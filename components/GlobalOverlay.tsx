"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function GlobalOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const dragConstraintsRef = useRef<HTMLDivElement>(null);
  
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; body: string; type: string }>>([]);

  useEffect(() => {
    const id = localStorage.getItem("user_id") || localStorage.getItem("my_id");
    if (id) setMyId(id);
  }, [pathname]);

  useEffect(() => {
    if (!myId) return;

    // Use a unique channel for notifications
    const channel = supabase.channel("chat_signal");
    
    channel.on("broadcast", { event: "nudge" }, (payload) => {
      if (payload.payload?.userId !== myId && pathname !== '/chat') {
        addToast("Nudge! 💖", "Your partner sent you a nudge!", "nudge");
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
    });

    channel.on("broadcast", { event: "message" }, (payload) => {
      if (payload.payload?.userId !== myId && pathname !== '/chat') {
         let preview = payload.payload?.content || "Sent a message";
         if (preview.startsWith("IMAGE_URL:")) preview = "Sent an image";
         if (preview.startsWith("VIDEO_URL:")) preview = "Sent a video";
         if (preview.startsWith("AUDIO_URL:")) preview = "Sent a voice note";
         addToast("New Message", preview, "message");
         if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200]);
      }
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, pathname]);

  const addToast = (title: string, body: string, type: string) => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, title, body, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleSendNudge = async () => {
    if (!myId || !channelRef.current) return;
    
    // Broadcast nudge
    channelRef.current.send({
      type: "broadcast",
      event: "nudge",
      payload: { userId: myId, userName: typeof window !== 'undefined' ? localStorage.getItem('user_name') || 'Your partner' : 'Your partner' }
    });
    
    // Optimistic UI for sender
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    
    // Save to DB
    await supabase.from("messages").insert({
       id: crypto.randomUUID(),
       sender_id: myId,
       content: "NUDGE_PING_💖",
       type: "text",
       status: "sent"
    });
  };

  if (!myId || pathname === "/login" || pathname === "/signin" || pathname === "/" || pathname?.startsWith("/onboarding")) {
    return null;
  }

  return (
    <>
      {/* Toasts Container */}
      <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 p-4 pointer-events-none pt-[max(env(safe-area-inset-top),1rem)]">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="bg-[#18181A]/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto flex items-center gap-4 cursor-pointer"
              onClick={() => router.push('/chat')}
            >
              <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                {t.type === 'nudge' ? <Heart className="h-5 w-5 text-red-500 fill-current" /> : <MessageSquare className="h-5 w-5 text-white/80" />}
              </div>
              <div className="flex-col min-w-0 flex-1">
                 <div className="text-white font-medium text-[15px]">{t.title}</div>
                 <div className="text-white/60 text-[13px] truncate">{t.body}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Nudge Button & Constraints Area */}
      <div ref={dragConstraintsRef} className="fixed inset-0 pointer-events-none z-[89]" />
      <motion.button
        drag
        dragConstraints={dragConstraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        whileTap={{ scale: 0.9 }}
        whileDrag={{ scale: 1.1 }}
        onClick={handleSendNudge}
        className="fixed z-[90] bottom-[90px] right-5 h-14 w-14 rounded-full bg-[#18181A]/80 backdrop-blur-xl flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/10 active:bg-white/10 transition-colors cursor-grab active:cursor-grabbing"
      >
        <Heart className="h-6 w-6 text-[var(--wine)] fill-current drop-shadow-[0_0_8px_rgba(188,21,41,0.5)]" />
      </motion.button>
    </>
  );
}
