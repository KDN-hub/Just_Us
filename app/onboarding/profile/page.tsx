"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { loadProfile } from "@/lib/auth";

/**
 * "What should we call you?" — the person is already identified by the account they
 * signed in with, so there's no "Who are you?" picker (it let anyone claim either account).
 */
export default function ProfileSetup() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile().then((profile) => {
      if (!profile) { router.replace("/signin"); return; }
      setUserId(profile.id);
      setNickname(profile.nickname ?? profile.name);
    });
  }, [router]);

  async function handleContinue() {
    const displayName = nickname.trim();
    if (!displayName) {
      setError("Please enter what you'd like to be called.");
      return;
    }
    if (!userId) return;

    setSaving(true);
    setError("");

    const { error: dbErr } = await supabase
      .from("users")
      .update({ nickname: displayName })
      .eq("id", userId);

    if (dbErr) {
      setError("Couldn't save. Please try again.");
      setSaving(false);
      return;
    }

    localStorage.setItem("user_name", displayName);
    router.push("/onboarding/pin-setup");
  }

  if (!userId) return null;

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col font-notch overflow-hidden">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        type="button"
        onClick={() => router.push("/signin")}
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
        className="relative z-10 flex flex-col gap-4 rounded-t-[36px] bg-[var(--card)] px-6 pb-24 pt-9 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
      >
        <div>
          <motion.h2 
            initial={{ opacity: 0, filter: "blur(6px)", y: 10 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-[24px] font-notch font-bold tracking-tight text-[var(--cream)]"
          >
            What should we call you?
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, filter: "blur(6px)", y: 10 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-1 text-[13px] leading-relaxed text-white/60"
          >
            This is the nickname your partner will see on Just Us.
          </motion.p>
        </div>

        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleContinue()}
          placeholder="Your name"
          autoComplete="off"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-base text-[var(--cream)] outline-none placeholder:text-white/40 focus:border-[var(--wine)] focus:ring-1 focus:ring-[var(--wine)]"
        />

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <div className="mt-6 flex w-full items-center justify-between pl-1 pr-0">
          {/* Progress dots - Step 3 */}
          <div className="flex items-center gap-[6px]">
            <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
            <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
            <span className="h-[6px] w-[20px] rounded-full bg-[var(--gold)]" />
            <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
          </div>

          <button
            onClick={handleContinue}
            disabled={saving}
            className="group flex h-[60px] items-center justify-center gap-4 rounded-full bg-white/[0.82] backdrop-blur-xl border border-white/60 pl-8 pr-2 text-[var(--wine)] shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_10px_24px_-6px_rgba(188,21,41,0.4)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.03] hover:bg-white/95 hover:border-white/80 hover:shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),0_20px_35px_-8px_rgba(188,21,41,0.55),0_10px_20px_-4px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.98] active:duration-100 disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="text-[17px] font-semibold tracking-wide">
              {saving ? "Saving…" : "Continue"}
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
