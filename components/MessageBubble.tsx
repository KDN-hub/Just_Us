"use client";

import { Check, CheckCheck, Clock, Play, Pause, X, Download, Mic, Plus, Reply, Copy, Pencil, Trash2, Share2, Pin, Info, CheckSquare, Ban, MessageSquare, Crop, ArrowLeft, Star } from "lucide-react";
import { useState, useRef, useEffect, memo } from "react";
import dynamic from "next/dynamic";
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });
import { Theme } from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import Avatar from "@/components/Avatar";
import MediaViewer, { MediaViewerItem } from "@/components/chat/MediaViewer";
import { downloadMediaFile } from "@/lib/media";

interface MessageBubbleProps {
  id: string;
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
  onCopy?: () => void;
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  onQuoteClick?: (targetId: string) => void;
  isEdited?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
  onPin?: () => void;
  onForward?: () => void;
  onInfo?: () => void;
  onSelect?: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onEditMedia?: (url: string, type: string) => void;
  onToggleFavoriteSticker?: (url: string) => void;
  isFavoriteSticker?: boolean;
  partnerName?: string;
}

const MessageStatusTicks = ({ status, queued, className = "" }: { status?: string, queued?: boolean, className?: string }) => {
  if (queued) return <Clock className={`h-[14px] w-[14px] text-white/60 ${className}`} strokeWidth={2} />;
  if (status === "read") return <CheckCheck className={`h-[16px] w-[16px] text-[#F5C842] ${className}`} strokeWidth={2.5} />;
  if (status === "delivered") return <CheckCheck className={`h-[16px] w-[16px] text-white/80 ${className}`} strokeWidth={2.5} />;
  return <Check className={`h-[16px] w-[16px] text-white/80 ${className}`} strokeWidth={2.5} />;
};

