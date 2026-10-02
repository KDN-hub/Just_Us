"use client";

import { useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LogOut, Fingerprint } from "lucide-react";
import PinPad from "@/components/PinPad";
import { setLocalPin, signOutAndWipe, verifyLocalPin, setSignInNotice } from "@/lib/auth";
import {
  isBiometricsSupported,
  isBiometricsEnabled,
  registerBiometrics,
  disableBiometrics,
} from "@/lib/biometrics";

type Step = "menu" | "old" | "new" | "confirm";

const LABELS: Record<Exclude<Step, "menu">, string> = {
  old:     "Enter your current PIN",
  new:     "Choose a new PIN",
  confirm: "Confirm your new PIN",
};

export default function Settings() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("menu");
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
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col bg-[var(--bg)] font-sans">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
        <button
          onClick={() => (step === "menu" ? router.back() : (setStep("menu"), setNewPin("")))}
          aria-label="Back"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <h1 className="text-[14px] font-medium text-[var(--cream)]">Settings</h1>
      </header>

      {step === "menu" ? (
        <div className="flex flex-col gap-3 p-4">
          {done && (
            <p className="rounded-[10px] bg-[#4C7A5B]/20 px-3 py-2 text-[12px] text-[#4C7A5B]">
              PIN changed. It applies to this device only.
            </p>
          )}

          <button
            onClick={() => { setDone(false); setStep("old"); }}
            className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-4 py-3.5 text-left"
          >
            <KeyRound className="h-4 w-4 text-[var(--gold)]" strokeWidth={2} />
            <div>
              <p className="text-[13px] text-[var(--cream)]">Change PIN</p>
              <p className="text-[11px] text-[var(--muted)]">The 4-digit code that unlocks Just Us on this device</p>
            </div>
          </button>

          {bioSupported && (
            <button
              onClick={handleToggleBiometrics}
              disabled={bioLoading}
              className="flex items-center justify-between rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-4 py-3.5 text-left transition-opacity active:opacity-80"
            >
              <div className="flex items-center gap-3">
                <Fingerprint
                  className={`h-4 w-4 ${bioEnabled ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}
                  strokeWidth={2}
                />
                <div>
                  <p className="text-[13px] text-[var(--cream)]">Face ID / Fingerprint</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    {bioLoading
                      ? "Verifying biometric..."
                      : bioEnabled
                      ? "Fast biometric unlock enabled"
                      : "Tap to enable biometric unlock"}
                  </p>
                </div>
              </div>
              <div
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  bioEnabled ? "bg-[var(--gold)]" : "bg-[#3A342E]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    bioEnabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </div>
            </button>
          )}

          {bioMsg && (
            <p className="rounded-[10px] bg-white/5 px-3 py-2 text-[12px] text-[var(--cream)]">
              {bioMsg}
            </p>
          )}

          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-4 py-3.5 text-left"
          >
            <LogOut className="h-4 w-4 text-red-400" strokeWidth={2} />
            <div>
              <p className="text-[13px] text-[var(--cream)]">Sign out of this device</p>
              <p className="text-[11px] text-[var(--muted)]">You&apos;ll need your email and password to come back</p>
            </div>
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-10">
          <PinPad key={step} onComplete={handlePin} error={error} label={LABELS[step]} />
          {message && <p className="text-[12px] text-red-400">{message}</p>}
        </div>
      )}
    </main>
  );
}
