import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { supabase } from "@/lib/supabase";
import { useChatStore, CallLogEntry } from "./useChatStore";
import { listUnreadFromPartner, mergeRemoteMessages } from "@/lib/db";
import { drainOutbox, syncConversation } from "@/lib/sync";
import {
  getRealtimeStatus,
  startRealtime,
  stopRealtime,
  subscribeRealtimeHandlers,
} from "@/lib/realtime";
import { flushReceipts, queueDeliveredReceipt } from "@/lib/receipts";
import { useReadReceipts } from "@/hooks/useReadReceipts";

const CONVERSATION_ID = "c0000000-0000-0000-0000-000000000003";

// The whole chat feature shares ONE realtime channel, owned by lib/realtime:
// messages / users / call_log postgres changes + broadcast (typing, nudge).
// Call signaling lives in lib/callEngine on its own private topic — its
// incoming ring is surfaced on the chat page through the engine snapshot.
// Read/delivered receipts are viewport-driven (useReadReceipts + lib/receipts).
export function useChatRealtime() {
  const {
    myId,
    setPartner,
    setReconnecting,
    setPartnerTyping,
    setDaysTogether,
    addOrUpdateCallLog,
    addOrUpdateCallLogs
  } = useChatStore(useShallow((s) => ({
    myId: s.myId,
    setPartner: s.setPartner,
    setReconnecting: s.setReconnecting,
    setPartnerTyping: s.setPartnerTyping,
    setDaysTogether: s.setDaysTogether,
    addOrUpdateCallLog: s.addOrUpdateCallLog,
    addOrUpdateCallLogs: s.addOrUpdateCallLogs,
  })));

  const hasConnectedRef = useRef(false);

  // Viewport-driven read receipts for partner messages.
  useReadReceipts(CONVERSATION_ID);

  // My own presence
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

    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    let accessToken = anonKey;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) accessToken = data.session.access_token;
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      accessToken = session?.access_token ?? anonKey;
    });

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
    };
  }, [myId]);

  // Realtime: events from the shared channel
  useEffect(() => {
    if (!myId) return;

    let cancelled = false;
    let partnerId: string | null = null;
    let lastResyncAt = 0;
    let partnerTypingTimer: NodeJS.Timeout | null = null;
    const RESYNC_THROTTLE_MS = 1000;

    const resync = async () => {
      if (!partnerId) return;

      let callQuery = supabase
        .from("call_log")
        .select("id, caller_id, type, status, started_at, ended_at, duration_seconds")
        .eq("conversation_id", CONVERSATION_ID);

      const { callLog } = useChatStore.getState();
      const existingCallArray = Object.values(callLog);
      const latestCall = existingCallArray.reduce((latest, call) => {
        return !latest || new Date(call.started_at) > new Date(latest.started_at) ? call : latest;
      }, null as CallLogEntry | null);

      if (latestCall) {
        callQuery = callQuery.gt("started_at", latestCall.started_at).order("started_at", { ascending: true });
      } else {
        callQuery = callQuery.order("started_at", { ascending: false }).limit(50);
      }

      // Message catch-up is cursor-based and lands in Dexie; the call log and
      // partner row are small and still live in the store.
      const [, callRes, partnerRes] = await Promise.all([
        syncConversation(CONVERSATION_ID),
        callQuery,
        supabase
          .from("users")
          .select("id, name, nickname, avatar_color, is_online, last_seen")
          .eq("id", partnerId)
          .single(),
      ]);
      if (cancelled) return;

      if (callRes.data && callRes.data.length > 0) {
        addOrUpdateCallLogs(callRes.data as CallLogEntry[]);
      }

      if (partnerRes.data) {
        const p = partnerRes.data;
        setPartner(p);
        localStorage.setItem("partner_name",  p.nickname ?? p.name);
        localStorage.setItem("partner_color", p.avatar_color ?? "var(--wine)");
        localStorage.setItem("partner_id",    p.id);
      }

      // Anything pulled in that the partner still sees as single-tick gets a
      // delivered receipt; the viewport observer upgrades visible ones to read.
      const unread = await listUnreadFromPartner(CONVERSATION_ID, partnerId);
      const undelivered = unread.filter((m) => m.status === "sent").map((m) => m.id);
      if (undelivered.length > 0) queueDeliveredReceipt(undelivered);
    };

    const maybeResync = () => {
      const now = Date.now();
      if (now - lastResyncAt > RESYNC_THROTTLE_MS) {
        lastResyncAt = now;
        void resync();
      }
    };

    const unsubscribe = subscribeRealtimeHandlers({
      onMessageInsert: (row) => {
        if (cancelled) return;
        void mergeRemoteMessages([row]);
        if (row.sender_id !== myId) queueDeliveredReceipt([row.id]);
      },
      onMessageUpdate: (row) => {
        if (cancelled) return;
        void mergeRemoteMessages([row]);
      },
      onPartnerUpdate: (row) => {
        if (cancelled) return;
        setPartner(row);
      },
      onCallLog: (row) => {
        if (cancelled) return;
        addOrUpdateCallLog(row);
      },
      onTyping: (payload) => {
        if (cancelled) return;
        if (payload.userId !== myId) {
          if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
          setPartnerTyping(payload.isTyping);
          if (payload.isTyping) {
            partnerTypingTimer = setTimeout(() => {
              setPartnerTyping(false);
            }, 3500);
          }
        }
      },
      onNudge: (payload) => {
        if (cancelled) return;
        if (payload.userId !== myId) {
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`${payload.userName || 'Your partner'} is thinking of you!`);
            utterance.rate = 1.05;
            utterance.pitch = 1.1;
            window.speechSynthesis.speak(utterance);
          }
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
             new Notification("💖 Thinking of you!", {
                body: `${payload.userName || 'Your partner'} just sent you a nudge.`,
             });
          }
        }
      },
      onStatusChange: (next) => {
        if (cancelled) return;
        if (next === "connected") {
          hasConnectedRef.current = true;
          setReconnecting(false);
          // Socket is back — flush anything the outbox queued and catch up on
          // whatever happened while the channel was down.
          void drainOutbox(CONVERSATION_ID, myId);
          maybeResync();
        } else if ((next === "connecting" || next === "reconnecting") && hasConnectedRef.current) {
          setReconnecting(true);
        }
      },
    });

    if (getRealtimeStatus() === "reconnecting" && hasConnectedRef.current) {
      setReconnecting(true);
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const handleVisibility = () => {
      if (!document.hidden) {
        maybeResync();
        void drainOutbox(CONVERSATION_ID, myId);
        flushReceipts();
      } else {
        flushReceipts();
      }
    };

    async function bootstrap() {
      partnerId = localStorage.getItem("partner_id");

      if (!partnerId) {
        const { data: conv } = await supabase
          .from("conversation")
          .select("user_a_id, user_b_id, together_since, created_at")
          .eq("id", CONVERSATION_ID)
          .single();
        if (cancelled || !conv) return;
        partnerId = conv.user_a_id === myId ? conv.user_b_id : conv.user_a_id;

        const startDate = conv.together_since || conv.created_at;
        if (startDate) {
           const days = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
           setDaysTogether(Math.max(0, days));
        }
      } else {
        supabase
          .from("conversation")
          .select("together_since, created_at")
          .eq("id", CONVERSATION_ID)
          .single()
          .then(({ data: conv }) => {
            if (cancelled || !conv) return;
            const startDate = conv.together_since || conv.created_at;
            if (startDate) {
               const days = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
               setDaysTogether(Math.max(0, days));
            }
          });
      }

      if (cancelled) return;
      startRealtime(CONVERSATION_ID, partnerId);
      // If the socket is slow, partner + call log still load through this.
      maybeResync();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    void bootstrap();

    return () => {
      cancelled = true;
      if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribe();
      flushReceipts();
      stopRealtime();
    };
  }, [myId, setPartner, setReconnecting, setPartnerTyping, setDaysTogether, addOrUpdateCallLog, addOrUpdateCallLogs]);
}
