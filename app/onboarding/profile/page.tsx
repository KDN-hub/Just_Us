"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadProfile } from "@/lib/auth";

/**
 * "What should we call you?" — the person is already identified by the account they
 * signed in with, so there's no "Who are you?" picker (it let anyone claim either account).
 */
export default function ProfileSetup() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile().then((profile) => {
      if (!profile) { router.replace("/signin"); return; }
      setUserId(profile.id);
      setNickname(profile.nickname ?? profile.name);
    });
  }, [router]);

  async function handleContinue() {
    const displayName = nickname.trim();
    if (!displayName) {
      setError("Please enter what you'd like to be called.");
      return;
    }
    if (!userId) return;

    setSaving(true);
    setError("");

    const { error: dbErr } = await supabase
      .from("users")
      .update({ nickname: displayName })
      .eq("id", userId);

    if (dbErr) {
      setError("Couldn't save. Please try again.");
      setSaving(false);
      return;
    }

    localStorage.setItem("user_name", displayName);
    router.push("/onboarding/pin-setup");
  }

  if (!userId) return null;

  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans"
      style={{ background: "linear-gradient(160deg, #1A1210 0%, #3B1520 100%)" }}
    >
      {/* Top — kicker */}
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#C9A66B]">
          Onboarding
        </p>
      </div>

      {/* Bottom sheet */}
      <div className="relative z-10 flex flex-col gap-3 rounded-t-[22px] bg-[#26221E] px-[18px] pb-8 pt-5">
        <p className="text-[13px] font-medium text-[#F5F0E8]">What should we call you?</p>

        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleContinue()}
          placeholder="Your name"
          autoComplete="off"
          className="w-full rounded-[10px] border border-[#3A342E] bg-[#1E1B18] px-[13px] py-3 text-[14px] text-[#F5F0E8] outline-none placeholder:text-[#8A8177] focus:border-[#7A2C3B]"
        />

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={saving}
          className="w-full rounded-[10px] bg-[#7A2C3B] py-3 text-[13px] font-medium text-[#F5F0E8] transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </main>
  );
}
