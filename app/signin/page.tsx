"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { clearLocalPin, hasLocalPin, lockApp, loadProfile, takeSignInNotice } from "@/lib/auth";

/**
 * One-time-per-device sign-in. This creates the real Supabase session that the
 * server trusts; the 4-digit PIN afterwards is only a local lock on top of it.
 */
export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setNotice(takeSignInNotice() ?? "");

    // Already signed in on this device? Skip straight on.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(hasLocalPin() ? "/login" : "/onboarding/pin-setup");
      else setChecking(false);
    });
  }, [router]);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");

    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authErr) {
      setError(
        authErr.message === "Invalid login credentials"
          ? "Wrong email or password."
          : "Couldn't sign in. Check your connection and try again.",
      );
      setBusy(false);
      return;
    }

    const profile = await loadProfile();
    if (!profile) {
      await supabase.auth.signOut({ scope: "local" });
      setError("This account isn't linked to Just Us.");
      setBusy(false);
      return;
    }

    // New sign-in = new local PIN for this device
    clearLocalPin();
    lockApp();
    router.replace("/onboarding/profile");
  }

  if (checking) return null;

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col font-sans overflow-hidden">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        type="button"
        onClick={() => router.push("/onboarding/welcome")}
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

      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center"
      >
        <p
          className="text-[26px] leading-tight text-[#F5F0E8] font-bold tracking-tight"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Sign in to Just Us
        </p>
        <p className="max-w-[260px] text-[12px] leading-relaxed text-[#8A8177]">
          Only needed once on each device. After this you&apos;ll just use your PIN.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 70 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col gap-3.5 rounded-t-[36px] bg-[#26221E] px-6 pb-12 pt-9 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
      >
        {notice && <p className="text-[12px] text-[#C9A66B]">{notice}</p>}

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-2xl border border-[#3A342E] bg-[#1E1B18] px-4 py-3.5 text-[15px] text-[#F5F0E8] outline-none placeholder:text-[#8A8177] focus:border-[var(--wine)] focus:ring-1 focus:ring-[var(--wine)]"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          placeholder="Password"
          className="w-full rounded-2xl border border-[#3A342E] bg-[#1E1B18] px-4 py-3.5 text-[15px] text-[#F5F0E8] outline-none placeholder:text-[#8A8177] focus:border-[var(--wine)] focus:ring-1 focus:ring-[var(--wine)]"
        />

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <div className="mt-6 flex w-full items-center justify-between pl-1 pr-0">
          {/* Progress dots - Step 2 */}
          <div className="flex items-center gap-[6px]">
            <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
            <span className="h-[6px] w-[20px] rounded-full bg-[var(--gold)]" />
            <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
            <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
          </div>

          <button
            onClick={handleSignIn}
            disabled={busy}
            className="group flex h-[60px] items-center justify-center gap-4 rounded-full bg-white/[0.82] backdrop-blur-xl border border-white/60 pl-8 pr-2 text-[var(--wine)] shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_10px_24px_-6px_rgba(188,21,41,0.4)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.03] hover:bg-white/95 hover:border-white/80 hover:shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),0_20px_35px_-8px_rgba(188,21,41,0.55),0_10px_20px_-4px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.98] active:duration-100 disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className="text-[17px] font-semibold tracking-wide">
              {busy ? "Signing in…" : "Sign in"}
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
