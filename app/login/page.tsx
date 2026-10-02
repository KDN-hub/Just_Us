"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PinPad from "@/components/PinPad";
import {
  CONVERSATION_ID,
  hasLocalPin,
  loadProfile,
  setSignInNotice,
  setUnlocked,
  signOutAndWipe,
  verifyLocalPin,
} from "@/lib/auth";
import {
  authenticateBiometrics,
  isBiometricsEnabled,
  isBiometricsSupported,
} from "@/lib/biometrics";

export default function Login() {
  const router = useRouter();
  const [dayCount, setDayCount] = useState<number | null>(null);
  const [pinError, setPinError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("?");
  const [avatarColor, setAvatarColor] = useState("#7A2C3B");
  const [bioAvailable, setBioAvailable] = useState(false);
  const autoPromptedRef = useRef(false);

  // ── Guard: needs a real session; a device without a PIN must set one first ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profile = await loadProfile({ useCache: true });
      if (cancelled) return;
      if (!profile) { router.replace("/signin"); return; }
      if (!hasLocalPin()) { router.replace("/onboarding/pin-setup"); return; }

      setUserName(profile.nickname ?? profile.name);
      setAvatarColor(profile.avatar_color ?? "#7A2C3B");
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [router]);

  const initial = userName[0]?.toUpperCase() ?? "?";

  // ── Fetch together_since → day count ──────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    supabase
      .from("conversation")
      .select("together_since")
      .eq("id", CONVERSATION_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.together_since) {
          setDayCount(
            Math.floor((Date.now() - new Date(data.together_since).getTime()) / 86_400_000),
          );
        }
      });
  }, [ready]);

  const failSignOut = useCallback(
    async (notice: string) => {
      await signOutAndWipe();
      setSignInNotice(notice);
      router.replace("/signin");
    },
    [router],
  );

  // ── Biometrics check & fast-path prompt ──────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!isBiometricsEnabled()) return;

    let active = true;
    isBiometricsSupported().then((supported) => {
      if (active && supported) {
        setBioAvailable(true);
      }
    });

    return () => {
      active = false;
    };
  }, [ready]);

  const handleBiometrics = useCallback(async () => {
    const result = await authenticateBiometrics();
    if (result.ok) {
      setUnlocked();
      router.replace("/chat");
      return;
    }
    if (result.error && !result.cancelled) {
      setErrorMsg(result.error);
      setTimeout(() => setErrorMsg(""), 2000);
    }
  }, [router]);

  useEffect(() => {
    if (!bioAvailable || autoPromptedRef.current) return;
    autoPromptedRef.current = true;
    const timer = setTimeout(() => {
      handleBiometrics();
    }, 250);
    return () => clearTimeout(timer);
  }, [bioAvailable, handleBiometrics]);

  // ── PIN verification (local only) ─────────────────────────────────────────
  const handlePinComplete = useCallback(
    async (pin: string) => {
      const { ok, attemptsLeft } = await verifyLocalPin(pin);

      if (ok) {
        setUnlocked();
        router.replace("/chat");
        return;
      }

      if (attemptsLeft === 0) {
        await failSignOut("Too many wrong PINs — please sign in again.");
        return;
      }

      setPinError(true);
      setErrorMsg(
        `Wrong PIN — ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`,
      );
      setTimeout(() => { setPinError(false); setErrorMsg(""); }, 900);
    },
    [router, failSignOut],
  );

  if (!ready) return null;

  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-md flex-col font-sans"
      style={{
        background: "linear-gradient(160deg, #1A1210 0%, #3B1520 100%)",
      }}
    >
      {/* Top — together counter */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-[#C9A66B]">
          Together for
        </p>
        <p
          className="text-[42px] font-normal leading-none text-[#F5F0E8]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          {dayCount !== null ? `Day ${dayCount}` : "—"}{" "}
          <span aria-hidden className="text-[36px]">
            🤍
          </span>
        </p>
      </div>

      {/* Bottom sheet */}
      <div className="relative z-10 flex flex-col items-center gap-5 rounded-t-[22px] bg-[#26221E] px-4 pb-10 pt-6">
        {/* Avatar */}
        <div
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-[18px] font-semibold text-[#F5F0E8]"
          style={{ backgroundColor: avatarColor }}
        >
          {initial}
        </div>

        <PinPad
          onComplete={handlePinComplete}
          error={pinError}
          label="Enter PIN"
          showBiometric={bioAvailable}
          onBiometric={handleBiometrics}
        />

        {errorMsg && (
          <p className="text-[14px] text-red-400">{errorMsg}</p>
        )}

        <button
          type="button"
          onClick={() => failSignOut("Sign in again to set a new PIN.")}
          className="text-[14px] text-[#8A8177] underline-offset-2 active:underline"
        >
          Forgot PIN?
        </button>
      </div>
    </main>
  );
}
