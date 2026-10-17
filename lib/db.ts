// ============================================================
//  Just Us — Local-first data layer (Dexie / IndexedDB)
//
//  The UI only ever reads messages from here (via useLiveQuery).
//  Supabase is the source of truth for recovery; this DB is the
//  source of truth for rendering.
//
//  Idempotency rule: the message `id` is a client-generated UUID
//  and is the primary key both locally and in Postgres, so retries
//  can never create duplicates.
// ============================================================

import Dexie, { type Table } from "dexie";

/** 'pending' and 'failed' are local-only; Postgres only knows sent/delivered/read. */
export type LocalMessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface LocalMessage {
  id: string;             // client-generated UUID — primary key everywhere
  conversation_id: string;
  sender_id: string;
  body: string;           // maps to the `content` column in Postgres
  type: string;           // 'text' | 'image' | 'sticker' | ...
  created_at: string;     // ISO timestamp; replaced with the server value once confirmed
  status: LocalMessageStatus;
}

/** Outgoing-operation queue. Written by the sync engine, drained in Phase 2. */
export interface OutboxEntry {
  id?: number;
  message_id: string;
  created_at: string;
  attempts: number;
  next_attempt_at: number; // epoch ms
  last_error: string | null;
}

/** Small key/value table for sync bookkeeping (`cursor:<conv>`, `last_synced_at:<conv>`). */
export interface MetaEntry {
  key: string;
  value: string;
  updated_at: string;
}

/** Shape of a row returned by `select(...)` on the Postgres `messages` table. */
export interface SupabaseMessageRow {
  id: string;
  conversation_id?: string | null;
  sender_id?: string | null;
  content?: string | null;
  type?: string | null;
  status?: string | null;
  created_at?: string | null;
}

export interface NewLocalMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  type: string;
}

class JustUsDB extends Dexie {
  messages!: Table<LocalMessage, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super("just-us");
    this.version(1).stores({
      // The compound index gives the chat timeline sorted by created_at
      // for one conversation, straight out of IndexedDB.
      messages: "&id, conversation_id, created_at, [conversation_id+created_at], status",
      outbox: "++id, message_id, next_attempt_at",
      meta: "&key",
    });
  }
}

// `new Dexie()` does not touch IndexedDB; the store opens on first query,
// which only ever happens inside useLiveQuery (client) or the sync engine.
export const db = new JustUsDB();

