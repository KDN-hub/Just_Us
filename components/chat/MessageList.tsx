import { RefObject } from "react";
import MessageBubble from "@/components/MessageBubble";
import CallBubble from "@/components/CallBubble";
import TypingBubble from "@/components/TypingBubble";
import { motion, AnimatePresence } from "framer-motion";

interface MessageListProps {
  timeline: any[];
  myId: string;
  handleReaction: (messageId: string, emoji: string) => void;
  partnerTyping: boolean;
  bottomRef: RefObject<HTMLDivElement>;
  partnerInitial: string;
  partnerColor: string;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
}

export default function MessageList({
  timeline,
  myId,
  handleReaction,
  partnerTyping,
  bottomRef,
  partnerInitial,
  partnerColor,
  myAvatarUrl,
  partnerAvatarUrl,
}: MessageListProps) {
  return (
    <div className="relative z-10 flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden px-4 pt-4 pb-6">
      {timeline.length === 0 && (
        <p className="mx-auto mt-10 text-[16px] text-white/60">Say something 💬</p>
      )}

      {timeline.map((item, i) => {
        let groupPosition: "single" | "top" | "middle" | "bottom" = "single";
        let mb = "mb-4";

        if (item.kind === "message") {
          const prev = timeline[i - 1];
          const next = timeline[i + 1];

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
          <motion.div key={item.data.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className={mb}>
            {item.kind === "message" ? (
              <MessageBubble
                content={item.data.content}
                isMine={item.data.sender_id === myId}
                timestamp={item.data.created_at}
                status={item.data.sender_id === myId ? item.data.status : undefined}
                queued={item.data.queued}
                type={item.data.type}
                reactions={item.data.reactions}
                myReaction={item.data.reactions?.[myId]}
                onReact={(emoji) => handleReaction(item.data.id, emoji)}
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
