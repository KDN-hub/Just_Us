"use client";

// ============================================================
//  useReadReceipts — viewport-driven "read" marking (Phase 3)
//
//  Watches every unread partner message bubble (they all carry
//  an `msg-<id>` DOM id from MessageList). When one is actually
//  visible for a real user — tab visible, enough of the bubble
//  inside the viewport — it is queued as "read".
//
//  Nothing is marked read merely because the chat screen is
//  open: messages the user scrolled past or that arrived while
//  the tab was hidden stay unread until seen.
// ============================================================

import { useCallback, useEffect, useRef } from "react";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useChatStore } from "@/hooks/useChatStore";
import { flushReceipts, queueReadReceipt } from "@/lib/receipts";

/** Bubble counts as "seen" at 15% visible — or a tall sliver of a very long message. */
const READ_THRESHOLD = 0.15;
const READ_MIN_PIXELS = 160;

export function useReadReceipts(conversationId: string): void {
  const partnerId = useChatStore((s) => s.partner?.id ?? null);

  const unreadIds = useLiveQuery(
    () => {
      if (!partnerId) return Promise.resolve<string[]>([]);
      return db.messages
        .where("[conversation_id+created_at]")
        .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
        .filter((m) => m.sender_id === partnerId && m.status !== "read")
        .toArray()
        .then((rows) => rows.map((m) => m.id));
    },
    [conversationId, partnerId],
  );

  const unreadKey = (unreadIds ?? []).join(",");
  const observerRef = useRef<IntersectionObserver | null>(null);
  const observedRef = useRef<Set<string>>(new Set());

  // One observer for the life of the screen.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (document.visibilityState !== "visible") return;
        const seen: string[] = [];
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const id = el.id.startsWith("msg-") ? el.id.slice(4) : "";
          if (!id) continue;
          // Still observed on purpose: a bubble that only crossed the low
          // threshold stays watched until it is genuinely seen (and the
          // unread list change then removes it).
          if (entry.intersectionRatio >= READ_THRESHOLD || entry.intersectionRect.height >= READ_MIN_PIXELS) {
            seen.push(id);
          }
        }
        if (seen.length > 0) queueReadReceipt(seen);
      },
      { threshold: [0.05, READ_THRESHOLD] },
    );
    observerRef.current = observer;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        flushReceipts();
        return;
      }
      // Intersections observed while hidden were ignored — force a fresh
      // callback for every bubble still being watched.
      for (const id of Array.from(observedRef.current)) {
        const el = document.getElementById(`msg-${id}`);
        if (!el) {
          observedRef.current.delete(id);
          continue;
        }
        observer.unobserve(el);
        observer.observe(el);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      observer.disconnect();
      observerRef.current = null;
      observedRef.current.clear();
      flushReceipts();
    };
  }, []);

  const unreadKeyRef = useRef("");
  unreadKeyRef.current = unreadKey;

  // Observe every unread partner bubble that is currently in the DOM.
  const syncObserved = useCallback(() => {
    const observer = observerRef.current;
    if (!observer) return;
    if (!unreadKeyRef.current && observedRef.current.size === 0) return;

    const ids = unreadKeyRef.current ? unreadKeyRef.current.split(",") : [];
    const wanted = new Set(ids);

    for (const id of Array.from(observedRef.current)) {
      if (wanted.has(id)) continue;
      const el = document.getElementById(`msg-${id}`);
      if (el) observer.unobserve(el);
      observedRef.current.delete(id);
    }
    for (const id of ids) {
      if (observedRef.current.has(id)) continue;
      const el = document.getElementById(`msg-${id}`);
      if (!el) continue; // not rendered yet — a later pass picks it up
      observer.observe(el);
      observedRef.current.add(id);
    }
  }, []);

  // Track the current set of unread partner bubbles.
  useEffect(() => {
    syncObserved();
  }, [syncObserved, unreadKey]);

  // The virtualized list mounts rows as the user scrolls, so a row for an
  // unread message can appear long after the unread list changed. Re-scan as
  // the user scrolls (trailing throttle) to observe rows as they enter the DOM.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        syncObserved();
      }, 120);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      if (timer) clearTimeout(timer);
    };
  }, [syncObserved]);
}
