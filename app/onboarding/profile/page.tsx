"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface UserRow {
  id: string;
  name: string;
  avatar_color: string | null;
}

export default function ProfileSetup() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fetch both users from Supabase
  useEffect(() => {
    supabase
      .from("users")
      .select("id, name, avatar_color")
      .then(({ data }) => {
        if (data) setUsers(data);
        setLoading(false);
      });
  }, []);

  async function handleContinue() {
    if (!selectedId) {
      setError("Tap which one you are first.");
      return;
    }
    const displayName = nickname.trim();
    if (!displayName) {
      setError("Please enter what you'd like to be called.");
      return;
    }
    setSaving(true);
    setError("");

    // Update the nickname in Supabase
    const { error: dbErr } = await supabase
      .from("users")
      .update({ nickname: displayName })
      .eq("id", selectedId);

    if (dbErr) {
      setError("Couldn't save. Please try again.");
      setSaving(false);
      return;
    }

    const selected = users.find((u) => u.id === selectedId)!;
    localStorage.setItem("user_id", selectedId);
    localStorage.setItem("user_name", displayName);
    localStorage.setItem("avatar_color", selected.avatar_color ?? "#7A2C3B");

    router.push("/onboarding/pin-setup");
  }

  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans"
      style={{
        background: "linear-gradient(160deg, #1A1210 0%, #3B1520 100%)",
      }}
    >
      {/* Top — step label */}
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#C9A66B]">
          Step 1 of 4
        </p>
      </div>

      {/* Bottom sheet */}
      <div className="relative z-10 flex flex-col gap-4 rounded-t-[22px] bg-[#26221E] px-[18px] pb-8 pt-5">

        {/* Who are you? */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-[#F5F0E8]">Who are you?</p>
          {loading ? (
            <p className="text-[12px] text-[#8A8177]">Loading…</p>
          ) : (
            <div className="flex gap-3">
              {users.map((u) => {
                const isSelected = selectedId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedId(u.id)}
                    className={`flex flex-1 flex-col items-center gap-2 rounded-[12px] border py-4 transition-colors ${
                      isSelected
                        ? "border-[#7A2C3B] bg-[#7A2C3B]/15"
                        : "border-[#3A342E] bg-[#1E1B18]"
                    }`}
                  >
                    {/* Avatar circle */}
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold text-[#F5F0E8]"
                      style={{ backgroundColor: u.avatar_color ?? "#7A2C3B" }}
                    >
                      {u.name[0].toUpperCase()}
                    </div>
                    <span className="text-[13px] text-[#F5F0E8]">{u.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* What should we call you? */}
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-[#F5F0E8]">
            What should we call you?
          </p>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            placeholder="Your name or nickname"
            autoComplete="off"
            className="w-full rounded-[10px] border border-[#3A342E] bg-[#1E1B18] px-[13px] py-3 text-[14px] text-[#F5F0E8] outline-none placeholder:text-[#8A8177] focus:border-[#7A2C3B]"
          />
        </div>

        {error && <p className="text-[12px] text-red-400">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={saving}
          className="mt-1 w-full rounded-[10px] bg-[#7A2C3B] py-3 text-[13px] font-medium text-[#F5F0E8] transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </main>
  );
}
