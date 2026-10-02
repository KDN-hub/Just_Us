"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { hasLocalPin } from "@/lib/auth";

export default function Root() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Never signed in on this device
        router.replace(localStorage.getItem("user_id") ? "/signin" : "/onboarding/welcome");
      } else if (!hasLocalPin()) {
        router.replace("/onboarding/pin-setup");
      } else {
        router.replace("/login");
      }
    });
  }, [router]);

  return null;
}
