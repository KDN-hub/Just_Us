"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";

/**
 * The draggable floating nudge button. Lives in its own (lazily imported)
 * module so framer-motion — needed only for `drag` — stays out of the First
 * Load JS of routes that don't render the overlay (login/signin/onboarding).
 */
export default function NudgeButton({ onSend }: { onSend: () => void }) {
  const dragConstraintsRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* Full-viewport constraint area: the button can be dragged anywhere on
          screen but never off it (same behavior as before). */}
      <div ref={dragConstraintsRef} className="fixed inset-0 pointer-events-none z-[89]" />
      <motion.button
        drag
        dragConstraints={dragConstraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        whileTap={{ scale: 0.9 }}
        whileDrag={{ scale: 1.1 }}
        onClick={onSend}
        className="fixed z-[90] bottom-[90px] right-5 h-14 w-14 rounded-full bg-[#18181A]/80 backdrop-blur-xl flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.5)] border border-white/10 active:bg-white/10 transition-colors cursor-grab active:cursor-grabbing"
      >
        <Heart className="h-6 w-6 text-[var(--wine)] fill-current drop-shadow-[0_0_8px_rgba(188,21,41,0.5)]" />
      </motion.button>
    </>
  );
}
