"use client";

import { Calendar } from "lucide-react";
import { useState, useEffect, useRef, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const [partnerName, setPartnerName] = useState("Home");

  // Optimistic tab highlight: on press, move the pill/label to the tapped tab
  // immediately, instead of waiting for the route to render (which left a dead
  // moment between tap and any visible change). Cleared the instant the real
  // pathname lands, with a safety timeout in case a navigation is slow/fails.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeHref = pendingHref ?? pathname;

  useEffect(() => {
    setPendingHref(null);
    if (pendingTimer.current) { clearTimeout(pendingTimer.current); pendingTimer.current = null; }
  }, [pathname]);

  useEffect(() => () => { if (pendingTimer.current) clearTimeout(pendingTimer.current); }, []);

  const selectTab = (href: string) => {
    setPendingHref(href);
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => setPendingHref(null), 2000);
  };

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

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchEndRef = useRef<{ x: number; y: number } | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndRef.current = null;
    touchStartRef.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
  };

  const onTouchEnd = () => {
    if (!touchStartRef.current || !touchEndRef.current) return;
    const distanceX = touchStartRef.current.x - touchEndRef.current.x;
    const distanceY = touchStartRef.current.y - touchEndRef.current.y;

    // Mostly horizontal swipe
    if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
      const isLeftSwipe = distanceX > 0;
      const isRightSwipe = distanceX < 0;
      
      const currentIndex = navItems.findIndex((item) => pathname.startsWith(item.href));
      
      if (isLeftSwipe && currentIndex >= 0 && currentIndex < navItems.length - 1) {
        // Swipe left = go to next tab
        router.push(navItems[currentIndex + 1].href);
      } else if (isRightSwipe && currentIndex > 0) {
        // Swipe right = go to prev tab
        router.push(navItems[currentIndex - 1].href);
      }
    }
  };

  return (
    <div 
      className="shell-h relative mx-auto flex w-full max-w-md flex-col overflow-hidden font-sans"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {children}
      </div>

      {/* Floating Bottom Nav Bar — fixed to the viewport (not the shell) so it
          stays visible even if the page underneath ever scrolls. */}
      <div className="fixed bottom-[max(env(safe-area-inset-bottom,0px),2.5rem)] left-0 right-0 z-50 mx-auto flex w-full max-w-md justify-center px-5 pointer-events-none">
        <div className="flex w-full items-center justify-between rounded-full border border-white/10 bg-[#18181A]/90 p-3 px-4 shadow-[0_10px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl pointer-events-auto">
          {navItems.map((item) => {
            const isActive = activeHref.startsWith(item.href);
            const Icon = item.icon as any;

            return (
              <Link
                key={item.name}
                href={item.href}
                onPointerDown={(e) => { if (e.button === 0) selectTab(item.href); }}
                onClick={() => selectTab(item.href)}
                className={`relative flex items-center justify-center rounded-full transition-all duration-200 touch-manipulation select-none ${
                  isActive ? "px-6 py-3 text-[var(--cream)]" : "p-3 text-white/50 hover:text-white/80"
                }`}
              >
                {isActive && (
                  <div
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-[var(--wine)] shadow-md p-1"
                  >
                    <div className="h-full w-full rounded-full border border-white/40" />
                  </div>
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {item.name === "Calendar" ? (
                    <Icon className="h-[28px] w-[28px]" strokeWidth={isActive ? 2 : 1.5} />
                  ) : (
                    <Icon className="h-[28px] w-[28px]" isActive={isActive} />
                  )}
                  {isActive && (
                    <span className="text-[17px] font-normal tracking-wide whitespace-nowrap overflow-hidden">
                      {item.name}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
