"use client";

import { motion } from "framer-motion";
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  canDeleteForEveryone: boolean;
  onDeleteForMe: () => void;
  onDeleteForEveryone?: () => void;
  count?: number;
}

export default function DeleteMessageModal({
  isOpen,
  onClose,
  canDeleteForEveryone,
  onDeleteForMe,
  onDeleteForEveryone,
  count = 1,
}: DeleteMessageModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="bg-[#18181A] border border-white/10 rounded-[24px] p-6 w-full max-w-[320px] shadow-2xl flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
          <Trash2 className="w-6 h-6 stroke-[2]" />
        </div>

        <h3 className="text-[19px] font-bold text-white mb-1.5 text-center">
          {count > 1 ? `Delete ${count} messages?` : "Delete message?"}
        </h3>

        <p className="text-white/60 text-[13px] text-center mb-6 leading-relaxed">
          {canDeleteForEveryone
            ? "You can delete this message for everyone in the chat, or just remove it from your device."
            : "This will remove the message from your device. Your partner will still be able to see it."}
        </p>

        <div className="w-full flex flex-col gap-2.5">
          {canDeleteForEveryone && onDeleteForEveryone && (
            <button
              onClick={() => {
                onDeleteForEveryone();
                onClose();
              }}
              className="w-full py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold text-[14px] transition-colors border border-red-500/30 active:scale-[0.98]"
            >
              Delete for everyone
            </button>
          )}

          <button
            onClick={() => {
              onDeleteForMe();
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-[14px] transition-colors active:scale-[0.98]"
          >
            Delete for me
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-white/50 hover:text-white/80 font-medium text-[14px] transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
