"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";

export default function Login() {
  const router = useRouter();
  const [dayCount, setDayCount] = useState<number | null>(null);
  const [pinError, setPinError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [ready, setReady] = useState(false);

  // Read localStorage only on the client
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("?");
  const [avatarColor, setAvatarColor] = useState("#7A2C3B");

  // ── Guard: must have completed onboarding ──────────────────────────────────
  useEffect(() => {
    const storedId = localStorage.getItem("user_id");
    const setupDone = localStorage.getItem("setup_complete");

    if (!storedId || !setupDone) {
      // Not set up yet — send them to the start
      router.replace("/onboarding/welcome");
      return;
    }

    setUserId(storedId);
    setUserName(localStorage.getItem("user_name") ?? "?");
    setAvatarColor(localStorage.getItem("avatar_color") ?? "#7A2C3B");
    setReady(true);
  }, [router]);

  const initial = userName[0]?.toUpperCase() ?? "?";

  // ── Fetch together_since → day count ──────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    async function fetchDays() {
      const { data } = await supabase
        .from("conversation")
        .select("together_since")
        .single();

      if (data?.together_since) {
        const diff = Math.floor(
          (Date.now() - new Date(data.together_since).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        setDayCount(diff);
      }
    }
    fetchDays();
  }, [ready]);

  // ── PIN verification ──────────────────────────────────────────────────────
  const handlePinComplete = useCallback(
    async (pin: string) => {
      const { data, error: dbErr } = await supabase
        .from("users")
        .select("pin_hash")
        .eq("id", userId)
        .single();

      // DB error (network issue etc.)
      if (dbErr) {
        setPinError(true);
        setErrorMsg("Connection error — check your internet and try again.");
        setTimeout(() => { setPinError(false); setErrorMsg(""); }, 1200);
        return;
      }

      // pin_hash is null means this user never finished PIN setup
      if (!data?.pin_hash) {
        // Clear stale localStorage and send them back to finish onboarding
        localStorage.removeItem("setup_complete");
        router.replace("/onboarding/pin-setup");
        return;
      }

      const match = await bcrypt.compare(pin, data.pin_hash);
      if (!match) {
        setPinError(true);
        setErrorMsg("Wrong PIN — try again.");
        setTimeout(() => { setPinError(false); setErrorMsg(""); }, 700);
        return;
      }

      // ✅ Correct PIN — mark online and enter the app
      await supabase
        .from("users")
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq("id", userId);

      router.push("/chat");
    },
    [userId, router],
  );

  // Don't render the PIN pad until we've checked localStorage
  if (!ready) return null;

  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans"
      style={{
        background: "linear-gradient(160deg, #1A1210 0%, #3B1520 100%)",
      }}
    >
      {/* Top — together counter */}
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#C9A66B]">
          Together for
        </p>
        <p
          className="text-[32px] font-normal leading-none text-[#F5F0E8]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          {dayCount !== null ? `Day ${dayCount}` : "—"}{" "}
          <span aria-hidden className="text-[28px]">
            🤍
          </span>
        </p>
      </div>

      {/* Bottom sheet */}
      <div className="relative z-10 flex flex-col items-center gap-4 rounded-t-[22px] bg-[#26221E] px-4 pb-8 pt-5">
        {/* Avatar */}
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[15px] font-semibold text-[#F5F0E8]"
          style={{ backgroundColor: avatarColor }}
        >
          {initial}
        </div>

        <PinPad
          onComplete={handlePinComplete}
          error={pinError}
          label="Enter your PIN"
        />

        {errorMsg && (
          <p className="text-[12px] text-red-400">{errorMsg}</p>
        )}
      </div>
    </main>
  );
}
