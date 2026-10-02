import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  content: string;
  isMine: boolean;
  timestamp: string; // ISO string
  /** Only passed for own messages — drives the tick indicator. */
  status?: "sent" | "delivered" | "read";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({
  content,
  isMine,
  timestamp,
  status,
}: MessageBubbleProps) {
  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[73%] px-3 py-2 text-xs leading-[1.45] text-[var(--cream)] ${
          isMine
            ? "rounded-[12px_12px_3px_12px] bg-[var(--wine)]"
            : "rounded-[12px_12px_12px_3px] bg-[var(--card)]"
        }`}
      >
        {content}
      </div>

      {/* Timestamp + status tick row */}
      <div className={`mt-0.5 flex items-center gap-[3px] ${isMine ? "flex-row-reverse" : ""}`}>
        <span className="text-[9px] text-[var(--muted)]">{formatTime(timestamp)}</span>

        {/* Tick indicator — only for own messages */}
        {isMine && status && (
          <>
            {status === "read" ? (
              <CheckCheck
                className="h-[10px] w-[10px] text-[#7A2C3B]"
                strokeWidth={2.5}
                aria-label="Read"
              />
            ) : status === "delivered" ? (
              <CheckCheck
                className="h-[10px] w-[10px] text-[var(--muted)]"
                strokeWidth={2.5}
                aria-label="Delivered"
              />
            ) : (
              <Check
                className="h-[10px] w-[10px] text-[var(--muted)]"
                strokeWidth={2.5}
                aria-label="Sent"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
