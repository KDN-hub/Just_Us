"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LogOut, Fingerprint, Image } from "lucide-react";
import PinPad from "@/components/PinPad";
import { setLocalPin, signOutAndWipe, verifyLocalPin, setSignInNotice } from "@/lib/auth";
import {
  isBiometricsSupported,
  isBiometricsEnabled,
  registerBiometrics,
  disableBiometrics,
} from "@/lib/biometrics";

type Step = "menu" | "old" | "new" | "confirm" | "wallpaper";

const LABELS: Record<Exclude<Step, "menu" | "wallpaper">, string> = {
  old:     "Enter your current PIN",
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

  useEffect(() => {
    isBiometricsSupported().then((supported) => {
      setBioSupported(supported);
      if (supported) {
        setBioEnabled(isBiometricsEnabled());
      }
    });
  }, []);

  const handleToggleBiometrics = async () => {
    if (bioLoading) return;
    if (bioEnabled) {
      disableBiometrics();
      setBioEnabled(false);
      setBioMsg("Biometrics disabled.");
      setTimeout(() => setBioMsg(""), 2000);
      return;
    }

    setBioLoading(true);
    const userName = (typeof window !== "undefined" ? localStorage.getItem("user_name") : null) ?? "User";
    const res = await registerBiometrics(userName);
    setBioLoading(false);

    if (res.ok) {
      setBioEnabled(true);
      setBioMsg("Face ID / Fingerprint enabled!");
      setTimeout(() => setBioMsg(""), 2500);
    } else if (res.error) {
      setBioMsg(res.error);
      setTimeout(() => setBioMsg(""), 3000);
    }
  };

  const flashError = (msg: string, then?: () => void) => {
    setError(true);
    setMessage(msg);
    setTimeout(() => { setError(false); setMessage(""); then?.(); }, 800);
  };

  const handlePin = useCallback(
    async (pin: string) => {
      if (step === "old") {
        const { ok, attemptsLeft } = await verifyLocalPin(pin);
        if (ok) { setStep("new"); return; }
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
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans" style={{ background: "var(--gradient)" }}>
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <button
          onClick={() => (step === "menu" ? router.back() : (setStep("menu"), setNewPin("")))}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] active:text-white md:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <h1 className="text-xl font-serif tracking-tight text-[var(--cream)] ml-1">Settings</h1>
      </header>

      {step === "menu" ? (
        <div className="flex flex-col gap-3 p-4 px-6">
          {done && (
            <p className="rounded-2xl bg-[#4C7A5B]/20 px-4 py-3 text-[13px] text-[#4C7A5B]">
              PIN changed. It applies to this device only.
            </p>
          )}

          <button
            onClick={() => { setDone(false); setStep("old"); }}
            className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-left transition-all active:scale-[0.98] active:border-white/10 md:hover:border-white/10"
          >
            <KeyRound className="h-5 w-5 text-[var(--gold)]" strokeWidth={2} />
            <div>
              <p className="text-[14px] font-medium text-[var(--cream)]">Change PIN</p>
              <p className="text-[13px] text-white/50">The 4-digit code that unlocks Just Us on this device</p>
            </div>
          </button>

          <button onClick={() => setStep("wallpaper")} className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-left transition-all active:scale-[0.98] active:border-white/10 md:hover:border-white/10">
            <Image className="h-5 w-5 text-[#34B7F1]" strokeWidth={2} />
            <div>
              <p className="text-[14px] font-medium text-[var(--cream)]">Chat Wallpaper</p>
              <p className="text-[13px] text-white/50">Change the background of your chat</p>
            </div>
          </button>

          {bioSupported && (
            <button
              onClick={handleToggleBiometrics}
              disabled={bioLoading}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-left transition-all active:scale-[0.98] active:border-white/10 md:hover:border-white/10 disabled:opacity-70"
            >
              <div className="flex items-center gap-4">
                <Fingerprint
                  className={`h-5 w-5 ${bioEnabled ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}
                  strokeWidth={2}
                />
                <div>
                  <p className="text-[14px] font-medium text-[var(--cream)]">Face ID / Fingerprint</p>
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
            <p className="rounded-2xl bg-white/5 px-4 py-3 text-[13px] text-[var(--cream)]">
              {bioMsg}
            </p>
          )}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 text-left transition-all active:scale-[0.98] active:border-white/10 md:hover:border-white/10 mt-2"
          >
            <LogOut className="h-5 w-5 text-red-400" strokeWidth={2} />
            <div>
              <p className="text-[14px] font-medium text-[var(--cream)]">Sign out of this device</p>
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
    </main>
  );
}

