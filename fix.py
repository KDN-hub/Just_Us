import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'import { Check, CheckCheck, Clock, Heart, Play, Pause, X, Download, Mic, User, Plus } from "lucide-react";',
    'import { Check, CheckCheck, Clock, Heart, Play, Pause, X, Download, Mic, User, Plus, Reply, Copy, Pencil, Trash2 } from "lucide-react";'
)

content = content.replace(
    '  myAvatarUrl?: string | null;\n  partnerAvatarUrl?: string | null;\n}',
    '  myAvatarUrl?: string | null;\n  partnerAvatarUrl?: string | null;\n  onReply?: () => void;\n  onEdit?: () => void;\n  onDelete?: () => void;\n}'
)

content = content.replace(
    '  myAvatarUrl,\n  partnerAvatarUrl,\n}: MessageBubbleProps) {',
    '  myAvatarUrl,\n  partnerAvatarUrl,\n  onReply,\n  onEdit,\n  onDelete,\n}: MessageBubbleProps) {'
)

old_menu = '''        {showReactionMenu && !showFullPicker && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className={bsolute -top-12  z-50 flex gap-1 bg-[#18181A] p-1.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10}
          >
            {['❤️', '😂', '😭', '😍', '👍'].map(emoji => (
              <motion.button whileTap={{ scale: 1.3 }} key={emoji} onClick={() => { onReact?.(emoji === myReaction ? 'NONE' : emoji); setShowReactionMenu(false); }} className={	ext-xl md:hover:scale-125 transition-transform px-1 }>{emoji}</motion.button>
            ))}
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowFullPicker(true)} className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white/70 active:text-white md:hover:text-white ml-1 transition-colors">
              <Plus className="h-5 w-5" strokeWidth={2} />
            </motion.button>
          </motion.div>
        )}'''

new_menu = '''        {showReactionMenu && !showFullPicker && (
          <>
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className={bsolute -top-12  z-50 flex gap-1 bg-[#18181A] p-1.5 rounded-full shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10}
          >
            {['❤️', '😂', '😭', '😍', '👍'].map(emoji => (
              <motion.button whileTap={{ scale: 1.3 }} key={emoji} onClick={() => { onReact?.(emoji === myReaction ? 'NONE' : emoji); setShowReactionMenu(false); }} className={	ext-xl md:hover:scale-125 transition-transform px-1 }>{emoji}</motion.button>
            ))}
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowFullPicker(true)} className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-white/70 active:text-white md:hover:text-white ml-1 transition-colors">
              <Plus className="h-5 w-5" strokeWidth={2} />
            </motion.button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            className={bsolute top-full mt-2  z-50 w-48 bg-[#18181A]/90 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden flex flex-col}
          >
            <button className="flex items-center justify-between px-4 py-3 text-[15px] text-white hover:bg-white/5 active:bg-white/10" onClick={(e) => { e.stopPropagation(); onReply?.(); setShowReactionMenu(false); }}>
               Reply
               <Reply className="w-4 h-4 text-white/50" />
            </button>
            {actualType === "text" && (
              <button className="flex items-center justify-between px-4 py-3 text-[15px] text-white hover:bg-white/5 active:bg-white/10" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(actualContent); setShowReactionMenu(false); }}>
                 Copy
                 <Copy className="w-4 h-4 text-white/50" />
              </button>
            )}
            {isMine && actualType === "text" && (
              <button className="flex items-center justify-between px-4 py-3 text-[15px] text-white hover:bg-white/5 active:bg-white/10" onClick={(e) => { e.stopPropagation(); onEdit?.(); setShowReactionMenu(false); }}>
                 Edit
                 <Pencil className="w-4 h-4 text-white/50" />
              </button>
            )}
            <button className="flex items-center justify-between px-4 py-3 text-[15px] text-red-500 hover:bg-white/5 active:bg-white/10 border-t border-white/5" onClick={(e) => { e.stopPropagation(); onDelete?.(); setShowReactionMenu(false); }}>
               Delete
               <Trash2 className="w-4 h-4 text-red-500/70" />
            </button>
          </motion.div>
          </>
        )}'''

content = content.replace(old_menu, new_menu)

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
