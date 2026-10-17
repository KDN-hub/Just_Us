// ============================================================
//  Just Us — Receipt queue (Phase 3)
//
//  Batches "delivered" (device received the message) and
//  "read" (bubble was actually visible in the viewport) receipts
//  for partner messages, and keeps the local Dexie rows in sync
//  so the UI and the unread queries agree immediately.
//
//  Network writes are best-effort: a failed flush puts the ids
//  back and waits for the next `online` event / visibility
//  change instead of hammering the server.
// ============================================================

import { supabase } from "@/lib/supabase";
import { markLocalMessagesStatus } from "@/lib/db";

const FLUSH_DELAY_MS = 250;

const deliveredQueue = new Set<string>();
const readQueue = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

function attachListeners(): void {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  window.addEventListener("online", () => {
    if (readQueue.size > 0 || deliveredQueue.size > 0) scheduleFlush();
  });
}

/** Device received these partner messages — sender should see 2 ticks. */
export function queueDeliveredReceipt(ids: string[]): void {
  if (ids.length === 0) return;
  for (const id of ids) {
    if (readQueue.has(id)) continue; // already heading to "read"
    deliveredQueue.add(id);
  }
  void markLocalMessagesStatus(ids, "delivered");
  attachListeners();
  scheduleFlush();
}

/** These partner messages were actually seen — sender should see wine ticks. */
export function queueReadReceipt(ids: string[]): void {
  if (ids.length === 0) return;
  for (const id of ids) {
    readQueue.add(id);
    deliveredQueue.delete(id);
  }
  void markLocalMessagesStatus(ids, "read");
  attachListeners();
  scheduleFlush();
}

/** Send everything queued right now (tab hidden, screen unmount). */
export function flushReceipts(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const readIds = Array.from(readQueue);
  const deliveredIds = Array.from(deliveredQueue);
  readQueue.clear();
  deliveredQueue.clear();

  if (readIds.length > 0) {
    supabase
      .from("messages")
      .update({ status: "read" })
      .in("id", readIds)
      .then(({ error }) => {
        if (error) {
          console.error("[receipts] mark-as-read failed:", error.message);
          for (const id of readIds) readQueue.add(id); // retried on the next flush trigger
        }
      });
  }

  if (deliveredIds.length > 0) {
    supabase
      .from("messages")
      .update({ status: "delivered" })
      .in("id", deliveredIds)
      .eq("status", "sent") // never downgrade a receipt that already reached "read"
      .then(({ error }) => {
        if (error) {
          console.error("[receipts] mark-as-delivered failed:", error.message);
          for (const id of deliveredIds) deliveredQueue.add(id);
        }
      });
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushReceipts();
  }, FLUSH_DELAY_MS);
}
