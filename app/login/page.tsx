"use client";

import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import "@fontsource/stack-sans-notch/400.css";
import "@fontsource/stack-sans-notch/700.css";
import { Lock, ChevronRight, ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";
import {
  CONVERSATION_ID,
  cacheTogetherSince,
  dayCountSince,
  hasLocalPin,
  loadCachedTogetherSince,
  loadProfile,
  setSignInNotice,
  setUnlocked,
  signOutAndWipe,
  verifyLocalPin,
} from "@/lib/auth";
import {
  authenticateBiometrics,
  isBiometricsEnabled,
  isBiometricsSupported,
} from "@/lib/biometrics";

// This page is prerendered on the server, where useLayoutEffect only logs a
// warning; the browser variant runs before paint, which is what we want.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function pickGreeting(name: string): string {
  const isNono = name.toLowerCase().includes("nono");
  const nonoGreetings = ["Heyy Cupcake🤍", "Finallyy she is here😩", "My babbyyy🥹", "Heyyy mama ❤️"];
  const myGreetings = ["Hey Bubba🤍", "Finallyy He is here😩", "My babbyyy🥹"];
  const pool = isNono ? nonoGreetings : myGreetings;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function Login() {
  const router = useRouter();
  const [dayCount, setDayCount] = useState<number | null>(null);
  const [pinError, setPinError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [userName, setUserName] = useState("?");
  const [avatarColor, setAvatarColor] = useState("#7A2C3B");
  const [greeting, setGreeting] = useState("");
  const [bioAvailable, setBioAvailable] = useState(false);
  const greetingSeededRef = useRef(false);

  const [showPinPad, setShowPinPad] = useState(false);

  // ── Paint from the device cache immediately ────────────────────────────────
  // The screen must never wait on an auth round-trip: name/avatar/greeting and
  // the day counter all come straight off localStorage (written by loadProfile
  // and the calendar on previous visits), so the lock UI is up on the first
  // frame. useLayoutEffect applies it before paint, so there's no flash.
  useIsoLayoutEffect(() => {
    const cachedName = localStorage.getItem("user_name");
    if (cachedName) {
      setUserName(cachedName);
      setAvatarColor(localStorage.getItem("avatar_color") ?? "#7A2C3B");
      setGreeting(pickGreeting(cachedName));
      greetingSeededRef.current = true;
    }
    const cachedDays = dayCountSince(loadCachedTogetherSince());
    if (cachedDays !== null) setDayCount(cachedDays);
  }, []);

  // ── Guard: needs a real session; a device without a PIN must set one first ──
  // Runs in the background and only ever *redirects* on failure — it never
  // blocks or blanks the lock screen (previously this returned null until
  // getSession() resolved, which is the slow, empty screen users noticed).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await loadProfile({ useCache: true });
      if (cancelled) return;
      if (!profile) { router.replace("/signin"); return; }
      if (!hasLocalPin()) { router.replace("/onboarding/pin-setup"); return; }

      const name = profile.nickname ?? profile.name;
      setUserName(name);
      setAvatarColor(profile.avatar_color ?? "#7A2C3B");
      if (!greetingSeededRef.current) {
        greetingSeededRef.current = true;
        setGreeting(pickGreeting(name));
      }

      // ── Fetch together_since → day count (cache-first, then revalidate) ──
      const { data } = await supabase
        .from("conversation")
        .select("together_since")
        .eq("id", CONVERSATION_ID)
        .maybeSingle();
      if (cancelled || !data?.together_since) return;
      cacheTogetherSince(data.together_since);
      setDayCount(dayCountSince(data.together_since));
    })();
    return () => { cancelled = true; };
  }, [router]);

  const initial = userName[0]?.toUpperCase() ?? "?";

  const failSignOut = useCallback(
    async (notice: string) => {
      await signOutAndWipe();
      setSignInNotice(notice);
      router.replace("/signin");
    },
    [router],
  );

  // ── Biometrics check & fast-path prompt ──────────────────────────────────
  useEffect(() => {
    if (!isBiometricsEnabled()) return;

    let active = true;
    isBiometricsSupported().then((supported) => {
      if (active && supported) {
        setBioAvailable(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const handleBiometrics = useCallback(async () => {
    const result = await authenticateBiometrics();
    if (result.ok) {
      setUnlocked();
      router.replace("/home");
      return;
    }
    if (result.error && !result.cancelled) {
      setErrorMsg(result.error);
      setTimeout(() => setErrorMsg(""), 2000);
    }
  }, [router]);



  const handleUnlockClick = () => {
    if (bioAvailable) {
      handleBiometrics();
    } else {
      setShowPinPad(true);
    }
  };

  // ── PIN verification (local only) ─────────────────────────────────────────
  const handlePinComplete = useCallback(
    async (pin: string) => {
      const { ok, attemptsLeft } = await verifyLocalPin(pin);

      if (ok) {
        setUnlocked();
        router.replace("/home");
        return;
      }

      if (attemptsLeft === 0) {
        await failSignOut("Too many wrong PINs — please sign in again.");
        return;
      }

      setPinError(true);
      setErrorMsg(
        `Wrong PIN — ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`,
      );
      setTimeout(() => { setPinError(false); setErrorMsg(""); }, 900);
    },
    [router, failSignOut],
  );

  return (
    <main className="shell-h relative mx-auto flex w-full max-w-md flex-col font-notch overflow-hidden">
      {/* Back button */}
      {showPinPad && (
        <button
          type="button"
          onClick={() => setShowPinPad(false)}
          aria-label="Go back"
          className="absolute top-[max(env(safe-area-inset-top,0px),1.5rem)] left-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)] transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5 stroke-[3] text-white mr-[2px]" />
        </button>
      )}

      {/* Blurred Background */}
      <div
        className="absolute inset-0 z-0 scale-[1.08] bg-cover bg-center bg-no-repeat blur-md"
        style={{ backgroundImage: "url('/images/welcome-couple.jpeg')" }}
      />
      {/* Overlay to ensure text readability */}
      <div className="absolute inset-0 z-0 bg-black/40" />

      {/* Top — together counter */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1 px-4 pt-28 pb-8">
        <div
          className="text-[52px] font-normal leading-none text-[var(--cream)] flex items-center justify-center"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          <span>
            {dayCount !== null ? `Día ${dayCount}` : "—"}
          </span>

          <div
            aria-hidden
            className="ml-3 flex items-center gap-2"
          >
            <div className="relative h-[38px] w-[38px]">
              <Image src="/images/white_heart_3d.png" alt="White Heart" fill className="object-contain" />
            </div>
            <div className="relative h-[38px] w-[38px]">
              <Image src="/images/locked_with_key_3d.png" alt="Locked" fill className="object-contain" />
            </div>
          </div>
        </div>
      </div>

      {!showPinPad ? (
        <div
          className="relative z-10 flex flex-col items-center gap-6 rounded-t-[36px] border-t border-white/10 bg-[#18181A]/90 px-6 backdrop-blur-2xl pb-[calc(env(safe-area-inset-bottom,0px)+4rem)] pt-10 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
        >
          <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl">
            <Lock className="h-[60px] w-[60px] text-[var(--gold)]" strokeWidth={2} />
          </div>

          <p className="mt-1 text-[26px] font-bold text-[var(--cream)] text-center font-notch tracking-tight px-2">
            {greeting}
          </p>

          <SlideButton onUnlock={handleUnlockClick} />

          {errorMsg && !showPinPad && (
            <p className="text-[15px] text-red-400">{errorMsg}</p>
          )}

          <button
            type="button"
            onClick={() => setShowPinPad(true)}
            className="py-3 text-[15px] text-white/60 transition-colors hover:text-white"
          >
            Use PIN instead
          </button>
        </div>
      ) : (
        <div
          className="relative z-10 flex flex-col items-center gap-5 rounded-t-[36px] border-t border-white/10 bg-[#18181A]/90 px-6 backdrop-blur-2xl pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-8 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
        >
          {/* Avatar */}
          <div
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[18px] font-semibold text-[var(--cream)] shadow-md mt-6"
            style={{ backgroundColor: avatarColor }}
          >
            {initial}
          </div>

          <PinPad
            onComplete={handlePinComplete}
            error={pinError}
            label="Enter PIN"
            showBiometric={bioAvailable}
            onBiometric={handleBiometrics}
          />

          {errorMsg && (
            <p className="text-[14px] text-red-400">{errorMsg}</p>
          )}

          <button
            type="button"
            onClick={() => router.push("/onboarding/pin-setup")}
            className="text-[14px] text-white/60 underline-offset-2 active:underline hover:text-white transition-colors"
          >
            Forgot PIN?
          </button>
        </div>
      )}
    </main>
  );
}

function SlideButton({ onUnlock }: { onUnlock: () => void }) {
  const containerWidth = 260;
  const knobWidth = 48; 
  const maxDrag = containerWidth - knobWidth - 16; 

  // Pointer-event drag instead of framer-motion: the knob and label are moved
  // by writing their styles directly (no React re-render per move), and the
  // snap animations are plain CSS transitions on transform/opacity.
  const knobRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startOffset: number } | null>(null);
  const offsetRef = useRef(0);

  const applyOffset = useCallback((offset: number, transition: string) => {
    offsetRef.current = offset;
    const knob = knobRef.current;
    if (knob) {
      knob.style.transition = transition;
      knob.style.transform = `translateX(${offset}px)`;
    }
    const label = labelRef.current;
    if (label) {
      label.style.opacity = String(Math.max(0, 1 - offset / (maxDrag * 0.5)));
    }
  }, [maxDrag]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startOffset: offsetRef.current,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    // Kill any in-flight snap so the knob tracks the finger exactly.
    applyOffset(offsetRef.current, "none");
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const next = Math.min(maxDrag, Math.max(0, drag.startOffset + (e.clientX - drag.startX)));
    applyOffset(next, "none");
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragStateRef.current = null;

    if (offsetRef.current > maxDrag * 0.65) {
      // Fire functional unlock immediately
      onUnlock();
      // Zip to the very end instantly
      applyOffset(maxDrag, "transform 0.05s linear");
      // Whip back to the start smoothly but very fast
      window.setTimeout(() => applyOffset(0, "transform 0.15s cubic-bezier(0.32, 0.72, 0, 1)"), 60);
    } else {
      // Return to start if let go early
      applyOffset(0, "transform 0.15s cubic-bezier(0.32, 0.72, 0, 1)");
    }
  };

  return (
    <div className="relative mt-4 flex h-[64px] w-[260px] items-center rounded-full bg-white/[0.85] backdrop-blur-xl border border-white/60 p-2 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_10px_24px_-6px_rgba(188,21,41,0.4)] overflow-hidden">
      <div
        ref={labelRef}
        className="absolute inset-0 z-0 flex items-center justify-center pl-6 pointer-events-none"
      >
        <span className="text-[17px] font-semibold tracking-wide text-[var(--wine)]">
          Slide to unlock
        </span>
      </div>

      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative z-10 flex h-[48px] w-[48px] cursor-grab active:cursor-grabbing touch-none select-none items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)]"
      >
        <ChevronRight className="h-6 w-6 stroke-[3] text-white ml-[2px]" />
      </div>
    </div>
  );
}