const AudioPlayer = ({ url, isMine, timestamp, status, queued, myAvatarUrl, partnerAvatarUrl, partnerInitial, partnerColor }: { url: string, isMine: boolean, timestamp: string, status?: string, queued?: boolean, myAvatarUrl?: string | null, partnerAvatarUrl?: string | null, partnerInitial?: string, partnerColor?: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const toggle = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(!isPlaying);
    } else {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent('just-us-audio-play', { detail: { url } }));
      }
      audioRef.current?.play();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    const handleOtherPlay = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.url !== url) {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener('just-us-audio-play', handleOtherPlay);
    return () => window.removeEventListener('just-us-audio-play', handleOtherPlay);
  }, [url]);

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  
  // Waveform pattern (24 bars)
  const heights = [4, 8, 14, 10, 6, 16, 22, 18, 12, 20, 24, 18, 12, 22, 16, 8, 14, 20, 14, 8, 12, 16, 8, 4];

  function formatTimeLocal(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const displayTime = isPlaying || progress > 0 ? progress : duration;

  return (
    <div className={`relative w-full p-2 flex items-center gap-2 ${isMine ? 'bg-gradient-to-b from-white/[0.28] to-white/[0.18] border-white/30 text-white' : 'bg-gradient-to-b from-[#242428]/90 to-[#18181A]/85 border-white/15 text-white'} backdrop-blur-xl border shadow-[0_4px_16px_rgba(0,0,0,0.22)] rounded-[10px] overflow-hidden`}>
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
           size={36} 
           imageUrl={isMine ? myAvatarUrl : partnerAvatarUrl} 
         />
         <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-[#4C7A5B] rounded-full flex items-center justify-center border-2 border-[var(--surface)] z-10">
            <Mic className="h-2.5 w-2.5 text-[var(--cream)]" strokeWidth={2.5} /> 
         </div>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Play/Pause Button */}
          <button onClick={toggle} className="shrink-0 text-[var(--cream)] active:scale-95 transition-all active:opacity-80 md:hover:opacity-80 p-0.5">
            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
          </button>

          {/* Waveform track */}
          <div className="relative flex-1 min-w-0 h-6 flex items-center group cursor-pointer overflow-hidden" onClick={(e) => {
             const rect = e.currentTarget.getBoundingClientRect();
             const pct = (e.clientX - rect.left) / rect.width;
             if (audioRef.current && duration) {
               audioRef.current.currentTime = pct * duration;
               setProgress(pct * duration);
             }
          }}>
            <div className="absolute inset-0 flex items-center justify-between gap-[2px]">
              {heights.map((h, i) => (
                <div key={i} className={`w-[2.5px] rounded-full shrink-0 ${isMine ? 'bg-white/30' : 'bg-black/20'}`} style={{ height: `${h}px` }} />
              ))}
            </div>
            <div className="absolute left-0 top-0 bottom-0 flex items-center justify-between gap-[2px] overflow-hidden" style={{ width: `${progressPercent}%` }}>
              {heights.map((h, i) => (
                <div key={i} className={`w-[2.5px] rounded-full shrink-0 ${isMine ? 'bg-[#34B7F1]' : 'bg-[#34B7F1]'}`} style={{ height: `${h}px` }} />
              ))}
            </div>
            {progress > 0 && (
              <div className="absolute top-1/2 -translate-y-1/2 w-[8px] h-[8px] rounded-full bg-[#34B7F1] shadow pointer-events-none transition-all" style={{ left: `calc(${progressPercent}% - 4px)` }} />
            )}
          </div>
        </div>

        {/* Bottom row: Duration/Time & timestamp+ticks */}
        <div className="flex items-center justify-between gap-3 mt-1 text-[12px] text-[var(--cream)]/70">
          <span className="font-medium shrink-0">
             {Math.floor(displayTime / 60)}:{(Math.floor(displayTime % 60)).toString().padStart(2, '0')}
          </span>
          
          <div className="flex items-center gap-1 shrink-0">
            <span>{formatTimeLocal(timestamp)}</span>
            {isMine && status && (
              <MessageStatusTicks status={status} queued={queued} className="h-3.5 w-3.5" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const VideoPlayer = ({ url, onClick, children }: { url: string; onClick: () => void; children?: React.ReactNode }) => {
  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-sm border border-black/10 bg-black cursor-pointer group active:opacity-95 md:hover:opacity-95 transition-all"
      onClick={onClick}
      role="button"
      aria-label="Open video in full screen viewer"
    >
      <video 
        src={url} 
        className="max-w-[240px] max-h-[300px] object-cover pointer-events-none" 
        preload="metadata"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors pointer-events-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white shadow-lg">
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

const MessageBubble = memo(function MessageBubble({
  id,
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
  onCopy,
  replyToId,
  replyToText,
  replyToSenderName,
  onQuoteClick,
  isEdited,
  isPinned,
  isDeleted,
  onPin,
  onForward,
  onInfo,
  onSelect,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onEditMedia,
  onToggleFavoriteSticker,
  isFavoriteSticker = false,
  partnerName = "Partner",
}: MessageBubbleProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<'bottom' | 'top'>('bottom');
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close menus & fullscreen viewer on Escape key
  useEffect(() => {
    if (!showReactionMenu && !isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowReactionMenu(false);
        setShowFullPicker(false);
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showReactionMenu, isFullscreen]);

  const openActionMenu = () => {
    if (selectionMode) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.bottom + 280 > window.innerHeight) {
        setMenuPlacement('top');
      } else {
        setMenuPlacement('bottom');
      }
    }
    setShowReactionMenu(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
  };

  const startPress = () => {
    if (selectionMode) return;
    pressTimerRef.current = setTimeout(() => {
      openActionMenu();
    }, 450);
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
  } else if (type === "sticker" || (type === "text" && content.startsWith("STICKER:"))) {
    actualType = "sticker";
    actualContent = content.replace("STICKER:", "");
  } else if (type === "video" || content.startsWith("VIDEO_URL:")) {
    actualType = "video";
    actualContent = content.replace("VIDEO_URL:", "");
  }

  let captionText = "";
  if ((actualType === "image" || actualType === "video") && actualContent.includes("|CAPTION:")) {
    const parts = actualContent.split("|CAPTION:");
    actualContent = parts[0];
    captionText = parts.slice(1).join("|CAPTION:");
  }

  const deckItems: Array<{ id?: string; url: string; type: "image" | "video"; caption?: string }> = (() => {
    if (actualType !== "image_group") return [];
    try {
      const raw = JSON.parse(actualContent);
      if (!Array.isArray(raw)) return [];
      return raw.map((it: any) => {
        if (typeof it === "string") {
          let cleanUrl = it;
          let cap = "";
          if (it.includes("|CAPTION:")) {
            const parts = it.split("|CAPTION:");
            cleanUrl = parts[0];
            cap = parts.slice(1).join("|CAPTION:");
          }
          const isVid = cleanUrl.includes("VIDEO_URL:") || cleanUrl.endsWith(".mp4");
          return {
            id,
            url: cleanUrl.replace("VIDEO_URL:", ""),
            type: isVid ? "video" as const : "image" as const,
            caption: cap || undefined,
          };
        }
        return {
          id: it.id || id,
          url: (it.url || "").replace("VIDEO_URL:", ""),
          type: (it.type || (it.url?.endsWith(".mp4") ? "video" : "image")) as "image" | "video",
          caption: it.caption || undefined,
        };
      });
    } catch {
      return [];
    }
  })();

  const viewerMediaItems: MediaViewerItem[] = (() => {
    if (actualType === "image_group") {
      return deckItems.map((item) => ({
        id: item.id || id,
        url: item.url,
        type: item.type,
        caption: item.caption,
        timestamp,
        senderName: isMine ? "You" : partnerName,
      }));
    }
    if (actualType === "image" || actualType === "video" || actualType === "sticker") {
      return [
        {
          id,
          url: actualContent,
          type: actualType === "video" ? "video" : "image",
          caption: captionText || undefined,
          timestamp,
          senderName: isMine ? "You" : partnerName,
        },
      ];
    }
    return [];
  })();

  const isActuallyDeleted = isDeleted || content === "This message was deleted";

  const renderQuotedReply = (extraClass = "") => {
    if (!replyToText || isActuallyDeleted) return null;
    return (
      <div 
        onClick={(e) => {
          e.stopPropagation();
          if (replyToId && onQuoteClick) onQuoteClick(replyToId);
        }}
        className={`mb-1 cursor-pointer rounded-[6px] bg-black/25 hover:bg-black/35 active:scale-[0.99] transition-all border-l-[3px] border-[var(--gold)] px-2 py-1 text-left select-none w-full min-w-[120px] ${extraClass}`}
      >
        <div className="text-[11.5px] font-semibold text-[var(--gold)] flex items-center gap-1 leading-tight">
          <Reply className="w-3 h-3 rotate-180 shrink-0" />
          <span className="truncate">{replyToSenderName || "Quoted message"}</span>
        </div>
        <div className="text-[12.5px] text-white/85 line-clamp-2 italic mt-0.5 break-words leading-tight">
          {replyToText}
        </div>
      </div>
    );
  };

  const handleDownload = async () => {
    const currentDeckItem = deckItems[fullscreenIndex];
    const targetUrl = actualType === "image_group" && deckItems.length > 0
      ? currentDeckItem?.url || actualContent
      : actualContent;
    await downloadMediaFile(targetUrl);
  };

  const handleBubbleClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      e.stopPropagation();
      onToggleSelect?.();
    }
  };

  return (
    <>
      <AnimatePresence>
      {showFullPicker && (
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" 
          onClick={() => { setShowFullPicker(false); setShowReactionMenu(false); }}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }} 
            animate={{ scale: 1, y: 0 }} 
            exit={{ scale: 0.9, y: 20 }} 
            transition={{ type: "spring", damping: 25, stiffness: 300 }} 
            className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/10" 
            onClick={e => e.stopPropagation()}
          >
            <EmojiPicker 
              theme={Theme.DARK} 
              width="100%" 
              height={400} 
              onEmojiClick={(e) => { 
                onReact?.(e.emoji === myReaction ? 'NONE' : e.emoji); 
                setShowFullPicker(false); 
                setShowReactionMenu(false); 
              }} 
            />
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <MediaViewer
        isOpen={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        items={viewerMediaItems}
        initialIndex={fullscreenIndex}
        onShowInChat={(targetId) => {
          if (onQuoteClick) onQuoteClick(targetId);
        }}
        onEditMedia={onEditMedia}
      />

      {showReactionMenu && !showFullPicker && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 transition-opacity" 
          onClick={() => setShowReactionMenu(false)} 
          onContextMenu={(e) => { e.preventDefault(); setShowReactionMenu(false); }} 
        />
      )}

      {isPinned && !isActuallyDeleted && (
        <div className={`flex items-center gap-1.5 mb-1 ${isMine ? "justify-end mr-4" : "justify-start ml-12"}`}>
          <Pin className="w-3.5 h-3.5 text-[var(--gold)]" />
          <span className="text-[12px] font-medium text-[var(--gold)]/80">Pinned</span>
        </div>
      )}

      <motion.div
        ref={containerRef}
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={`group relative flex w-full items-end gap-2.5 ${isMine ? "flex-row-reverse" : "flex-row"} ${showReactionMenu ? "z-[110] scale-[1.02] transition-transform shadow-2xl" : "z-0 transition-transform"} ${selectionMode ? "cursor-pointer" : ""}`}
        onClick={handleBubbleClick}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onContextMenu={(e) => {
          e.preventDefault();
          openActionMenu();
        }}
      >
        {/* Selection mode checkbox */}
        {selectionMode && (
          <div className="shrink-0 mb-3" onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "bg-[var(--wine)] border-[var(--wine)]" : "border-white/40 bg-black/20"}`}>
              {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
            </div>
          </div>
        )}

        {!isMine && (
          <div className={`shrink-0 ${(groupPosition === "single" || groupPosition === "bottom") ? "opacity-100" : "opacity-0"}`}>
            <Avatar initial={partnerInitial} color={partnerColor} size={28} imageUrl={partnerAvatarUrl} />
          </div>
        )}
        
        <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} ${actualType === "audio" ? "max-w-[85%] sm:max-w-[72%]" : "max-w-[80%] sm:max-w-[70%]"} min-w-0`}>
          <div className="group relative w-full min-w-0">
            
            {actualType === "image_group" ? (
              (() => {
                const displayCount = Math.min(deckItems.length, 3);
                const remainingCount = deckItems.length - 1;
                
                return (
                  <div className={`relative inline-block ${replyToText && !isActuallyDeleted ? (isMine ? 'bg-gradient-to-b from-white/[0.28] to-white/[0.18] text-white backdrop-blur-xl border-white/30' : 'bg-gradient-to-b from-[#242428]/90 to-[#18181A]/85 text-white backdrop-blur-xl border-white/15') + ' p-1 rounded-[10px] border shadow-[0_4px_16px_rgba(0,0,0,0.22)]' : ''}`}>
                    {renderQuotedReply("max-w-[210px]")}
                    <div className="relative inline-block group w-[210px] h-[250px] my-1 cursor-pointer" onClick={() => { if (!selectionMode) { setIsFullscreen(true); setFullscreenIndex(0); } }}> 
                      {Array.from({ length: displayCount }).map((_, domIndex) => {
                        const realIndex = displayCount - 1 - domIndex;
                        const item = deckItems[realIndex];
                        if (!item) return null;
                        
                        let transforms = "";
                        if (realIndex === 0) {
                          transforms = "rotate-0 translate-y-0 z-30 group-active:scale-95";
                        } else if (realIndex === 1) {
                          transforms = "rotate-[8deg] translate-x-12 -translate-y-2 z-20 opacity-95 group-hover:rotate-[10deg] group-hover:translate-x-16 group-active:scale-95";
                        } else if (realIndex === 2) {
                          transforms = "-rotate-[8deg] -translate-x-12 -translate-y-2 z-10 opacity-90 group-hover:-rotate-[10deg] group-hover:-translate-x-16 group-active:scale-95";
                        }

                        return (
                          <div key={realIndex} className={`absolute inset-0 rounded-[9px] overflow-hidden border-2 border-[#18181A]/40 shadow-2xl transition-all duration-300 ease-out origin-bottom ${transforms}`}>
                            {item.type === "video" ? (
                              <div className="w-full h-full relative bg-black">
                                <video src={item.url} preload="metadata" muted playsInline className="w-full h-full object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                  <div className="w-9 h-9 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white shadow-lg">
                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <img src={item.url} className="w-full h-full object-cover" alt="" />
                            )}
                            {realIndex === 0 && remainingCount > 0 && (
                              <div className="absolute bottom-3 inset-x-0 flex justify-center z-40">
                                <span className="bg-black/60 backdrop-blur-xl px-3.5 py-1 rounded-full text-white font-medium text-[13px] shadow-xl border border-white/10 flex items-center gap-1.5">
                                  +{remainingCount} {deckItems.some(d => d.type === "video") ? "media" : "photos"}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="bg-black/55 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[11.5px] absolute -bottom-1.5 -right-1.5 flex items-center gap-1 z-40 pointer-events-none shadow-lg">
                        <span>{formatTime(timestamp)}</span>
                        {isMine && status && (
                          <MessageStatusTicks status={status} queued={queued} className="h-3.5 w-3.5" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : actualContent === "NUDGE_PING_💖" ? (
              <div className="py-1 text-[64px] leading-none animate-in zoom-in-50 duration-500 drop-shadow-xl" style={{ filter: 'drop-shadow(0 10px 15px rgba(255,50,100,0.4))' }}>
                 💖
              </div>
            ) : actualType === "sticker" ? (
              <div className="relative inline-block group select-none">
                {renderQuotedReply("max-w-[170px]")}
                <div className="relative inline-block p-1">
                  <img
                    src={actualContent}
                    alt="Sticker"
                    className="w-[145px] h-[145px] sm:w-[160px] sm:h-[160px] object-contain drop-shadow-[0_8px_22px_rgba(0,0,0,0.38)] transition-transform active:scale-95 cursor-pointer"
                    loading="lazy"
                    onClick={() => { if (!selectionMode) { setIsFullscreen(true); setFullscreenIndex(0); } }}
                  />
                  <div className="bg-black/55 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[11px] absolute bottom-1.5 right-1.5 flex items-center gap-1 z-10 pointer-events-none shadow-md">
                    <span>{formatTime(timestamp)}</span>
                    {isMine && status && (
                      <MessageStatusTicks status={status} queued={queued} className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>
              </div>
            ) : actualType === "image" ? (
              captionText ? (
                <div className={`relative inline-block group rounded-[10px] border shadow-[0_4px_16px_rgba(0,0,0,0.22)] overflow-hidden p-1 ${isMine ? 'bg-gradient-to-b from-white/[0.28] to-white/[0.18] text-white backdrop-blur-xl border-white/30' : 'bg-gradient-to-b from-[#242428]/90 to-[#18181A]/85 text-white backdrop-blur-xl border-white/15'}`}>
                  {renderQuotedReply("max-w-[210px]")}
                  <img 
                    src={actualContent} 
                    alt="Image message" 
                    onClick={() => { if (!selectionMode) { setIsFullscreen(true); setFullscreenIndex(0); } }} 
                    className="max-w-[210px] max-h-[270px] rounded-[8px] object-cover cursor-pointer border border-white/5 w-full block active:opacity-90 hover:opacity-95 transition-opacity" 
                    role="button"
                    aria-label="Open full-screen image"
                  />
                  <div className="px-2 pt-1.5 pb-2 text-[14.5px] leading-snug break-words">
                    <span className="whitespace-pre-wrap">{captionText}</span>
                    <span className={`inline-block ${isEdited ? "w-[94px]" : "w-[62px]"} h-3.5 ml-1.5`} aria-hidden="true" />
                  </div>
                  <span className="absolute bottom-[4px] right-[7px] flex items-center gap-1 select-none pointer-events-none">
                    {isEdited && !isActuallyDeleted && (
                      <span className="text-[10.5px] text-white/50 italic mr-0.5">Edited</span>
                    )}
                    <span className={`text-[11.5px] font-medium tracking-tight ${isMine ? 'text-white/70' : 'text-[#7FE283]'}`}>{formatTime(timestamp)}</span>
                    {isMine && status && !isActuallyDeleted && (
                      <MessageStatusTicks status={status} queued={queued} className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </span>
                </div>
              ) : (
                <div className={`relative inline-block group ${replyToText && !isActuallyDeleted ? (isMine ? 'bg-gradient-to-b from-white/[0.28] to-white/[0.18] text-white backdrop-blur-xl border-white/30' : 'bg-gradient-to-b from-[#242428]/90 to-[#18181A]/85 text-white backdrop-blur-xl border-white/15') + ' p-1 rounded-[10px] border shadow-[0_4px_16px_rgba(0,0,0,0.22)]' : ''}`}>
                  {renderQuotedReply("max-w-[210px]")}
                  <div className="relative inline-block">
                    <img 
                      src={actualContent} 
                      alt="Image message" 
                      onClick={() => { if (!selectionMode) { setIsFullscreen(true); setFullscreenIndex(0); } }} 
                      className="max-w-[210px] max-h-[270px] rounded-[9px] object-cover cursor-pointer border border-white/5 active:opacity-90 hover:opacity-95 transition-opacity" 
                      role="button"
                      aria-label="Open full-screen image"
                    />
                    <div className="bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[11.5px] absolute bottom-1.5 right-1.5 flex items-center gap-1 z-10 pointer-events-none">
                      <span>{formatTime(timestamp)}</span>
                      {isMine && status && (
                        <MessageStatusTicks status={status} queued={queued} className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </div>
                </div>
              )
            ) : actualType === "video" ? (
              captionText ? (
                <div className={`relative inline-block group rounded-[10px] border shadow-[0_4px_16px_rgba(0,0,0,0.22)] overflow-hidden p-1 ${isMine ? 'bg-gradient-to-b from-white/[0.28] to-white/[0.18] text-white backdrop-blur-xl border-white/30' : 'bg-gradient-to-b from-[#242428]/90 to-[#18181A]/85 text-white backdrop-blur-xl border-white/15'}`}>
                  {renderQuotedReply("max-w-[250px]")}
                  <VideoPlayer url={actualContent} onClick={() => { if (!selectionMode) { setIsFullscreen(true); setFullscreenIndex(0); } }} />
                  <div className="px-2 pt-1.5 pb-2 text-[14.5px] leading-snug break-words">
                    <span className="whitespace-pre-wrap">{captionText}</span>
                    <span className={`inline-block ${isEdited ? "w-[94px]" : "w-[62px]"} h-3.5 ml-1.5`} aria-hidden="true" />
                  </div>
                  <span className="absolute bottom-[4px] right-[7px] flex items-center gap-1 select-none pointer-events-none">
                    {isEdited && !isActuallyDeleted && (
                      <span className="text-[10.5px] text-white/50 italic mr-0.5">Edited</span>
                    )}
                    <span className={`text-[11.5px] font-medium tracking-tight ${isMine ? 'text-white/70' : 'text-[#7FE283]'}`}>{formatTime(timestamp)}</span>
                    {isMine && status && !isActuallyDeleted && (
                      <MessageStatusTicks status={status} queued={queued} className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </span>
                </div>
              ) : (
                <div className={`relative inline-block group ${replyToText && !isActuallyDeleted ? (isMine ? 'bg-gradient-to-b from-white/[0.28] to-white/[0.18] text-white backdrop-blur-xl border-white/30' : 'bg-gradient-to-b from-[#242428]/90 to-[#18181A]/85 text-white backdrop-blur-xl border-white/15') + ' p-1 rounded-[10px] border shadow-[0_4px_16px_rgba(0,0,0,0.22)]' : ''}`}>
                  {renderQuotedReply("max-w-[250px]")}
                  <VideoPlayer url={actualContent} onClick={() => { if (!selectionMode) { setIsFullscreen(true); setFullscreenIndex(0); } }}>
                    <div className="bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[11.5px] absolute bottom-1.5 right-1.5 flex items-center gap-1 z-10 pointer-events-none">
                      <span>{formatTime(timestamp)}</span>
                      {isMine && status && (
                        <MessageStatusTicks status={status} queued={queued} className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </VideoPlayer>
                </div>
              )
            ) : isFile ? (
              <div className={`flex flex-col px-3 py-1.5 rounded-[10px] relative shadow-[0_4px_16px_rgba(0,0,0,0.22)] min-w-[175px] ${isMine ? 'bg-gradient-to-b from-white/[0.28] to-white/[0.18] text-white backdrop-blur-xl border border-white/30' : 'bg-gradient-to-b from-[#242428]/90 to-[#18181A]/85 text-white backdrop-blur-xl border border-white/15'}`}>
                {renderQuotedReply()}
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:opacity-90 active:scale-[0.98] transition-all">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isMine ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>
                    <Download className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0 pr-7">
                    <span className="text-[13.5px] font-medium text-white truncate">{fileName}</span>
                    <span className="text-[11px] text-white/50">{fileSize > 0 ? (fileSize / 1024 / 1024).toFixed(1) + ' MB' : 'Document'}</span>
                  </div>
                  <span className="absolute bottom-[4px] right-[7px] flex items-center gap-1 select-none pointer-events-none">
                    {isEdited && <span className="text-[10.5px] text-white/45 italic mr-0.5">Edited</span>}
                    <span className={`text-[11.5px] font-medium tracking-tight ${isMine ? 'text-white/70' : 'text-[#7FE283]'}`}>{formatTime(timestamp)}</span>
                    {isMine && status && <MessageStatusTicks status={status} queued={queued} className="h-3.5 w-3.5 shrink-0" />}
                  </span>
                </a>
              </div>
            ) : actualType === "audio" ? (
              <div className={`flex flex-col w-[240px] xs:w-[255px] sm:w-[270px] max-w-[calc(100vw-65px)] min-w-0 ${replyToText && !isActuallyDeleted ? (isMine ? 'bg-gradient-to-b from-white/[0.28] to-white/[0.18] text-white backdrop-blur-xl border-white/30' : 'bg-gradient-to-b from-[#242428]/90 to-[#18181A]/85 text-white backdrop-blur-xl border-white/15') + ' p-1 rounded-[10px] border shadow-[0_4px_16px_rgba(0,0,0,0.22)]' : ''}`}>
                {renderQuotedReply("w-full")}
                <AudioPlayer url={actualContent} isMine={isMine} timestamp={timestamp} status={status} queued={queued} myAvatarUrl={myAvatarUrl} partnerAvatarUrl={partnerAvatarUrl} partnerInitial={partnerInitial} partnerColor={partnerColor} />
              </div>
            ) : (
              <div
                className={`px-3 pt-1.5 pb-2 text-[15px] leading-snug break-words rounded-[10px] relative shadow-[0_4px_16px_rgba(0,0,0,0.22)] ${
                  isActuallyDeleted
                    ? "bg-white/5 text-white/40 italic border-dashed border border-white/15"
                    : isMine
                    ? `bg-gradient-to-b from-white/[0.28] to-white/[0.18] text-white backdrop-blur-xl border border-white/30`
                    : `bg-gradient-to-b from-[#242428]/90 to-[#18181A]/85 text-white backdrop-blur-xl border border-white/15`
                }`}
              >
                {renderQuotedReply()}
                {isActuallyDeleted ? (
                  <div className="flex items-center gap-1.5 pr-12 py-0.5 text-[14px]">
                    <Ban className="w-3.5 h-3.5 text-white/40 shrink-0" />
                    <span>This message was deleted</span>
                  </div>
                ) : (
                  <>
                    <span className="whitespace-pre-wrap">{actualContent}</span>
                    <span className={`inline-block ${isEdited ? "w-[94px]" : "w-[62px]"} h-3.5 ml-1.5`} aria-hidden="true" />
                  </>
                )}
                
                <span className="absolute bottom-[4px] right-[7px] flex items-center gap-1 select-none pointer-events-none">
                  {isEdited && !isActuallyDeleted && (
                    <span className="text-[10.5px] text-white/50 italic mr-0.5">Edited</span>
                  )}
                  <span className={`text-[11.5px] font-medium tracking-tight ${isMine ? 'text-white/70' : 'text-[#7FE283]'}`}>{formatTime(timestamp)}</span>
                  {isMine && status && !isActuallyDeleted && (
                    <MessageStatusTicks status={status} queued={queued} className="h-3.5 w-3.5 shrink-0" />
                  )}
                </span>
              </div>
            )}

            {/* Reactions Bar & Context Menu */}
            <AnimatePresence>
            {showReactionMenu && !showFullPicker && (
              <div className={`absolute ${menuPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} ${isMine ? 'right-0' : 'left-0'} z-50 flex flex-col gap-2 max-w-[calc(100vw-32px)]`}>
                
                {/* Reaction Picker Bar (unless deleted message) */}
                {!isActuallyDeleted && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: menuPlacement === 'top' ? 10 : -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: menuPlacement === 'top' ? 10 : -10 }}
                    className={`flex items-center gap-1 bg-[#18181A] p-1.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.6)] border border-white/10 self-${isMine ? 'end' : 'start'}`}
                  >
                    {['❤️', '😂', '😭', '😍', '😘', '👍'].map(emoji => (
                      <motion.button 
                        whileTap={{ scale: 1.3 }} 
                        key={emoji} 
                        onClick={(e) => { 
                          e.stopPropagation();
                          onReact?.(emoji === myReaction ? 'NONE' : emoji); 
                          setShowReactionMenu(false); 
                        }} 
                        className={`text-xl md:hover:scale-125 transition-transform px-1 py-0.5 rounded-full ${emoji === myReaction ? 'bg-white/20' : ''}`}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                    <motion.button 
                      whileTap={{ scale: 0.9 }} 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFullPicker(true);
                      }} 
                      className="flex items-center justify-center w-7 h-7 rounded-full bg-white/5 text-white/70 active:text-white md:hover:text-white ml-0.5 transition-colors"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                    </motion.button>
                  </motion.div>
                )}

                {/* Actions Menu */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8, y: menuPlacement === 'top' ? 10 : -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: menuPlacement === 'top' ? 10 : -10 }}
                  className="flex flex-col bg-[#18181A]/95 backdrop-blur-2xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] border border-white/10 overflow-hidden py-1 divide-y divide-white/5"
                >
                  {/* Actions for regular messages */}
                  {!isActuallyDeleted && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); onReply?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                        <Reply className="w-4 h-4 text-white/60" /> Reply
                      </button>

                      {actualType === 'text' && !isFile && (
                        <button onClick={(e) => { e.stopPropagation(); onCopy?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                          <Copy className="w-4 h-4 text-white/60" /> Copy
                        </button>
                      )}

                      {isMine && actualType === 'text' && !isFile && (
                        <button onClick={(e) => { e.stopPropagation(); onEdit?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                          <Pencil className="w-4 h-4 text-white/60" /> Edit
                        </button>
                      )}

                      {(actualType === 'image' || actualType === 'image_group' || actualType === 'video') && onEditMedia && (
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          setShowReactionMenu(false);
                          const targetUrl = actualType === 'image_group' ? deckItems[0]?.url || actualContent : actualContent;
                          const targetType = (actualType === 'video' || (actualType === 'image_group' && deckItems[0]?.type === 'video')) ? 'video' : 'image';
                          onEditMedia(targetUrl, targetType); 
                        }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                          <Pencil className="w-4 h-4 text-[var(--gold)]" /> Edit Media
                        </button>
                      )}

                      {(actualType === 'image' || actualType === 'video' || isFile || actualType === 'sticker') && (
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                          <Download className="w-4 h-4 text-white/60" /> Save / Download
                        </button>
                      )}

                      {actualType === 'sticker' && onToggleFavoriteSticker && (
                        <button onClick={(e) => { e.stopPropagation(); onToggleFavoriteSticker(actualContent); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                          <Star className={`w-4 h-4 ${isFavoriteSticker ? "fill-yellow-400 text-yellow-400" : "text-white/60"}`} /> {isFavoriteSticker ? "Remove from Favorites" : "Add to Favorites"}
                        </button>
                      )}

                      <button onClick={(e) => { e.stopPropagation(); onPin?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                        <Pin className="w-4 h-4 text-white/60" /> {isPinned ? 'Unpin' : 'Pin'}
                      </button>

                      <button onClick={(e) => { e.stopPropagation(); onForward?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                        <Share2 className="w-4 h-4 text-white/60" /> Forward / Share
                      </button>

                      <button onClick={(e) => { e.stopPropagation(); onSelect?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                        <CheckSquare className="w-4 h-4 text-white/60" /> Select
                      </button>
                    </>
                  )}

                  {/* Info and Delete */}
                  <button onClick={(e) => { e.stopPropagation(); onInfo?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                    <Info className="w-4 h-4 text-white/60" /> Info
                  </button>

                  <button onClick={(e) => { e.stopPropagation(); onDelete?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-red-400 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                    <Trash2 className="w-4 h-4 text-red-400/80" /> Delete
                  </button>
                </motion.div>
              </div>
            )}
            </AnimatePresence>

            {/* Reactions Display Pill */}
            {reactions && Object.keys(reactions).length > 0 && !isActuallyDeleted && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  if (myReaction) {
                    onReact?.('NONE');
                  } else {
                    openActionMenu();
                  }
                }}
                className={`absolute -bottom-3 ${isMine ? 'right-4' : 'left-4'} flex items-center border ${myReaction ? 'border-white/30 bg-white/20' : 'bg-[#18181A] border-white/10'} rounded-full px-2 py-0.5 shadow-md z-20 cursor-pointer active:scale-95 transition-all`}
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
});

export default MessageBubble;
