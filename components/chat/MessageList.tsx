import {
  MutableRefObject,
  RefObject,
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import MessageBubble from "@/components/MessageBubble";
import CallBubble from "@/components/CallBubble";
import TypingBubble from "@/components/TypingBubble";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

interface MessageListProps {
  timeline: any[];
  myId: string;
  partnerName?: string;
  handleReaction: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onQuoteClick?: (targetId: string) => void;
  /** Tap-to-retry for messages whose send failed. */
  onRetry?: (id: string) => void;
  partnerTyping: boolean;
  bottomRef: RefObject<HTMLDivElement>;
  partnerInitial: string;
  partnerColor: string;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
  onPin?: (id: string) => void;
  onForward?: (id: string) => void;
  onInfo?: (id: string) => void;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
  selectedMessageIds?: string[];
  onToggleSelect?: (id: string) => void;
  scrollContainerRef?: MutableRefObject<HTMLDivElement | null>;
  /** Fired whenever the scroller moves — drives the floating date pill + at-bottom tracking. */
  onScrollContainer?: () => void;
  /** The user reached the top of the loaded window — the page can pull in older history. */
  onStartReached?: () => void;
  onEditMedia?: (url: string, type: string) => void;
  onToggleFavoriteSticker?: (url: string) => void;
  favoriteStickers?: string[];
  /** False while the local DB hasn't produced its first result yet — avoids an empty-state flash. */
  showEmptyState?: boolean;
  /** The first local-DB result hasn't arrived yet — show skeleton bubbles instead of a blank screen. */
  loading?: boolean;
}

/** Imperative handle: lets the page jump to a message that is virtualized out of the window. */
export interface MessageListHandle {
  /** Brings a message into view. False when the id isn't part of the loaded timeline. */
  scrollToMessageId: (id: string) => boolean;
}

// Typing state flows to the Virtuoso footer through context so the footer keeps
// a stable component identity — remounting it would kill the exit animation.
const TypingContext = createContext(false);

// Base index for the virtualizer's item positions. Headroom so prepended history
// can subtract without ever going negative (the react-virtuoso chat pattern).
const VIRTUAL_START_INDEX = 100000;

// Cold-start placeholder rows — pure opacity pulse, no layout thrash.
function MessageListSkeleton() {
  const widths = ["w-[132px]", "w-[210px]", "w-[96px]", "w-[176px]", "w-[238px]", "w-[118px]", "w-[150px]"];
  return (
    <div className="flex flex-col gap-3 pt-1" aria-hidden="true">
      {widths.map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
          <div
            className={`h-10 animate-pulse rounded-2xl bg-white/[0.06] ${w}`}
            style={{ animationDelay: `${i * 90}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

export function formatDateSeparator(dateStr: string): string | null {
  const date = new Date(dateStr);

  // Guard against invalid/undefined timestamps (e.g. "NaN Invalid Date NaN" pills)
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) return "TODAY";
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";

  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

interface MessageRowProps {
  kind: "message" | "call";
  data: any;
  time: string;
  myId: string;
  partnerName: string;
  partnerInitial: string;
  partnerColor: string;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
  groupPosition: "single" | "top" | "middle" | "bottom";
  mb: string;
  isNewDay: boolean;
  /** Play the entrance animation — only for ids this mount has never shown. */
  animateEntrance: boolean;
  selectionMode: boolean;
  isSelected: boolean;
  isFavoriteSticker: boolean;
  handleReaction: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onQuoteClick?: (targetId: string) => void;
  onRetry?: (id: string) => void;
  onPin?: (id: string) => void;
  onForward?: (id: string) => void;
  onInfo?: (id: string) => void;
  onSelect?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
  onEditMedia?: (url: string, type: string) => void;
  onToggleFavoriteSticker?: (url: string) => void;
}

const MessageRow = memo(function MessageRow({
  kind,
  data,
  time,
  myId,
  partnerName,
  partnerInitial,
  partnerColor,
  myAvatarUrl,
  partnerAvatarUrl,
  groupPosition,
  mb,
  isNewDay,
  animateEntrance,
  selectionMode,
  isSelected,
  isFavoriteSticker,
  handleReaction,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onQuoteClick,
  onRetry,
  onPin,
  onForward,
  onInfo,
  onSelect,
  onToggleSelect,
  onEditMedia,
  onToggleFavoriteSticker,
}: MessageRowProps) {
  const msgId = data.id;
  const dayLabel = isNewDay ? formatDateSeparator(time) : null;
  return (
    <div>
      {dayLabel && (
        <div className="flex items-center justify-center my-4 select-none">
          <span className="bg-[#18181A]/80 backdrop-blur-md border border-white/10 text-white/70 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
            {dayLabel}
          </span>
        </div>
      )}
      <div
        id={`msg-${msgId}`}
        data-msg-time={time}
        className={`${animateEntrance ? "animate-msg-in" : ""} transition-[box-shadow,background-color] duration-300 rounded-2xl ${mb}`}
      >
        {kind === "message" ? (
          <MessageBubble
            id={msgId}
            content={data.content}
            isMine={data.sender_id === myId}
            timestamp={data.created_at}
            status={data.sender_id === myId ? data.status : undefined}
            queued={data.queued}
            failed={data.failed}
            onRetry={onRetry ? () => onRetry(msgId) : undefined}
            type={data.type}
            reactions={data.reactions}
            myReaction={data.reactions?.[myId]}
            onReact={(emoji) => handleReaction(msgId, emoji)}
            onReply={onReply ? () => onReply(msgId) : undefined}
            onEdit={onEdit ? () => onEdit(msgId) : undefined}
            onDelete={onDelete ? () => onDelete(msgId) : undefined}
            onCopy={onCopy ? () => onCopy(data.content) : undefined}
            replyToId={data.reply_to}
            replyToText={data.reply_to_text}
            replyToSenderName={data.reply_to_sender_id === myId ? "You" : partnerName}
            onQuoteClick={onQuoteClick}
            isEdited={data.is_edited}
            isPinned={data.is_pinned}
            isDeleted={data.is_deleted}
            onPin={onPin ? () => onPin(msgId) : undefined}
            onForward={onForward ? () => onForward(msgId) : undefined}
            onInfo={onInfo ? () => onInfo(msgId) : undefined}
            onSelect={onSelect ? () => onSelect(msgId) : undefined}
            selectionMode={selectionMode}
            isSelected={isSelected}
            onToggleSelect={onToggleSelect ? () => onToggleSelect(msgId) : undefined}
            groupPosition={groupPosition}
            partnerInitial={partnerInitial}
            partnerColor={partnerColor}
            partnerName={partnerName}
            myAvatarUrl={myAvatarUrl}
            partnerAvatarUrl={partnerAvatarUrl}
            onEditMedia={onEditMedia}
            onToggleFavoriteSticker={onToggleFavoriteSticker}
            isFavoriteSticker={isFavoriteSticker}
          />
        ) : (
          <CallBubble
            type={data.type}
            status={data.status!}
            duration={data.duration_seconds}
            timestamp={data.started_at}
            isMine={data.caller_id === myId}
          />
        )}
      </div>
    </div>
  );
});

const MessageList = memo(forwardRef<MessageListHandle, MessageListProps>(function MessageList({
  timeline,
  myId,
  partnerName = "Partner",
  handleReaction,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onQuoteClick,
  onRetry,
  partnerTyping,
  bottomRef,
  partnerInitial,
  partnerColor,
  myAvatarUrl,
  partnerAvatarUrl,
  onPin,
  onForward,
  onInfo,
  onSelect,
  selectionMode = false,
  selectedMessageIds = [],
  onToggleSelect,
  scrollContainerRef,
  onScrollContainer,
  onStartReached,
  onEditMedia,
  onToggleFavoriteSticker,
  favoriteStickers = [],
  showEmptyState = true,
  loading = false,
}: MessageListProps, ref) {
  const clusteredTimeline = useMemo(() => {
    const getMediaItem = (item: any) => {
      if (!item || item.kind !== "message" || !item.data || item.data.is_deleted) return null;
      const d = item.data;
      let rawContent: string = d.content || "";
      let caption: string | undefined = undefined;

      if (rawContent.includes("|CAPTION:")) {
        const parts = rawContent.split("|CAPTION:");
        rawContent = parts[0];
        caption = parts.slice(1).join("|CAPTION:");
      }

      if (d.type === "image") {
        return { isMedia: true, url: rawContent, type: "image" as const, caption };
      }
      if (d.type === "video") {
        return { isMedia: true, url: rawContent, type: "video" as const, caption };
      }
      if (d.type === "text" && rawContent.startsWith("VIDEO_URL:")) {
        return { isMedia: true, url: rawContent.replace("VIDEO_URL:", ""), type: "video" as const, caption };
      }
      return null;
    };

    const clustered = [];
    let i = 0;
    while (i < timeline.length) {
      const item = timeline[i];
      const media = getMediaItem(item);
      if (media) {
        const group = [item];
        let j = i + 1;
        while (
          j < timeline.length &&
          timeline[j].kind === "message" &&
          timeline[j].data.sender_id === item.data.sender_id
        ) {
          const nextMedia = getMediaItem(timeline[j]);
          if (!nextMedia) break;
          const timeA = new Date(group[group.length - 1].data.created_at).getTime();
          const timeB = new Date(timeline[j].data.created_at).getTime();
          if (timeB - timeA > 90 * 1000) break; // within 90 seconds
          group.push(timeline[j]);
          j++;
        }
        if (group.length > 1) {
          const deckItems = group.map((g) => {
            const m = getMediaItem(g);
            return {
              id: g.data.id,
              url: m?.url || g.data.content,
              type: m?.type || "image",
              caption: m?.caption,
            };
          });
          clustered.push({
            kind: "message",
            time: item.time,
            data: {
              ...item.data,
              type: "image_group",
              content: JSON.stringify(deckItems),
              originalMessages: group,
            },
          });
          i = j;
          continue;
        }
      }
      clustered.push(item);
      i++;
    }

    // Precompute per-row presentation flags once per timeline rebuild — the
    // virtualized rows read them directly instead of re-deriving on render.
    for (let k = 0; k < clustered.length; k++) {
      const item = clustered[k];
      const prev = clustered[k - 1];
      const next = clustered[k + 1];
      const isNewDay = !prev || new Date(item.time).toDateString() !== new Date(prev.time).toDateString();
      let groupPosition: "single" | "top" | "middle" | "bottom" = "single";
      let mb = "mb-4";
      if (item.kind === "message") {
        const isSameAsPrev = prev?.kind === "message" && prev.data.sender_id === item.data.sender_id && !isNewDay;
        const isNextNewDay = next && new Date(next.time).toDateString() !== new Date(item.time).toDateString();
        const isSameAsNext = next?.kind === "message" && next.data.sender_id === item.data.sender_id && !isNextNewDay;
        if (isSameAsPrev && isSameAsNext) groupPosition = "middle";
        else if (isSameAsPrev) groupPosition = "bottom";
        else if (isSameAsNext) groupPosition = "top";
        if (isSameAsNext) mb = "mb-1";
      }
      item.groupPosition = groupPosition;
      item.mb = mb;
      item.isNewDay = isNewDay;
    }

    return clustered;
  }, [timeline]);

  // ----- virtualization (Phase 5) -----

  // firstItemIndex + react-virtuoso's prepend bookkeeping keep the viewport
  // pinned when older history is inserted above the current window.
  const [firstItemIndex, setFirstItemIndex] = useState(VIRTUAL_START_INDEX);
  const prevFirstIdRef = useRef<string | null>(null);
  const prevLengthRef = useRef(0);
  useMemo(() => {
    const prevFirst = prevFirstIdRef.current;
    if (prevFirst && clusteredTimeline.length > prevLengthRef.current) {
      const prepended = clusteredTimeline.findIndex((it: any) => it.data?.id === prevFirst);
      if (prepended > 0) setFirstItemIndex((n) => n - prepended);
    }
    prevFirstIdRef.current = clusteredTimeline[0]?.data?.id ?? null;
    prevLengthRef.current = clusteredTimeline.length;
  }, [clusteredTimeline]);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const clusteredRef = useRef(clusteredTimeline);
  useEffect(() => {
    clusteredRef.current = clusteredTimeline;
  }, [clusteredTimeline]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToMessageId: (id: string) => {
        const index = clusteredRef.current.findIndex((it: any) => it.data?.id === id);
        if (index < 0) return false;
        virtuosoRef.current?.scrollToIndex({ index, align: "center", behavior: "smooth" });
        return true;
      },
    }),
    [],
  );

  // Virtuoso owns the scroller element; hand it to the page (ref) and pipe its
  // scroll events into the page's floating-date / at-bottom handler.
  const [scrollerEl, setScrollerEl] = useState<HTMLElement | null>(null);
  const onScrollContainerRef = useRef(onScrollContainer);
  onScrollContainerRef.current = onScrollContainer;

  const handleScrollerRef = useCallback(
    (el: HTMLElement | Window | null) => {
      const asEl = el instanceof HTMLElement ? el : null;
      setScrollerEl(asEl);
      if (scrollContainerRef) scrollContainerRef.current = asEl as HTMLDivElement | null;
    },
    [scrollContainerRef],
  );

  useEffect(() => {
    if (!scrollerEl) return;
    const handler = () => onScrollContainerRef.current?.();
    scrollerEl.addEventListener("scroll", handler, { passive: true });
    return () => scrollerEl.removeEventListener("scroll", handler);
  }, [scrollerEl]);

  const onStartReachedRef = useRef(onStartReached);
  onStartReachedRef.current = onStartReached;
  const handleStartReached = useCallback(() => {
    onStartReachedRef.current?.();
  }, []);

  // Entrance animation only for ids this mount hasn't shown yet — otherwise
  // every scroll would replay msg-in on freshly mounted virtual rows.
  const seenIdsRef = useRef<Set<string>>(new Set());

  const computeItemKey = useCallback((_index: number, item: any) => item.data.id as string, []);

  const itemContent = useCallback(
    (_index: number, item: any) => {
      const id = item.data.id as string;
      const animateEntrance = !seenIdsRef.current.has(id);
      if (animateEntrance) seenIdsRef.current.add(id);
      return (
        <MessageRow
          kind={item.kind}
          data={item.data}
          time={item.time}
          myId={myId}
          partnerName={partnerName}
          partnerInitial={partnerInitial}
          partnerColor={partnerColor}
          myAvatarUrl={myAvatarUrl}
          partnerAvatarUrl={partnerAvatarUrl}
          groupPosition={item.groupPosition}
          mb={item.mb}
          isNewDay={item.isNewDay}
          animateEntrance={animateEntrance}
          selectionMode={selectionMode}
          isSelected={item.kind === "message" && selectedMessageIds.includes(item.data.id)}
          isFavoriteSticker={
            item.kind === "message" &&
            typeof item.data.content === "string" &&
            favoriteStickers.includes(item.data.content.replace(/^STICKER:/, ""))
          }
          handleReaction={handleReaction}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onCopy={onCopy}
          onQuoteClick={onQuoteClick}
          onRetry={onRetry}
          onPin={onPin}
          onForward={onForward}
          onInfo={onInfo}
          onSelect={onSelect}
          onToggleSelect={onToggleSelect}
          onEditMedia={onEditMedia}
          onToggleFavoriteSticker={onToggleFavoriteSticker}
        />
      );
    },
    [
      myId, partnerName, partnerInitial, partnerColor, myAvatarUrl, partnerAvatarUrl,
      selectionMode, selectedMessageIds, favoriteStickers, handleReaction,
      onReply, onEdit, onDelete, onCopy, onQuoteClick, onRetry, onPin,
      onForward, onInfo, onSelect, onToggleSelect, onEditMedia, onToggleFavoriteSticker,
    ],
  );

  // Stable component identities for the virtualizer's slots. The footer reads
  // typing state from context so it never has to remount.
  const vComponents = useMemo(() => {
    const ListHeader = function ListHeader() {
      return <div className="h-3" />;
    };
    const ListFooter = function ListFooter() {
      const isTyping = useContext(TypingContext);
      return (
        <>
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="mb-4"
              >
                <TypingBubble />
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={bottomRef} className="h-6" />
        </>
      );
    };
    return { Header: ListHeader, Footer: ListFooter };
  }, [bottomRef]);

  const isEmpty = clusteredTimeline.length === 0;

  return (
    <TypingContext.Provider value={partnerTyping}>
      {isEmpty ? (
        /* Empty window: nothing to virtualize yet — skeleton while the local DB
           warms up, otherwise the "just you two" card. */
        <div
          ref={scrollContainerRef}
          className="relative z-10 flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden px-3 sm:px-4 pt-3 pb-6"
        >
          {loading ? (
            <MessageListSkeleton />
          ) : (
            showEmptyState && (
        <div className="flex-1 flex flex-col items-center justify-center my-auto p-6 text-center select-none animate-in fade-in zoom-in-95 duration-500">
          <div className="w-16 h-16 rounded-full bg-[var(--wine)]/20 border border-[var(--wine)]/30 flex items-center justify-center text-[var(--gold)] mb-4 shadow-xl">
            <Heart className="w-8 h-8 fill-[var(--wine)] text-[var(--gold)]" />
          </div>
          <h3 className="text-[19px] font-bold text-white mb-1">Just you two ❤️</h3>
          <p className="text-[14px] text-white/50 max-w-[240px]">
            This is your private space. Say hello or send a nudge to begin!
          </p>
        </div>
            )
          )}

          {partnerTyping && (
            <div className="mb-4">
              <TypingBubble />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      ) : (
        /* Virtualized window over the loaded timeline. Only visible rows are in
           the DOM; the page still owns scroll decisions via the props above. */
        <Virtuoso
          ref={virtuosoRef}
          data={clusteredTimeline}
          computeItemKey={computeItemKey}
          itemContent={itemContent}
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={clusteredTimeline.length - 1}
          alignToBottom={false}
          increaseViewportBy={{ top: 600, bottom: 600 }}
          startReached={handleStartReached}
          scrollerRef={handleScrollerRef}
          components={vComponents}
          className="relative z-10 flex-1 min-h-0 px-3 sm:px-4"
        />
      )}
    </TypingContext.Provider>
  );
}));

export default MessageList;
