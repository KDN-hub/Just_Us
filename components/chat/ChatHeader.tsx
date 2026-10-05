import Link from "next/link";
import { Settings, Phone, Video, Flame } from "lucide-react";
import Avatar from "@/components/Avatar";

interface ChatHeaderProps {
  partnerInitial: string;
  partnerColor: string;
  partnerDisplay: string;
  daysTogether: number;
  isOnline: boolean;
  reconnecting: boolean;
  partnerIsOnline: boolean;
  partnerLastSeenText: string;
}

export default function ChatHeader({
  partnerInitial,
  partnerColor,
  partnerDisplay,
  daysTogether,
  isOnline,
  reconnecting,
  partnerIsOnline,
  partnerLastSeenText
}: ChatHeaderProps) {
  return (
    <header className="relative z-10 shrink-0 flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 pb-4 pt-[max(env(safe-area-inset-top),1rem)]">
      <Avatar initial={partnerInitial} color={partnerColor} size={42} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[18px] font-serif tracking-tight font-semibold text-[var(--cream)] truncate max-w-[140px]">
            {partnerDisplay}
          </span>
          {daysTogether > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[var(--wine)]/30 rounded-full border border-[var(--wine)]/50">
              <Flame className="h-3 w-3 text-[#F5C842]" />
              <span className="text-[10px] font-bold text-[#F5C842]">{daysTogether}</span>
            </div>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          {!isOnline ? (
            <span className="text-[12px] italic text-[#F5C842]" role="status">
              No network
            </span>
          ) : reconnecting ? (
            <span className="text-[12px] italic text-[var(--muted)]" role="status">
              Connecting…
            </span>
          ) : partnerIsOnline ? (
            <>
              <span className="h-2 w-2 rounded-full bg-[#4C7A5B] animate-pulse" />
              <span className="text-[12px] text-[#4C7A5B]">Online</span>
            </>
          ) : (
            <span className="text-[12px] text-[var(--muted)]">
              {partnerLastSeenText}
            </span>
          )}
        </div>
      </div>

      <Link
        href="/settings"
        aria-label="Settings"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)]"
      >
        <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
      </Link>
      <Link
        href="/call?type=voice"
        aria-label="Voice call"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
      >
        <Phone className="h-[17px] w-[17px]" strokeWidth={2} />
      </Link>
      <Link
        href="/call?type=video"
        aria-label="Video call"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"
      >
        <Video className="h-[17px] w-[17px]" strokeWidth={2} />
      </Link>
    </header>
  );
}
