"use client";

// ============================================================
//  useSyncEngine — starts the background network work.
//
//  Mount: kick a delta sync + drain the outbox + ask for
//  persistent storage (the chat screen renders from Dexie
//  meanwhile — never waits on any of this).
//  Online: connection came back → sync + drain the queue.
//  Visible again: sync if the last one is older than 30s.
//  While open + visible: one slow safety sync per minute —
//  a mobile socket can die without any event; Postgres is the
//  recovery source of truth.
//
//  Socket-level reconnect is owned by lib/realtime; this hook
//  only decides when data is (re)pulled.
// ============================================================

import { useEffect } from "react";
import { useChatStore } from "@/hooks/useChatStore";
import { requestPersistentStorage } from "@/lib/pwa";
import { drainOutbox, syncConversation } from "@/lib/sync";

const VISIBILITY_SYNC_MS = 30_000;
const SAFETY_SYNC_MS = 60_000;

export function useSyncEngine(conversationId: string, myId: string): void {
  useEffect(() => {
    // Phase 4: durable storage for IndexedDB (all messages live there). Fire-and-forget.
    void requestPersistentStorage();

    if (!myId) return;

    let lastKickAt = 0;

    const kick = () => {
      lastKickAt = Date.now();
      void syncConversation(conversationId);
      void drainOutbox(conversationId, myId);
    };

    const goOnline = () => {
      useChatStore.getState().setIsOnline(true);
      kick();
    };

    const goOffline = () => {
      useChatStore.getState().setIsOnline(false);
    };

    const onVisibility = () => {
      if (document.hidden) return;
      if (Date.now() - lastKickAt > VISIBILITY_SYNC_MS) kick();
    };

    kick();

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", onVisibility);

    const safetyInterval = setInterval(() => {
      if (!document.hidden && navigator.onLine && Date.now() - lastKickAt >= SAFETY_SYNC_MS) {
        kick();
      }
    }, SAFETY_SYNC_MS);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(safetyInterval);
    };
  }, [conversationId, myId]);
}
