"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint } from "lucide-react";
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

  const handleComplete = useCallback(
    async (pin: string) => {
      if (mode === "set") {
        setFirstPin(pin);
        setMode("confirm");
        setErrorMsg("");
        return;
      }

      // Confirm mode
      if (pin !== firstPin) {
        setError(true);
        setErrorMsg("PINs don't match — try again.");
        setTimeout(() => {
          setError(false);
          setErrorMsg("");
          setMode("set");
          setFirstPin("");
        }, 700);
        return;
      }

      setSaving(true);
      await setLocalPin(pin);
      setUnlocked(); // they just proved who they are by signing in and choosing a PIN

      const supported = await isBiometricsSupported();
      if (supported) {
        setSaving(false);
        setMode("biometric");
        return;
      }

      await proceedNext();
    },
    [mode, firstPin, proceedNext],
  );

  if (!ready) return null;

  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans"
      style={{
        background: "var(--gradient)",
      }}
    >
      {/* Top — step indicator */}
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#C9A66B]">
          Onboarding
        </p>
      </div>

      {/* Bottom sheet */}
      <div className="relative z-10 flex flex-col items-center gap-4 rounded-t-[22px] bg-[#26221E] px-4 pb-8 pt-5">
        {/* Avatar initial */}
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[15px] font-semibold text-[#F5F0E8]"
          style={{ backgroundColor: avatarColor }}
        >
          {initial}
        </div>

        {mode === "biometric" ? (
          <div className="flex w-full flex-col items-center gap-4 py-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#C9A66B]/30 bg-[#C9A66B]/10">
              <Fingerprint className="h-8 w-8 text-[#C9A66B]" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-[17px] font-medium text-[#F5F0E8]">Enable Fast Unlock?</h2>
              <p className="mt-1 max-w-[270px] text-[13px] leading-relaxed text-[#8A8177]">
                Use Face ID or fingerprint to unlock Just Us instantly without typing your PIN every time.
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col gap-2.5">
              <button
                type="button"
                onClick={handleEnableBiometric}
                disabled={saving}
                className="w-full rounded-[14px] bg-[#7A2C3B] py-3.5 text-[14px] font-medium text-[#F5F0E8] transition-opacity active:opacity-80 disabled:opacity-50"
              >
                {saving ? "Setting up..." : "Enable Face ID / Fingerprint"}
              </button>
              <button
                type="button"
                onClick={proceedNext}
                disabled={saving}
                className="w-full py-2.5 text-[13px] text-[#8A8177] transition-colors active:text-[#F5F0E8]"
              >
                Skip for now
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* PinPad handles label + dots + keypad */}
            <PinPad
              key={mode}
              onComplete={handleComplete}
              error={error}
              label={mode === "set" ? "Set a 4-digit PIN" : "Confirm your PIN"}
            />

            {errorMsg && (
              <p className="text-[12px] text-red-400">{errorMsg}</p>
            )}

            {saving && (
              <p className="text-[12px] text-[#8A8177]">Saving your PIN…</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
