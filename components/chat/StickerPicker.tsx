"use client";

import React, { useState, useEffect } from "react";
import { Clock, Star, Plus, Search, Sparkles, Heart } from "lucide-react";
import {
  Sticker,
  StickerPack,
  fetchStickerPacks,
  fetchRecentStickers,
  fetchFavoriteStickers,
  toggleFavoriteSticker,
  recordRecentSticker,
} from "@/lib/stickers";

interface StickerPickerProps {
  userId: string;
  onSelectSticker: (sticker: Sticker) => void;
  onOpenImport: () => void;
}

export default function StickerPicker({
  userId,
  onSelectSticker,
  onOpenImport,
}: StickerPickerProps) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activePackId, setActivePackId] = useState<string>("recent");
  const [recentStickers, setRecentStickers] = useState<Sticker[]>([]);
  const [favoriteStickers, setFavoriteStickers] = useState<Sticker[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Load packs, recents, favorites
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const [allPacks, recents, favs] = await Promise.all([
          fetchStickerPacks(),
          fetchRecentStickers(userId),
          fetchFavoriteStickers(userId),
        ]);
        if (isMounted) {
          setPacks(allPacks);
          setRecentStickers(recents);
          setFavoriteStickers(favs);

          // If no recents, default to first pack
          if (recents.length === 0 && allPacks.length > 0) {
            setActivePackId(allPacks[0].id);
          }
        }
      } catch (err) {
        console.error("[stickers] Failed to load sticker picker data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handlePick = (sticker: Sticker) => {
    recordRecentSticker(userId, sticker);
    setRecentStickers((prev) => [sticker, ...prev.filter((s) => s.url !== sticker.url)].slice(0, 24));
    onSelectSticker(sticker);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, sticker: Sticker) => {
    e.stopPropagation();
    const isNowFav = await toggleFavoriteSticker(userId, sticker);
    if (isNowFav) {
      setFavoriteStickers((prev) => [sticker, ...prev.filter((s) => s.url !== sticker.url)]);
    } else {
      setFavoriteStickers((prev) => prev.filter((s) => s.url !== sticker.url && s.id !== sticker.id));
    }
  };

  // Determine which stickers to render
  const displayedStickers: Sticker[] = (() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const allStickers: Sticker[] = [];
      for (const p of packs) {
        if (p.name.toLowerCase().includes(q)) {
          allStickers.push(...p.stickers);
        } else {
          for (const s of p.stickers) {
            allStickers.push(s);
          }
        }
      }
      return allStickers;
    }

    if (activePackId === "recent") return recentStickers;
    if (activePackId === "favorites") return favoriteStickers;

    const currentPack = packs.find((p) => p.id === activePackId);
    return currentPack ? currentPack.stickers : [];
  })();

  const isFavorite = (stk: Sticker) =>
    favoriteStickers.some((f) => f.url === stk.url || (f.id && stk.id && f.id === stk.id));

  return (
    <div className="flex flex-col h-[360px] bg-[#18181A]/95 text-white select-none">
      {/* Search Header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-white/10 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-white/40 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stickers…"
            className="w-full bg-transparent text-[13px] text-white placeholder:text-white/40 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-[11px] text-white/50 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Stickers Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-white/40 text-[13px]">
            <Sparkles className="w-6 h-6 animate-pulse mb-2 text-[var(--gold)]" />
            <span>Loading stickers…</span>
          </div>
        ) : displayedStickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-white/40 p-4">
            {activePackId === "recent" ? (
              <>
                <Clock className="w-7 h-7 mb-2 opacity-40" />
                <p className="text-[13.5px] font-medium text-white/60 mb-0.5">No recent stickers</p>
                <p className="text-[12px]">Stickers you send will appear here.</p>
              </>
            ) : activePackId === "favorites" ? (
              <>
                <Star className="w-7 h-7 mb-2 opacity-40 text-yellow-400" />
                <p className="text-[13.5px] font-medium text-white/60 mb-0.5">No favorites yet</p>
                <p className="text-[12px]">Right click or tap the star on any sticker to favorite it.</p>
              </>
            ) : (
              <>
                <p className="text-[13.5px] font-medium text-white/60">No stickers in this pack</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2.5">
            {displayedStickers.map((sticker, idx) => (
              <div
                key={`${sticker.id || sticker.url}-${idx}`}
                className="relative group aspect-square flex items-center justify-center rounded-xl p-1.5 hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                onClick={() => handlePick(sticker)}
              >
                <img
                  src={sticker.url}
                  alt="Sticker"
                  loading="lazy"
                  className="w-full h-full object-contain pointer-events-none drop-shadow-md"
                />
                <button
                  type="button"
                  onClick={(e) => handleToggleFavorite(e, sticker)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95"
                  title={isFavorite(sticker) ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star
                    className={`w-3 h-3 ${
                      isFavorite(sticker)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-white/70"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-Tabs Bar: Recents | Favorites | Pack Icons | + Import */}
      <div className="flex items-center gap-1 px-2.5 py-1.5 border-t border-white/10 bg-black/40 overflow-x-auto no-scrollbar shrink-0">
        {/* Recents Button */}
        <button
          onClick={() => {
            setActivePackId("recent");
            setSearchQuery("");
          }}
          className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors ${
            activePackId === "recent" && !searchQuery
              ? "bg-[var(--wine)] text-white shadow"
              : "text-white/60 hover:text-white"
          }`}
          title="Recent stickers"
        >
          <Clock className="w-4 h-4" />
        </button>

        {/* Favorites Button */}
        <button
          onClick={() => {
            setActivePackId("favorites");
            setSearchQuery("");
          }}
          className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors ${
            activePackId === "favorites" && !searchQuery
              ? "bg-[var(--wine)] text-white shadow"
              : "text-white/60 hover:text-white"
          }`}
          title="Favorite stickers"
        >
          <Star className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* Pack Cover Thumbnails */}
        {packs.map((pack) => (
          <button
            key={pack.id}
            onClick={() => {
              setActivePackId(pack.id);
              setSearchQuery("");
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-xl shrink-0 p-1 transition-all ${
              activePackId === pack.id && !searchQuery
                ? "bg-white/20 border-2 border-[var(--gold)] scale-105"
                : "opacity-60 hover:opacity-100"
            }`}
            title={pack.name}
          >
            {pack.cover_url ? (
              <img
                src={pack.cover_url}
                alt={pack.name}
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              <Heart className="w-4 h-4 text-[var(--gold)]" />
            )}
          </button>
        ))}

        {/* Add / Import Pack Button */}
        <button
          onClick={onOpenImport}
          className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 ml-auto bg-white/10 hover:bg-white/20 text-white/80 hover:text-white active:scale-95 transition-all shadow border border-white/10"
          title="Import new sticker pack"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
