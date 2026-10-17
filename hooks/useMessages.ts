"use client";

// ============================================================
//  useMessages — the chat UI's only message source.
//
//  Reads straight from Dexie via useLiveQuery and maps local
//  rows into the UI message shape. It never awaits a Supabase
//  fetch, so the first paint after app open is always local.
// ============================================================

import { useMemo } from "react";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type LocalMessage } from "@/lib/db";
import type { Message } from "@/hooks/useChatStore";

export interface MessagesView {
  /** UI-shaped messages, oldest first. Empty until Dexie resolves. */
  messages: Message[];
  /** False until the first IndexedDB read completes (used to avoid empty-state flashes). */
  ready: boolean;
}

function toChatMessage(local: LocalMessage): Message {
  const isWaiting = local.status === "pending" || local.status === "failed";

  // The bubble shows a clock while waiting, a tap-to-retry icon when failed,
  // and the tick indicator once the message has been accepted.
  let status: Message["status"] = "sent";
  if (local.status === "delivered" || local.status === "read") status = local.status;

  return {
    id: local.id,
    sender_id: local.sender_id,
    content: local.body,
    type: local.type,
    status,
    created_at: local.created_at,
    pending: isWaiting,
    queued: local.status === "pending",
    failed: local.status === "failed",
  };
}

export function useMessages(conversationId: string): MessagesView {
  const rows = useLiveQuery(
    () =>
      db.messages
        .where("[conversation_id+created_at]")
        .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
        .toArray(),
    [conversationId],
  );

  const messages = useMemo(() => (rows ?? []).map(toChatMessage), [rows]);

  return { messages, ready: rows !== undefined };
}