// ── Status ordering ─────────────────────────────────────────
// When local and remote copies of a message disagree, the higher
// rank wins — a status never moves backwards.
const STATUS_RANK: Record<LocalMessageStatus, number> = {
  failed: 0,
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export function higherStatus(a: LocalMessageStatus, b: LocalMessageStatus): LocalMessageStatus {
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a;
}

function normalizeRemoteStatus(status: string | null | undefined): LocalMessageStatus {
  if (status === "delivered" || status === "read") return status;
  return "sent";
}

export function fromSupabaseRow(row: SupabaseMessageRow): LocalMessage {
  return {
    id: row.id,
    conversation_id: row.conversation_id ?? "",
    sender_id: row.sender_id ?? "",
    body: row.content ?? "",
    type: row.type ?? "text",
    created_at: row.created_at ?? new Date().toISOString(),
    status: normalizeRemoteStatus(row.status),
  };
}

// ── Message reads ───────────────────────────────────────────

export function getLocalMessage(id: string): Promise<LocalMessage | undefined> {
  return db.messages.get(id);
}

export function getOldestLocalMessage(conversationId: string): Promise<LocalMessage | undefined> {
  return db.messages
    .where("[conversation_id+created_at]")
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .first();
}

export function listUnreadFromPartner(conversationId: string, partnerId: string): Promise<LocalMessage[]> {
  return db.messages
    .where("[conversation_id+created_at]")
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .filter((m) => m.sender_id === partnerId && m.status !== "read")
    .toArray();
}

/** Newest EDIT:<targetId>:... body for a message, or null if it was never edited. */
export async function getLatestEditContent(conversationId: string, targetId: string): Promise<string | null> {
  const edits = await db.messages
    .where("[conversation_id+created_at]")
    .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
    .filter((m) => m.type === "text" && m.body.startsWith(`EDIT:${targetId}:`))
    .toArray();
  if (edits.length === 0) return null;
  edits.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return edits[edits.length - 1].body.split(":").slice(2).join(":");
}

/** Messages still waiting to reach Postgres (Phase 2 drains these with backoff). */
export function listPendingLocalMessages(conversationId: string, senderId: string): Promise<LocalMessage[]> {
  return db.messages
    .where("status")
    .anyOf("pending", "failed")
    .filter((m) => m.conversation_id === conversationId && m.sender_id === senderId)
    .sortBy("created_at");
}

// ── Message writes ──────────────────────────────────────────

/** Write an outgoing message locally (appears instantly) with status 'pending'. */
export async function saveLocalMessage(input: NewLocalMessage): Promise<LocalMessage> {
  const message: LocalMessage = {
    ...input,
    created_at: new Date().toISOString(),
    status: "pending",
  };
  await db.messages.put(message);
  return message;
}

/**
 * Upsert remote rows by id. Remote content/timestamps win (Postgres is the
 * source of truth); status only ever moves forwards.
 */
export async function mergeRemoteMessages(rows: SupabaseMessageRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.transaction("rw", db.messages, async () => {
    for (const row of rows) {
      const remote = fromSupabaseRow(row);
      const existing = await db.messages.get(row.id);
      if (!existing) {
        await db.messages.put(remote);
        continue;
      }
      await db.messages.put({
        ...existing,
        ...remote,
        status: higherStatus(existing.status, remote.status),
      });
    }
  });
}

/** pending/failed → sent, without downgrading a status the server already confirmed. */
export async function markMessageSent(id: string, serverCreatedAt: string | null): Promise<void> {
  const existing = await db.messages.get(id);
  if (!existing) return;
  const patch: Partial<LocalMessage> = {};
  if (STATUS_RANK[existing.status] <= STATUS_RANK.pending) patch.status = "sent";
  if (serverCreatedAt) patch.created_at = serverCreatedAt;
  if (Object.keys(patch).length > 0) await db.messages.update(id, patch);
}

export async function markMessageFailed(id: string): Promise<void> {
  const existing = await db.messages.get(id);
  if (!existing) return;
  if (STATUS_RANK[existing.status] <= STATUS_RANK.pending) {
    await db.messages.update(id, { status: "failed" });
  }
}

/** Forward-only local status bump (used by the receipt queue). */
export async function markLocalMessagesStatus(ids: string[], status: LocalMessageStatus): Promise<void> {
  if (ids.length === 0) return;
  await db.transaction("rw", db.messages, async () => {
    for (const id of ids) {
      const message = await db.messages.get(id);
      if (!message) continue;
      if (STATUS_RANK[status] > STATUS_RANK[message.status]) {
        await db.messages.update(id, { status });
      }
    }
  });
}

/** Back to the clock icon while a manual retry is in flight. */
export async function markMessagePending(id: string): Promise<void> {
  await db.messages.update(id, { status: "pending" });
}

// ── Outbox ──────────────────────────────────────────────────

/** Add a message to the send queue. Idempotent: one entry per message. */
export async function enqueueOutbox(messageId: string): Promise<void> {
  await db.transaction("rw", db.outbox, async () => {
    const existing = await db.outbox.where("message_id").equals(messageId).first();
    if (existing) return;
    await db.outbox.add({
      message_id: messageId,
      created_at: new Date().toISOString(),
      attempts: 0,
      next_attempt_at: Date.now(),
      last_error: null,
    });
  });
}

/** Entries in send order (all start due; ties break by insertion id). */
export function listOutbox(): Promise<OutboxEntry[]> {
  return db.outbox.orderBy("next_attempt_at").toArray();
}

export function getOutboxForMessage(messageId: string): Promise<OutboxEntry | undefined> {
  return db.outbox.where("message_id").equals(messageId).first();
}

export async function updateOutbox(id: number, patch: Partial<OutboxEntry>): Promise<void> {
  await db.outbox.update(id, patch);
}

export async function removeOutbox(id: number): Promise<void> {
  await db.outbox.delete(id);
}

// ── Meta (sync cursor) ──────────────────────────────────────

async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value, updated_at: new Date().toISOString() });
}

async function getMeta(key: string): Promise<string | null> {
  const entry = await db.meta.get(key);
  return entry?.value ?? null;
}

export function getCursor(conversationId: string): Promise<string | null> {
  return getMeta(`cursor:${conversationId}`);
}

export function setCursor(conversationId: string, cursor: string): Promise<void> {
  return setMeta(`cursor:${conversationId}`, cursor);
}

export function getLastSyncedAt(conversationId: string): Promise<string | null> {
  return getMeta(`last_synced_at:${conversationId}`);
}

export function setLastSyncedAt(conversationId: string, at: string): Promise<void> {
  return setMeta(`last_synced_at:${conversationId}`, at);
}

/** Debug helper: wipe the local database (next sync re-backfills from Postgres). */
export async function clearLocalData(): Promise<void> {
  await db.transaction("rw", db.messages, db.outbox, db.meta, async () => {
    await db.messages.clear();
    await db.outbox.clear();
    await db.meta.clear();
  });
}
