import { supabase } from "@/lib/supabase";

export interface Sticker {
  id: string;
  pack_id?: string;
  owner_id?: string;
  storage_path?: string;
  url: string;
  mime_type?: string;
  width?: number;
  height?: number;
  created_at?: string;
  is_favorite?: boolean;
}

export interface StickerPack {
  id: string;
  name: string;
  creator_id?: string;
  cover_url?: string;
  stickers: Sticker[];
  created_at?: string;
}

// Built-in starter sticker packs for Just Us (Cute Couples & Fun Reactions)
export const DEFAULT_STICKER_PACKS: StickerPack[] = [
  {
    id: "pack-love-bubu-dudu",
    name: "Bubu & Dudu ❤️",
    cover_url: "https://media.tenor.com/T0b-Oa0u7sYAAAAi/tkthao219-bubududu.gif",
    stickers: [
      { id: "s-bd-1", url: "https://media.tenor.com/T0b-Oa0u7sYAAAAi/tkthao219-bubududu.gif", pack_id: "pack-love-bubu-dudu" },
      { id: "s-bd-2", url: "https://media.tenor.com/B942y020TTEAAAAi/dudu-bubu.gif", pack_id: "pack-love-bubu-dudu" },
      { id: "s-bd-3", url: "https://media.tenor.com/Jd0n2J1e3hMAAAAi/mocha-bear.gif", pack_id: "pack-love-bubu-dudu" },
      { id: "s-bd-4", url: "https://media.tenor.com/xIID7d983VMAAAAi/milk-and-mocha-bear.gif", pack_id: "pack-love-bubu-dudu" },
      { id: "s-bd-5", url: "https://media.tenor.com/E_2t3a9fNrwAAAAi/peach-cat.gif", pack_id: "pack-love-bubu-dudu" },
      { id: "s-bd-6", url: "https://media.tenor.com/YwN9qRkQ7f0AAAAi/mochi-peach.gif", pack_id: "pack-love-bubu-dudu" },
    ],
  },
  {
    id: "pack-cute-cats",
    name: "Cute Cats 🐱",
    cover_url: "https://media.tenor.com/N2sS-WtyHhgAAAAM/cat-meme.gif",
    stickers: [
      { id: "s-cc-1", url: "https://media.tenor.com/N2sS-WtyHhgAAAAM/cat-meme.gif", pack_id: "pack-cute-cats" },
      { id: "s-cc-2", url: "https://media.tenor.com/Z4XW47B_3b4AAAAM/hugging.gif", pack_id: "pack-cute-cats" },
      { id: "s-cc-3", url: "https://media.tenor.com/n14aQZ2E86QAAAAM/love-cute.gif", pack_id: "pack-cute-cats" },
      { id: "s-cc-4", url: "https://media.tenor.com/w1j0bM6sSCAAAAAM/sad-puss-in-boots.gif", pack_id: "pack-cute-cats" },
      { id: "s-cc-5", url: "https://media.tenor.com/f7l1Y2Z7hQIAAAAi/cat-heart.gif", pack_id: "pack-cute-cats" },
      { id: "s-cc-6", url: "https://media.tenor.com/XG_XWfO5L7UAAAAi/cat-kiss.gif", pack_id: "pack-cute-cats" },
    ],
  },
];

const LOCAL_STORAGE_CUSTOM_PACKS = "just_us_custom_sticker_packs";
const LOCAL_STORAGE_RECENTS = "just_us_recent_stickers";
const LOCAL_STORAGE_FAVORITES = "just_us_fav_stickers";

// Short-lived in-memory caches so reopening the sticker picker (which unmounts
// on close) doesn't re-query every sticker table on each mount. Invalidated on
// any mutation, so data freshness is preserved.
const STICKER_CACHE_TTL_MS = 60_000;
let packsNetworkCache: { data: StickerPack[]; at: number } | null = null;
let recentsNetworkCache: Map<string, { data: Sticker[]; at: number }> = new Map();
let favoritesNetworkCache: Map<string, { data: Sticker[]; at: number }> = new Map();

/**
 * Validate a candidate sticker file before upload/import
 */
export async function validateStickerFile(file: File): Promise<{
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
  previewUrl?: string;
}> {
  const allowedMime = ["image/webp", "image/png", "image/gif", "image/jpeg", "image/svg+xml"];
  if (!allowedMime.includes(file.type) && !file.name.match(/\.(webp|png|gif|jpe?g|svg)$/i)) {
    return { ok: false, error: "Unsupported sticker format. Please use WebP, PNG, GIF, or JPEG." };
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: `Sticker too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max size is 5MB.` };
  }

  return new Promise((resolve) => {
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        ok: true,
        width: img.naturalWidth,
        height: img.naturalHeight,
        previewUrl,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      resolve({ ok: false, error: "Corrupted or invalid image file." });
    };
    img.src = previewUrl;
  });
}

/**
 * Fetch all installed / owned sticker packs
 */
