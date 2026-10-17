// ============================================================
//  Just Us — Realtime connection manager (Phase 3)
//
//  One channel does everything for the chat feature:
//    • postgres_changes: messages / users / call_log
//    • broadcast: call offer + hangup, typing, nudge
//  (The /call screen still opens its own channel on the same
//   topic while a call is on screen — untouched. GlobalOverlay
//   keeps its own separate "chat_signal" topic.)
//
//  This module owns the reconnect loop: on CHANNEL_ERROR /
//  TIMED_OUT / CLOSED it tears the channel down and re-creates
//  it with exponential backoff + jitter. `online` and coming
//  back to a visible tab also trigger an immediate attempt.
//  (supabase-js re-joins on its own too; the watchdog is the
//  belt-and-braces for the cases where it gets stuck.)
//
//  Consumers:
//    subscribeRealtimeHandlers({ ... })  — reaction to events
//    sendRealtimeBroadcast(event, data)  — typing/nudge/declined
//    startRealtime / stopRealtime        — lifecycle (chat screen)
// ============================================================

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SupabaseMessageRow } from "@/lib/db";
import type { CallLogEntry, UserRow } from "@/hooks/useChatStore";

export type RealtimeStatus = "offline" | "connecting" | "connected" | "reconnecting";

export interface OfferPayload {
  sdp: RTCSessionDescriptionInit;
  callType?: "voice" | "video";
  callerId: string;
}

export interface TypingPayload {
  userId: string;
  isTyping: boolean;
}

export interface NudgePayload {
  userId: string;
  userName?: string;
}

export interface RealtimeHandlers {
  onMessageInsert?(row: SupabaseMessageRow): void;
  onMessageUpdate?(row: SupabaseMessageRow): void;
  onPartnerUpdate?(row: Partial<UserRow>): void;
  onCallLog?(row: CallLogEntry, eventType: "INSERT" | "UPDATE"): void;
  onOffer?(payload: OfferPayload): void;
  onHangup?(): void;
  onTyping?(payload: TypingPayload): void;
  onNudge?(payload: NudgePayload): void;
  onStatusChange?(status: RealtimeStatus): void;
}

const CONNECT_BASE_MS = 1_000;
const CONNECT_MAX_MS = 30_000;

const handlerSets = new Set<RealtimeHandlers>();

let channel: RealtimeChannel | null = null;
let activeConversationId: string | null = null;
let activePartnerId: string | null = null;
let status: RealtimeStatus = "offline";
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let restarting = false;
let globalListenersAttached = false;

export function getRealtimeStatus(): RealtimeStatus {
  return status;
}

/** Fire-and-forget broadcast on the shared channel. No-op if not joined yet. */
export function sendRealtimeBroadcast(event: string, payload: Record<string, unknown>): void {
  if (!channel) return;
  void channel.send({ type: "broadcast", event, payload }).catch(() => {});
}

/** Register one handler bundle. Returns the unsubscribe function. */
export function subscribeRealtimeHandlers(handlers: RealtimeHandlers): () => void {
  handlerSets.add(handlers);
  return () => {
    handlerSets.delete(handlers);
  };
}

function dispatch<K extends keyof RealtimeHandlers>(
  key: K,
  ...args: Parameters<NonNullable<RealtimeHandlers[K]>>
): void {
  handlerSets.forEach((handlers) => {
    const handler = handlers[key] as
      | ((...a: Parameters<NonNullable<RealtimeHandlers[K]>>) => void)
      | undefined;
    if (!handler) return;
    try {
      handler(...args);
    } catch (err) {
      console.error(`[realtime] ${String(key)} handler failed:`, err);
    }
  });
}

function setStatus(next: RealtimeStatus): void {
  if (status === next) return;
  status = next;
  dispatch("onStatusChange", next);
}

// ── Reconnect loop ──────────────────────────────────────────

function reconnectDelay(): number {
  const base = Math.min(CONNECT_MAX_MS, CONNECT_BASE_MS * 2 ** Math.max(0, reconnectAttempts - 1));
  reconnectAttempts += 1;
  return Math.round(base * (0.8 + Math.random() * 0.4)); // ±20% jitter
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  if (!activeConversationId || reconnectTimer) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return; // wait for the online event
  const delay = reconnectDelay();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void restartChannel();
  }, delay);
}

