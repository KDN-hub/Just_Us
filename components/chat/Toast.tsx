"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertCircle, Info } from "lucide-react";

export interface ToastMessage {
  id: string;
  text: string;
  type?: "success" | "error" | "info";
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-20 inset-x-0 mx-auto max-w-sm z-[150] pointer-events-none flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => onDismiss(toast.id)}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#1C1C1E]/95 text-white text-[13px] font-medium shadow-2xl border border-white/15 backdrop-blur-xl"
          >
            {toast.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : toast.type === "info" ? (
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-[#5BD05F] shrink-0" />
            )}
            <span>{toast.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
