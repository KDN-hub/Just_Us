"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CONVERSATION_ID, loadProfile, markSetupComplete } from "@/lib/auth";

export default function TogetherSince() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Must be signed in; if setup is already complete, skip this step
  useEffect(() => {
    loadProfile({ useCache: true }).then((profile) => {
      if (!profile) { router.replace("/signin"); return; }
      if (localStorage.getItem("setup_complete") === "true") router.replace("/chat");
    });
  }, [router]);

  async function handleFinish() {
    if (!date) {
      setError("Please pick a date.");
      return;
    }
    setSaving(true);
    setError("");

    // Update the singleton conversation row
    const { error: dbErr } = await supabase
      .from("conversation")
      .update({ together_since: date })
      .eq("id", CONVERSATION_ID);

    if (dbErr) {
      setError("Couldn't save the date. Please try again.");
      setSaving(false);
      return;
    }

    markSetupComplete();
    router.replace("/chat");
  }

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
      <div className="relative z-10 flex flex-col gap-3 rounded-t-[22px] bg-[#26221E] px-[18px] pb-8 pt-5">
        <p className="text-[14px] font-medium text-[#F5F0E8]">
          When did you two start?
        </p>
        <p className="text-[12px] leading-normal text-[#8A8177]">
          Sets your streak counter — only entered once, ever.
        </p>

        {/* Date input */}
        <div className="flex w-full items-center gap-2 rounded-[10px] border border-[#3A342E] bg-[#1E1B18] px-[13px] py-2.5 focus-within:border-[#7A2C3B]">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 bg-transparent text-[13px] tracking-wide text-[#F5F0E8] outline-none [color-scheme:dark]"
            max={new Date().toISOString().split("T")[0]}
          />
          <Calendar
            className="h-4 w-4 shrink-0 text-[#8A8177]"
            strokeWidth={2}
            aria-hidden
          />
        </div>

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <button
          onClick={handleFinish}
          disabled={saving}
          className="mt-1 w-full rounded-[10px] bg-[#7A2C3B] py-3 text-[13px] font-medium text-[#F5F0E8] transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Finish setup"}
        </button>
      </div>
    </main>
  );
}
