"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
    <main
      className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans"
      style={{ background: "linear-gradient(160deg, #1A1210 0%, #3B1520 100%)" }}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#C9A66B]">
          Onboarding
        </p>
        <p
          className="text-[26px] leading-tight text-[#F5F0E8]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Sign in to Just Us
        </p>
        <p className="max-w-[260px] text-[12px] leading-relaxed text-[#8A8177]">
          Only needed once on each device. After this you&apos;ll just use your PIN.
        </p>
      </div>

      <div className="relative z-10 flex flex-col gap-3 rounded-t-[22px] bg-[#26221E] px-[18px] pb-8 pt-5">
        {notice && <p className="text-[12px] text-[#C9A66B]">{notice}</p>}

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-[10px] border border-[#3A342E] bg-[#1E1B18] px-[13px] py-3 text-[14px] text-[#F5F0E8] outline-none placeholder:text-[#8A8177] focus:border-[#7A2C3B]"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
          placeholder="Password"
          className="w-full rounded-[10px] border border-[#3A342E] bg-[#1E1B18] px-[13px] py-3 text-[14px] text-[#F5F0E8] outline-none placeholder:text-[#8A8177] focus:border-[#7A2C3B]"
        />

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <button
          onClick={handleSignIn}
          disabled={busy}
          className="mt-1 w-full rounded-[10px] bg-[#7A2C3B] py-3 text-[13px] font-medium text-[#F5F0E8] transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </main>
  );
}
