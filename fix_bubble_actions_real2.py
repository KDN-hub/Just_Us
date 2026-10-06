import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

context_menu = '''
          <AnimatePresence>
          {showReactionMenu && !showFullPicker && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              className={`absolute top-full mt-2 ${isMine ? 'right-0' : 'left-0'} z-50 flex flex-col min-w-[160px] bg-[#18181A]/95 backdrop-blur-xl rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden`}
            >
              <button onClick={(e) => { e.stopPropagation(); onReply?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                 <Reply className="w-4 h-4 text-white/60" /> Reply
              </button>
              {actualType === 'text' && (
                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(actualContent); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                   <Copy className="w-4 h-4 text-white/60" /> Copy
                </button>
              )}
              {isMine && actualType === 'text' && (
                <button onClick={(e) => { e.stopPropagation(); onEdit?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                   <Pencil className="w-4 h-4 text-white/60" /> Edit
                </button>
              )}
              {isMine && (
                <button onClick={(e) => { e.stopPropagation(); onDelete?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-red-400 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                   <Trash2 className="w-4 h-4 text-red-400/80" /> Delete
                </button>
              )}
            </motion.div>
          )}
          </AnimatePresence>

'''

content = content.replace('{reactions && Object.keys(reactions).length > 0 && (', context_menu + '{reactions && Object.keys(reactions).length > 0 && (')

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
