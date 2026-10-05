"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PhoneIncoming, PhoneOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageList from "@/components/chat/MessageList";
import ChatInput from "@/components/chat/ChatInput";
import { useChatStore, generateUUID, formatLastSeen, TimelineItem, Message } from "@/hooks/useChatStore";
import { useChatRealtime } from "@/hooks/useChatRealtime";

const CONVERSATION_ID = "c0000000-0000-0000-0000-000000000003";

export default function Chat() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const signalChRef = useRef<RealtimeChannel | null>(null);
  const prevCountRef = useRef(0);

  const {
    myId, partner, messages, callLog, reconnecting,
    partnerTyping, isOnline, daysTogether, incomingCall,
    setIncomingCall, addOrUpdateMessage, getMessageList, getCallLogList
  } = useChatStore();

  useChatRealtime(signalChRef);

  const [draft, setDraft] = useState("");
  const [now, setNow] = useState<number>(() => Date.now());
  const [wallpaper, setWallpaper] = useState<string>("default");
  
  useEffect(() => {
    setWallpaper(localStorage.getItem('chat_wallpaper') || 'default');
  }, []);

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

      addOrUpdateMessage({
        id: tempId,
        sender_id: myId,
        content: url,
        type: type,
        status: 'sent',
        created_at: new Date().toISOString(),
        pending: true,
        queued: offline,
      });
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
          const m = useChatStore.getState().messages[tempId];
          if (m) addOrUpdateMessage({ ...m, queued: true });
        } else if (insertData) {
          const m = useChatStore.getState().messages[tempId];
          if (m) addOrUpdateMessage({ ...m, created_at: insertData.created_at, pending: false });
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

      addOrUpdateMessage({
        id: tempId,
        sender_id: myId,
        content: dbContent,
        type: dbType,
        status: 'sent',
        created_at: new Date().toISOString(),
        pending: true,
        queued: offline,
      });
      
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
          const m = useChatStore.getState().messages[tempId];
          if (m) addOrUpdateMessage({ ...m, queued: true });
        } else if (insertData) {
          const m = useChatStore.getState().messages[tempId];
          if (m) addOrUpdateMessage({ ...m, created_at: insertData.created_at, pending: false });
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

  useEffect(() => {
    const setupDone = localStorage.getItem("setup_complete");
    if (!myId || !setupDone) router.replace("/onboarding/welcome");
  }, [myId, router]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const messageList = getMessageList();
  const callLogList = getCallLogList();

  useEffect(() => {
    const count = messageList.length + callLogList.length;
    if (count === 0 && !partnerTyping) return;
    bottomRef.current?.scrollIntoView({
      behavior: prevCountRef.current === 0 ? "auto" : "smooth",
      block: "end",
    });
    prevCountRef.current = count;
  }, [messageList.length, callLogList.length, partnerTyping]);

  useEffect(() => {
    if (!isOnline) return;
    const queued = messageList.filter((m) => m.queued && m.sender_id === myId);
    if (queued.length === 0) return;
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
        addOrUpdateMessage({ ...msg, queued: false, pending: true });
      }
    });
  }, [isOnline, myId, messageList, addOrUpdateMessage]);

  const handleSend = useCallback(async (overrideText?: string | React.MouseEvent | React.KeyboardEvent) => {
    const text = (typeof overrideText === 'string' ? overrideText : draft).trim();
    if (!text) return;

    if (typeof overrideText !== 'string') setDraft('');

    const tempId = generateUUID();
    const offline = !navigator.onLine;

    addOrUpdateMessage({
      id: tempId,
      sender_id: myId,
      content: text,
      type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
      pending: true,
      queued: offline,
    });
    inputRef.current?.focus();

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
      const m = useChatStore.getState().messages[tempId];
      if (m) addOrUpdateMessage({ ...m, queued: true });
    } else if (data) {
      const m = useChatStore.getState().messages[tempId];
      if (m) addOrUpdateMessage({ ...m, created_at: data.created_at, pending: false });
    }
  }, [draft, myId, addOrUpdateMessage]);

  const handleNudge = async () => {
    if (!isOnline) return;

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

    addOrUpdateMessage({
      id: tempId,
      sender_id: myId,
      content: "NUDGE_PING_💖",
      type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
      pending: true,
      queued: offline,
    });
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
      const m = useChatStore.getState().messages[tempId];
      if (m) addOrUpdateMessage({ ...m, queued: true });
    } else if (data) {
      const m = useChatStore.getState().messages[tempId];
      if (m) addOrUpdateMessage({ ...m, created_at: data.created_at, pending: false });
    }
  };

  const handleAcceptCall = useCallback(() => {
    if (!incomingCall) return;
    sessionStorage.setItem("pending_offer", JSON.stringify({ sdp: incomingCall.sdp }));
    setIncomingCall(null);
    router.push(`/call?type=${incomingCall.callType}`);
  }, [incomingCall, router, setIncomingCall]);

  const handleDeclineCall = useCallback(() => {
    signalChRef.current?.send({ type: "broadcast", event: "declined", payload: {} });
    setIncomingCall(null);
  }, [setIncomingCall]);

  const handleReaction = async (messageId: string, emoji: string) => {
    const tempId = generateUUID();
    const dbContent = `REACTION:${messageId}:${emoji}`;
    const offline = !navigator.onLine;

    addOrUpdateMessage({
      id: tempId,
      sender_id: myId,
      content: dbContent,
      type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
      pending: true,
      queued: offline,
    });

    if (offline) return;

    await supabase.from('messages').insert({
      id: tempId,
      conversation_id: CONVERSATION_ID,
      sender_id: myId,
      type: 'text',
      content: dbContent,
      status: 'sent',
    });
  };

  const realMessages: Message[] = [];
  const reactionsMap: Record<string, Record<string, string>> = {};

  for (const m of messageList) {
    if (m.type === 'text' && m.content.startsWith('REACTION:')) {
      const parts = m.content.split(':');
      if (parts.length >= 3) {
        const targetId = parts[1];
        const emoji = parts.slice(2).join(':'); 
        if (!reactionsMap[targetId]) reactionsMap[targetId] = {};
        if (emoji === 'NONE') {
          delete reactionsMap[targetId][m.sender_id];
        } else {
          reactionsMap[targetId][m.sender_id] = emoji;
        }
      }
    } else {
      realMessages.push(m);
    }
  }

  for (const m of realMessages) {
    m.reactions = reactionsMap[m.id] || {};
  }

  const timeline: TimelineItem[] = [
    ...realMessages.map((m) => ({ kind: "message" as const, data: m, time: m.created_at })),
    ...callLogList
      .filter((c) => c.status !== null)
      .map((c) => ({ kind: "call" as const, data: c, time: c.started_at })),
  ].sort((a, b) => {
    const pa = a.kind === "message" && a.data.pending ? 1 : 0;
    const pb = b.kind === "message" && b.data.pending ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });

  const partnerDisplay = partner?.nickname ?? partner?.name ?? "…";
  const partnerInitial = partnerDisplay[0]?.toUpperCase() ?? "?";
  const partnerColor   = partner?.avatar_color ?? "var(--wine)";

  return (
    <motion.main 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans relative overflow-x-hidden" 
      style={{ 
        background: wallpaper === 'default' ? "var(--gradient)" : (wallpaper.startsWith('http') ? '#000' : wallpaper)
      }}
    >
      {wallpaper.startsWith('http') && (
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none bg-cover bg-center" style={{ backgroundImage: `url('${wallpaper}')` }} />
      )}

      {incomingCall && (
        <div className="absolute inset-x-0 top-0 z-50 mx-auto max-w-md">
          <div className="m-3 flex items-center gap-3.5 rounded-[16px] border border-white/10 bg-[#18181A]/90 px-4 py-4 shadow-xl backdrop-blur-md">
            <Avatar initial={partnerInitial} color={partnerColor} size={46} />
            <div className="flex-1">
              <p className="text-[15px] font-semibold text-[var(--cream)]">
                {partnerDisplay}
              </p>
              <p className="text-[13px] text-[var(--muted)]">
                Incoming {incomingCall.callType} call…
              </p>
            </div>
            <button
              onClick={handleDeclineCall}
              aria-label="Decline"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-red-700/80 text-white"
            >
              <PhoneOff className="h-5 w-5" strokeWidth={2} />
            </button>
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

      {!isOnline && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-[#5C4A10] px-4 py-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#F5C842]" />
          <span className="text-[13px] font-medium text-[#F5C842]">Waiting for network…</span>
        </div>
      )}

      <ChatHeader
        partnerInitial={partnerInitial}
        partnerColor={partnerColor}
        partnerDisplay={partnerDisplay}
        daysTogether={daysTogether}
        isOnline={isOnline}
        reconnecting={reconnecting}
        partnerIsOnline={partner?.is_online ?? false}
        partnerLastSeenText={formatLastSeen(partner?.last_seen ?? null, now)}
      />

      <MessageList
        timeline={timeline}
        myId={myId}
        handleReaction={handleReaction}
        partnerTyping={partnerTyping}
        bottomRef={bottomRef}
      />

      <ChatInput
        draft={draft}
        setDraft={setDraft}
        isOnline={isOnline}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        pickerTab={pickerTab}
        setPickerTab={setPickerTab}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        handleSendDirectURL={handleSendDirectURL}
        fileInputRef={fileInputRef}
        handleFileUpload={handleFileUpload}
        isRecording={isRecording}
        recordingTime={recordingTime}
        stopRecording={stopRecording}
        startRecording={startRecording}
        inputRef={inputRef}
        signalChRef={signalChRef}
        myId={myId}
        typingTimeoutRef={typingTimeoutRef}
        handleSend={handleSend}
        handleNudge={handleNudge}
        pendingMedia={pendingMedia}
        setPendingMedia={setPendingMedia}
        mediaCaption={mediaCaption}
        setMediaCaption={setMediaCaption}
        uploadMedia={uploadMedia}
      />
    </motion.main>
  );
}
