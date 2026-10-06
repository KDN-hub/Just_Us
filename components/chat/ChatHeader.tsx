"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Phone, Video, Image as ImageIcon, UserPen, Images, MoreVertical, Search } from "lucide-react";
import Avatar from "@/components/Avatar";

interface ChatHeaderProps {
  partnerInitial: string;
  partnerColor: string;
  partnerDisplay: string;
  daysTogether: number;
  isOnline: boolean;
  reconnecting: boolean;
  partnerIsOnline: boolean;
  partnerLastSeenText: string;
  onOpenWallpaper?: () => void;
  onOpenUsername?: () => void;
  onOpenMedia?: () => void;
  partnerAvatarUrl?: string | null;
  onOpenAvatarUpload?: () => void;
  onSearchClick?: () => void;
}

export default function ChatHeader({
  partnerInitial,
  partnerColor,
  partnerDisplay,
  daysTogether,
  isOnline,
  reconnecting,
  partnerIsOnline,
  partnerLastSeenText,
  onOpenWallpaper,
  onOpenUsername,
  onOpenMedia,
  partnerAvatarUrl,
  onOpenAvatarUpload,
  onSearchClick
}: ChatHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  return (
    <header className="relative z-[60] shrink-0 flex items-center gap-3 bg-[#18181A]/95 backdrop-blur-2xl border-b border-white/10 px-4 pb-4 pt-[max(env(safe-area-inset-top),4.5rem)] shadow-lg">
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
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#18181A]/90 backdrop-blur-md border border-white/10 shadow-lg overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2">
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
                <span className="text-[15px]">Change Username</span></button>
              <button onClick={() => { setShowMenu(false); onSearchClick?.(); }} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-white active:bg-white/10">
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



