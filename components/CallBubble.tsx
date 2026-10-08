import { Phone, Video, PhoneMissed } from "lucide-react";

interface CallBubbleProps {
  type: "voice" | "video";
  status: "missed" | "answered" | "declined";
  duration: number | null;
  timestamp: string; // ISO string
  /** true if the current user was the caller */
  isMine: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CallBubble({
  type,
  status,
  duration,
  timestamp,
  isMine,
}: CallBubbleProps) {
  const typeLabel = type === "video" ? "Video" : "Voice";

  let label: string;
  let colorClass: string;
  let Icon = status === "missed" ? PhoneMissed : type === "video" ? Video : Phone;

  if (status === "answered") {
    label = `${typeLabel} call${duration ? ` · ${formatDuration(duration)}` : ""}`;
    colorClass = "text-[#4C7A5B]";
  } else if (status === "declined") {
    label = "Call declined";
    colorClass = "text-red-400";
  } else {
    // missed
    label = `Missed ${typeLabel.toLowerCase()} call`;
    colorClass = "text-red-400";
  }

  return (
    <div className="mx-auto flex w-fit max-w-[85%] items-center gap-2.5 rounded-[12px] bg-[var(--card)] px-4 py-2.5">
      <Icon className={`h-[18px] w-[18px] shrink-0 ${colorClass}`} strokeWidth={2} />
      <span className={`text-[14px] ${colorClass}`}>{label}</span>
      <span className="text-[12px] text-[var(--muted)]">· {formatTime(timestamp)}</span>
    </div>
  );
}

