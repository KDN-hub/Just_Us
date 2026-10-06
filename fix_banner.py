import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

banner = '''      {editingMessage && (
        <div className="flex items-center justify-between bg-[#18181A]/95 backdrop-blur-2xl px-4 py-2 border-t border-white/10 text-white text-[13px]">
          <div className="flex flex-col">
            <span className="font-semibold text-white/70 mb-0.5 flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Editing Message</span>
            <span className="line-clamp-1 opacity-50">{realMessages.find(m => m.id === editingMessage)?.content}</span>
          </div>
          <button onClick={() => { setEditingMessage(null); setDraft(""); }} className="p-2 hover:bg-white/10 rounded-full"><X className="w-4 h-4 text-white/50" /></button>
        </div>
      )}
      {replyingTo && (
        <div className="flex items-center justify-between bg-[#18181A]/95 backdrop-blur-2xl px-4 py-2 border-t border-white/10 text-white text-[13px]">
          <div className="flex flex-col">
            <span className="font-semibold text-white/70 mb-0.5 flex items-center gap-1.5"><Reply className="w-3.5 h-3.5" /> Replying to {realMessages.find(m => m.id === replyingTo)?.sender_id === myId ? "Yourself" : partner}</span>
            <span className="line-clamp-1 opacity-50">{realMessages.find(m => m.id === replyingTo)?.content}</span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-4 h-4 text-white/50" /></button>
        </div>
      )}
      <ChatInput'''

content = content.replace('      <ChatInput', banner)

# Also import Pencil, Reply, Copy, Trash2, X in page.tsx if not exists
if 'Pencil' not in content:
    content = content.replace('import { ChevronLeft, Phone, Video, Image as ImageIcon, UserPen, Images, MoreVertical } from "lucide-react";', 'import { ChevronLeft, Phone, Video, Image as ImageIcon, UserPen, Images, MoreVertical, Pencil, Reply, Copy, Trash2, X } from "lucide-react";')
    content = content.replace('import { Heart, Plus, Camera, X } from "lucide-react";', 'import { Heart, Plus, Camera, X, Pencil, Reply, Copy, Trash2 } from "lucide-react";')
    content = content.replace('import { Heart, Plus, Camera, X, Star } from "lucide-react";', 'import { Heart, Plus, Camera, X, Star, Pencil, Reply, Copy, Trash2 } from "lucide-react";')
    content = content.replace('import { Check, CheckCheck, Clock, Heart, Play, Pause, X, Download, Mic, User, Plus, Reply, Copy, Pencil, Trash2 }', 'import { Check, CheckCheck, Clock, Heart, Play, Pause, X, Download, Mic, User, Plus, Reply, Copy, Pencil, Trash2 }')
    
with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
