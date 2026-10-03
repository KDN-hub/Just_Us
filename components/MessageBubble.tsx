import { Check, CheckCheck, Clock, Heart } from "lucide-react";

interface MessageBubbleProps {
  content: string;
  isMine: boolean;
  timestamp: string; // ISO string
  /** Only passed for own messages — drives the tick indicator. */
  status?: "sent" | "delivered" | "read";
  queued?: boolean;
  type?: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MessageBubble({
  content,
  isMine,
  timestamp,
  status,
  queued = false,
  type = "text",
}: MessageBubbleProps) {
  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {content === "NUDGE_PING_💖" ? (
        <div className="py-1 text-[64px] leading-none animate-in zoom-in-50 duration-500 drop-shadow-xl" style={{ filter: 'drop-shadow(0 10px 15px rgba(255,50,100,0.4))' }}>
           💖
        </div>
      ) : type === "image" ? (
        <img src={content} alt="Image message" className="max-w-[240px] max-h-[300px] rounded-md object-cover" />
      ) : type === "video" ? (
        <video src={content} controls className="max-w-[240px] max-h-[300px] rounded-md" />
      ) : type === "audio" ? (
        <audio src={content} controls className="max-w-[240px]" />
      ) : (
        <div
          className={`max-w-[78%] px-4 py-2.5 text-[15px] leading-[1.5] text-[var(--cream)] ${
            isMine
              ? "rounded-[16px_16px_4px_16px] bg-[var(--wine)]"
              : "rounded-[16px_16px_16px_4px] bg-[var(--card)]"
          }`}
        >
          {content}
        </div>
      )}

      {/* Timestamp + status tick row */}
      <div className={`mt-1 flex items-center gap-[4px] ${isMine ? "flex-row-reverse" : ""}`}>
        <span className="text-[11px] text-[var(--muted)]">{formatTime(timestamp)}</span>

        {/* Tick indicator — only for own messages */}
        {isMine && status && (
          <>
            {queued ? (
              <Clock className="h-[13px] w-[13px] text-[var(--muted)]" strokeWidth={2} aria-label="Queued" />
            ) : status === "read" ? (
              <CheckCheck
                className="h-[13px] w-[13px] text-[#7A2C3B]"
                strokeWidth={2.5}
                aria-label="Read"
              />
            ) : status === "delivered" ? (
              <CheckCheck
                className="h-[13px] w-[13px] text-[var(--muted)]"
                strokeWidth={2.5}
                aria-label="Delivered"
              />
            ) : (
              <Check
                className="h-[13px] w-[13px] text-[var(--muted)]"
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
