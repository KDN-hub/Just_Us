"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Phone, Video, Send, PhoneIncoming, PhoneOff, Settings, Heart, Paperclip, Mic, Square, X, Smile, Star } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import MessageBubble from "@/components/MessageBubble";
import CallBubble from "@/components/CallBubble";
import TypingBubble from "@/components/TypingBubble";
import EmojiPicker from 'emoji-picker-react';

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
  /** Message composed while offline — will be sent when connection restores. */
  queued?: boolean;
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

const MSG_CACHE_KEY = `msg_cache_${CONVERSATION_ID}`;
const MSG_CACHE_LIMIT = 100;

function loadMsgCache(): Message[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(MSG_CACHE_KEY) : null;
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch { return []; }
}

function saveMsgCache(msgs: Message[]): void {
  try {
    const toSave = msgs.filter(m => !m.pending && !m.queued).slice(-MSG_CACHE_LIMIT);
    localStorage.setItem(MSG_CACHE_KEY, JSON.stringify(toSave));
  } catch {}
}



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
  // Tracks whether we've ever had a successful realtime connection —
  // prevents "Reconnecting…" from flashing on the very first page load.
  const hasConnectedRef = useRef(false);

  // ── Identity ─────────────────────────────────────────────────────────────
  const [myId] = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem("user_id") ?? "" : ""),
  );

  // ── Data state ────────────────────────────────────────────────────────────
  // Pre-seed partner from localStorage so the header renders instantly on mount
  // (no blank-screen flash). The network fetch in bootstrap() will overwrite
  // this with fresh data as soon as it resolves.
  const [partner, setPartner] = useState<UserRow | null>(() => {
    if (typeof window === "undefined") return null;
    const id    = localStorage.getItem("partner_id");
    const name  = localStorage.getItem("partner_name");
    const color = localStorage.getItem("partner_color");
    if (!id || !name) return null;
    return {
      id,
      name,
      nickname: name,
      avatar_color: color,
      is_online: false,
      last_seen: null,
    };
  });

  const [messages, setMessages] = useState<Message[]>(
    () => typeof window !== 'undefined' ? loadMsgCache() : []
  );
  const [callLog,      setCallLog]      = useState<CallLogEntry[]>([]);
  const [draft,        setDraft]        = useState("");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    () => typeof window !== 'undefined' ? navigator.onLine : true
  );
  // Drives the live "Last seen X minutes ago" label (local clock tick only — no network)
  const [now,          setNow]          = useState<number>(() => Date.now());

  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [pendingMedia, setPendingMedia] = useState<{file: File | Blob, type: string, url: string} | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'sticker' | 'gif' | 'favorites'>('emoji');
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      return JSON.parse(localStorage.getItem('fav_media') || '[]');
    }
    return [];
  });

  const toggleFavorite = (url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev: string[]) => {
      const next = prev.includes(url) ? prev.filter((u: string) => u !== url) : [...prev, url];
      localStorage.setItem('fav_media', JSON.stringify(next));
      return next;
    });
  };

  const handleSendDirectURL = async (url: string, type: string) => {
    try {
      const tempId = generateUUID();
      const offline = !navigator.onLine;

      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          sender_id: myId,
          content: url,
          type: type,
          status: 'sent',
          created_at: new Date().toISOString(),
          pending: true,
          queued: offline,
        },
      ]);
      setShowEmojiPicker(false);
      
      if (!offline) {
        const { data: insertData, error: insertError } = await supabase
          .from('messages')
          .insert({
            id: tempId,
            conversation_id: CONVERSATION_ID,
            sender_id: myId,
            type: type,
            content: url,
            status: 'sent',
          })
          .select('created_at')
          .single();
          
        if (insertError) {
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, queued: true } : m));
        } else if (insertData) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, created_at: insertData.created_at, pending: false } : m)),
          );
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const uploadMedia = async (file: File | Blob, type: string, caption?: string) => {
    try {
      const ext = (file as File).name ? (file as File).name.split('.').pop() : 'webm';
      const fileName = `${generateUUID()}.${ext}`;
      
      const { data, error } = await supabase.storage.from('chat_media').upload(fileName, file);
      if (error) {
        if (error.message.includes('Bucket not found') || error.message.includes('The resource was not found')) {
          alert('Storage bucket "chat_media" not found. Please create it in Supabase.');
        } else {
          console.error('[chat] Upload error:', error);
          alert('Failed to upload media.');
        }
        return;
      }
      
      const { data: publicData } = supabase.storage.from('chat_media').getPublicUrl(fileName);
      const url = publicData.publicUrl;
      
      let dbType = type === 'image' ? 'image' : 'text';
      let dbContent = url;
      if (type === 'audio') dbContent = `AUDIO_URL:${url}`;
      if (type === 'video') dbContent = `VIDEO_URL:${url}`;
      
      const tempId = generateUUID();
      const offline = !navigator.onLine;

      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          sender_id: myId,
          content: dbContent,
          type: dbType,
          status: 'sent',
          created_at: new Date().toISOString(),
          pending: true,
          queued: offline,
        },
      ]);
      
      if (!offline) {
        const { data: insertData, error: insertError } = await supabase
          .from('messages')
          .insert({
            id: tempId,
            conversation_id: CONVERSATION_ID,
            sender_id: myId,
            type: dbType,
            content: dbContent,
            status: 'sent',
          })
          .select('created_at')
          .single();
          
        if (insertError) {
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, queued: true } : m));
        } else if (insertData) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, created_at: insertData.created_at, pending: false } : m)),
          );
        }
      }

      if (caption) {
        handleSend(caption);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during upload.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith('video') ? 'video' : 'image';
    setPendingMedia({ file, type, url: URL.createObjectURL(file) });
    e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        uploadMedia(audioBlob, 'audio');
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.error('Error accessing microphone', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

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

  // ── Online / offline detection ────────────────────────────────────────────
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
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
          const next = Array.from(byId.values());
          saveMsgCache(next);
          return next;
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

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    const handleVisibility = () => {
      if (!document.hidden) resync();
    };

    async function bootstrap() {
      // Use cached partner_id to avoid a blocking network round-trip on every mount.
      // Falls back to a DB lookup only if the cache is missing (first-ever load).
      partnerId = localStorage.getItem("partner_id");

      if (!partnerId) {
        const { data: conv } = await supabase
          .from("conversation")
          .select("user_a_id, user_b_id")
          .eq("id", CONVERSATION_ID)
          .single();
        if (cancelled || !conv) return;
        partnerId = conv.user_a_id === myId ? conv.user_b_id : conv.user_a_id;
      }


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
            hasConnectedRef.current = true;
            setReconnecting(false);
            resync();
          } else if (status === "CHANNEL_ERROR") {
            console.error("[chat] Realtime CHANNEL_ERROR — will retry automatically.", err ?? "");
            if (hasConnectedRef.current) setReconnecting(true);
          } else if (status === "TIMED_OUT") {
            console.warn("[chat] Realtime subscription timed out — will retry automatically.");
            if (hasConnectedRef.current) setReconnecting(true);
          } else if (status === "CLOSED") {
            console.warn("[chat] Realtime channel closed.");
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
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.userId !== myId) {
          setPartnerTyping(payload.isTyping);
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

    return () => { supabase.removeChannel(ch); };
  }, [myId]);

  // ── Auto-scroll when an item is appended (sent or received) or partner starts typing ───────────────
  useEffect(() => {
    const count = messages.length + callLog.length;
    if (count === 0 && !partnerTyping) return;
    bottomRef.current?.scrollIntoView({
      behavior: prevCountRef.current === 0 ? "auto" : "smooth",
      block: "end",
    });
    prevCountRef.current = count;
  }, [messages.length, callLog.length, partnerTyping]);

  // ── Drain offline queue when connection restores ───────────────────────────
  useEffect(() => {
    if (!isOnline) return;
    setMessages((prev) => {
      const queued = prev.filter((m) => m.queued && m.sender_id === myId);
      if (queued.length === 0) return prev;
      // Fire-and-forget: send each queued message
      queued.forEach(async (msg) => {
        const { error } = await supabase
          .from('messages')
          .insert({
            id: msg.id,
            conversation_id: CONVERSATION_ID,
            sender_id: myId,
            type: 'text',
            content: msg.content,
            status: 'sent',
          })
          .select('id')
          .single();
        if (!error) {
          setMessages((p) => p.map((m) => m.id === msg.id ? { ...m, queued: false, pending: true } : m));
        }
      });
      return prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, myId]);



  // ── Send message (optimistic UI) ──────────────────────────────────────────
  const handleSend = useCallback(async (overrideText?: string | React.MouseEvent | React.KeyboardEvent) => {
    const isEvent = overrideText && typeof overrideText === 'object' && 'nativeEvent' in overrideText;
    const text = (typeof overrideText === 'string' ? overrideText : draft).trim();
    if (!text) return;

    if (typeof overrideText !== 'string') setDraft('');

    const tempId = generateUUID();
    const offline = !navigator.onLine;

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: myId,
        content: text,
        type: 'text',
        status: 'sent',
        created_at: new Date().toISOString(),
        pending: true,
        queued: offline,
      },
    ]);
    inputRef.current?.focus();

    // If offline, the drain effect will send it when connection restores
    if (offline) return;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        id: tempId,
        conversation_id: CONVERSATION_ID,
        sender_id: myId,
        type: 'text',
        content: text,
        status: 'sent',
      })
      .select('created_at')
      .single();

    if (error) {
      console.error('[chat] send failed:', error.message);
      // Keep message in chat as queued rather than losing it
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, queued: true } : m));
    } else if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, created_at: data.created_at, pending: false } : m)),
      );
    }
  }, [draft, myId]);

  const handleNudge = async () => {
    if (!isOnline) return;

    // Send broadcast for immediate vibration if partner is online
    signalChRef.current?.send({
      type: "broadcast",
      event: "nudge",
      payload: { 
        userId: myId, 
        userName: typeof window !== 'undefined' ? localStorage.getItem('user_name') || 'Your partner' : 'Your partner' 
      },
    });

    const tempId = generateUUID();
    const offline = !navigator.onLine;

    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: myId,
        content: "NUDGE_PING_💖",
        type: 'text',
        status: 'sent',
        created_at: new Date().toISOString(),
        pending: true,
        queued: offline,
      },
    ]);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

    if (offline) return;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        id: tempId,
        conversation_id: CONVERSATION_ID,
        sender_id: myId,
        type: 'text',
        content: "NUDGE_PING_💖",
        status: 'sent',
      })
      .select('created_at')
      .single();

    if (error) {
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, queued: true } : m));
    } else if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, created_at: data.created_at, pending: false } : m)),
      );
    }
  };
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
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans" style={{ background: "var(--gradient)" }}>

      {/* ── Incoming call overlay ───────────────────────────────────────── */}
      {incomingCall && (
        <div className="absolute inset-x-0 top-0 z-50 mx-auto max-w-md">
          <div className="m-3 flex items-center gap-3.5 rounded-[16px] bg-[var(--card)] px-4 py-4 shadow-xl ring-1 ring-white/10">
            <Avatar initial={partnerInitial} color={partnerColor} size={46} />
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-[var(--cream)]">
                {partnerDisplay}
              </p>
              <p className="text-[13px] text-[var(--muted)]">
                Incoming {incomingCall.callType} call…
              </p>
            </div>
            {/* Decline */}
            <button
              onClick={handleDeclineCall}
              aria-label="Decline"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-red-700/80 text-white"
            >
              <PhoneOff className="h-5 w-5" strokeWidth={2} />
            </button>
            {/* Accept */}
            <button
              onClick={handleAcceptCall}
              aria-label="Accept"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#4C7A5B] text-white"
            >
              <PhoneIncoming className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {/* ── Offline banner (WhatsApp-style) ───────────────────────────── */}
      {!isOnline && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-[#5C4A10] px-4 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#F5C842]" />
          <span className="text-[13px] font-medium text-[#F5C842]">Waiting for network…</span>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">

        <Avatar initial={partnerInitial} color={partnerColor} size={42} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[16px] font-semibold text-[var(--cream)]">
              {partnerDisplay}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {!isOnline ? (
              <span className="text-[12px] italic text-[#F5C842]" role="status">
                No network
              </span>
            ) : reconnecting ? (
              <span className="text-[12px] italic text-[var(--muted)]" role="status">
                Connecting…
              </span>
            ) : partner?.is_online ? (
              <>
                <span className="h-2 w-2 rounded-full bg-[#4C7A5B]" />
                <span className="text-[12px] text-[#4C7A5B]">Online</span>
              </>
            ) : (
              <span className="text-[12px] text-[var(--muted)]">
                {formatLastSeen(partner?.last_seen ?? null, now)}
              </span>
            )}
          </div>
        </div>

        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)]"
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
        </Link>
        <Link
          href="/call?type=voice"
          aria-label="Voice call"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
        >
          <Phone className="h-[17px] w-[17px]" strokeWidth={2} />
        </Link>
        <Link
          href="/call?type=video"
          aria-label="Video call"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
        >
          <Video className="h-[17px] w-[17px]" strokeWidth={2} />
        </Link>
      </header>

      {/* ── Timeline (messages + call log) ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto px-4 py-4">
        {timeline.length === 0 && (
          <p className="mx-auto mt-10 text-[14px] text-[var(--muted)]">Say something 💬</p>
        )}

        {timeline.map((item) =>
          item.kind === "message" ? (
            <MessageBubble
              key={item.data.id}
              content={item.data.content}
              isMine={item.data.sender_id === myId}
              timestamp={item.data.created_at}
              status={item.data.sender_id === myId ? item.data.status : undefined}
              queued={item.data.queued}
              type={item.data.type}
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
        
        {partnerTyping && <TypingBubble />}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-2 py-2 relative">
        
        {showEmojiPicker && (
          <div className="absolute bottom-[100%] left-2 mb-2 z-50 flex flex-col bg-[var(--card)] rounded-lg overflow-hidden border border-[var(--border)] shadow-xl w-[320px]">
            <div className="flex border-b border-[var(--border)] bg-black/20">
              <button onClick={() => setPickerTab('emoji')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'emoji' ? 'text-[var(--cream)] border-b-2 border-[var(--wine)]' : 'text-[var(--muted)]'}`}>Emojis</button>
              <button onClick={() => setPickerTab('sticker')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'sticker' ? 'text-[var(--cream)] border-b-2 border-[var(--wine)]' : 'text-[var(--muted)]'}`}>Stickers</button>
              <button onClick={() => setPickerTab('gif')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'gif' ? 'text-[var(--cream)] border-b-2 border-[var(--wine)]' : 'text-[var(--muted)]'}`}>GIFs</button>
              <button onClick={() => setPickerTab('favorites')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'favorites' ? 'text-[var(--cream)] border-b-2 border-[var(--wine)]' : 'text-[var(--muted)]'}`}>Favs</button>
            </div>
            <div className="h-[350px] overflow-y-auto relative bg-[var(--surface)]">
              {pickerTab === 'emoji' && (
                <EmojiPicker theme={"dark" as any} width="100%" height={350} onEmojiClick={(e) => setDraft(prev => prev + e.emoji)} />
              )}
              {pickerTab === 'favorites' && (
                <div className="grid grid-cols-3 gap-2 p-3">
                  {favorites.length === 0 && <p className="col-span-3 text-center text-[var(--muted)] text-[13px] mt-10">No favorites yet</p>}
                  {favorites.map((url, i) => (
                    <div key={i} className="relative group aspect-square">
                      <img src={url} alt="Favorite" className="w-full h-full object-contain cursor-pointer hover:bg-white/10 rounded-lg p-1" onClick={() => handleSendDirectURL(url, 'image')} />
                      <button onClick={(e) => toggleFavorite(url, e)} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pickerTab === 'sticker' && (
                <div className="grid grid-cols-3 gap-2 p-3">
                  {["https://media.tenor.com/E_2t3a9fNrwAAAAi/peach-cat.gif", "https://media.tenor.com/T0b-Oa0u7sYAAAAi/tkthao219-bubududu.gif", "https://media.tenor.com/Jd0n2J1e3hMAAAAi/mocha-bear.gif", "https://media.tenor.com/xIID7d983VMAAAAi/milk-and-mocha-bear.gif", "https://media.tenor.com/YwN9qRkQ7f0AAAAi/mochi-peach.gif", "https://media.tenor.com/B942y020TTEAAAAi/dudu-bubu.gif"].map((url, i) => (
                    <div key={i} className="relative group aspect-square">
                      <img src={url} alt="Sticker" className="w-full h-full object-contain cursor-pointer hover:bg-white/10 rounded-lg p-1" onClick={() => handleSendDirectURL(url, 'image')} />
                      <button onClick={(e) => toggleFavorite(url, e)} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <Star className={`h-3 w-3 ${favorites.includes(url) ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pickerTab === 'gif' && (
                <div className="grid grid-cols-2 gap-2 p-3">
                  {["https://media.tenor.com/N2sS-WtyHhgAAAAM/cat-meme.gif", "https://media.tenor.com/Z4XW47B_3b4AAAAM/hugging.gif", "https://media.tenor.com/n14aQZ2E86QAAAAM/love-cute.gif", "https://media.tenor.com/w1j0bM6sSCAAAAAM/sad-puss-in-boots.gif"].map((url, i) => (
                    <div key={i} className="relative group aspect-square">
                      <img src={url} alt="GIF" className="w-full h-full object-cover cursor-pointer hover:bg-white/10 rounded-lg" onClick={() => handleSendDirectURL(url, 'image')} />
                      <button onClick={(e) => toggleFavorite(url, e)} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <Star className={`h-3 w-3 ${favorites.includes(url) ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <input type="file" ref={fileInputRef} accept="image/*,video/*,audio/*" className="hidden" onChange={handleFileUpload} />
        
        {/* Input Bubble Container */}
        <div className="flex-1 flex items-end gap-1.5 rounded-[24px] bg-[var(--card)] px-1.5 py-1 min-h-[44px]">
          
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--cream)]"
          >
            <Smile className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </button>
          
          {isRecording ? (
            <div className="flex-1 flex items-center justify-center gap-2 py-2 animate-in slide-in-from-right-4 duration-300">
               <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
               <span className="text-[15px] font-mono text-[var(--cream)]">
                 {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
               </span>
            </div>
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (!signalChRef.current || !isOnline) return;
                  if (!typingTimeoutRef.current) {
                    signalChRef.current.send({ type: "broadcast", event: "typing", payload: { userId: myId, isTyping: true } });
                  } else {
                    clearTimeout(typingTimeoutRef.current);
                  }
                  typingTimeoutRef.current = setTimeout(() => {
                    signalChRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: myId, isTyping: false } });
                    typingTimeoutRef.current = null;
                  }, 2000);
                }}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Message…"
                autoComplete="off"
                className="flex-1 bg-transparent py-2 text-[16px] text-[var(--cream)] outline-none placeholder:text-[var(--muted)] min-w-0"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--cream)] transform -rotate-45"
              >
                <Paperclip className="h-[20px] w-[20px]" strokeWidth={1.5} />
              </button>
            </>
          )}

          {!draft.trim() && (
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isOnline}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${isRecording ? 'text-red-500 animate-pulse' : 'text-[var(--muted)] hover:text-[var(--cream)]'}`}
            >
              {isRecording ? <Square className="h-[18px] w-[18px]" strokeWidth={2} /> : <Mic className="h-[20px] w-[20px]" strokeWidth={1.5} />}
            </button>
          )}

        </div>

        {/* Outside Circle Button (Send or Nudge) */}
        <div className="shrink-0 mb-[2px]">
          {draft.trim() ? (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!isOnline}
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--wine)] text-white transition-all disabled:opacity-40"
            >
              <Send className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNudge}
              disabled={!isOnline}
              aria-label="Nudge"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#7A2C3B] text-[var(--cream)] transition-all active:scale-95 disabled:opacity-40"
            >
              <Heart className="h-[22px] w-[22px] fill-current" />
            </button>
          )}
        </div>
      </div>

      {pendingMedia && (
        <div className="absolute inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center p-4">
            <button onClick={() => setPendingMedia(null)} className="text-white"><X className="h-6 w-6" /></button>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-0">
            {pendingMedia.type === 'video' ? <video src={pendingMedia.url} controls className="max-h-full max-w-full" /> : <img src={pendingMedia.url} className="max-h-full max-w-full object-contain" />}
          </div>
          <div className="p-4 flex gap-2">
            <input type="text" value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} placeholder="Add a caption..." className="flex-1 rounded-full bg-zinc-800 text-white px-4 py-2 outline-none" />
            <button onClick={() => {
               uploadMedia(pendingMedia.file, pendingMedia.type, mediaCaption);
               setPendingMedia(null);
               setMediaCaption("");
            }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4C7A5B] text-white">
              <Send className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
