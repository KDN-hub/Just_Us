// ============================================================
//  Just Us — Sync engine (Phase 1)
//
//  UI  <-  Dexie (local DB)  <-  this module  <->  Supabase  <->  Postgres
//
//  Two jobs, both background-only (never block a render):
//   1. syncConversation()      — cursor-based delta pull from Postgres
//   2. sendLocalMessage()      — save locally, push to Postgres, in order
//      flushPendingMessages()  — retry anything still pending/failed
//
//  Phase 3 will own the reconnect loop (backoff, visibility, socket
//  events); this module only exposes the primitives it will call.
// ============================================================

import { supabase } from "@/lib/supabase";
import {
  getCursor,
  listPendingLocalMessages,
  markMessageFailed,
  markMessageSent,
  mergeRemoteMessages,
  saveLocalMessage,
  setCursor,
  setLastSyncedAt,
  type LocalMessage,
  type NewLocalMessage,
  type SupabaseMessageRow,
} from "@/lib/db";

const SYNC_BATCH = 500;      // rows per delta fetch
const RECENT_WINDOW = 50;    // rows refreshed on every sync (catches missed receipts)
const MESSAGE_COLUMNS = "id, conversation_id, sender_id, content, type, status, created_at";

// ── Delta sync ──────────────────────────────────────────────

async function selectRows(
  conversationId: string,
  options: { gte?: string; lt?: string; newestFirst?: boolean; limit: number },
): Promise<SupabaseMessageRow[]> {
  let query = supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("conversation_id", conversationId);

  if (options.gte) query = query.gte("created_at", options.gte);
  if (options.lt) query = query.lt("created_at", options.lt);

  const { data, error } = await query
    .order("created_at", { ascending: !options.newestFirst })
    .limit(options.limit);

  if (error) throw new Error(`message fetch failed: ${error.message}`);
  return (data ?? []) as unknown as SupabaseMessageRow[];
}

function newestCreatedAt(rows: SupabaseMessageRow[]): string | null {
  let newest: string | null = null;
  for (const row of rows) {
    const at = row.created_at ?? null;
    if (at && (!newest || at > newest)) newest = at;
  }
  return newest;
}

let syncInFlight: Promise<void> | null = null;

/**
 * Pull everything newer than meta.cursor from Postgres and merge it into Dexie.
 * Coalesced: concurrent callers share one in-flight run.
 */
export function syncConversation(conversationId: string): Promise<void> {
  if (!syncInFlight) {
    syncInFlight = doSync(conversationId).finally(() => {
      syncInFlight = null;
    });
  }
  return syncInFlight;
}

async function doSync(conversationId: string): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  try {
    const cursor = await getCursor(conversationId);

    if (!cursor) {
      // First run on this device: backfill the most recent messages only.
      const recent = await selectRows(conversationId, { newestFirst: true, limit: RECENT_WINDOW });
      await mergeRemoteMessages(recent);
      const newest = newestCreatedAt(recent);
      if (newest) await setCursor(conversationId, newest);
      await setLastSyncedAt(conversationId, new Date().toISOString());
      return;
    }

    // Refresh the latest window on every sync so read/delivered receipts
    // missed while offline are picked up (UPDATEs don't change created_at).
    const recent = await selectRows(conversationId, { newestFirst: true, limit: RECENT_WINDOW });
    await mergeRemoteMessages(recent);

    // Pull everything at-or-after the cursor, oldest first, in batches.
    // Re-fetching the boundary row is deliberate: merging by id is idempotent.
    let from = cursor;
    let newest = cursor;
    for (;;) {
      const batch = await selectRows(conversationId, { gte: from, limit: SYNC_BATCH });
      await mergeRemoteMessages(batch);
      if (batch.length === 0) break;

      const batchNewest = newestCreatedAt(batch) ?? from;
      if (batchNewest > newest) newest = batchNewest;
      if (batch.length < SYNC_BATCH) break;
      if (batchNewest <= from) break; // stuck on a timestamp boundary — merge already deduped
      from = batchNewest;
    }

    if (newest > cursor) await setCursor(conversationId, newest);
    await setLastSyncedAt(conversationId, new Date().toISOString());
  } catch (err) {
    // Background sync is best-effort; realtime + the next sync will catch up.
    console.error("[sync] delta sync failed:", err);
  }
}

// ── Outgoing messages ───────────────────────────────────────

let sendChain: Promise<void> = Promise.resolve();

/**
 * Idempotent push of one local message. If the same UUID already exists in
 * Postgres (a retry after an uncertain failure, or two devices flushing the
 * same queue), ignoreDuplicates turns the conflict into a no-op.
 */
export async function sendPendingMessage(message: LocalMessage): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return; // stays pending

  const row = {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    type: message.type,
    content: message.body,
    status: "sent",
  };

  let { data, error } = await supabase
    .from("messages")
    .upsert(row, { onConflict: "id", ignoreDuplicates: true })
    .select("created_at");

  // Fallback for databases whose messages_type_check predates migration 010.
  if (error && error.code === "23514" && message.type === "sticker") {
    const fallback = await supabase
      .from("messages")
      .upsert(
        { ...row, type: "text", content: `STICKER:${message.body}` },
        { onConflict: "id", ignoreDuplicates: true },
      )
      .select("created_at");
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("[sync] send failed:", error.message);
    await markMessageFailed(message.id);
    return;
  }

  const inserted = (data ?? []) as { created_at?: string | null }[];
  await markMessageSent(message.id, inserted[0]?.created_at ?? null);
}

/**
 * Save an outgoing message to Dexie (instant UI, status 'pending') and push
 * it to Postgres in the background. Sends are chained so server timestamps
 * keep the same order as the local ones.
 */
export async function sendLocalMessage(input: NewLocalMessage): Promise<LocalMessage> {
  const local = await saveLocalMessage(input);
  sendChain = sendChain.then(() => sendPendingMessage(local)).catch(() => {});
  return local;
}

// ── Retry ───────────────────────────────────────────────────

let flushInFlight: Promise<void> | null = null;

/** Retry every pending/failed local message, oldest first. Coalesced. */
export function flushPendingMessages(conversationId: string, senderId: string): Promise<void> {
  if (!flushInFlight) {
    flushInFlight = doFlush(conversationId, senderId).finally(() => {
      flushInFlight = null;
    });
  }
  return flushInFlight;
}

async function doFlush(conversationId: string, senderId: string): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const pending = await listPendingLocalMessages(conversationId, senderId);
  for (const message of pending) {
    if (typeof navigator !== "undefined" && !navigator.onLine) break;
    await sendPendingMessage(message);
  }
}
