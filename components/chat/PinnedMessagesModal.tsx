"use client";

import { motion } from "framer-motion";
import { Pin, X, ArrowUpRight } from "lucide-react";
import { Message } from "@/hooks/useChatStore";

interface PinnedMessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  pinnedMessages: Message[];
  myId: string;
  partnerName: string;
  onNavigateToMessage: (id: string) => void;
  onUnpin: (id: string) => void;
}

export default function PinnedMessagesModal({
  isOpen,
  onClose,
  pinnedMessages,
  myId,
  partnerName,
  onNavigateToMessage,
  onUnpin,
}: PinnedMessagesModalProps) {
  if (!isOpen) return null;

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
        className="bg-[#18181A] border border-white/10 rounded-[28px] w-full max-w-sm max-h-[80vh] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2 text-white">
            <Pin className="w-5 h-5 text-[var(--gold)]" />
            <h3 className="text-[17px] font-bold">Pinned Messages ({pinnedMessages.length})</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 divide-y divide-white/5">
          {pinnedMessages.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-[14px]">
              No pinned messages yet.
            </div>
          ) : (
            pinnedMessages.map((msg) => (
              <div 
                key={msg.id} 
                className="py-3 px-2 flex items-center justify-between gap-3 group hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                onClick={() => {
                  onClose();
                  onNavigateToMessage(msg.id);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-semibold text-[var(--gold)]">
                      {msg.sender_id === myId ? "You" : partnerName}
                    </span>
                    <span className="text-[10px] text-white/40">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[13px] text-white/90 truncate">
                    {msg.type === "image" ? "📷 Photo" : msg.type === "audio" ? "🎵 Voice note" : msg.type === "video" ? "🎥 Video" : msg.content}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    title="Unpin"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnpin(msg.id);
                    }}
                    className="p-2 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="p-2 text-white/60 group-hover:text-white transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
