"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";
import { CONVERSATION_ID, loadProfile, markSetupComplete, setLocalPin, setUnlocked } from "@/lib/auth";
import { isBiometricsSupported, registerBiometrics } from "@/lib/biometrics";

type Mode = "set" | "confirm" | "biometric";

/**
 * Sets this device's PIN lock. The PIN is hashed and kept ONLY on this device —
 * it is never sent to the server (the server trusts the Supabase session instead).
 */
export default function PinSetup() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("set");
  const [firstPin, setFirstPin] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("You");
  const [avatarColor, setAvatarColor] = useState("#7A2C3B");

  // Must be signed in to get here
  useEffect(() => {
    loadProfile({ useCache: true }).then((profile) => {
      if (!profile) { router.replace("/signin"); return; }
      setUserName(profile.nickname ?? profile.name);
      setAvatarColor(profile.avatar_color ?? "#7A2C3B");
      setReady(true);
    });
  }, [router]);

  const initial = userName[0]?.toUpperCase() ?? "?";

  const proceedNext = useCallback(async () => {
    const { data: conv } = await supabase
      .from("conversation")
      .select("together_since")
      .eq("id", CONVERSATION_ID)
      .maybeSingle();

    if (conv?.together_since) {
      markSetupComplete();
      router.replace("/chat");
    } else {
      router.replace("/onboarding/together-since");
    }
  }, [router]);

  const handleEnableBiometric = useCallback(async () => {
    setSaving(true);
    await registerBiometrics(userName);
    await proceedNext();
  }, [userName, proceedNext]);

  const handleProceedToConfirm = useCallback(() => {
    if (currentPin.length !== 4) return;
    setFirstPin(currentPin);
    setCurrentPin("");
    setMode("confirm");
    setErrorMsg("");
  }, [currentPin]);

  const handleConfirmPin = useCallback(async () => {
    if (currentPin.length !== 4) return;

    if (currentPin !== firstPin) {
      setError(true);
      setErrorMsg("PINs don't match — try again.");
      setTimeout(() => {
        setError(false);
        setErrorMsg("");
        setMode("set");
        setFirstPin("");
        setCurrentPin("");
      }, 700);
      return;
    }

    setSaving(true);
    await setLocalPin(currentPin);
    setUnlocked(); // they just proved who they are by signing in and choosing a PIN

    const supported = await isBiometricsSupported();
    if (supported) {
      setSaving(false);
      setMode("biometric");
      return;
    }

    await proceedNext();
  }, [currentPin, firstPin, proceedNext]);

  const handleBack = () => {
    if (mode === "confirm") {
      setMode("set");
      setFirstPin("");
      setCurrentPin("");
      setErrorMsg("");
    } else if (mode === "biometric") {
      setMode("set");
      setFirstPin("");
      setCurrentPin("");
    } else {
      router.push("/onboarding/profile");
    }
  };

  if (!ready) return null;

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-md flex-col font-notch overflow-hidden">
      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className="absolute top-[max(env(safe-area-inset-top,0px),1.5rem)] left-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)] transition-transform duration-200 hover:scale-105 active:scale-95"
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
        className="relative z-10 flex flex-col items-center gap-4 rounded-t-[36px] border-t border-white/10 bg-[#18181A]/90 px-6 backdrop-blur-2xl pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-8 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
      >
        {/* Avatar initial */}
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[15px] font-semibold text-[var(--cream)] shadow-md"
          style={{ backgroundColor: avatarColor }}
        >
          {initial}
        </div>

        <AnimatePresence mode="wait">
          {mode === "biometric" ? (
            <motion.div
              key="biometric"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full flex-col items-center gap-4 py-3 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10">
                <Fingerprint className="h-8 w-8 text-[var(--gold)]" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-xl font-serif tracking-tight text-[var(--cream)]">Enable Fast Unlock?</h2>
                <p className="mt-1 max-w-[270px] text-[14px] leading-relaxed text-white/60">
                  Use Face ID or fingerprint to unlock Just Us instantly without typing your PIN every time.
                </p>
              </div>
              <div className="mt-2 flex w-full flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleEnableBiometric}
                  disabled={saving}
                  className="w-full rounded-2xl bg-[var(--wine)] py-3.5 text-base font-medium text-white transition-all active:scale-[0.97] hover:brightness-110 shadow-[0_8px_16px_-6px_rgba(122,44,59,0.5)] disabled:opacity-50"
                >
                  {saving ? "Setting up..." : "Enable Face ID / Fingerprint"}
                </button>
                <button
                  type="button"
                  onClick={proceedNext}
                  disabled={saving}
                  className="w-full py-2.5 text-[14px] text-white/60 transition-colors hover:text-white"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pin-pad"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full flex-col items-center"
            >
              {/* PinPad */}
              <PinPad
                key={mode}
                autoComplete={false}
                onChange={setCurrentPin}
                error={error}
                label={mode === "set" ? "Set a 4-digit PIN" : "Confirm your PIN"}
              />

              {errorMsg && (
                <p className="mt-2 text-[12px] text-red-400">{errorMsg}</p>
              )}

              {saving && (
                <p className="mt-2 text-[12px] text-[#8A8177]">Saving your PIN…</p>
              )}

              {/* Action Row: Progress dots + Continue/Confirm Arrow */}
              <div className="mt-2 flex w-full items-center justify-between pl-1 pr-0 min-h-[60px]">
                {/* Progress dots - Step 4 */}
                <div className="flex items-center gap-[6px]">
                  <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
                  <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
                  <span className="h-[6px] w-[6px] rounded-full bg-white/20" />
                  <span className="h-[6px] w-[20px] rounded-full bg-[var(--gold)]" />
                </div>

                {/* Once 4 digits are input, show the continue arrow */}
                <div
                  className={`transition-all duration-300 ${
                    currentPin.length === 4
                      ? "opacity-100 scale-100 pointer-events-auto"
                      : "opacity-0 scale-95 pointer-events-none"
                  }`}
                >
                  {mode === "set" ? (
                    <button
                      type="button"
                      onClick={handleProceedToConfirm}
                      aria-label="Continue to confirm PIN"
                      className="group flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white/[0.82] backdrop-blur-xl border border-white/60 shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_10px_24px_-6px_rgba(188,21,41,0.4)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.05] hover:bg-white/95 hover:border-white/80 hover:shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),0_20px_35px_-8px_rgba(188,21,41,0.55),0_10px_20px_-4px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.98]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)] transition-transform group-hover:translate-x-0.5">
                        <ChevronRight className="h-5 w-5 stroke-[3] text-white ml-[2px]" />
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConfirmPin}
                      disabled={saving}
                      className="group flex h-[60px] items-center justify-center gap-4 rounded-full bg-white/[0.82] backdrop-blur-xl border border-white/60 pl-8 pr-2 text-[var(--wine)] shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.85),0_10px_24px_-6px_rgba(188,21,41,0.4)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.03] hover:bg-white/95 hover:border-white/80 hover:shadow-[inset_0_2px_3px_rgba(255,255,255,0.95),0_20px_35px_-8px_rgba(188,21,41,0.55),0_10px_20px_-4px_rgba(0,0,0,0.35)] active:translate-y-0 active:scale-[0.98] active:duration-100 disabled:opacity-50"
                    >
                      <span className="text-[17px] font-semibold tracking-wide">
                        {saving ? "Saving…" : "Confirm"}
                      </span>
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--wine)] shadow-[0_4px_12px_rgba(188,21,41,0.35)] transition-transform group-hover:translate-x-1">
                        <ChevronRight className="h-5 w-5 stroke-[3] text-white ml-[2px]" />
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
