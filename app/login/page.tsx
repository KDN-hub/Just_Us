"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, ChevronRight, ChevronLeft } from "lucide-react";
import { motion, useAnimation, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";
import {
  CONVERSATION_ID,
  hasLocalPin,
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

export default function Login() {
  const router = useRouter();
  const [dayCount, setDayCount] = useState<number | null>(null);
  const [pinError, setPinError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("?");
  const [avatarColor, setAvatarColor] = useState("#7A2C3B");
  const [greeting, setGreeting] = useState("");
  const [bioAvailable, setBioAvailable] = useState(false);
  const autoPromptedRef = useRef(false);

  const [showPinPad, setShowPinPad] = useState(false);

  // ── Guard: needs a real session; a device without a PIN must set one first ──
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

      const isNono = name.toLowerCase().includes("nono");
      const nonoGreetings = ["Heyy Cupcake🤍", "Finallyy she is here😩", "My babbyyy🥹", "Heyyy mama ❤️"];
      const myGreetings = ["Hey Bubba🤍", "Finallyy He is here😩", "My babbyyy🥹"];
      const pool = isNono ? nonoGreetings : myGreetings;
      setGreeting(pool[Math.floor(Math.random() * pool.length)]);

      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const initial = userName[0]?.toUpperCase() ?? "?";

  // ── Fetch together_since → day count ──────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    supabase
      .from("conversation")
      .select("together_since")
      .eq("id", CONVERSATION_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.together_since) {
          setDayCount(
            Math.floor((Date.now() - new Date(data.together_since).getTime()) / 86_400_000),
          );
        }
      });
  }, [ready]);

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
    if (!ready) return;
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
  }, [ready]);

  const handleBiometrics = useCallback(async () => {
    const result = await authenticateBiometrics();
    if (result.ok) {
      setUnlocked();
      router.replace("/chat");
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
        router.replace("/chat");
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

  if (!ready) return null;

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col font-notch overflow-hidden">
      {/* Back button */}
      {showPinPad && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          type="button"
          onClick={() => setShowPinPad(false)}
          aria-label="Go back"
          className="absolute top-6 left-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)] transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5 stroke-[3] text-white mr-[2px]" />
        </motion.button>
      )}

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

      {/* Top — together counter */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1 px-4 pt-28 pb-8">
        <div
          className="text-[52px] font-normal leading-none text-[var(--cream)] flex items-center justify-center"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          <motion.span
            initial={{ opacity: 0, y: 15, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {dayCount !== null ? `Día ${dayCount}` : "—"}
          </motion.span>

          <motion.div 
            initial={{ opacity: 0, scale: 0.6, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden 
            className="ml-3 flex items-center gap-2"
          >
            <div className="relative h-[38px] w-[38px]">
              <Image src="/images/white_heart_3d.png" alt="White Heart" fill className="object-contain" />
            </div>
            <div className="relative h-[38px] w-[38px]">
              <Image src="/images/locked_with_key_3d.png" alt="Locked" fill className="object-contain" />
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!showPinPad ? (
          <motion.div
            key="unlock-card"
            initial={{ opacity: 0, y: 70 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 70 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center gap-6 rounded-t-[36px] bg-[var(--card)] px-6 pb-16 pt-10 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.5, filter: "blur(10px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl"
            >
              <Lock className="h-[60px] w-[60px] text-[var(--gold)]" strokeWidth={2} />
            </motion.div>

            <motion.p 
              initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mt-1 text-[26px] font-bold text-[var(--cream)] text-center font-notch tracking-tight px-2"
            >
              {greeting}
            </motion.p>

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
          </motion.div>
        ) : (
          <motion.div
            key="pin-card"
            initial={{ opacity: 0, y: 70 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 70 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center gap-5 rounded-t-[36px] bg-[var(--card)] px-6 pb-24 pt-8 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
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
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function SlideButton({ onUnlock }: { onUnlock: () => void }) {
  const containerWidth = 260;
  const knobWidth = 48; 
  const maxDrag = containerWidth - knobWidth - 16; 

  const x = useMotionValue(0);
  const controls = useAnimation();
  
  const textOpacity = useTransform(x, [0, maxDrag * 0.5], [1, 0]);
  
  const handleDragEnd = async () => {
    if (x.get() > maxDrag * 0.65) {
      // Fire functional unlock immediately
      onUnlock();
      // Zip to the very end instantly
      await controls.start({ 
        x: maxDrag,
        transition: { type: "tween", duration: 0.05, ease: "linear" }
      });
      // Whip back to the start smoothly but very fast
      controls.start({ 
        x: 0,
        transition: { type: "tween", duration: 0.15, ease: "circOut" }
      });
    } else {
      // Return to start if let go early
      controls.start({ 
        x: 0,
        transition: { type: "tween", duration: 0.15, ease: "circOut" } 
      });
    }
  };

  return (
    <div className="relative mt-4 flex h-[64px] w-[260px] items-center rounded-full bg-white/[0.85] backdrop-blur-xl border border-white/60 p-2 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_10px_24px_-6px_rgba(188,21,41,0.4)] overflow-hidden">
      <motion.div 
        style={{ opacity: textOpacity }}
        className="absolute inset-0 z-0 flex items-center justify-center pl-6 pointer-events-none"
      >
        <span className="text-[17px] font-semibold tracking-wide text-[var(--wine)]">
          Slide to unlock
        </span>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: maxDrag }}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className="relative z-10 flex h-[48px] w-[48px] cursor-grab active:cursor-grabbing items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)]"
      >
        <ChevronRight className="h-6 w-6 stroke-[3] text-white ml-[2px]" />
      </motion.div>
    </div>
  );
}
