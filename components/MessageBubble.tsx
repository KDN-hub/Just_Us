import { Check, CheckCheck, Clock, Heart, Play, Pause } from "lucide-react";
import { useState, useRef } from "react";

interface MessageBubbleProps {
  content: string;
  isMine: boolean;
  timestamp: string; // ISO string
  /** Only passed for own messages — drives the tick indicator. */
  status?: "sent" | "delivered" | "read";
  queued?: boolean;
  type?: string;
}

const AudioPlayer = ({ url, isMine }: { url: string, isMine: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toggle = () => {
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };
  return (
    <div className="flex items-center gap-3 py-1">
      <audio ref={audioRef} src={url} onEnded={() => setIsPlaying(false)} />
      <button onClick={toggle} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isMine ? 'bg-[var(--cream)] text-[var(--wine)]' : 'bg-[var(--wine)] text-[var(--cream)]'}`}>
        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-1" />}
      </button>
      <div className="flex-1 h-1.5 w-32 rounded-full bg-black/20 overflow-hidden">
        <div className={`h-full ${isMine ? 'bg-[var(--cream)]' : 'bg-[var(--wine)]'} w-1/3`} />
      </div>
    </div>
  );
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
  let actualType = type;
  let actualContent = content;
  if (type === "text" && content.startsWith("AUDIO_URL:")) {
    actualType = "audio";
    actualContent = content.replace("AUDIO_URL:", "");
  } else if (type === "text" && content.startsWith("VIDEO_URL:")) {
    actualType = "video";
    actualContent = content.replace("VIDEO_URL:", "");
  }

  return (
    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
      {actualContent === "NUDGE_PING_💖" ? (
        <div className="py-1 text-[64px] leading-none animate-in zoom-in-50 duration-500 drop-shadow-xl" style={{ filter: 'drop-shadow(0 10px 15px rgba(255,50,100,0.4))' }}>
           💖
        </div>
      ) : actualType === "image" ? (
        <img src={actualContent} alt="Image message" className="max-w-[240px] max-h-[300px] rounded-md object-cover" />
      ) : actualType === "video" ? (
        <video src={actualContent} controls className="max-w-[240px] max-h-[300px] rounded-md" />
      ) : actualType === "audio" ? (
        <AudioPlayer url={actualContent} isMine={isMine} />
      ) : (
        <div
          className={`max-w-[78%] px-4 py-2.5 text-[15px] leading-[1.5] text-[var(--cream)] ${
            isMine
              ? "rounded-[16px_16px_4px_16px] bg-[var(--wine)]"
              : "rounded-[16px_16px_16px_4px] bg-[var(--card)]"
          }`}
        >
          {actualContent}
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
