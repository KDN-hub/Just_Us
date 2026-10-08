"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Download,
  Pencil,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Loader2,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { resolveMediaUrl, downloadMediaFile } from "@/lib/media";

export interface MediaViewerItem {
  id?: string;
  url: string;
  type: "image" | "video";
  caption?: string;
  timestamp?: string;
  senderName?: string;
}

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  items: MediaViewerItem[];
  initialIndex?: number;
  onShowInChat?: (messageId: string) => void;
  onEditMedia?: (url: string, type: "image" | "video") => void;
}

export default function MediaViewer({
  isOpen,
  onClose,
  items,
  initialIndex = 0,
  onShowInChat,
  onEditMedia,
}: MediaViewerProps) {
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [resolvedUrl, setResolvedUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeMediaType, setActiveMediaType] = useState<"image" | "video">("image");

  // Video playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Update currentIndex when initialIndex changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(initialIndex, 0), Math.max(items.length - 1, 0)));
      setShowControls(true);
    }
  }, [isOpen, initialIndex, items.length]);

  const currentItem: MediaViewerItem | undefined = items[currentIndex];

  // Resolve signed URL / public URL for current item
  const loadMedia = useCallback(async (item?: MediaViewerItem) => {
    if (!item || !item.url) {
      setResolvedUrl("");
      setIsLoading(false);
      return;
    }
    setActiveMediaType(item.type || "image");
    setIsLoading(true);
    setHasError(false);
    setIsPlaying(false);
    setCurrentTime(0);

    try {
      const cleanUrl = item.url.replace("VIDEO_URL:", "").trim();
      const signedOrPublic = await resolveMediaUrl(cleanUrl);
      setResolvedUrl(signedOrPublic);
    } catch (err) {
      console.error("[MediaViewer] Error resolving URL:", err);
      setHasError(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && currentItem) {
      setActiveMediaType(currentItem.type || "image");
      loadMedia(currentItem);
    }
  }, [isOpen, currentItem, loadMedia]);

  // Background Scroll Locking
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        if (currentIndex > 0) {
          e.preventDefault();
          setCurrentIndex((prev) => prev - 1);
        }
      } else if (e.key === "ArrowRight") {
        if (currentIndex < items.length - 1) {
          e.preventDefault();
          setCurrentIndex((prev) => prev + 1);
        }
      } else if (e.key === " " && currentItem?.type === "video") {
        e.preventDefault();
        togglePlayPause();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, items.length, currentItem, onClose]);

  // Auto-hide controls after inactivity on video
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3500);
    }
  }, [isPlaying]);

  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
      resetControlsTimer();
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowControls(true);
    }
  };

  const handleDownload = async () => {
    if (!currentItem) return;
    setIsDownloading(true);
    try {
      await downloadMediaFile(currentItem.url);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;

    // Horizontal swipe threshold: 55px
    if (Math.abs(diff) > 55) {
      if (diff > 0 && currentIndex < items.length - 1) {
        // Swiped Left -> Next
        setCurrentIndex((i) => i + 1);
      } else if (diff < 0 && currentIndex > 0) {
        // Swiped Right -> Prev
        setCurrentIndex((i) => i - 1);
      }
    }
    touchStartXRef.current = null;
  };

  const handleVideoError = () => {
    if (resolvedUrl) {
      const probeImg = new Image();
      probeImg.onload = () => {
        console.log("[MediaViewer] Video decode failed, auto-recovered as Image.");
        setActiveMediaType("image");
        setIsLoading(false);
        setHasError(false);
      };
      probeImg.onerror = () => {
        setIsLoading(false);
        setHasError(true);
      };
      probeImg.src = resolvedUrl;
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  };

  const handleImageError = () => {
    if (resolvedUrl) {
      const probeVid = document.createElement("video");
      probeVid.onloadeddata = () => {
        console.log("[MediaViewer] Image load failed, auto-recovered as Video.");
        setActiveMediaType("video");
        setIsLoading(false);
        setHasError(false);
      };
      probeVid.onerror = () => {
        setIsLoading(false);
        setHasError(true);
      };
      probeVid.src = resolvedUrl;
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  };

  function formatTimeDisplay(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function formatTimestamp(iso?: string): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  if (!mounted || !isOpen || !currentItem) return null;

  const isVideo = activeMediaType === "video";
  const hasMultiple = items.length > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black flex flex-col select-none overflow-hidden touch-none"
      style={{ WebkitTapHighlightColor: "transparent" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseMove={resetControlsTimer}
    >
      {/* Top Controls Bar */}
      <div
        className={`absolute top-0 inset-x-0 z-50 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top,0px),3.75rem)] pb-4 bg-gradient-to-b from-black/95 via-black/70 to-transparent transition-opacity duration-300 pointer-events-auto ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Left: Close Button & Metadata */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white transition-all active:scale-95 shrink-0 border border-white/10 shadow-lg focus:outline-none"
            aria-label="Close media viewer"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white text-[15px] font-semibold leading-tight truncate">
                {currentItem.senderName || "Media"}
              </span>
              {hasMultiple && (
                <span className="text-white/60 text-[12px] font-medium shrink-0">
                  ({currentIndex + 1} of {items.length})
                </span>
              )}
            </div>
            {currentItem.timestamp && (
              <span className="text-white/50 text-[11.5px] leading-tight">
                {formatTimestamp(currentItem.timestamp)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions (Show in Chat, Edit, Download) */}
        <div className="flex items-center gap-2 shrink-0">
          {currentItem.id && onShowInChat && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onShowInChat(currentItem.id!);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white text-[13px] font-medium transition-all active:scale-95 border border-white/10 shadow-lg"
              title="Locate message in chat"
            >
              <MessageSquare className="w-4 h-4 text-[var(--gold)]" />
              <span className="hidden sm:inline">Show in chat</span>
            </button>
          )}

          {onEditMedia && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditMedia(currentItem.url, currentItem.type);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white text-[13px] font-medium transition-all active:scale-95 border border-white/10 shadow-lg"
              title="Edit media"
            >
              <Pencil className="w-4 h-4 text-[var(--gold)]" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md text-white transition-all active:scale-95 border border-white/10 shadow-lg shrink-0 disabled:opacity-50"
            aria-label="Download media"
            title="Download file"
          >
            {isDownloading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Focused Media Canvas */}
      <div
        className="flex-1 flex items-center justify-center relative min-h-0 min-w-0 bg-black overflow-hidden"
        onClick={toggleControls}
      >
        {/* Loading Spinner */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20 pointer-events-none">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--gold)]" />
            <span className="text-white/60 text-[13.5px] font-medium">Loading media…</span>
          </div>
        )}

        {/* Error Screen */}
        {hasError && (
          <div
            className="flex flex-col items-center justify-center text-center p-6 bg-[#18181A]/90 border border-white/10 rounded-2xl max-w-sm z-30 mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-white text-[15px] font-semibold mb-1">Unable to load this media</p>
            <p className="text-white/50 text-[13px] mb-5">
              The media could not be loaded or the connection timed out.
            </p>
            <div className="flex items-center gap-3 w-full justify-center">
              <button
                type="button"
                onClick={() => loadMedia(currentItem)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 text-white text-[13px] font-medium transition-all"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full bg-red-600/80 hover:bg-red-600 active:scale-95 text-white text-[13px] font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Image Rendering with Zoom / Pan */}
        {!isVideo && resolvedUrl && (
          <div
            className="w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={5}
              doubleClick={{ mode: "toggle", step: 2 }}
              wheel={{ step: 0.2 }}
            >
              <TransformComponent
                wrapperStyle={{ width: "100%", height: "100%" }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={resolvedUrl}
                  alt={currentItem.caption || "Fullscreen media"}
                  className={`max-h-full max-w-full object-contain pointer-events-auto transition-opacity duration-300 ${
                    isLoading ? "opacity-0" : "opacity-100"
                  }`}
                  onLoad={() => setIsLoading(false)}
                  onError={handleImageError}
                  draggable={false}
                />
              </TransformComponent>
            </TransformWrapper>
          </div>
        )}

        {/* Video Rendering with Custom Playback Controls */}
        {isVideo && resolvedUrl && (
          <div
            className="w-full h-full relative flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
          >
            <video
              ref={videoRef}
              src={resolvedUrl}
              playsInline
              autoPlay
              className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
                isLoading ? "opacity-0" : "opacity-100"
              }`}
              onLoadedData={() => {
                setIsLoading(false);
                if (videoRef.current) {
                  setDuration(videoRef.current.duration || 0);
                  setIsPlaying(!videoRef.current.paused);
                }
              }}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                }
              }}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onEnded={() => {
                setIsPlaying(false);
                setShowControls(true);
              }}
              onError={handleVideoError}
            />

            {/* Buffering Indicator */}
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <Loader2 className="w-12 h-12 animate-spin text-white/70" />
              </div>
            )}

            {/* Large Center Play Button when Paused */}
            {!isPlaying && !isLoading && !hasError && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                className="absolute inset-0 flex items-center justify-center z-20 group focus:outline-none"
                aria-label="Play video"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl transition-transform group-hover:scale-110 active:scale-95">
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1 text-white" />
                </div>
              </button>
            )}
          </div>
        )}

        {/* Deck Navigation Chevrons */}
        {hasMultiple && (
          <>
            {currentIndex > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((i) => i - 1);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/50 hover:bg-black/80 active:bg-black/90 text-white backdrop-blur-md border border-white/10 transition-all active:scale-95 shadow-xl hidden sm:flex items-center justify-center"
                aria-label="Previous item"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {currentIndex < items.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((i) => i + 1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-black/50 hover:bg-black/80 active:bg-black/90 text-white backdrop-blur-md border border-white/10 transition-all active:scale-95 shadow-xl hidden sm:flex items-center justify-center"
                aria-label="Next item"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Caption Overlay */}
      {currentItem.caption && (
        <div
          className={`absolute ${
            isVideo
              ? "bottom-[max(env(safe-area-inset-bottom,0px)+5.5rem,6rem)]"
              : "bottom-[max(env(safe-area-inset-bottom,0px)+2.5rem,3.5rem)]"
          } inset-x-0 z-40 flex justify-center px-4 pointer-events-none transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="bg-[#18181A]/90 backdrop-blur-md text-white text-[14px] px-5 py-2.5 rounded-2xl max-w-lg text-center border border-white/10 shadow-2xl pointer-events-auto leading-relaxed max-h-28 overflow-y-auto">
            {currentItem.caption}
          </div>
        </div>
      )}

      {/* Bottom Floating Bar (Custom Video Scrubber for Video, or Minimal Safe Area Dock) */}
      {isVideo && (
        <div
          className={`absolute bottom-0 inset-x-0 z-50 px-4 pt-3 pb-[max(env(safe-area-inset-bottom,0px),2.25rem)] bg-gradient-to-t from-black/95 via-black/75 to-transparent transition-opacity duration-300 pointer-events-auto ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1.5 max-w-2xl mx-auto">
            {/* Scrubber slider */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-[var(--wine)] focus:outline-none"
              aria-label="Video seek slider"
            />

            {/* Video Controls Bar */}
            <div className="flex items-center justify-between text-white text-[13px] pt-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="p-1 text-white hover:text-white/80 active:scale-95 transition-all"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1 text-white/80 hover:text-white active:scale-95 transition-all"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-red-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>

                <span className="text-[12px] text-white/70 font-mono">
                  {formatTimeDisplay(currentTime)} / {formatTimeDisplay(duration)}
                </span>
              </div>

              {/* Fullscreen request trigger */}
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    if (videoRef.current.requestFullscreen) {
                      videoRef.current.requestFullscreen();
                    } else if ((videoRef.current as any).webkitEnterFullscreen) {
                      (videoRef.current as any).webkitEnterFullscreen();
                    }
                  }
                }}
                className="p-1 text-white/80 hover:text-white active:scale-95 transition-all"
                aria-label="Expand fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
