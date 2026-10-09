import { RefObject, useMemo, memo } from "react";
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
  scrollContainerRef?: RefObject<HTMLDivElement>;
  onScrollContainer?: (e: React.UIEvent<HTMLDivElement>) => void;
  onEditMedia?: (url: string, type: string) => void;
  onToggleFavoriteSticker?: (url: string) => void;
  favoriteStickers?: string[];
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
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
  selectionMode: boolean;
  isSelected: boolean;
  isFavoriteSticker: boolean;
  handleReaction: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onQuoteClick?: (targetId: string) => void;
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
  selectionMode,
  isSelected,
  isFavoriteSticker,
  handleReaction,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onQuoteClick,
  onPin,
  onForward,
  onInfo,
  onSelect,
  onToggleSelect,
  onEditMedia,
  onToggleFavoriteSticker,
}: MessageRowProps) {
  const msgId = data.id;
  return (
    <div>
      {isNewDay && (
        <div className="flex items-center justify-center my-4 select-none">
          <span className="bg-[#18181A]/80 backdrop-blur-md border border-white/10 text-white/70 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
            {formatDateSeparator(time)}
          </span>
        </div>
      )}
      <motion.div
        id={`msg-${msgId}`}
        data-msg-time={time}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={`transition-all duration-300 rounded-2xl ${mb}`}
      >
        {kind === "message" ? (
          <MessageBubble
            id={msgId}
            content={data.content}
            isMine={data.sender_id === myId}
            timestamp={data.created_at}
            status={data.sender_id === myId ? data.status : undefined}
            queued={data.queued}
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
      </motion.div>
    </div>
  );
});

const MessageList = memo(function MessageList({
  timeline,
  myId,
  partnerName = "Partner",
  handleReaction,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onQuoteClick,
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
  onEditMedia,
  onToggleFavoriteSticker,
  favoriteStickers = [],
}: MessageListProps) {
  
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
    return clustered;
  }, [timeline]);

  return (
    <div 
      ref={scrollContainerRef}
      onScroll={onScrollContainer}
      className="relative z-10 flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden px-3 sm:px-4 pt-3 pb-6"
    >
      {timeline.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center my-auto p-6 text-center select-none animate-in fade-in zoom-in-95 duration-500">
          <div className="w-16 h-16 rounded-full bg-[var(--wine)]/20 border border-[var(--wine)]/30 flex items-center justify-center text-[var(--gold)] mb-4 shadow-xl">
            <Heart className="w-8 h-8 fill-[var(--wine)] text-[var(--gold)]" />
          </div>
          <h3 className="text-[19px] font-bold text-white mb-1">Just you two ❤️</h3>
          <p className="text-[14px] text-white/50 max-w-[240px]">
            This is your private space. Say hello or send a nudge to begin!
          </p>
        </div>
      )}

      {clusteredTimeline.map((item: any, i, arr) => {
        let groupPosition: "single" | "top" | "middle" | "bottom" = "single";
        let mb = "mb-4";

        const prev = arr[i - 1];
        const isNewDay = !prev || new Date(item.time).toDateString() !== new Date(prev.time).toDateString();

        if (item.kind === "message") {
          const next = arr[i + 1];
          const isSameAsPrev = prev?.kind === "message" && prev.data.sender_id === item.data.sender_id && !isNewDay;
          const isNextNewDay = next && new Date(next.time).toDateString() !== new Date(item.time).toDateString();
          const isSameAsNext = next?.kind === "message" && next.data.sender_id === item.data.sender_id && !isNextNewDay;

          if (isSameAsPrev && isSameAsNext) groupPosition = "middle";
          else if (isSameAsPrev) groupPosition = "bottom";
          else if (isSameAsNext) groupPosition = "top";
          
          if (isSameAsNext) {
            mb = "mb-1";
          }
        }

        const isMessage = item.kind === "message";
        const stickerCore = isMessage && typeof item.data.content === "string"
          ? item.data.content.replace(/^STICKER:/, "")
          : "";

        return (
          <MessageRow
            key={`wrapper-${item.data.id}`}
            kind={item.kind}
            data={item.data}
            time={item.time}
            myId={myId}
            partnerName={partnerName}
            partnerInitial={partnerInitial}
            partnerColor={partnerColor}
            myAvatarUrl={myAvatarUrl}
            partnerAvatarUrl={partnerAvatarUrl}
            groupPosition={groupPosition}
            mb={mb}
            isNewDay={isNewDay}
            selectionMode={selectionMode}
            isSelected={isMessage && selectedMessageIds.includes(item.data.id)}
            isFavoriteSticker={isMessage && favoriteStickers.includes(stickerCore)}
            handleReaction={handleReaction}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onCopy={onCopy}
            onQuoteClick={onQuoteClick}
            onPin={onPin}
            onForward={onForward}
            onInfo={onInfo}
            onSelect={onSelect}
            onToggleSelect={onToggleSelect}
            onEditMedia={onEditMedia}
            onToggleFavoriteSticker={onToggleFavoriteSticker}
          />
        );
      })}

      <AnimatePresence>
      {partnerTyping && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="mb-4">
          <TypingBubble />
        </motion.div>
      )}
      </AnimatePresence>

      <div ref={bottomRef} />
    </div>
  );
});

export default MessageList;
