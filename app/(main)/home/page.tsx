"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [partnerName, setPartnerName] = useState("");

  useEffect(() => {
    const fetchPartnerName = async () => {
      // Optimistically use local storage
      const localPartner = localStorage.getItem("partner_name");
      if (localPartner) {
        setPartnerName(localPartner);
      }

      // We only fetch from DB if we don't have it locally, to prevent redundant calls 
      // since the layout is already fetching it and updating local storage.
      if (!localPartner) {
        import("@/lib/supabase").then(async ({ supabase }) => {
          const myId = localStorage.getItem("user_id");
          if (!myId) return;

          const { data: conv } = await supabase.from("conversation").select("user_a_id, user_b_id").maybeSingle();
          if (!conv) return;

          const partnerId = conv.user_a_id === myId ? conv.user_b_id : conv.user_a_id;
          const { data: partner } = await supabase.from("users").select("name, nickname").eq("id", partnerId).maybeSingle();
          
          if (partner) {
            const nameToUse = partner.nickname || partner.name;
            setPartnerName(nameToUse);
            localStorage.setItem("partner_name", nameToUse);
          }
        });
      }
    };
    
    // Listen for storage changes in case the layout updates it
    const handleStorage = () => {
      const pn = localStorage.getItem("partner_name");
      if (pn) setPartnerName(pn);
    };
    window.addEventListener("storage", handleStorage);
    
    fetchPartnerName();

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <div 
      className="relative flex min-h-full w-full flex-col p-6 pb-28"
    >
      <div className="mt-12">
        <h1 className="text-[32px] font-bold text-white tracking-tight" style={{ fontFamily: "var(--font-fraunces), serif" }}>
          {partnerName ? partnerName : "..."}
        </h1>
        <p className="text-white/70 mt-1">Your space.</p>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {/* Temporary entry point to the actual chat room until the design is finalized */}
        <Link href="/chat">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#18181A]/90 p-4 backdrop-blur-md shadow-lg"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wine)] text-white">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-[17px] font-semibold text-white">Our Chat</h2>
              <p className="text-[14px] text-white/70 line-clamp-1">Tap to enter the conversation...</p>
            </div>
          </motion.div>
        </Link>
      </div>
    </div>
  );
}
