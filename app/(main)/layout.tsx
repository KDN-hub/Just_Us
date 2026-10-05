"use client";

import { Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SmileHomeIcon = ({ className, isActive }: { className?: string, isActive?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isActive ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M11.2 3.5a1.5 1.5 0 0 1 1.6 0l6.8 5c.9.6 1.4 1.6 1.4 2.6v7.4c0 1.9-1.5 3.5-3.5 3.5H6.5C4.5 22 3 20.4 3 18.5v-7.4c0-1 .5-2 1.4-2.6l6.8-5z" />
    <path d="M9 16.5v-2a3 3 0 0 1 6 0v2" stroke={isActive ? "var(--wine)" : "currentColor"} strokeWidth={isActive ? "2" : "1.5"} fill="none" strokeLinecap="round" />
  </svg>
);

const ProfileIcon = ({ className, isActive }: { className?: string, isActive?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isActive ? 0 : 1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8.5" r="3.2" />
    <path d="M6 21.5v-2a6 4.5 0 0 1 12 0v2" />
  </svg>
);

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [partnerName, setPartnerName] = useState("Home");

  useEffect(() => {
    const fetchPartnerName = async () => {
      // Optimistically use local storage
      const localPartner = localStorage.getItem("partner_name");
      if (localPartner) {
        setPartnerName(localPartner);
      }

      // Fetch fresh from DB
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
    };

    fetchPartnerName();
  }, []);

  const navItems = [
    { name: partnerName, href: "/home", icon: SmileHomeIcon },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Profile", href: "/settings", icon: ProfileIcon },
  ];

  return (
    <div 
      className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden font-sans"
    >
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Floating Bottom Nav Bar */}
      <div className="absolute bottom-10 left-0 right-0 z-50 flex w-full justify-center px-5 pointer-events-none">
        <div className="flex w-full items-center justify-between rounded-full border border-white/10 bg-[#18181A]/90 p-3 px-4 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl pointer-events-auto">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon as any;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative flex items-center justify-center rounded-full transition-all duration-300 ${
                  isActive ? "px-6 py-3 text-[var(--cream)]" : "p-3 text-white/50 hover:text-white/80"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-[var(--wine)] shadow-md p-1"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  >
                    <div className="h-full w-full rounded-full border border-white/40" />
                  </motion.div>
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {item.name === "Calendar" ? (
                    <Icon className="h-[28px] w-[28px]" strokeWidth={isActive ? 2 : 1.5} />
                  ) : (
                    <Icon className="h-[28px] w-[28px]" isActive={isActive} />
                  )}
                  <AnimatePresence mode="popLayout">
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, width: 0, scale: 0.8 }}
                        animate={{ opacity: 1, width: "auto", scale: 1 }}
                        exit={{ opacity: 0, width: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        className="text-[17px] font-normal tracking-wide whitespace-nowrap overflow-hidden"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
