// ============================================================
//  Just Us — Sync engine (Phases 1–2)
//
//  UI  <-  Dexie (local DB)  <-  this module  <->  Supabase  <->  Postgres
//
//  Two jobs, both background-only (never block a render):
//   1. syncConversation()  — cursor-based delta pull from Postgres
//   2. sendLocalMessage()   — save locally, queue in the outbox, drain
//      drainOutbox()         — idempotent push with exponential backoff
//      retryOutboxMessage()  — tap-to-retry from the bubble UI
//
//  Phase 3 will own the reconnect loop (backoff, visibility, socket
//  events); this module only exposes the primitives it will call.
// ============================================================

import { supabase } from "@/lib/supabase";
import {
  enqueueOutbox,
  getCursor,
  getLocalMessage,
  getOutboxForMessage,
  listOutbox,
  listPendingLocalMessages,
  markMessageFailed,
  markMessagePending,
  markMessageSent,
  mergeRemoteMessages,
  removeOutbox,
  saveLocalMessage,
  setCursor,
  setLastSyncedAt,
  updateOutbox,
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

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * One idempotent push attempt for a local message. If the same UUID already
 * exists in Postgres (retry after an uncertain failure, or another device
 * flushing the same queue), ignoreDuplicates turns the conflict into a no-op.
 */
export async function sendPendingMessage(message: LocalMessage): Promise<SendResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, error: "offline" }; // stays pending, not failed
  }

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
    return { ok: false, error: error.message };
  }

  const inserted = (data ?? []) as { created_at?: string | null }[];
  await markMessageSent(message.id, inserted[0]?.created_at ?? null);
  return { ok: true };
}

/**
 * Save an outgoing message to Dexie (instant UI, status 'pending'), queue it
 * in the outbox, and kick the drain loop. Nothing here waits on the network.
 */
export async function sendLocalMessage(input: NewLocalMessage): Promise<LocalMessage> {
  const local = await saveLocalMessage(input);
  await enqueueOutbox(local.id);
  void drainOutbox(local.conversation_id, local.sender_id);
  return local;
}

// ── Outbox drain (exponential backoff + jitter) ─────────────

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function backoffDelay(attempts: number): number {
  const base = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  return Math.round(base * (0.8 + Math.random() * 0.4)); // ±20% jitter
}

let drainInFlight = false;
let drainAgain = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAt = 0;

function scheduleRetry(delayMs: number, conversationId: string, senderId: string): void {
  const at = Date.now() + delayMs;
  if (retryTimer && retryAt <= at) return; // an earlier retry is already booked
  if (retryTimer) clearTimeout(retryTimer);
  retryAt = at;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    retryAt = 0;
    void drainOutbox(conversationId, senderId);
  }, delayMs);
}

/**
 * Push everything in the outbox that is due, oldest first, and book a retry
 * timer for entries still in backoff. Coalesced and safe to call from
 * anywhere: a fresh send, the online event, visibility, or a socket reconnect.
 */
export async function drainOutbox(conversationId: string, senderId: string): Promise<void> {
  if (drainInFlight) {
    drainAgain = true;
    return;
  }
  drainInFlight = true;
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    await reconcileOutbox(conversationId, senderId);

    const nextDue = await pushDueEntries();
    if (nextDue !== Infinity) scheduleRetry(nextDue, conversationId, senderId);
  } finally {
    drainInFlight = false;
    if (drainAgain) {
      drainAgain = false;
      void drainOutbox(conversationId, senderId);
    }
  }
}

/**
 * Safety net: pending/failed rows without an outbox entry (written before the
 * outbox existed, or a crash between the two writes) get queued again.
 */
async function reconcileOutbox(conversationId: string, senderId: string): Promise<void> {
  const waiting = await listPendingLocalMessages(conversationId, senderId);
  if (waiting.length === 0) return;

  const entries = await listOutbox();
  const covered = new Set(entries.map((entry) => entry.message_id));
  for (const message of waiting) {
    if (!covered.has(message.id)) await enqueueOutbox(message.id);
  }
}

/** One pass over the queue. Returns ms until the next due entry, or Infinity. */
async function pushDueEntries(): Promise<number> {
  const entries = await listOutbox();
  let nextDue = Infinity;

  for (const entry of entries) {
    if (entry.id === undefined) continue;

    const dueIn = entry.next_attempt_at - Date.now();
    if (dueIn > 0) {
      nextDue = Math.min(nextDue, dueIn);
      continue;
    }

    const message = await getLocalMessage(entry.message_id);
    if (!message) {
      await removeOutbox(entry.id); // orphaned entry
      continue;
    }
    if (message.status !== "pending" && message.status !== "failed") {
      await removeOutbox(entry.id); // already confirmed (e.g. realtime echo arrived first)
      continue;
    }

    const result = await sendPendingMessage(message);
    if (result.ok) {
      await removeOutbox(entry.id);
      continue;
    }

    const attempts = entry.attempts + 1;
    const delay = backoffDelay(attempts);
    await updateOutbox(entry.id, {
      attempts,
      next_attempt_at: Date.now() + delay,
      last_error: result.error ?? "unknown",
    });
    nextDue = Math.min(nextDue, delay);

    if (typeof navigator !== "undefined" && !navigator.onLine) break; // no point hammering
  }

  return nextDue;
}

/** Tap-to-retry: reset the entry's backoff and attempt it again right now. */
export async function retryOutboxMessage(
  messageId: string,
  conversationId: string,
  senderId: string,
): Promise<void> {
  await markMessagePending(messageId);
  await enqueueOutbox(messageId);

  const entry = await getOutboxForMessage(messageId);
  if (entry?.id !== undefined) {
    await updateOutbox(entry.id, { attempts: 0, next_attempt_at: Date.now(), last_error: null });
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
    retryAt = 0;
  }
  await drainOutbox(conversationId, senderId);
}
