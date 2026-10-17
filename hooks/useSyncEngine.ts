"use client";

// ============================================================
//  useSyncEngine — starts the background network work.
//
//  Mount: kick a delta sync + push any pending sends (the chat
//  screen renders from Dexie meanwhile — never waits on this).
//  Online: connection came back → sync + flush the queue.
//
//  Phase 3 replaces the event wiring with a reconnect manager
//  (socket reconnect, visibilitychange, exponential backoff).
// ============================================================

import { useEffect } from "react";
import { flushPendingMessages, syncConversation } from "@/lib/sync";

export function useSyncEngine(conversationId: string, myId: string): void {
  useEffect(() => {
    if (!myId) return;

    const kick = () => {
      void syncConversation(conversationId);
      void flushPendingMessages(conversationId, myId);
    };

    kick();

    window.addEventListener("online", kick);
    return () => window.removeEventListener("online", kick);
  }, [conversationId, myId]);
}
