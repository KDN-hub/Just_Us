import { Check, CheckCheck, Clock, Heart, Play, Pause, X, Download, Mic, User, Plus } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useState, useRef } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';

interface MessageBubbleProps {
  content: string;
  isMine: boolean;
  timestamp: string; // ISO string
  /** Only passed for own messages — drives the tick indicator. */
  status?: "sent" | "delivered" | "read";
  queued?: boolean;
  type?: string;
  onReact?: (emoji: string) => void;
  reactions?: Record<string, string>;
}

const AudioPlayer = ({ url, isMine, timestamp, status, queued }: { url: string, isMine: boolean, timestamp: string, status?: string, queued?: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const toggle = () => {
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  
  // Fake waveform pattern (35 bars)
  const heights = [4, 6, 8, 5, 4, 7, 10, 14, 12, 10, 18, 20, 24, 20, 16, 12, 14, 18, 22, 24, 22, 18, 14, 10, 8, 6, 5, 7, 6, 4, 3, 4, 4, 3, 3];

  function formatTimeLocal(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const displayTime = isPlaying || progress > 0 ? progress : duration;

  return (
    <div className={`relative w-[280px] p-2 flex items-center gap-3 ${isMine ? "rounded-[16px_16px_4px_16px] bg-[var(--wine)]" : "rounded-[16px_16px_16px_4px] bg-[var(--card)]"}`}>
      <audio 
        ref={audioRef} 
        src={url} 
        preload="metadata"
        onEnded={() => { setIsPlaying(false); setProgress(0); }} 
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime || 0)} 
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} 
      />

      {/* Avatar with Mic overlay */}
      <div className="relative shrink-0">
         <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
            <User className="h-8 w-8 text-white/50 mt-3" strokeWidth={1.5} />
         </div>
         {/* Little green mic overlay */}
         <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-[#4C7A5B] rounded-full flex items-center justify-center border-2 border-white/10">
            <Mic className="h-3 w-3 text-[var(--cream)]" strokeWidth={2.5} /> 
         </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button onClick={toggle} className="shrink-0 text-[var(--cream)]">
            {isPlaying ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current" />}
          </button>

          {/* Waveform track */}
          <div className="relative flex-1 h-8 flex items-center group cursor-pointer" onClick={(e) => {
             const rect = e.currentTarget.getBoundingClientRect();
             const pct = (e.clientX - rect.left) / rect.width;
             if (audioRef.current && duration) {
               audioRef.current.currentTime = pct * duration;
               setProgress(pct * duration);
             }
          }}>
            {/* Unplayed */}
            <div className="absolute inset-0 flex items-center gap-[2px]">
              {heights.map((h, i) => (
                <div key={i} className={`w-[3px] rounded-full ${isMine ? 'bg-white/30' : 'bg-black/20'}`} style={{ height: `${h}px` }} />
              ))}
            </div>
            {/* Played */}
            <div className="absolute left-0 top-0 bottom-0 flex items-center gap-[2px] overflow-hidden" style={{ width: `${progressPercent}%` }}>
              {heights.map((h, i) => (
                <div key={i} className={`w-[3px] rounded-full shrink-0 ${isMine ? 'bg-white/80' : 'bg-[#34B7F1]'}`} style={{ height: `${h}px` }} />
              ))}
            </div>
            {/* Knob thumb */}
            <div className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-[#34B7F1] shadow pointer-events-none" style={{ left: `calc(${progressPercent}% - 5px)` }} />
          </div>
        </div>

        {/* Bottom row: Duration/Time & timestamp+ticks */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-[var(--cream)]/70 font-medium">
             {Math.floor(displayTime / 60)}:{(Math.floor(displayTime % 60)).toString().padStart(2, '0')}
          </span>
          
          <div className="flex items-center gap-[4px]">
            <span className="text-[10px] text-[var(--cream)]/70">{formatTimeLocal(timestamp)}</span>
            {isMine && status && (
              <>
                {queued ? (
                  <Clock className="h-[11px] w-[11px] text-white/80" strokeWidth={2} />
                ) : status === "read" ? (
                  <CheckCheck className="h-[12px] w-[12px] text-white" strokeWidth={2.5} />
                ) : status === "delivered" ? (
                  <CheckCheck className="h-[12px] w-[12px] text-white/80" strokeWidth={2.5} />
                ) : (
                  <Check className="h-[12px] w-[12px] text-white/80" strokeWidth={2.5} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const VideoPlayer = ({ url, onClick, children }: { url: string; onClick: () => void; children?: React.ReactNode }) => {
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
      {children}
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
  onReact,
  reactions,
}: MessageBubbleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startPress = () => {
    pressTimerRef.current = setTimeout(() => {
      setShowReactionMenu(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };
  const cancelPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
  };

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
      {showFullPicker && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => { setShowFullPicker(false); setShowReactionMenu(false); }}>
          <div className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <EmojiPicker theme={Theme.DARK} width="100%" height={400} onEmojiClick={(e) => { onReact?.(e.emoji); setShowFullPicker(false); setShowReactionMenu(false); }} />
          </div>
        </div>
      )}
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
      <div 
        className={`group relative flex flex-col ${isMine ? "items-end" : "items-start"}`}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowReactionMenu(true);
          if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
        }}
      >
        <div className="group relative">
        {actualContent === "NUDGE_PING_💖" ? (
          <div className="py-1 text-[64px] leading-none animate-in zoom-in-50 duration-500 drop-shadow-xl" style={{ filter: 'drop-shadow(0 10px 15px rgba(255,50,100,0.4))' }}>
             💖
          </div>
        ) : actualType === "image" ? (
          <div className="relative inline-block group">
            <img src={actualContent} alt="Image message" onClick={() => setIsFullscreen(true)} className="max-w-[240px] max-h-[300px] rounded-md object-cover cursor-pointer" />
            <div className="bg-black/50 text-white px-1.5 py-0.5 rounded-full text-[10px] absolute bottom-2 right-2 flex items-center gap-1 z-10 pointer-events-none">
              <span>{formatTime(timestamp)}</span>
              {isMine && status && (
                <>
                  {queued ? (
                    <Clock className="h-[10px] w-[10px] text-white/80" strokeWidth={2} />
                  ) : status === "read" ? (
                    <CheckCheck className="h-[11px] w-[11px] text-white" strokeWidth={2.5} />
                  ) : status === "delivered" ? (
                    <CheckCheck className="h-[11px] w-[11px] text-white/80" strokeWidth={2.5} />
                  ) : (
                    <Check className="h-[11px] w-[11px] text-white/80" strokeWidth={2.5} />
                  )}
                </>
              )}
            </div>
          </div>
        ) : actualType === "video" ? (
          <VideoPlayer url={actualContent} onClick={() => setIsFullscreen(true)}>
            <div className="bg-black/50 text-white px-1.5 py-0.5 rounded-full text-[10px] absolute bottom-2 right-2 flex items-center gap-1 z-10 pointer-events-none">
              <span>{formatTime(timestamp)}</span>
              {isMine && status && (
                <>
                  {queued ? (
                    <Clock className="h-[10px] w-[10px] text-white/80" strokeWidth={2} />
                  ) : status === "read" ? (
                    <CheckCheck className="h-[11px] w-[11px] text-white" strokeWidth={2.5} />
                  ) : status === "delivered" ? (
                    <CheckCheck className="h-[11px] w-[11px] text-white/80" strokeWidth={2.5} />
                  ) : (
                    <Check className="h-[11px] w-[11px] text-white/80" strokeWidth={2.5} />
                  )}
                </>
              )}
            </div>
          </VideoPlayer>
      ) : actualType === "audio" ? (
        <AudioPlayer url={actualContent} isMine={isMine} timestamp={timestamp} status={status} queued={queued} />
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

        {showReactionMenu && !showFullPicker && (
          <div className="fixed inset-0 z-40" onClick={() => setShowReactionMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowReactionMenu(false); }} />
        )}
        {showReactionMenu && !showFullPicker && (
          <div className={`absolute -top-12 ${isMine ? 'right-0' : 'left-0'} z-50 flex gap-1 bg-[var(--card)] p-1.5 rounded-full shadow-lg border border-[var(--border)]`}>
            {['❤️', '😂', '😮', '😢', '👍'].map(emoji => (
              <button key={emoji} onClick={() => { onReact?.(emoji); setShowReactionMenu(false); }} className="text-xl hover:scale-125 transition-transform px-1">{emoji}</button>
            ))}
            <button onClick={() => setShowFullPicker(true)} className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--cream)] ml-1">
              <Plus className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        )}

        {reactions && Object.keys(reactions).length > 0 && (
          <div className={`absolute -bottom-3 ${isMine ? 'right-4' : 'left-4'} flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-full px-1.5 py-0.5 shadow-sm z-20`}>
            {Array.from(new Set(Object.values(reactions))).map((emoji, idx) => (
              <span key={idx} className="text-[12px]">{emoji}</span>
            ))}
            {Object.keys(reactions).length > 1 && (
              <span className="text-[10px] text-[var(--muted)] ml-1 font-medium">{Object.keys(reactions).length}</span>
            )}
          </div>
        )}
        </div>

      {/* Timestamp + status tick row (only show outside for text/nudge) */}
      {actualType !== "image" && actualType !== "video" && actualType !== "audio" && (
        <div className={`mt-1 flex items-center gap-[4px] ${isMine ? "flex-row-reverse" : ""}`}>
          <span className="text-[11px] text-[var(--muted)]">{formatTime(timestamp)}</span>

          {/* Tick indicator — only for own messages */}
          {isMine && status && (
            <>
              {queued ? (
                <Clock className="h-[13px] w-[13px] text-[var(--muted)]" strokeWidth={2} aria-label="Queued" />
              ) : status === "read" ? (
                <CheckCheck
                  className="h-[13px] w-[13px] text-white"
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
      )}
      </div>
    </>
  );
}
