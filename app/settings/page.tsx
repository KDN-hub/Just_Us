"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LogOut } from "lucide-react";
import PinPad from "@/components/PinPad";
import { setLocalPin, signOutAndWipe, verifyLocalPin, setSignInNotice } from "@/lib/auth";

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
