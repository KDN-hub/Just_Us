"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { CONVERSATION_ID, loadProfile, markSetupComplete } from "@/lib/auth";

export default function TogetherSince() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Must be signed in; if setup is already complete, skip this step
  useEffect(() => {
    loadProfile({ useCache: true }).then((profile) => {
      if (!profile) { router.replace("/signin"); return; }
      if (localStorage.getItem("setup_complete") === "true") router.replace("/chat");
    });
  }, [router]);

  async function handleFinish() {
    if (!date) {
      setError("Please pick a date.");
      return;
    }
    setSaving(true);
    setError("");

    // Update the singleton conversation row
    const { error: dbErr } = await supabase
      .from("conversation")
      .update({ together_since: date })
      .eq("id", CONVERSATION_ID);

    if (dbErr) {
      setError("Couldn't save the date. Please try again.");
      setSaving(false);
      return;
    }

    markSetupComplete();
    router.replace("/chat");
  }

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col font-notch overflow-hidden">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        type="button"
        onClick={() => router.push("/onboarding/pin-setup")}
        aria-label="Go back"
        className="absolute top-6 left-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)] transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <ChevronLeft className="h-5 w-5 stroke-[3] text-white mr-[2px]" />
      </motion.button>

      {/* Blurred Background */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute inset-0 z-0 scale-[1.08] bg-cover bg-center bg-no-repeat blur-md"
        style={{ backgroundImage: "url('/images/welcome-couple.jpeg')" }}
      />
      {/* Overlay to ensure text readability */}
      <div className="absolute inset-0 z-0 bg-black/40" />

      {/* Top spacer */}
      <div className="relative z-10 flex flex-1 items-center justify-center"></div>

      {/* Bottom sheet */}
      <motion.div
        initial={{ opacity: 0, y: 70 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col gap-4 rounded-t-[36px] bg-[var(--card)] px-6 pb-12 pt-9 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
      >
        <div>
          <h2 className="text-[24px] font-notch font-bold tracking-tight text-[var(--cream)]">
            When did you two start?
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            Sets your relationship streak counter — only entered once, ever.
          </p>
        </div>

        {/* Date input */}
        <div className="flex w-full items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 focus-within:border-[var(--wine)] focus-within:ring-1 focus-within:ring-[var(--wine)]">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-transparent text-base tracking-wide text-[var(--cream)] outline-none [color-scheme:dark]"
            max={new Date().toISOString().split("T")[0]}
          />
          <Calendar
            className="h-5 w-5 shrink-0 text-[var(--muted)]"
            strokeWidth={2}
            aria-hidden
          />
        </div>

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <div className="mt-6 flex w-full items-center justify-between pl-1 pr-0">
          {/* Progress dots - Step 4 */}
          <div className="flex items-center gap-[6px]">
            <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
            <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
            <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
            <span className="h-[6px] w-[20px] rounded-full bg-[var(--gold)]" />
          </div>

          <button
            onClick={handleFinish}
            disabled={saving}
            className="group flex h-[60px] items-center justify-center gap-4 rounded-full bg-white/[0.82] backdrop-blur-xl border border-white/60 pl-8 pr-2 text-[var(--wine)] shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_10px_24px_-6px_rgba(188,21,41,0.4)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.03] hover:bg-white/95 hover:border-white/80 hover:shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),0_20px_35px_-8px_rgba(188,21,41,0.55),0_10px_20px_-4px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.98] active:duration-100 disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="text-[17px] font-semibold tracking-wide">
              {saving ? "Saving…" : "Finish"}
            </span>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)] transition-transform group-hover:translate-x-1">
              <ChevronRight className="h-5 w-5 stroke-[3] text-white ml-[2px]" />
            </div>
          </button>
        </div>
      </motion.div>
    </main>
  );
}
