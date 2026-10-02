"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";
import { CONVERSATION_ID, loadProfile, markSetupComplete, setLocalPin, setUnlocked } from "@/lib/auth";

type Mode = "set" | "confirm";

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

      // "Together since" is set once, by whichever of you onboards first
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
    },
    [mode, firstPin, router],
  );

  if (!ready) return null;

  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans"
      style={{
        background: "linear-gradient(160deg, #1A1210 0%, #3B1520 100%)",
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
      </div>
    </main>
  );
}