async function restartChannel(): Promise<void> {
  if (restarting || !activeConversationId) return;
  restarting = true;
  try {
    const old = channel;
    channel = null; // stale-channel guard: callbacks from `old` are ignored
    if (old) {
      try {
        await supabase.removeChannel(old);
      } catch (err) {
        console.error("[realtime] removeChannel failed:", err);
      }
    }
    if (!activeConversationId) return; // stopped while tearing down
    setStatus("connecting");
    createChannel(activeConversationId, activePartnerId);
  } finally {
    restarting = false;
  }
}

// ── Channel ────────────────────────────────────────────────

function createChannel(conversationId: string, partnerId: string | null): void {
  const ch = supabase
    .channel(`call-signal-${conversationId}`, {
      config: { broadcast: { self: false }, private: true },
    })
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => dispatch("onMessageInsert", payload.new as SupabaseMessageRow),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => dispatch("onMessageUpdate", payload.new as SupabaseMessageRow),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "users", filter: partnerId ? `id=eq.${partnerId}` : undefined },
      (payload) => dispatch("onPartnerUpdate", payload.new as Partial<UserRow>),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "call_log", filter: `conversation_id=eq.${conversationId}` },
      (payload) => dispatch("onCallLog", payload.new as CallLogEntry, "INSERT"),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "call_log", filter: `conversation_id=eq.${conversationId}` },
      (payload) => dispatch("onCallLog", payload.new as CallLogEntry, "UPDATE"),
    )
    .on("broadcast", { event: "offer" }, ({ payload }) => {
      dispatch("onOffer", payload as unknown as OfferPayload);
    })
    .on("broadcast", { event: "hangup" }, () => {
      dispatch("onHangup");
    })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      dispatch("onTyping", payload as unknown as TypingPayload);
    })
    .on("broadcast", { event: "nudge" }, ({ payload }) => {
      dispatch("onNudge", payload as unknown as NudgePayload);
    });

  channel = ch;
  ch.subscribe((subscribeStatus) => {
    if (channel !== ch) return; // an old incarnation — ignore
    if (subscribeStatus === "SUBSCRIBED") {
      reconnectAttempts = 0;
      clearReconnectTimer();
      setStatus("connected");
    } else if (
      subscribeStatus === "CHANNEL_ERROR" ||
      subscribeStatus === "TIMED_OUT" ||
      subscribeStatus === "CLOSED"
    ) {
      setStatus("reconnecting");
      scheduleReconnect();
    }
  });
}

// ── Lifecycle ──────────────────────────────────────────────

function onWindowOnline(): void {
  if (!activeConversationId) return;
  if (status === "connected" || status === "connecting") return; // join already in progress
  reconnectAttempts = 0;
  clearReconnectTimer();
  void restartChannel();
}

function onWindowOffline(): void {
  if (!activeConversationId) return;
  clearReconnectTimer();
  setStatus("offline");
}

function onVisibility(): void {
  if (document.visibilityState !== "visible") return;
  onWindowOnline();
}

function attachGlobalListeners(): void {
  if (globalListenersAttached || typeof window === "undefined") return;
  globalListenersAttached = true;
  window.addEventListener("online", onWindowOnline);
  window.addEventListener("offline", onWindowOffline);
  document.addEventListener("visibilitychange", onVisibility);
}

function detachGlobalListeners(): void {
  if (!globalListenersAttached) return;
  globalListenersAttached = false;
  window.removeEventListener("online", onWindowOnline);
  window.removeEventListener("offline", onWindowOffline);
  document.removeEventListener("visibilitychange", onVisibility);
}

/**
 * Open (or keep) the shared channel. Idempotent: calling it again while
 * already connected to the same conversation is a no-op.
 */
export function startRealtime(conversationId: string, partnerId: string | null): void {
  if (channel && activeConversationId === conversationId) return;
  const wasActive = activeConversationId !== null;
  activeConversationId = conversationId;
  activePartnerId = partnerId;
  attachGlobalListeners();
  if (wasActive) {
    // Switching conversations: tear the old channel down first.
    void restartChannel();
  } else {
    setStatus("connecting");
    createChannel(conversationId, partnerId);
  }
}

/** Close the channel and stop the reconnect loop (chat screen unmounted). */
export function stopRealtime(): void {
  activeConversationId = null;
  activePartnerId = null;
  reconnectAttempts = 0;
  clearReconnectTimer();
  detachGlobalListeners();
  const old = channel;
  channel = null;
  setStatus("offline");
  if (old) {
    void supabase.removeChannel(old).catch((err) => {
      console.error("[realtime] removeChannel failed:", err);
    });
  }
}