export async function fetchStickerPacks(): Promise<StickerPack[]> {
  const customPacks: StickerPack[] = [];

  const now = Date.now();
  if (packsNetworkCache && now - packsNetworkCache.at < STICKER_CACHE_TTL_MS) {
    customPacks.push(...packsNetworkCache.data);
  } else {
    try {
      // 1. Try fetching from Supabase table
      const { data: packsData, error: packsError } = await supabase
        .from("sticker_packs")
        .select("id, name, creator_id, cover_url, created_at")
        .order("created_at", { ascending: false });

      if (!packsError && packsData) {
        const fresh: StickerPack[] = [];
        if (packsData.length > 0) {
          const { data: stickersData, error: stickersError } = await supabase
            .from("stickers")
            .select("*")
            .order("created_at", { ascending: true });

          if (!stickersError && stickersData) {
            for (const p of packsData) {
              const packStickers = stickersData.filter((s: any) => s.pack_id === p.id);
              fresh.push({
                id: p.id,
                name: p.name,
                creator_id: p.creator_id,
                cover_url: p.cover_url || packStickers[0]?.url,
                stickers: packStickers,
                created_at: p.created_at,
              });
            }
          }
        }
        packsNetworkCache = { data: fresh, at: Date.now() };
        customPacks.push(...fresh);
      }
    } catch (err) {
      console.warn("[stickers] DB fetch skipped or failed, falling back to local storage:", err);
    }
  }

  // 2. Merge with locally cached custom packs
  if (typeof window !== "undefined") {
    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CUSTOM_PACKS) || "[]");
      for (const lp of local) {
        if (!customPacks.some((p) => p.id === lp.id)) {
          customPacks.push(lp);
        }
      }
    } catch (e) {
      console.warn("[stickers] Failed reading local packs cache", e);
    }
  }

  return [...DEFAULT_STICKER_PACKS, ...customPacks];
}

/**
 * Create a new sticker pack and upload its stickers to the existing 'stickers' bucket
 */
export async function createStickerPack(
  name: string,
  files: File[],
  creatorId: string
): Promise<{ ok: boolean; pack?: StickerPack; error?: string }> {
  if (!name.trim()) return { ok: false, error: "Pack name is required." };
  if (!files || files.length === 0) return { ok: false, error: "Select at least one sticker." };

  const packId = crypto.randomUUID ? crypto.randomUUID() : `pack-${Date.now()}`;
  const uploadedStickers: Sticker[] = [];

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    const validation = await validateStickerFile(file);
    if (!validation.ok) {
      return { ok: false, error: `File "${file.name}": ${validation.error}` };
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "webp";
    const stickerId = crypto.randomUUID ? crypto.randomUUID() : `stk-${Date.now()}-${idx}`;
    const storagePath = `${creatorId}/${packId}/${stickerId}.${ext}`;

    // Upload to existing 'stickers' bucket
    let fileUrl = "";
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("stickers")
        .upload(storagePath, file, {
          contentType: file.type || "image/webp",
          upsert: true,
        });

      if (uploadError) {
        console.warn(`[stickers] Storage upload to 'stickers' error:`, uploadError);
        return { ok: false, error: `Upload failed: ${uploadError.message}. Please check storage policies and retry.` };
      } else if (uploadData) {
        fileUrl = supabase.storage.from("stickers").getPublicUrl(storagePath).data.publicUrl;
      }
    } catch (e: any) {
      console.error("[stickers] Unexpected upload error:", e);
      return { ok: false, error: e?.message || "Upload network failure." };
    }

    uploadedStickers.push({
      id: stickerId,
      pack_id: packId,
      owner_id: creatorId,
      storage_path: storagePath,
      url: fileUrl,
      mime_type: file.type || "image/webp",
      width: validation.width,
      height: validation.height,
      created_at: new Date().toISOString(),
    });
  }

  const coverUrl = uploadedStickers[0]?.url || "";

  const newPack: StickerPack = {
    id: packId,
    name: name.trim(),
    creator_id: creatorId,
    cover_url: coverUrl,
    stickers: uploadedStickers,
    created_at: new Date().toISOString(),
  };

  // Try persisting to Supabase tables
  try {
    const { error: pErr } = await supabase.from("sticker_packs").insert({
      id: packId,
      name: newPack.name,
      creator_id: creatorId,
      cover_url: coverUrl,
    });

    if (!pErr) {
      await supabase.from("stickers").insert(
        uploadedStickers.map((s) => ({
          id: s.id,
          pack_id: s.pack_id,
          owner_id: s.owner_id,
          storage_path: s.storage_path,
          url: s.url,
          mime_type: s.mime_type,
          width: s.width,
          height: s.height,
        }))
      );
    }
  } catch (err) {
    console.warn("[stickers] Failed saving pack to DB tables, will keep in local storage:", err);
  }

  // Update local storage backup
  if (typeof window !== "undefined") {
    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CUSTOM_PACKS) || "[]");
      local.unshift(newPack);
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_PACKS, JSON.stringify(local));
    } catch (e) {
      console.warn("[stickers] Failed caching pack to localStorage", e);
    }
  }

  // Invalidate pack cache so the new pack appears immediately
  packsNetworkCache = null;

  return { ok: true, pack: newPack };
}

