import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add props
content = content.replace('  isEdited?: boolean;', '  isEdited?: boolean;\n  isPinned?: boolean;\n  onPin?: () => void;\n  onForward?: () => void;\n  onInfo?: () => void;')
content = content.replace('  isEdited,\n}: MessageBubbleProps) {', '  isEdited,\n  isPinned,\n  onPin,\n  onForward,\n  onInfo,\n}: MessageBubbleProps) {')

# Add Pin indicator
pin_indicator = '''      <motion.div
'''
content = content.replace('      <motion.div\n        initial={{ y: 20', '{isPinned && <div className={`flex items-center gap-1.5 mb-1 ${isMine ? "justify-end mr-4" : "justify-start ml-12"}`}><Pin className="w-3 h-3 text-white/50" /><span className="text-[11px] font-medium text-white/50">Pinned</span></div>}\n      <motion.div\n        initial={{ y: 20')


# Update action menu
new_menu = '''              <button onClick={(e) => { e.stopPropagation(); onReply?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
                 <Reply className="w-4 h-4 text-white/60" /> Reply
              </button>
              {actualType === 'text' && (
                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(actualContent); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                   <Copy className="w-4 h-4 text-white/60" /> Copy
                </button>
              )}
              {isMine && actualType === 'text' && (
                <button onClick={(e) => { e.stopPropagation(); onEdit?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                   <Pencil className="w-4 h-4 text-white/60" /> Edit
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); onPin?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                 <Pin className="w-4 h-4 text-white/60" /> {isPinned ? 'Unpin' : 'Pin'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); onForward?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                 <Share2 className="w-4 h-4 text-white/60" /> Forward
              </button>
              <button onClick={(e) => { e.stopPropagation(); onInfo?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                 <Info className="w-4 h-4 text-white/60" /> Info
              </button>
              {isMine && (
                <button onClick={(e) => { e.stopPropagation(); onDelete?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-red-400 hover:bg-white/10 transition-colors text-left active:bg-white/15 border-t border-white/5">
                   <Trash2 className="w-4 h-4 text-red-400/80" /> Delete
                </button>
              )}'''

old_menu = '''              <button onClick={(e) => { e.stopPropagation(); onReply?.(); setShowReactionMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-white/90 hover:bg-white/10 transition-colors text-left active:bg-white/15">
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
              )}'''

content = content.replace(old_menu, new_menu)

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
