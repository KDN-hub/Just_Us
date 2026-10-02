"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, Video, Send, PhoneIncoming, PhoneOff, Settings } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import MessageBubble from "@/components/MessageBubble";
import CallBubble from "@/components/CallBubble";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageStatus = "sent" | "delivered" | "read";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  type: string;
  status: MessageStatus;
  created_at: string;
  /** Optimistic message not yet confirmed by the server (its created_at is a local placeholder). */
  pending?: boolean;
}

interface CallLogEntry {
  id: string;
  caller_id: string;
  type: "voice" | "video";
  status: "missed" | "answered" | "declined" | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

type TimelineItem =
  | { kind: "message"; data: Message; time: string }
  | { kind: "call"; data: CallLogEntry; time: string };

interface UserRow {
  id: string;
  name: string;
  nickname: string | null;
  avatar_color: string | null;
  is_online: boolean;
  last_seen: string | null;
}

interface IncomingCall {
  sdp: RTCSessionDescriptionInit;
  callType: "voice" | "video";
  callerId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONVERSATION_ID = "c0000000-0000-0000-0000-000000000003";
const SIGNAL_CHANNEL  = `call-signal-${CONVERSATION_ID}`;

const STATUS_RANK: Record<MessageStatus, number> = { sent: 0, delivered: 1, read: 2 };

/** Status can only move forward — protects against out-of-order realtime events. */
function higherStatus(a: MessageStatus, b: MessageStatus): MessageStatus {
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** Pure function of (last_seen, now) so it can be recomputed on a timer. */
function formatLastSeen(iso: string | null, now: number): string {
  if (!iso) return "Offline";
  const diff = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return "Last seen just now";
  if (diff < 3600) return `Last seen ${plural(Math.floor(diff / 60), "minute")} ago`;
  if (diff < 86400) return `Last seen ${plural(Math.floor(diff / 3600), "hour")} ago`;
  return `Last seen ${plural(Math.floor(diff / 86400), "day")} ago`;
}

function generateUUID(): string {
  // Mobile browsers block crypto.randomUUID over plain-HTTP LAN IPs
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Chat() {
  const router    = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const signalChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const prevCountRef = useRef(0);

  // ── Identity ─────────────────────────────────────────────────────────────
  const [myId] = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem("user_id") ?? "" : ""),
  );

  // ── Data state ────────────────────────────────────────────────────────────
  const [partner,      setPartner]      = useState<UserRow | null>(null);

  const [messages,     setMessages]     = useState<Message[]>([]);
  const [callLog,      setCallLog]      = useState<CallLogEntry[]>([]);
  const [draft,        setDraft]        = useState("");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  // Drives the live "Last seen X minutes ago" label (local clock tick only — no network)
  const [now,          setNow]          = useState<number>(() => Date.now());

  // ── Redirect if not set up / not logged in ────────────────────────────────
  useEffect(() => {
    const setupDone = localStorage.getItem("setup_complete");
    if (!myId || !setupDone) router.replace("/onboarding/welcome");
  }, [myId, router]);

  // ── Live "last seen" clock: recompute every 60 s ──────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── My own presence ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!myId) return;

    const setPresence = (online: boolean) => {
      supabase
        .from("users")
        .update({ is_online: online, last_seen: new Date().toISOString() })
        .eq("id", myId)
        .then(({ error }) => {
          if (error) console.error("[chat] presence update failed:", error.message);
        });
    };

    // The keepalive request below runs during page teardown, where an async
    // getSession() can't be awaited — so keep the user's access token in a variable.
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    let accessToken = anonKey;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) accessToken = data.session.access_token;
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      accessToken = session?.access_token ?? anonKey;
    });

    // On tab close / navigation the page may die before a normal request
    // completes; a keepalive request is allowed to outlive the page.
    const setOfflineOnExit = () => {
      const key = anonKey;
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?id=eq.${myId}`, {
        method: "PATCH",
        keepalive: true,
        headers: {
          apikey: key,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ is_online: false, last_seen: new Date().toISOString() }),
      }).catch(() => {});
    };

    const handleVisibility = () => setPresence(!document.hidden);

    setPresence(true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", setOfflineOnExit);

    return () => {
      authSub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", setOfflineOnExit);
      setPresence(false);
    };
  }, [myId]);

  // ── Realtime: ONE channel, ONE effect, ONE cleanup ────────────────────────
  // Handles: messages INSERT, messages UPDATE (read receipts), users UPDATE
  // (partner presence) and call_log INSERT/UPDATE.
  useEffect(() => {
    if (!myId) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let partnerId: string | null = null;

    // Mark every unread incoming message as read (single UPDATE, no refetch).
    const markPartnerMessagesRead = () => {
      if (!partnerId) return;
      supabase
        .from("messages")
        .update({ status: "read" })
        .eq("conversation_id", CONVERSATION_ID)
        .eq("sender_id", partnerId)
        .neq("status", "read")
        .then(({ error }) => {
          if (error) console.error("[chat] mark-as-read failed:", error.message);
        });
    };

    // Catch-up load. Runs only once the channel is SUBSCRIBED (so nothing can be
    // missed between "fetch" and "subscribe"), on re-subscribe after a dropped
    // connection, and when the app returns to the foreground. Results are MERGED
    // into state, never used to overwrite it. It is never run per-message.
    const resync = async () => {
      if (!partnerId) return;
      const [msgRes, callRes, partnerRes] = await Promise.all([
        supabase
          .from("messages")
          .select("id, sender_id, content, type, status, created_at")
          .eq("conversation_id", CONVERSATION_ID)
          .order("created_at", { ascending: true }),
        supabase
          .from("call_log")
          .select("id, caller_id, type, status, started_at, ended_at, duration_seconds")
          .eq("conversation_id", CONVERSATION_ID)
          .order("started_at", { ascending: true }),
        supabase
          .from("users")
          .select("id, name, nickname, avatar_color, is_online, last_seen")
          .eq("id", partnerId)
          .single(),
      ]);
      if (cancelled) return;

      if (msgRes.data) {
        const fetched = msgRes.data as Message[];
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          for (const m of fetched) {
            const existing = byId.get(m.id);
            byId.set(m.id, existing ? { ...m, status: higherStatus(existing.status, m.status) } : m);
          }
          return Array.from(byId.values());
        });
      }

      if (callRes.data) {
        const fetched = callRes.data as CallLogEntry[];
        setCallLog((prev) => {
          const byId = new Map(prev.map((c) => [c.id, c]));
          for (const c of fetched) byId.set(c.id, c);
          return Array.from(byId.values());
        });
      }

      if (partnerRes.data) {
        const p = partnerRes.data as UserRow;
        setPartner(p);
        setNow(Date.now());
        localStorage.setItem("partner_name",  p.nickname ?? p.name);
        localStorage.setItem("partner_color", p.avatar_color ?? "var(--wine)");
        localStorage.setItem("partner_id",    p.id);
      }

      // Opening / refocusing the chat = reading everything the partner sent
      if (!document.hidden) markPartnerMessagesRead();
    };

    const handleVisibility = () => {
      if (!document.hidden) resync();
    };

    async function bootstrap() {
      // Only the partner id is needed before subscribing (for the users filter).
      const { data: conv } = await supabase
        .from("conversation")
        .select("user_a_id, user_b_id")
        .eq("id", CONVERSATION_ID)
        .single();

      if (cancelled || !conv) return;

      partnerId = conv.user_a_id === myId ? conv.user_b_id : conv.user_a_id;


      channel = supabase
        .channel(`db-sync-${CONVERSATION_ID}`)

        // New messages → append straight to state (no refetch)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${CONVERSATION_ID}` },
          (payload) => {
            if (cancelled) return;
            const msg = payload.new as Message;
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id)
                // Our own optimistic message coming back: adopt the SERVER timestamp
                ? prev.map((m) =>
                    m.id === msg.id
                      ? { ...m, created_at: msg.created_at, status: higherStatus(m.status, msg.status), pending: false }
                      : m,
                  )
                : [...prev, msg],
            );

            // Incoming message: read if I'm looking at it, otherwise delivered
            if (msg.sender_id !== myId) {
              supabase
                .from("messages")
                .update({ status: document.hidden ? "delivered" : "read" })
                .eq("id", msg.id)
                .then(({ error }) => {
                  if (error) console.error("[chat] receipt update failed:", error.message);
                });
            }
          },
        )

        // Status changes (read receipts) → patch the message in place
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${CONVERSATION_ID}` },
          (payload) => {
            if (cancelled) return;
            const updated = payload.new as Message;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === updated.id ? { ...m, status: higherStatus(m.status, updated.status) } : m,
              ),
            );
          },
        )

        // Partner presence → only take the two presence fields from the payload
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${partnerId}` },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as Partial<UserRow>;
            setPartner((prev) =>
              prev
                ? {
                    ...prev,
                    is_online: row.is_online ?? prev.is_online,
                    last_seen: row.last_seen ?? prev.last_seen,
                  }
                : prev,
            );
            setNow(Date.now());
          },
        )

        // Call log
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_log", filter: `conversation_id=eq.${CONVERSATION_ID}` },
          (payload) => {
            if (cancelled) return;
            const entry = payload.new as CallLogEntry;
            setCallLog((prev) => (prev.some((c) => c.id === entry.id) ? prev : [...prev, entry]));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "call_log", filter: `conversation_id=eq.${CONVERSATION_ID}` },
          (payload) => {
            if (cancelled) return;
            const updated = payload.new as CallLogEntry;
            setCallLog((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          },
        )

        .subscribe((status, err) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setReconnecting(false);
            resync();
          } else if (status === "CHANNEL_ERROR") {
            console.error("[chat] Realtime CHANNEL_ERROR — will retry automatically.", err ?? "");
            setReconnecting(true);
          } else if (status === "TIMED_OUT") {
            console.warn("[chat] Realtime subscription timed out — will retry automatically.");
            setReconnecting(true);
          } else if (status === "CLOSED") {
            console.warn("[chat] Realtime channel closed.");
            setReconnecting(true);
          }
        });
    }

    document.addEventListener("visibilitychange", handleVisibility);
    bootstrap();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, [myId]);

  // ── Incoming call: subscribe to signaling channel ─────────────────────────
  useEffect(() => {
    if (!myId) return;

    const ch = supabase
      // private: only signed-in members can join (enforced by RLS on realtime.messages)
      .channel(SIGNAL_CHANNEL, { config: { broadcast: { self: false }, private: true } })
      .on("broadcast", { event: "offer" }, ({ payload }) => {
        if (payload.callerId && payload.callerId !== myId) {
          setIncomingCall({
            sdp:      payload.sdp as RTCSessionDescriptionInit,
            callType: (payload.callType as "voice" | "video") ?? "voice",
            callerId: payload.callerId as string,
          });
        }
      })
      .on("broadcast", { event: "hangup" }, () => {
        setIncomingCall(null);
      })
      .subscribe();

    signalChRef.current = ch;

    return () => { supabase.removeChannel(ch); };
  }, [myId]);

  // ── Auto-scroll when an item is appended (sent or received) ───────────────
  // Keyed on counts, not array identity, so tick/status updates don't yank the
  // user to the bottom while they are reading history.
  useEffect(() => {
    const count = messages.length + callLog.length;
    if (count === 0) return;
    bottomRef.current?.scrollIntoView({
      behavior: prevCountRef.current === 0 ? "auto" : "smooth",
      block: "end",
    });
    prevCountRef.current = count;
  }, [messages.length, callLog.length]);

  // ── Send message (optimistic UI) ──────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;

    setDraft("");

    const tempId = generateUUID();

    // The local timestamp is only a placeholder. Device clocks differ, so ordering must
    // come from the database's now(); `pending` keeps this message last until it arrives.
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: myId,
        content: text,
        type: "text",
        status: "sent",
        created_at: new Date().toISOString(),
        pending: true,
      },
    ]);
    inputRef.current?.focus();

    // Same id as the optimistic row, so the realtime INSERT echo is de-duplicated.
    // created_at is deliberately NOT sent: the column default (now()) stamps it server-side.
    const { data, error } = await supabase
      .from("messages")
      .insert({
        id: tempId,
        conversation_id: CONVERSATION_ID,
        sender_id: myId,
        type: "text",
        content: text,
        status: "sent",
      })
      .select("created_at")
      .single();

    if (error) {
      console.error("[chat] send failed:", error.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft((d) => d || text);
    } else if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, created_at: data.created_at, pending: false } : m)),
      );
    }
  }, [draft, myId]);

  // ── Accept / Decline incoming call ────────────────────────────────────────
  const handleAcceptCall = useCallback(() => {
    if (!incomingCall) return;
    sessionStorage.setItem("pending_offer", JSON.stringify({ sdp: incomingCall.sdp }));
    setIncomingCall(null);
    router.push(`/call?type=${incomingCall.callType}`);
  }, [incomingCall, router]);

  const handleDeclineCall = useCallback(() => {
    signalChRef.current?.send({ type: "broadcast", event: "declined", payload: {} });
    setIncomingCall(null);
  }, []);

  // ── Merged timeline: messages + completed call log entries ────────────────
  const timeline: TimelineItem[] = [
    ...messages.map((m) => ({ kind: "message" as const, data: m, time: m.created_at })),
    // Only show calls that have a final status (exclude in-progress)
    ...callLog
      .filter((c) => c.status !== null)
      .map((c) => ({ kind: "call" as const, data: c, time: c.started_at })),
  ].sort((a, b) => {
    // Unconfirmed local messages always sit at the bottom, in the order they were sent
    const pa = a.kind === "message" && a.data.pending ? 1 : 0;
    const pb = b.kind === "message" && b.data.pending ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });

  // ─── Derived display values ──────────────────────────────────────────────
  const partnerDisplay = partner?.nickname ?? partner?.name ?? "…";
  const partnerInitial = partnerDisplay[0]?.toUpperCase() ?? "?";
  const partnerColor   = partner?.avatar_color ?? "var(--wine)";

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col bg-[var(--bg)] font-sans">

      {/* ── Incoming call overlay ───────────────────────────────────────── */}
      {incomingCall && (
        <div className="absolute inset-x-0 top-0 z-50 mx-auto max-w-md">
          <div className="m-3 flex items-center gap-3 rounded-[16px] bg-[var(--card)] px-4 py-4 shadow-xl ring-1 ring-white/10">
            <Avatar initial={partnerInitial} color={partnerColor} size={42} />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-[var(--cream)]">
                {partnerDisplay}
              </p>
              <p className="text-[11px] text-[var(--muted)]">
                Incoming {incomingCall.callType} call…
              </p>
            </div>
            {/* Decline */}
            <button
              onClick={handleDeclineCall}
              aria-label="Decline"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-700/80 text-white"
            >
              <PhoneOff className="h-4 w-4" strokeWidth={2} />
            </button>
            {/* Accept */}
            <button
              onClick={handleAcceptCall}
              aria-label="Accept"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4C7A5B] text-white"
            >
              <PhoneIncoming className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-[9px] border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">

        <Avatar initial={partnerInitial} color={partnerColor} size={34} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-[var(--cream)]">
              {partnerDisplay}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            {reconnecting ? (
              <span className="text-[10px] italic text-[var(--muted)]" role="status">
                Reconnecting...
              </span>
            ) : partner?.is_online ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-[#4C7A5B]" />
                <span className="text-[10px] text-[#4C7A5B]">Online</span>
              </>
            ) : (
              <span className="text-[10px] text-[var(--muted)]">
                {formatLastSeen(partner?.last_seen ?? null, now)}
              </span>
            )}
          </div>
        </div>

        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[var(--muted)]"
        >
          <Settings className="h-[14px] w-[14px]" strokeWidth={2} />
        </Link>
        <Link
          href="/call?type=voice"
          aria-label="Voice call"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
        >
          <Phone className="h-[13px] w-[13px]" strokeWidth={2} />
        </Link>
        <Link
          href="/call?type=video"
          aria-label="Video call"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
        >
          <Video className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </header>

      {/* ── Timeline (messages + call log) ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col gap-[9px] overflow-y-auto px-3 py-3.5">
        {timeline.length === 0 && (
          <p className="mx-auto mt-10 text-[12px] text-[var(--muted)]">Say something 💬</p>
        )}

        {timeline.map((item) =>
          item.kind === "message" ? (
            <MessageBubble
              key={item.data.id}
              content={item.data.content}
              isMine={item.data.sender_id === myId}
              timestamp={item.data.created_at}
              status={item.data.sender_id === myId ? item.data.status : undefined}
            />
          ) : (
            <CallBubble
              key={item.data.id}
              type={item.data.type}
              status={item.data.status!}
              duration={item.data.duration_seconds}
              timestamp={item.data.started_at}
              isMine={item.data.caller_id === myId}
            />
          ),
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-[7px] border-t border-[var(--border)] bg-[var(--surface)] px-[11px] py-[9px]">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Message…"
          autoComplete="off"
          className="flex-1 rounded-[20px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--cream)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--wine)]"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim()}
          aria-label="Send"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wine)] text-[var(--cream)] transition-opacity disabled:opacity-40"
        >
          <Send className="h-[13px] w-[13px]" strokeWidth={2} />
        </button>
      </div>
    </main>
  );
}
