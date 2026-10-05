"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LogOut, Fingerprint, Image, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PinPad from "@/components/PinPad";
import { setLocalPin, signOutAndWipe, verifyLocalPin, setSignInNotice } from "@/lib/auth";
import {
  isBiometricsSupported,
  isBiometricsEnabled,
  registerBiometrics,
  disableBiometrics,
  authenticateBiometrics,
} from "@/lib/biometrics";

type Step = "menu" | "auth" | "new" | "confirm" | "wallpaper";
  type ActionType = "pin" | "wallpaper" | "bio" | "signout" | null;

const LABELS: Record<Exclude<Step, "menu" | "wallpaper">, string> = {
  auth:     "Enter your PIN",
  old:     "Enter your current PIN", // unused
  new:     "Choose a new PIN",
  confirm: "Confirm your new PIN",
};

export default function Settings() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("menu");
  const [wallpaper, setWallpaper] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('chat_wallpaper') || 'default' : 'default');

  const handleSetWallpaper = (val: string) => {
    setWallpaper(val);
    localStorage.setItem('chat_wallpaper', val);
  };
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioMsg, setBioMsg] = useState("");
  const [authTarget, setAuthTarget] = useState<ActionType>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);


  useEffect(() => {
    if (done) {
      const t = setTimeout(() => setDone(false), 800);
      return () => clearTimeout(t);
    }
  }, [done]);

  useEffect(() => {
    if (bioMsg) {
      const t = setTimeout(() => setBioMsg(""), 800);
      return () => clearTimeout(t);
    }
  }, [bioMsg]);

  useEffect(() => {
    isBiometricsSupported().then((supported) => {
      setBioSupported(supported);
      if (supported) {
        setBioEnabled(isBiometricsEnabled());
      }
    });
  }, []);

  const executeAction = (action: ActionType) => {
    if (action === "pin") {
      setStep("new");
    } else if (action === "wallpaper") {
      setStep("wallpaper");
    } else if (action === "bio") {
      executeToggleBiometrics();
    } else if (action === "signout") {
      setShowSignOutModal(true);
    }
    setAuthTarget(null);
  };

  const handleSecureAction = async (action: ActionType) => {
    if (bioEnabled) {
      setBioLoading(true);
      try {
        const res = await authenticateBiometrics();
        if (res.ok) {
          setBioLoading(false);
          executeAction(action);
          return;
        }
      } catch (e) {
        // fallback
      }
      setBioLoading(false);
    }
    setAuthTarget(action);
    setStep("auth");
  };

  const executeToggleBiometrics = async () => {
    if (bioLoading) return;
    if (bioEnabled) {
      disableBiometrics();
      setBioEnabled(false);
      setBioMsg("Biometrics disabled.");
      return;
    }

    setBioLoading(true);
    const userName = (typeof window !== "undefined" ? localStorage.getItem("user_name") : null) ?? "User";
    const res = await registerBiometrics(userName);
    setBioLoading(false);

    if (res.ok) {
      setBioEnabled(true);
      setBioMsg("Face ID / Fingerprint enabled!");
    } else if (res.error) {
      setBioMsg(res.error);
    }
  };

  const handleToggleBiometrics = async () => {
    handleSecureAction("bio");
  };

  const flashError = (msg: string, then?: () => void) => {
    setError(true);
    setMessage(msg);
    setTimeout(() => { setError(false); setMessage(""); then?.(); }, 800);
  };

  const handlePin = useCallback(
    async (pin: string) => {
      if (step === "auth") {
        const { ok, attemptsLeft } = await verifyLocalPin(pin);
        if (ok) { if (authTarget) executeAction(authTarget); return; }
        if (attemptsLeft === 0) {
          await signOutAndWipe();
          setSignInNotice("Too many wrong PINs — please sign in again.");
          router.replace("/signin");
          return;
        }
        flashError(`Wrong PIN — ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`);
        return;
      }

      if (step === "new") {
        setNewPin(pin);
        setStep("confirm");
        return;
      }

      if (step === "confirm") {
        if (pin !== newPin) {
          flashError("PINs don't match — try again.", () => { setNewPin(""); setStep("new"); });
          return;
        }
        await setLocalPin(pin);
        setDone(true);
        setStep("menu");
      }
    },
    [step, newPin, router],
  );

  async function handleSignOut() {
    await signOutAndWipe();
    router.replace("/signin");
  }

  return (
    <main className="flex min-h-full w-full flex-col font-sans pb-28">
      <div className="mt-12 px-6 pb-2 w-full flex items-center gap-4">
        {step !== "menu" && (
          <button
            onClick={() => { setStep("menu"); setNewPin(""); }}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
        <h1 className="text-[36px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-fraunces), serif" }}>Profile</h1>
      </div>

      {step === "menu" ? (
        <div className="flex flex-col w-full gap-4 px-6 mt-2">
          {done && (
            <p className="rounded-2xl bg-[#4C7A5B]/20 px-4 py-3 text-[13px] text-[#4C7A5B]">
              PIN changed. It applies to this device only.
            </p>
          )}

          <button
            onClick={() => { setDone(false); handleSecureAction("pin"); }}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#18181A]/90 px-5 py-4 text-left transition-all active:scale-[0.98] active:border-white/20 md:hover:border-white/20 backdrop-blur-md shadow-lg"
          >
            <KeyRound className="h-5 w-5 text-[var(--gold)]" strokeWidth={2} />
            <div>
              <p className="text-[15px] font-medium text-[var(--cream)] tracking-wide">Change PIN</p>
              <p className="text-[13px] text-white/50">The 4-digit code that unlocks Just Us on this device</p>
            </div>
          </button>

          <button onClick={() => handleSecureAction("wallpaper")} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#18181A]/90 px-5 py-4 text-left transition-all active:scale-[0.98] active:border-white/20 md:hover:border-white/20 backdrop-blur-md shadow-lg">
            <Image className="h-5 w-5 text-[#34B7F1]" strokeWidth={2} />
            <div>
              <p className="text-[15px] font-medium text-[var(--cream)] tracking-wide">Chat Wallpaper</p>
              <p className="text-[13px] text-white/50">Change the background of your chat</p>
            </div>
          </button>

          {bioSupported && (
            <button
              onClick={handleToggleBiometrics}
              disabled={bioLoading}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#18181A]/90 px-5 py-4 text-left transition-all active:scale-[0.98] active:border-white/20 md:hover:border-white/20 disabled:opacity-70 backdrop-blur-md shadow-lg"
            >
              <div className="flex items-center gap-4">
                <Fingerprint
                  className={`h-5 w-5 ${bioEnabled ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}
                  strokeWidth={2}
                />
                <div>
                  <p className="text-[15px] font-medium text-[var(--cream)] tracking-wide">Face ID / Fingerprint</p>
                  <p className="text-[13px] text-white/50">
                    {bioLoading
                      ? "Verifying biometric..."
                      : bioEnabled
                      ? "Fast biometric unlock enabled"
                      : "Tap to enable biometric unlock"}
                  </p>
                </div>
              </div>
              <div
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  bioEnabled ? "bg-[var(--gold)]" : "bg-black/30 border border-white/5"
                }`}
              >
                <span
                  className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white transition-all shadow-sm ${
                    bioEnabled ? "left-[25px]" : "left-[3px]"
                  }`}
                />
              </div>
            </button>
          )}

          {bioMsg && (
            <p className="rounded-2xl bg-[#18181A]/90 backdrop-blur-md border border-white/10 px-4 py-3 text-[13px] text-[var(--gold)]">
              {bioMsg}
            </p>
          )}

          <button
            onClick={() => handleSecureAction("signout")}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#18181A]/90 px-5 py-4 text-left transition-all active:scale-[0.98] active:border-white/20 md:hover:border-white/20 mt-2 backdrop-blur-md shadow-lg"
          >
            <LogOut className="h-5 w-5 text-[#FF3B30]" strokeWidth={2} />
            <div>
              <p className="text-[15px] font-medium text-[var(--cream)] tracking-wide">Sign out of this device</p>
              <p className="text-[13px] text-white/50">You&apos;ll need your email and password to come back</p>
            </div>
          </button>
        </div>
      ) : step === "wallpaper" ? (
        <div className="flex flex-col gap-4 p-4">
          <h2 className="text-[15px] font-medium text-[var(--cream)] mb-2">Choose Wallpaper</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleSetWallpaper('default')} className={`h-32 rounded-xl border-2 ${wallpaper === 'default' ? 'border-[var(--gold)]' : 'border-transparent'} relative overflow-hidden`} style={{ background: 'var(--gradient)' }}>
              <span className="absolute bottom-2 left-2 text-[12px] text-white/80 bg-black/40 px-2 rounded-full">Default</span>
            </button>
            <button onClick={() => handleSetWallpaper('black')} className={`h-32 rounded-xl border-2 ${wallpaper === 'black' ? 'border-[var(--gold)]' : 'border-transparent'} relative overflow-hidden bg-black`}>
              <span className="absolute bottom-2 left-2 text-[12px] text-white/80 bg-white/20 px-2 rounded-full">Pure Black</span>
            </button>
            <button onClick={() => handleSetWallpaper('https://images.unsplash.com/photo-1557682250-33bd709cbe85')} className={`h-32 rounded-xl border-2 ${wallpaper === 'https://images.unsplash.com/photo-1557682250-33bd709cbe85' ? 'border-[var(--gold)]' : 'border-transparent'} relative overflow-hidden bg-cover bg-center`} style={{ backgroundImage: "url('https://images.unsplash.com/photo-1557682250-33bd709cbe85')" }}>
              <span className="absolute bottom-2 left-2 text-[12px] text-white/80 bg-black/40 px-2 rounded-full">Purple Dream</span>
            </button>
            <button onClick={() => handleSetWallpaper('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe')} className={`h-32 rounded-xl border-2 ${wallpaper === 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe' ? 'border-[var(--gold)]' : 'border-transparent'} relative overflow-hidden bg-cover bg-center`} style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe')" }}>
              <span className="absolute bottom-2 left-2 text-[12px] text-white/80 bg-black/40 px-2 rounded-full">Abstract</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-10">
          <PinPad key={step} onComplete={handlePin} error={error} label={LABELS[step as Exclude<Step, "menu" | "wallpaper">]} />
          {message && <p className="text-[12px] text-red-400">{message}</p>}
        </div>
      )}
    
      <AnimatePresence>
        {showSignOutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-sm rounded-[28px] border border-white/10 bg-[#18181A]/95 p-6 shadow-2xl backdrop-blur-xl"
            >
              <button
                onClick={() => setShowSignOutModal(false)}
                className="absolute right-4 top-4 rounded-full bg-white/5 p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
              
              <div className="mb-6 mt-2 flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-500">
                  <LogOut className="h-7 w-7" strokeWidth={2.5} />
                </div>
                <h2 className="text-[20px] font-bold text-white">Are You Sure?</h2>
                <p className="mt-2 text-[14px] text-white/60">You will need to sign in again with your email and password to access Just Us.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignOutModal(false)}
                  className="flex-1 rounded-2xl bg-white/10 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/20"
                >
                  No
                </button>
                <button
                  onClick={() => { setShowSignOutModal(false); handleSignOut(); }}
                  className="flex-1 rounded-2xl bg-red-500 py-3.5 text-[15px] font-semibold text-white shadow-md transition-colors hover:bg-red-600"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}

