"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasLocalPin, isUnlocked, loadProfile, markSetupComplete } from "@/lib/auth";

/**
 * Wraps every protected page. Children only mount once there is a real Supabase
 * session, a local PIN has been set up AND the app has been unlocked this session,
 * so pages can safely read the cached profile from localStorage on first render.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { router.replace("/signin"); return; }

      const profile = await loadProfile({ useCache: true });
      if (cancelled) return;
      if (!profile) { router.replace("/signin"); return; }

      if (!hasLocalPin()) { router.replace("/onboarding/pin-setup"); return; }
      if (!isUnlocked())  { router.replace("/login"); return; }

      markSetupComplete();
      setReady(true);
    })();

    // Signed out elsewhere (or refresh token revoked) → back to sign-in
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/signin");
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (!ready) return <div className="h-dvh" style={{ background: "var(--gradient)" }} />;
  return <>{children}</>;
}
