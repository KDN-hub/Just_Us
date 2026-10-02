"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Root() {
  const router = useRouter();

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    const setupComplete = localStorage.getItem("setup_complete");

    if (!userId || !setupComplete) {
      router.replace("/onboarding/welcome");
    } else {
      router.replace("/login");
    }
  }, [router]);

  // Blank screen while redirecting
  return null;
}
