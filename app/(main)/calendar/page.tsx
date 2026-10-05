"use client";

import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Heart } from "lucide-react";

export default function CalendarPage() {
  return (
    <div 
      className="relative flex min-h-full w-full flex-col p-6 pb-28"
    >
      <div className="mt-12">
        <h1 className="text-[32px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-fraunces), serif" }}>
          Calendar
        </h1>
        <p className="text-white/70 mt-1">Our shared timeline.</p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {/* Default Anniversary Item */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="relative overflow-hidden flex items-center gap-4 rounded-2xl border border-white/10 bg-[#18181A]/90 p-4 backdrop-blur-md shadow-lg"
        >
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white/20 text-white">
            <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Nov</span>
            <span className="text-[22px] font-bold leading-none mt-0.5">7</span>
          </div>
          <div className="flex-1">
            <h2 className="text-[17px] font-semibold text-white flex items-center gap-2">
              Our Anniversary <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            </h2>
            <p className="text-[14px] text-white/70 mt-0.5">Yearly celebration!</p>
          </div>
        </motion.div>
        
        {/* Placeholder for future calendar UI */}
        <div className="mt-4 rounded-2xl border border-dashed border-white/30 p-8 text-center">
          <CalendarIcon className="mx-auto h-8 w-8 text-white/50 mb-3" />
          <p className="text-[15px] font-medium text-white/80">Full calendar coming soon</p>
          <p className="text-[13px] text-white/50 mt-1">Schedule and plan together</p>
        </div>
      </div>
    </div>
  );
}
