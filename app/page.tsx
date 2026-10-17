"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasLocalPin } from "@/lib/auth";

/**
 * Entry router. Decides WHERE to go from the device cache synchronously — no
 * getSession() round-trip before the first redirect (that wait used to show a
 * blank screen on every app open, which read as "the login page is slow").
 *
 * The destination always re-validates: /login checks the real session and
 * bounces to /signin if it's gone, /signin checks for an existing session, and
 * /onboarding/pin-setup requires a session before setting a PIN. So routing
 * from cache is only a fast path, never a trust decision.
 */
export default function Root() {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("user_id")) {
      // Never signed in on this device
      router.replace("/onboarding/welcome");
    } else if (!hasLocalPin()) {
      router.replace("/onboarding/pin-setup");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
