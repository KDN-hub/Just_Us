"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasLocalPin, isUnlocked, loadProfile, markSetupComplete } from "@/lib/auth";

// Remembered for the lifetime of this page session (cleared on sign-out/full reload),
// so AuthGate can paint an already-verified gated screen immediately instead of
// waiting on a fresh getSession()/loadProfile() round-trip on every remount.
let sessionVerified = false;

/**
 * Wraps every protected page. Children only mount once there is a real Supabase
 * session, a local PIN has been set up AND the app has been unlocked this session,
 * so pages can safely read the cached profile from localStorage on first render.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Seeded from the previous successful verification for this browser session, so
  // re-entering a gated route (Profile's settings/layout.tsx remounts this on every
  // tap) renders children on the first frame instead of behind a blank gradient.
  // The full check below still runs on every mount — it just no longer blocks the
  // first paint, and any failure redirects exactly as before.
  const [ready, setReady] = useState(() => sessionVerified);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { sessionVerified = false; setReady(false); router.replace("/signin"); return; }

      const profile = await loadProfile({ useCache: true, session });
      if (cancelled) return;
      if (!profile) { sessionVerified = false; setReady(false); router.replace("/signin"); return; }

      if (!hasLocalPin()) { sessionVerified = false; setReady(false); router.replace("/onboarding/pin-setup"); return; }
      if (!isUnlocked())  { sessionVerified = false; setReady(false); router.replace("/login"); return; }

      markSetupComplete();
      sessionVerified = true;
      setReady(true);
    })();

    // Signed out elsewhere (or refresh token revoked) → back to sign-in
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        sessionVerified = false;
        setReady(false);
        router.replace("/signin");
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return <div className="shell-h" style={{ background: "var(--gradient)" }} />;
  return <>{children}</>;
}
