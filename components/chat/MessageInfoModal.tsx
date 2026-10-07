"use client";

import { motion } from "framer-motion";
import { Info, Check, CheckCheck, Clock, X } from "lucide-react";
import { Message } from "@/hooks/useChatStore";

interface MessageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  myId: string;
  partnerName: string;
}

export default function MessageInfoModal({
  isOpen,
  onClose,
  message,
  myId,
  partnerName,
}: MessageInfoModalProps) {
  if (!isOpen || !message) return null;

  const isMine = message.sender_id === myId;
  const isDeleted = message.is_deleted || message.content === "This message was deleted";

  function formatDateTime(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (isToday) {
      return `Today, ${timeStr}`;
    }
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
  }

  let previewContent = message.content;
  if (message.type === "image") previewContent = "📷 Photo";
  else if (message.type === "video") previewContent = "🎥 Video";
  else if (message.type === "audio") previewContent = "🎵 Voice note";
  else if (isDeleted) previewContent = "This message was deleted";

  return (
    <div 
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="bg-[#18181A] border border-white/10 rounded-[28px] w-full max-w-sm shadow-2xl p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2 text-white">
            <Info className="w-5 h-5 text-blue-400" />
            <h3 className="text-[17px] font-bold">Message Info</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message snippet preview */}
        <div className="mb-6 p-3.5 rounded-2xl bg-white/5 border border-white/5">
          <div className="text-[11px] font-semibold text-white/50 mb-1">
            {isMine ? "You" : partnerName}
          </div>
          <div className="text-[14px] text-white/90 line-clamp-3 italic">
            &ldquo;{previewContent}&rdquo;
          </div>
        </div>

        {/* Status Timeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <div className="flex items-center gap-2 text-white/70 text-[14px]">
              <Check className="w-4 h-4 text-white/50" />
              <span>Sent</span>
            </div>
            <span className="text-[13px] font-medium text-white/90">
              {message.created_at ? formatDateTime(message.created_at) : "Pending"}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <div className="flex items-center gap-2 text-white/70 text-[14px]">
              <CheckCheck className={`w-4 h-4 ${message.status === 'delivered' || message.status === 'read' ? 'text-white/80' : 'text-white/30'}`} />
              <span>Delivered</span>
            </div>
            <span className="text-[13px] font-medium text-white/90">
              {message.status === 'delivered' || message.status === 'read'
                ? formatDateTime(message.created_at)
                : message.pending || message.queued
                ? "Pending"
                : "Sent"}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <div className="flex items-center gap-2 text-white/70 text-[14px]">
              <CheckCheck className={`w-4 h-4 ${message.status === 'read' ? 'text-[#F5C842]' : 'text-white/30'}`} />
              <span>Read</span>
            </div>
            <span className="text-[13px] font-medium text-white/90">
              {message.status === 'read'
                ? formatDateTime(message.created_at)
                : "Not read yet"}
            </span>
          </div>
        </div>

        <button 
          onClick={onClose} 
          className="w-full mt-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-[14px] transition-colors active:scale-[0.98]"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}
