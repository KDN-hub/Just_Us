import { Check, CheckCheck, Clock, Heart, Play, Pause, X, Download, Mic, User, Plus, Reply, Copy, Pencil, Trash2, Share2, Pin, Info } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useState, useRef } from "react";
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from "@/components/Avatar";

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
  myReaction?: string;
  groupPosition?: "single" | "top" | "middle" | "bottom";
  partnerInitial?: string;
  partnerColor?: string;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  replyToText?: string;
  isEdited?: boolean;
  isPinned?: boolean;
  onPin?: () => void;
  onForward?: () => void;
  onInfo?: () => void;
}

const MessageStatusTicks = ({ status, queued, className = "" }: { status?: string, queued?: boolean, className?: string }) => {
  if (queued) return <Clock className={`h-[14px] w-[14px] text-white/60 ${className}`} strokeWidth={2} />;
  if (status === "read") return <CheckCheck className={`h-[16px] w-[16px] text-[#F5C842] ${className}`} strokeWidth={2.5} />;
  if (status === "delivered") return <CheckCheck className={`h-[16px] w-[16px] text-white/70 ${className}`} strokeWidth={2.5} />;
  return <Check className={`h-[16px] w-[16px] text-white/70 ${className}`} strokeWidth={2.5} />;
};

const AudioPlayer = ({ url, isMine, timestamp, status, queued, myAvatarUrl, partnerAvatarUrl, partnerInitial, partnerColor }: { url: string, isMine: boolean, timestamp: string, status?: string, queued?: boolean, myAvatarUrl?: string | null, partnerAvatarUrl?: string | null, partnerInitial?: string, partnerColor?: string }) => {
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
    <div className={`relative w-[280px] p-2 flex items-center gap-3 bg-[#18181A]/80 backdrop-blur-xl border border-white/10 shadow-lg rounded-[24px]`}>
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
         <Avatar 
           initial={isMine ? "USER" : (partnerInitial || "?")} 
           color={isMine ? "var(--wine)" : partnerColor} 
           size={48} 
           imageUrl={isMine ? myAvatarUrl : partnerAvatarUrl} 
         />
         {/* Little green mic overlay */}
         <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-[#4C7A5B] rounded-full flex items-center justify-center border-2 border-[var(--surface)] z-10">
            <Mic className="h-3 w-3 text-[var(--cream)]" strokeWidth={2.5} /> 
         </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button onClick={toggle} className="shrink-0 text-[var(--cream)] active:scale-95 transition-all active:opacity-80 md:hover:opacity-80">
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
            <div className="absolute top-1/2 -translate-y-1/2 w-[10px] h-[10px] rounded-full bg-[#34B7F1] shadow pointer-events-none transition-all" style={{ left: `calc(${progressPercent}% - 5px)` }} />
          </div>
        </div>

        {/* Bottom row: Duration/Time & timestamp+ticks */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[12px] text-[var(--cream)]/70 font-medium">
             {Math.floor(displayTime / 60)}:{(Math.floor(displayTime % 60)).toString().padStart(2, '0')}
          </span>
          
          <div className="flex items-center gap-[4px]">
            <span className="text-[13px] text-[var(--cream)]/70">{formatTimeLocal(timestamp)}</span>
            {isMine && status && (
              <MessageStatusTicks status={status} queued={queued} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const VideoPlayer = ({ url, onClick, children }: { url: string; onClick: () => void; children?: React.ReactNode }) => {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm border border-black/10 bg-black cursor-pointer group active:opacity-95 md:hover:opacity-95 transition-all" onClick={onClick}>
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
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
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
  myReaction,
  groupPosition = "single",
  partnerInitial = "?",
  partnerColor = "var(--wine)",
  myAvatarUrl,
  partnerAvatarUrl,
  onReply,
  onEdit,
  onDelete,
  replyToText,
  isEdited,
  isPinned,
  onPin,
  onForward,
  onInfo,
}: MessageBubbleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
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
  
  let isFile = false;
  let fileUrl = '';
  let fileName = '';
  let fileSize = 0;
  
  if (type === "text" && content.startsWith("AUDIO_URL:")) {
    actualType = "audio";
    actualContent = content.replace("AUDIO_URL:", "");
  } else if (type === "text" && content.startsWith("VIDEO_URL:")) {
    actualType = "video";
    actualContent = content.replace("VIDEO_URL:", "");
  } else if (type === "text" && content.startsWith("FILE_URL:")) {
    isFile = true;
    const parts = content.replace("FILE_URL:", "").split("|");
    fileUrl = parts[0];
    fileName = parts[1] || 'Document';
    fileSize = parseInt(parts[2] || '0', 10);
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
      <AnimatePresence>
      {showFullPicker && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-y-0 inset-x-0 mx-auto max-w-md z-[110] flex items-center justify-center bg-black/60 p-4" onClick={() => { setShowFullPicker(false); setShowReactionMenu(false); }}>
          <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="w-full max-w-sm rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <EmojiPicker theme={Theme.DARK} width="100%" height={400} onEmojiClick={(e) => { onReact?.(e.emoji === myReaction ? 'NONE' : e.emoji); setShowFullPicker(false); setShowReactionMenu(false); }} />
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      {isFullscreen && (
        <div className="fixed inset-y-0 inset-x-0 mx-auto max-w-md z-[100] bg-black flex flex-col animate-in fade-in duration-200">
          <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent absolute top-0 inset-x-0 z-20 pointer-events-none">
            <button onClick={() => setIsFullscreen(false)} className="text-white p-2 pointer-events-auto">
              <X className="h-6 w-6" />
            </button>
            <div className="text-white text-[13px] font-medium opacity-80 pointer-events-auto">
              {formatTime(timestamp)}
            </div>
            <div className="flex items-center pointer-events-auto">
              {actualType === "image" || actualType === "image_group" ? (
                <button onClick={handleDownload} className="text-white p-2" aria-label="Download">
                  <Download className="h-5 w-5" />
                </button>
              ) : (
                <div className="w-9" />
              )}
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center min-h-0 bg-black relative">
            {actualType === "image" || actualType === "image_group" ? (
              <div className="w-full h-full relative flex items-center justify-center">
                {actualType === "image_group" && (function(){ try { return JSON.parse(actualContent); } catch { return []; } })().length > 1 && fullscreenIndex > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); setFullscreenIndex(i => i - 1); }} className="absolute left-4 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-black/80">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                )}
                {actualType === "image_group" && (function(){ try { return JSON.parse(actualContent); } catch { return []; } })().length > 1 && fullscreenIndex < (function(){ try { return JSON.parse(actualContent); } catch { return []; } })().length - 1 && (
                  <button onClick={(e) => { e.stopPropagation(); setFullscreenIndex(i => i + 1); }} className="absolute right-4 z-50 p-3 rounded-full bg-black/50 text-white hover:bg-black/80">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                )}
                <TransformWrapper initialScale={1} minScale={1} maxScale={5}>
                    <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src={actualType === "image_group" ? (function(){ try { return JSON.parse(actualContent); } catch { return []; } })()[fullscreenIndex] : actualContent} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                    </TransformComponent>
                  </TransformWrapper>
              </div>
            ) : (
              <video src={actualType === "image_group" ? (function(){ try { return JSON.parse(actualContent); } catch { return []; } })()[fullscreenIndex] : actualContent} controls autoPlay className="max-h-full max-w-full" />
            )}
          </div>
        </div>
      )}
      {showReactionMenu && !showFullPicker && (
        <div className="fixed inset-y-0 inset-x-0 mx-auto max-w-md z-[100] bg-black/50 transition-opacity" onClick={() => setShowReactionMenu(false)} onContextMenu={(e) => { e.preventDefault(); setShowReactionMenu(false); }} />
      )}
{isPinned && <div className={`flex items-center gap-1.5 mb-1 ${isMine ? "justify-end mr-4" : "justify-start ml-12"}`}><Pin className="w-3 h-3 text-white/50" /><span className="text-[11px] font-medium text-white/50">Pinned</span></div>}
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={`group relative flex w-full ${isMine ? "flex-col items-end" : "flex-row items-end gap-2"} ${showReactionMenu ? "z-[110] scale-[1.02] transition-transform shadow-2xl" : "z-0 transition-transform"}`}
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
      {!isMine && (
        <div className={`shrink-0 ${(groupPosition === "single" || groupPosition === "bottom") ? "opacity-100" : "opacity-0"}`}>
          <Avatar initial={partnerInitial} color={partnerColor} size={28} imageUrl={partnerAvatarUrl} />
        </div>
      )}
      
      <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[75%]`}>


        <div className="group relative w-full">
        {actualType === "image_group" ? (
          (() => {
            const urls = (function(){ try { return JSON.parse(actualContent); } catch { return []; } })();
            const displayCount = Math.min(urls.length, 3);
            const remainingCount = urls.length - 1;
            
            return (
              <div className="relative inline-block group w-[220px] h-[260px] mt-4 mb-2 mx-6 cursor-pointer" onClick={() => { setIsFullscreen(true); setFullscreenIndex(0); }}> 
                {Array.from({ length: displayCount }).map((_, domIndex) => {
                  const realIndex = displayCount - 1 - domIndex;
                  const url = urls[realIndex];
                  
                  let transforms = "";
                  
                  if (realIndex === 0) { // Front image
                    transforms = "rotate-0 translate-y-0 z-30 group-active:scale-95";
                  } else if (realIndex === 1) { // Middle image
                    transforms = "rotate-[8deg] translate-x-12 -translate-y-2 z-20 opacity-95 group-hover:rotate-[10deg] group-hover:translate-x-16 group-active:scale-95";
                  } else if (realIndex === 2) { // Back image
                    transforms = "-rotate-[8deg] -translate-x-12 -translate-y-2 z-10 opacity-90 group-hover:-rotate-[10deg] group-hover:-translate-x-16 group-active:scale-95";
                  }

                  return (
                    <div key={realIndex} className={`absolute inset-0 rounded-[20px] overflow-hidden border-2 border-[#18181A]/40 shadow-2xl transition-all duration-300 ease-out origin-bottom ${transforms}`}>
                      <img src={url} className="w-full h-full object-cover" alt="" />
                      
                      {realIndex === 0 && remainingCount > 0 && (
                        <div className="absolute bottom-4 inset-x-0 flex justify-center z-40">
                          <span className="bg-black/60 backdrop-blur-xl px-4 py-1.5 rounded-full text-white font-medium text-[14px] shadow-xl border border-white/10 flex items-center gap-1.5">
                            +{remainingCount} photos
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded-full text-[13px] absolute -bottom-2 -right-4 flex items-center gap-1 z-40 pointer-events-none shadow-lg">
                  <span>{formatTime(timestamp)}</span>
                  {isMine && status && (
                    <MessageStatusTicks status={status} queued={queued} />
                  )}
                </div>
              </div>
            );
          })()
        ) : actualContent === "NUDGE_PING_💖" ? (
          <div className="py-1 text-[64px] leading-none animate-in zoom-in-50 duration-500 drop-shadow-xl" style={{ filter: 'drop-shadow(0 10px 15px rgba(255,50,100,0.4))' }}>
             💖
          </div>
        ) : actualType === "image" ? (
          <div className="relative inline-block group">
            <img src={actualContent} alt="Image message" onClick={() => { setIsFullscreen(true); setFullscreenIndex(0); }} className="max-w-[240px] max-h-[300px] rounded-[20px] object-cover cursor-pointer border border-white/5" />
            <div className="bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded-full text-[13px] absolute bottom-2 right-2 flex items-center gap-1 z-10 pointer-events-none">
              <span>{formatTime(timestamp)}</span>
              {isMine && status && (
                <MessageStatusTicks status={status} queued={queued} />
              )}
            </div>
          </div>
        ) : actualType === "video" ? (
          <VideoPlayer url={actualContent} onClick={() => { setIsFullscreen(true); setFullscreenIndex(0); }}>
            <div className="bg-black/50 backdrop-blur-md text-white px-2 py-1 rounded-full text-[13px] absolute bottom-2 right-2 flex items-center gap-1 z-10 pointer-events-none">
              <span>{formatTime(timestamp)}</span>
              {isMine && status && (
                <MessageStatusTicks status={status} queued={queued} />
              )}
            </div>
          </VideoPlayer>
      ) : isFile ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 px-4 py-3 rounded-[24px] border border-white/5 relative shadow-sm hover:opacity-90 active:scale-[0.98] transition-all min-w-[200px] ${isMine ? 'bg-white/20 backdrop-blur-md' : 'bg-[#18181A]/80 backdrop-blur-md'}`}>
           <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${isMine ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>
              <Download className="w-5 h-5" />
           </div>
           <div className="flex flex-col flex-1 min-w-0 pr-8">
              <span className="text-[15px] font-medium text-white truncate">{fileName}</span>
              <span className="text-[12px] text-white/50">{fileSize > 0 ? (fileSize / 1024 / 1024).toFixed(1) + ' MB' : 'Document'}</span>
           </div>
           <span className="absolute bottom-[10px] right-[18px] flex items-center gap-1">
             {isEdited && <span className="text-[10px] text-white/40 italic mr-1">Edited</span>}
             <span className={`text-[11px] font-medium ${isMine ? 'text-white/50' : 'text-[#5BD05F]'}`}>{formatTime(timestamp)}</span>
             {isMine && status && <MessageStatusTicks status={status} queued={queued} className="h-3 w-3" />}
          </span>
        </a>
      ) : actualType === "audio" ? (
        <AudioPlayer url={actualContent} isMine={isMine} timestamp={timestamp} status={status} queued={queued} myAvatarUrl={myAvatarUrl} partnerAvatarUrl={partnerAvatarUrl} partnerInitial={partnerInitial} partnerColor={partnerColor} />
      ) : (
        <div
          className={`px-[18px] py-[10px] text-[17px] leading-relaxed text-white shadow-sm break-words rounded-[24px] border border-white/5 relative ${
            isMine
              ? `bg-white/20 backdrop-blur-md`
              : `bg-[#18181A]/80 backdrop-blur-md`
          }`}
        >
          <span className="whitespace-pre-wrap">{actualContent}</span>
          <span className="inline-block w-[65px] h-4" aria-hidden="true" />
          <span className="absolute bottom-[10px] right-[18px] flex items-center gap-1">
             <span className={`text-[13px] font-medium ${isMine ? 'text-white/50' : 'text-[#5BD05F]'}`}>{formatTime(timestamp)}</span>
             {isMine && status && (
               <MessageStatusTicks status={status} queued={queued} />
             )}
          </span>
        </div>
      )}


        <AnimatePresence>
        {showReactionMenu && !showFullPicker && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className={`absolute -top-12 ${isMine ? 'right-0' : 'left-0'} z-50 flex gap-1 bg-[#18181A] p-1.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10`}
          >
            {['❤️', '😂', '😮', '😢', '👍'].map(emoji => (
              <motion.button whileTap={{ scale: 1.3 }} key={emoji} onClick={() => { onReact?.(emoji === myReaction ? 'NONE' : emoji); setShowReactionMenu(false); }} className={`text-xl md:hover:scale-125 transition-transform px-1 ${emoji === myReaction ? 'bg-white/10 rounded-full' : ''}`}>{emoji}</motion.button>
            ))}
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowFullPicker(true)} className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white/70 active:text-white md:hover:text-white ml-1 transition-colors">
              <Plus className="h-5 w-5" strokeWidth={2} />
            </motion.button>
          </motion.div>
        )}
        </AnimatePresence>

        
          <AnimatePresence>
          {showReactionMenu && !showFullPicker && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              className={`absolute top-full mt-2 ${isMine ? 'right-0' : 'left-0'} z-50 flex flex-col min-w-[160px] bg-[#18181A]/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden`}
            >
              <button onClick={(e) => { e.stopPropagation(); onReply?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                 <Reply className="w-4 h-4 text-white/60" /> Reply
              </button>
              {actualType === 'text' && (
                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(actualContent); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                   <Copy className="w-4 h-4 text-white/60" /> Copy
                </button>
              )}
              {isMine && actualType === 'text' && (
                <button onClick={(e) => { e.stopPropagation(); onEdit?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                   <Pencil className="w-4 h-4 text-white/60" /> Edit
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onPin?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                 <Pin className="w-4 h-4 text-white/60" /> {isPinned ? 'Unpin' : 'Pin'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onForward?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                 <Share2 className="w-4 h-4 text-white/60" /> Forward
              </button>
              <button onClick={(e) => { e.stopPropagation(); onInfo?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                 <Info className="w-4 h-4 text-white/60" /> Info
              </button>
              {isMine && (
                <button onClick={(e) => { e.stopPropagation(); onDelete?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-red-400 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                   <Trash2 className="w-4 h-4 text-red-400/80" /> Delete
                </button>
              )}
            </motion.div>
          )}
          </AnimatePresence>

{reactions && Object.keys(reactions).length > 0 && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              if (myReaction) {
                onReact?.('NONE');
              } else {
                setShowReactionMenu(true);
              }
            }}
            className={`absolute -bottom-3 ${isMine ? 'right-4' : 'left-4'} flex items-center border ${myReaction ? 'border-white/20 bg-white/20' : 'bg-[#18181A] border-white/10'} rounded-full px-1.5 py-0.5 shadow-md z-20 cursor-pointer active:scale-95 transition-all`}
          >
            {Array.from(new Set(Object.values(reactions))).map((emoji, idx) => (
              <span key={idx} className="text-[12px]">{emoji}</span>
            ))}
            {Object.keys(reactions).length > 1 && (
              <span className="text-[10px] text-white/70 ml-1 font-medium">{Object.keys(reactions).length}</span>
            )}
          </div>
        )}
        </div>
      </div>
      </motion.div>
    </>
  );
}





