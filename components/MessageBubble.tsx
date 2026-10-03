import { Check, CheckCheck, Clock, Heart, Play, Pause, X, Download } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toggle = () => {
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };
  return (
    <div className="flex items-center gap-3 py-1">
      <audio 
        ref={audioRef} 
        src={url} 
        onEnded={() => { setIsPlaying(false); setProgress(0); }} 
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime || 0)} 
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} 
      />
      <button onClick={toggle} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isMine ? 'bg-[#F2EFEA] text-[#7A2C3B]' : 'bg-[#7A2C3B] text-[#F2EFEA]'} shadow-sm`}>
        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-1" />}
      </button>
      <div className="flex flex-col gap-1 w-36">
        <div className="h-1.5 w-full rounded-full bg-black/20 overflow-hidden relative">
          <div className={`absolute top-0 left-0 h-full ${isMine ? 'bg-[#F2EFEA]' : 'bg-[#7A2C3B]'}`} style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
        </div>
        <div className={`text-[10px] ${isMine ? 'text-[#F2EFEA]/70' : 'text-[#7A2C3B]/70'} font-medium tracking-wide`}>
          {Math.floor(progress / 60)}:{(Math.floor(progress % 60)).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}

const VideoPlayer = ({ url, onClick }: { url: string; onClick: () => void }) => {
  return (
    <div className="relative overflow-hidden rounded-[12px] shadow-sm border border-black/10 bg-black cursor-pointer group" onClick={onClick}>
      <video 
        src={url} 
        className="max-w-[240px] max-h-[300px] object-cover" 
        preload="metadata"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white">
          <Play className="h-6 w-6 fill-current ml-1" />
        </div>
      </div>
    </div>
  );
};

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  let actualType = type;
  let actualContent = content;
  if (type === "text" && content.startsWith("AUDIO_URL:")) {
    actualType = "audio";
    actualContent = content.replace("AUDIO_URL:", "");
  } else if (type === "text" && content.startsWith("VIDEO_URL:")) {
    actualType = "video";
    actualContent = content.replace("VIDEO_URL:", "");
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(actualContent);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `media-${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed', err);
      const a = document.createElement('a');
      a.href = actualContent;
      a.download = `media-${Date.now()}`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <>
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent absolute top-0 inset-x-0 z-20 pointer-events-none">
            <button onClick={() => setIsFullscreen(false)} className="text-white p-2 pointer-events-auto">
              <X className="h-6 w-6" />
            </button>
            <div className="text-white text-[13px] font-medium opacity-80 pointer-events-auto">
              {formatTime(timestamp)}
            </div>
            <div className="flex items-center pointer-events-auto">
              {actualType === "image" ? (
                <button onClick={handleDownload} className="text-white p-2" aria-label="Download">
                  <Download className="h-5 w-5" />
                </button>
              ) : (
                <div className="w-9" />
              )}
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center min-h-0 bg-black relative">
            {actualType === "image" ? (
              <TransformWrapper initialScale={1} minScale={1} maxScale={5}>
                <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <img src={actualContent} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </TransformComponent>
              </TransformWrapper>
            ) : (
              <video src={actualContent} controls autoPlay className="max-h-full max-w-full" />
            )}
          </div>
        </div>
      )}
      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
        {actualContent === "NUDGE_PING_💖" ? (
          <div className="py-1 text-[64px] leading-none animate-in zoom-in-50 duration-500 drop-shadow-xl" style={{ filter: 'drop-shadow(0 10px 15px rgba(255,50,100,0.4))' }}>
             💖
          </div>
        ) : actualType === "image" ? (
          <img src={actualContent} alt="Image message" onClick={() => setIsFullscreen(true)} className="max-w-[240px] max-h-[300px] rounded-md object-cover cursor-pointer" />
        ) : actualType === "video" ? (
          <VideoPlayer url={actualContent} onClick={() => setIsFullscreen(true)} />
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
    </>
  );
}
