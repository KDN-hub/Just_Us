"use client";
import { useState, useRef, useEffect, memo } from "react";
import Link from "next/link";
import { ChevronLeft, Phone, Video, Image as ImageIcon, UserPen, Images, MoreVertical, Search, X, Copy, Share2, Trash2, Pin } from "lucide-react";
import Avatar from "@/components/Avatar";
import { formatLastSeen } from "@/hooks/useChatStore";

interface ChatHeaderProps {
  partnerInitial: string;
  partnerColor: string;
  partnerDisplay: string;
  daysTogether: number;
  isOnline: boolean;
  reconnecting: boolean;
  partnerIsOnline: boolean;
  partnerLastSeen: string | null;
  onOpenWallpaper?: () => void;
  onOpenUsername?: () => void;
  onOpenMedia?: () => void;
  partnerAvatarUrl?: string | null;
  onOpenAvatarUpload?: () => void;
  onSearchClick?: () => void;
  onOpenPinned?: () => void;
  pinnedCount?: number;
  selectionMode?: boolean;
  selectedCount?: number;
  onCancelSelection?: () => void;
  onCopySelected?: () => void;
  onShareSelected?: () => void;
  onDeleteSelected?: () => void;
}

function ChatHeader({
  partnerInitial,
  partnerColor,
  partnerDisplay,
  daysTogether,
  isOnline,
  reconnecting,
  partnerIsOnline,
  partnerLastSeen,
  onOpenWallpaper,
  onOpenUsername,
  onOpenMedia,
  partnerAvatarUrl,
  onOpenAvatarUpload,
  onSearchClick,
  onOpenPinned,
  pinnedCount = 0,
  selectionMode = false,
  selectedCount = 0,
  onCancelSelection,
  onCopySelected,
  onShareSelected,
  onDeleteSelected,
}: ChatHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const partnerLastSeenText = formatLastSeen(partnerLastSeen, now);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  if (selectionMode) {
    return (
      <header className="relative z-[60] shrink-0 flex items-center justify-between bg-[#18181A]/95 backdrop-blur-2xl border-b border-white/10 px-4 pb-4 pt-[max(env(safe-area-inset-top,0px),1rem)] shadow-lg animate-in fade-in duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancelSelection}
            aria-label="Cancel selection"
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white shadow-sm transition-transform active:scale-95"
          >
            <X className="h-6 w-6" strokeWidth={2.5} />
          </button>
          <span className="text-[18px] font-bold text-white">
            {selectedCount} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopySelected}
            disabled={selectedCount === 0}
            aria-label="Copy selected"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            <Copy className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            onClick={onShareSelected}
            disabled={selectedCount === 0}
            aria-label="Forward or Share selected"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            <Share2 className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
            aria-label="Delete selected"
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
          >
            <Trash2 className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="relative z-[60] shrink-0 flex items-center gap-3 bg-[#18181A]/95 backdrop-blur-2xl border-b border-white/10 px-4 pb-4 pt-[max(env(safe-area-inset-top,0px),1rem)] shadow-lg">
      <Link
        href="/home"
        aria-label="Back"
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-white/5 border border-white/10 text-white shadow-sm transition-transform active:scale-95"
      >
        <ChevronLeft className="h-7 w-7 mr-0.5" strokeWidth={3} />
      </Link>

      <div className="relative shrink-0">
        <button onClick={onOpenAvatarUpload} className="relative group block rounded-full focus:outline-none transition-transform active:scale-95">
          <Avatar initial={partnerInitial} color={partnerColor} size={48} imageUrl={partnerAvatarUrl} />
          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <ImageIcon className="h-4 w-4 text-white" />
          </div>
        </button>
        {partnerIsOnline && (
          <span className="absolute -top-0.5 -right-0.5 h-[14px] w-[14px] rounded-full bg-[#5BD05F] border-[2.5px] border-[#18181A]" />
        )}
      </div>

      <div className="min-w-0 flex-1 ml-1">
        <div className="flex items-center gap-2">
          <span className="text-[22px] font-bold text-white truncate">
            {partnerDisplay}
          </span>
        </div>
        <div className="flex items-center min-w-0">
          {!isOnline ? (
            <span className="text-[13px] italic text-[#F5C842] truncate" role="status">
              No network
            </span>
          ) : reconnecting ? (
            <span className="text-[13px] italic text-white/50 truncate" role="status">
              Connecting…
            </span>
          ) : partnerIsOnline ? (
            <span className="text-[13px] text-[#5BD05F] font-medium truncate">Online</span>
          ) : (
            <span className="text-[13px] text-white/50 truncate block w-full">
              {partnerLastSeenText}
            </span>
          )}
        </div>
      </div>      
      
      <div className="flex items-center gap-2">
        <Link
          href="/call?type=voice"
          aria-label="Voice call"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
        >
          <Phone className="h-[22px] w-[22px]" strokeWidth={2} />
        </Link>
        <Link
          href="/call?type=video"
          aria-label="Video call"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
        >
          <Video className="h-[22px] w-[22px]" strokeWidth={2} />
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            aria-label="More options"
            onClick={() => setShowMenu(!showMenu)}
            className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-colors"
          >
            <MoreVertical className="h-[22px] w-[22px]" strokeWidth={2} />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#18181A]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2">
              <button 
                onClick={() => { setShowMenu(false); onOpenPinned?.(); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-white active:bg-white/10"
              >
                <Pin className="h-5 w-5 text-[var(--gold)]" strokeWidth={2} />
                <span className="text-[15px]">Pinned Messages {pinnedCount > 0 ? `(${pinnedCount})` : ''}</span>
              </button>
              <button 
                onClick={() => { setShowMenu(false); onOpenWallpaper?.(); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-white active:bg-white/10"
              >
                <ImageIcon className="h-5 w-5 text-[#34B7F1]" strokeWidth={2} />
                <span className="text-[15px]">Chat Wallpaper</span>
              </button>
              <button 
                onClick={() => { setShowMenu(false); onOpenUsername?.(); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-white active:bg-white/10"
              >
                <UserPen className="h-5 w-5 text-[var(--gold)]" strokeWidth={2} />
                <span className="text-[15px]">Change Username</span>
              </button>
              <button 
                onClick={() => { setShowMenu(false); onSearchClick?.(); }} 
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-white active:bg-white/10"
              >
                <Search className="h-5 w-5 text-gray-400" strokeWidth={2} />
                <span className="text-[15px]">Search Chat</span>
              </button>
              <button 
                onClick={() => { setShowMenu(false); onOpenMedia?.(); }}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-white active:bg-white/10"
              >
                <Images className="h-5 w-5 text-[#5BD05F]" strokeWidth={2} />
                <span className="text-[15px]">Media, Links & Docs</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default memo(ChatHeader);
