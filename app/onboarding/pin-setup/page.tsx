"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";

type Mode = "set" | "confirm";

export default function PinSetup() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("set");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const userName = typeof window !== "undefined"
    ? localStorage.getItem("user_name") ?? "You"
    : "You";
  const initial = userName[0]?.toUpperCase() ?? "?";
  const avatarColor =
    typeof window !== "undefined"
      ? (localStorage.getItem("avatar_color") ?? "#7A2C3B")
      : "#7A2C3B";

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

      // PINs match — hash and save
      setSaving(true);
      const hash = await bcrypt.hash(pin, 10);
      const userId = localStorage.getItem("user_id");

      const { error: dbErr } = await supabase
        .from("users")
        .update({ pin_hash: hash })
        .eq("id", userId);

      if (dbErr) {
        setErrorMsg("Couldn't save your PIN. Please try again.");
        setSaving(false);
        return;
      }

      router.push("/onboarding/together-since");
    },
    [mode, firstPin, router],
  );

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
          Step 2 of 4
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
