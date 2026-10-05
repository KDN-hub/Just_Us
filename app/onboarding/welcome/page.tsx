"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Welcome() {
  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-10 text-center font-notch overflow-hidden"
      style={{
        background: "var(--gradient)",
      }}
    >
      {/* Main Content Area - Centers vertically in available space */}
      <div className="flex flex-1 flex-col items-center justify-center gap-12">
        {/* Circular couple photo (Larger & Premium) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative h-[240px] w-[240px] animate-float overflow-hidden rounded-full border-[3px] border-[var(--gold)] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),0_0_45px_rgba(201,166,107,0.3)]"
        >
          <Image
            src="/images/welcome-couple.jpeg"
            alt="Just Us"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 240px, 240px"
          />
        </motion.div>

        {/* Text Content */}
        <div className="flex flex-col gap-4 px-2">
          <motion.h1 
            initial={{ opacity: 0, y: 15, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-[44px] font-bold tracking-tight leading-[1.1] text-[var(--cream)]"
          >
            Made for just
            <br />
            the two of us
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 15, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="text-[17px] font-medium tracking-tight leading-relaxed text-white/60"
          >
            No strangers, no groups.
            <br />
            Just a space for YOU and I
          </motion.p>
        </div>
      </div>

      {/* Bottom Action Row (Anchored to bottom) */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="mt-12 flex w-full items-center justify-between pb-6 pl-2 pr-1"
      >
        {/* Progress dots */}
        <div className="flex items-center gap-[6px]">
          <span className="h-[6px] w-[20px] rounded-full bg-[var(--gold)]" />
          <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
          <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
          <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
        </div>

        {/* Next Button */}
        <Link
          href="/signin"
          className="group flex h-[60px] items-center justify-center gap-4 rounded-full bg-white/[0.82] backdrop-blur-xl border border-white/60 pl-8 pr-2 text-[var(--wine)] shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_10px_24px_-6px_rgba(188,21,41,0.4)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.03] hover:bg-white/95 hover:border-white/80 hover:shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),0_20px_35px_-8px_rgba(188,21,41,0.55),0_10px_20px_-4px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.98] active:duration-100"
        >
          <span className="text-[17px] font-semibold tracking-wide">Get started</span>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)] transition-transform group-hover:translate-x-1">
            <ChevronRight className="h-5 w-5 stroke-[3] text-white ml-[2px]" />
          </div>
        </Link>
      </motion.div>
    </main>
  );
}