/**
 * Record a sticker usage in Recents (persisted in DB and localStorage)
 */
export async function recordRecentSticker(userId: string, sticker: Sticker) {
  if (typeof window !== "undefined") {
    try {
      const recents: Sticker[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_RECENTS) || "[]");
      const filtered = recents.filter((s) => s.url !== sticker.url && s.id !== sticker.id);
      filtered.unshift(sticker);
      // Keep up to 24 recents
      localStorage.setItem(LOCAL_STORAGE_RECENTS, JSON.stringify(filtered.slice(0, 24)));
    } catch (e) {
      console.warn("[stickers] Local recents update error", e);
    }
  }

  try {
    if (sticker.id && !sticker.id.startsWith("s-")) {
      await supabase.from("recent_stickers").upsert(
        {
          user_id: userId,
          sticker_id: sticker.id,
          used_at: new Date().toISOString(),
        },
        { onConflict: "user_id,sticker_id" }
      );
      recentsNetworkCache.delete(userId);
    }
  } catch (err) {
    // Silently fall back to localStorage
  }
}

/**
 * Fetch Recents
 */
export async function fetchRecentStickers(userId: string): Promise<Sticker[]> {
  let list: Sticker[] = [];
  if (typeof window !== "undefined") {
    try {
      list = JSON.parse(localStorage.getItem(LOCAL_STORAGE_RECENTS) || "[]");
    } catch {
      list = [];
    }
  }

  try {
    const cached = recentsNetworkCache.get(userId);
    let dbRecents: Sticker[] = [];
    if (cached && Date.now() - cached.at < STICKER_CACHE_TTL_MS) {
      dbRecents = cached.data;
    } else {
      const { data, error } = await supabase
        .from("recent_stickers")
        .select("sticker_id, used_at, stickers(*)")
        .eq("user_id", userId)
        .order("used_at", { ascending: false })
        .limit(20);

      if (!error && data) {
        dbRecents = data
          .map((r: any) => r.stickers)
          .filter(Boolean) as Sticker[];
        recentsNetworkCache.set(userId, { data: dbRecents, at: Date.now() });
      }
    }

    for (const r of dbRecents) {
      if (!list.some((it) => it.url === r.url)) {
        list.push(r);
      }
    }
  } catch {}

  return list;
}

/**
 * Toggle favorite sticker
 */
export async function toggleFavoriteSticker(
  userId: string,
  sticker: Sticker
): Promise<boolean> {
  let isNowFav = false;

  if (typeof window !== "undefined") {
    try {
      const favs: Sticker[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FAVORITES) || "[]");
      const exists = favs.some((s) => s.url === sticker.url || s.id === sticker.id);
      let updated: Sticker[];
      if (exists) {
        updated = favs.filter((s) => s.url !== sticker.url && s.id !== sticker.id);
        isNowFav = false;
      } else {
        updated = [sticker, ...favs];
        isNowFav = true;
      }
      localStorage.setItem(LOCAL_STORAGE_FAVORITES, JSON.stringify(updated));
    } catch (e) {
      console.warn("[stickers] Local fav update error", e);
    }
  }

  try {
    if (sticker.id && !sticker.id.startsWith("s-")) {
      if (isNowFav) {
        await supabase.from("favorite_stickers").upsert({
          user_id: userId,
          sticker_id: sticker.id,
        });
      } else {
        await supabase
          .from("favorite_stickers")
          .delete()
          .match({ user_id: userId, sticker_id: sticker.id });
      }
      favoritesNetworkCache.delete(userId);
    }
  } catch {}

  return isNowFav;
}

/**
 * Fetch Favorites
 */
export async function fetchFavoriteStickers(userId: string): Promise<Sticker[]> {
  let list: Sticker[] = [];
  if (typeof window !== "undefined") {
    try {
      list = JSON.parse(localStorage.getItem(LOCAL_STORAGE_FAVORITES) || "[]");
    } catch {
      list = [];
    }
  }

  try {
    const cached = favoritesNetworkCache.get(userId);
    let dbFavs: Sticker[] = [];
    if (cached && Date.now() - cached.at < STICKER_CACHE_TTL_MS) {
      dbFavs = cached.data;
    } else {
      const { data, error } = await supabase
        .from("favorite_stickers")
        .select("sticker_id, created_at, stickers(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        dbFavs = data
          .map((f: any) => f.stickers)
          .filter(Boolean) as Sticker[];
        favoritesNetworkCache.set(userId, { data: dbFavs, at: Date.now() });
      }
    }

    for (const f of dbFavs) {
      if (!list.some((it) => it.url === f.url)) {
        list.push(f);
      }
    }
  } catch {}

  return list;
}
