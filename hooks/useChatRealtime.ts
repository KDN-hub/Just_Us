import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useChatStore, Message, CallLogEntry } from "./useChatStore";

const CONVERSATION_ID = "c0000000-0000-0000-0000-000000000003";
const SIGNAL_CHANNEL  = `call-signal-${CONVERSATION_ID}`;

export function useChatRealtime(signalChRef: React.MutableRefObject<ReturnType<typeof supabase.channel> | null>) {
  const {
    myId,
    setPartner,
    setReconnecting,
    setPartnerTyping,
    setDaysTogether,
    setIncomingCall,
    addOrUpdateMessage,
    addOrUpdateMessages,
    addOrUpdateCallLog,
    addOrUpdateCallLogs
  } = useChatStore();

  const hasConnectedRef = useRef(false);

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

  // Realtime: db-sync
  useEffect(() => {
    if (!myId) return;

    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let partnerId: string | null = null;

    const markPartnerMessagesRead = () => {
      if (!partnerId) return;
      
      const { messages } = useChatStore.getState();
      const unreadIds = Object.values(messages)
        .filter(m => m.sender_id === partnerId && m.status !== "read")
        .map(m => m.id);
        
      if (unreadIds.length === 0) return;

      supabase
        .from("messages")
        .update({ status: "read" })
        .in("id", unreadIds)
        .then(({ error }) => {
          if (error) console.error("[chat] mark-as-read failed:", error.message);
        });
    };

    const resync = async () => {
      if (!partnerId) return;
      
      const { messages } = useChatStore.getState();
      const existingMsgArray = Object.values(messages);
      const latestMessage = existingMsgArray.reduce((latest, msg) => {
        if (!msg.pending && !msg.queued) {
           return !latest || new Date(msg.created_at) > new Date(latest.created_at) ? msg : latest;
        }
        return latest;
      }, null as Message | null);
      
      let msgQuery = supabase
        .from("messages")
        .select("id, sender_id, content, type, status, created_at")
        .eq("conversation_id", CONVERSATION_ID);
        
      if (latestMessage) {
        msgQuery = msgQuery.gt("created_at", latestMessage.created_at).order("created_at", { ascending: true });
      } else {
        msgQuery = msgQuery.order("created_at", { ascending: false }).limit(50);
      }

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

      const [msgRes, callRes, partnerRes] = await Promise.all([
        msgQuery,
        callQuery,
        supabase
          .from("users")
          .select("id, name, nickname, avatar_color, is_online, last_seen")
          .eq("id", partnerId)
          .single(),
      ]);
      if (cancelled) return;

      if (msgRes.data && msgRes.data.length > 0) {
        addOrUpdateMessages(msgRes.data as Message[]);
      }
      
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

      if (!document.hidden) markPartnerMessagesRead();
    };

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const handleVisibility = () => {
      if (!document.hidden) resync();
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

      channel = supabase
        .channel(`db-sync-${CONVERSATION_ID}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${CONVERSATION_ID}` },
          (payload) => {
            if (cancelled) return;
            const msg = payload.new as Message;
            addOrUpdateMessage({ ...msg, pending: false, queued: false });

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
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${CONVERSATION_ID}` },
          (payload) => {
            if (cancelled) return;
            addOrUpdateMessage(payload.new as Message);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${partnerId}` },
          (payload) => {
            if (cancelled) return;
            setPartner(payload.new as Partial<typeof payload.new>);
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_log", filter: `conversation_id=eq.${CONVERSATION_ID}` },
          (payload) => {
            if (cancelled) return;
            addOrUpdateCallLog(payload.new as CallLogEntry);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "call_log", filter: `conversation_id=eq.${CONVERSATION_ID}` },
          (payload) => {
            if (cancelled) return;
            addOrUpdateCallLog(payload.new as CallLogEntry);
          },
        )
        .subscribe((status, err) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            hasConnectedRef.current = true;
            setReconnecting(false);
            resync();
          } else if (status === "CHANNEL_ERROR") {
            if (hasConnectedRef.current) setReconnecting(true);
          } else if (status === "TIMED_OUT") {
            if (hasConnectedRef.current) setReconnecting(true);
          } else if (status === "CLOSED") {
            if (hasConnectedRef.current) setReconnecting(true);
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
  }, [myId, setPartner, setReconnecting, setDaysTogether, addOrUpdateMessage, addOrUpdateMessages, addOrUpdateCallLog, addOrUpdateCallLogs]);

  // Incoming call & signaling
  useEffect(() => {
    if (!myId) return;

    let partnerTypingTimer: NodeJS.Timeout | null = null;

    const ch = supabase
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
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId !== myId) {
          if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
          setPartnerTyping(payload.isTyping);
          if (payload.isTyping) {
            partnerTypingTimer = setTimeout(() => {
              setPartnerTyping(false);
            }, 3500);
          }
        }
      })
      .on("broadcast", { event: "nudge" }, ({ payload }) => {
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
      })
      .subscribe();

    signalChRef.current = ch;

    return () => { 
      if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
      supabase.removeChannel(ch); 
    };
  }, [myId, setIncomingCall, setPartnerTyping, signalChRef]);
}
