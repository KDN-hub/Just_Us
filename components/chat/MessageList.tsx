"use client";

import { RefObject } from "react";
import MessageBubble from "@/components/MessageBubble";
import CallBubble from "@/components/CallBubble";
import TypingBubble from "@/components/TypingBubble";
import { motion, AnimatePresence } from "framer-motion";

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
}

export default function MessageList({
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
}: MessageListProps) {
  return (
    <div className="relative z-10 flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden px-4 pt-4 pb-6">
      {timeline.length === 0 && (
        <p className="mx-auto mt-10 text-[16px] text-white/60">Say something 💬</p>
      )}

      {(() => {
        const clustered = [];
        let i = 0;
        while (i < timeline.length) {
          const item = timeline[i];
          if (item.kind === "message" && item.data.type === "image") {
            const group = [item];
            let j = i + 1;
            while (j < timeline.length && timeline[j].kind === "message" && timeline[j].data.type === "image" && timeline[j].data.sender_id === item.data.sender_id) {
              const timeA = new Date(group[group.length - 1].data.created_at).getTime();
              const timeB = new Date(timeline[j].data.created_at).getTime();
              if (timeB - timeA > 60 * 1000) break;
              group.push(timeline[j]);
              j++;
            }
            if (group.length > 1) {
              clustered.push({ kind: "message", data: { ...item.data, type: "image_group", content: JSON.stringify(group.map(g => g.data.content)), originalMessages: group } });
              i = j;
              continue;
            }
          }
          clustered.push(item);
          i++;
        }
        return clustered;
      })().map((item: any, i, arr) => {
        let groupPosition: "single" | "top" | "middle" | "bottom" = "single";
        let mb = "mb-4";

        if (item.kind === "message") {
          const prev = arr[i - 1];
          const next = arr[i + 1];

          const isSameAsPrev = prev?.kind === "message" && prev.data.sender_id === item.data.sender_id;
          const isSameAsNext = next?.kind === "message" && next.data.sender_id === item.data.sender_id;

          if (isSameAsPrev && isSameAsNext) groupPosition = "middle";
          else if (isSameAsPrev) groupPosition = "bottom";
          else if (isSameAsNext) groupPosition = "top";
          
          if (isSameAsNext) {
            mb = "mb-1";
          }
        }

        return (
          <motion.div 
            id={`msg-${item.data.id}`} 
            key={item.data.id} 
            layout 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ type: "spring", stiffness: 300, damping: 25 }} 
            className={`transition-all duration-300 rounded-2xl ${mb}`}
          >
            {item.kind === "message" ? (
              <MessageBubble
                id={item.data.id}
                content={item.data.content}
                isMine={item.data.sender_id === myId}
                timestamp={item.data.created_at}
                status={item.data.sender_id === myId ? item.data.status : undefined}
                queued={item.data.queued}
                type={item.data.type}
                reactions={item.data.reactions}
                myReaction={item.data.reactions?.[myId]}
                onReact={(emoji) => handleReaction(item.data.id, emoji)}
                onReply={() => onReply?.(item.data.id)}
                onEdit={() => onEdit?.(item.data.id)}
                onDelete={() => onDelete?.(item.data.id)}
                onCopy={() => onCopy?.(item.data.content)}
                replyToId={item.data.reply_to}
                replyToText={item.data.reply_to_text}
                replyToSenderName={item.data.reply_to_sender_id === myId ? "You" : partnerName}
                onQuoteClick={onQuoteClick}
                isEdited={item.data.is_edited}
                isPinned={item.data.is_pinned}
                isDeleted={item.data.is_deleted}
                onPin={() => onPin?.(item.data.id)}
                onForward={() => onForward?.(item.data.id)}
                onInfo={() => onInfo?.(item.data.id)}
                onSelect={() => onSelect?.(item.data.id)}
                selectionMode={selectionMode}
                isSelected={selectedMessageIds.includes(item.data.id)}
                onToggleSelect={() => onToggleSelect?.(item.data.id)}
                groupPosition={groupPosition}
                partnerInitial={partnerInitial}
                partnerColor={partnerColor}
                myAvatarUrl={myAvatarUrl}
                partnerAvatarUrl={partnerAvatarUrl}
              />
            ) : (
              <CallBubble
                type={item.data.type}
                status={item.data.status!}
                duration={item.data.duration_seconds}
                timestamp={item.data.started_at}
                isMine={item.data.caller_id === myId}
              />
            )}
          </motion.div>
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
}
