import re

with open('components/chat/ChatInput.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
content = content.replace(
    'import { Send, Heart, Paperclip, Mic, Square, X, Smile, Star } from "lucide-react";',
    'import { Send, Heart, Paperclip, Mic, Square, X, Smile, Star, Plus, Camera, Image as ImageIcon, FileText, Music, MapPin } from "lucide-react";'
)

content = content.replace(
    '  setMediaCaption: React.Dispatch<React.SetStateAction<string>>;\n  uploadMedia: (file: File | Blob, type: string, caption?: string) => void;\n}',
    '  setMediaCaption: React.Dispatch<React.SetStateAction<string>>;\n  uploadMedia: (file: File | Blob, type: string, caption?: string) => void;\n}\n\n'
)

# Add showAttachmentMenu state
content = content.replace(
    'export default function ChatInput({',
    'export default function ChatInput({\n'
)
content = content.replace(
    '}: ChatInputProps) {',
    '}: ChatInputProps) {\n  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);\n'
)
if 'import { useState, useRef' not in content:
    content = content.replace('import { RefObject }', 'import { RefObject, useState }')


menu_html = '''              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 active:text-white md:hover:text-white transition-colors"
                >
                  <Plus className={h-[22px] w-[22px] transition-transform duration-300 } strokeWidth={1.5} />
                </button>
                <AnimatePresence>
                  {showAttachmentMenu && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute bottom-12 right-0 md:-left-16 z-50 grid grid-cols-3 gap-2 p-3 w-[260px] bg-[#18181A]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] origin-bottom-right md:origin-bottom-left"
                    >
                      <button onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*,video/*'); fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-white/5 group">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 group-active:scale-95 transition-transform"><ImageIcon className="w-5 h-5" /></div>
                        <span className="text-[11px] text-white/70 font-medium">Gallery</span>
                      </button>
                      <button onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*,video/*'); fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-white/5 group">
                        <div className="w-12 h-12 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 group-active:scale-95 transition-transform"><Camera className="w-5 h-5" /></div>
                        <span className="text-[11px] text-white/70 font-medium">Camera</span>
                      </button>
                      <button onClick={() => { fileInputRef.current?.setAttribute('accept', '.pdf,.doc,.docx,.txt'); fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-white/5 group">
                        <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 group-active:scale-95 transition-transform"><FileText className="w-5 h-5" /></div>
                        <span className="text-[11px] text-white/70 font-medium">Document</span>
                      </button>
                      <button onClick={() => { fileInputRef.current?.setAttribute('accept', 'audio/*'); fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-white/5 group">
                        <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 group-active:scale-95 transition-transform"><Music className="w-5 h-5" /></div>
                        <span className="text-[11px] text-white/70 font-medium">Audio</span>
                      </button>
                      <button onClick={() => { alert('Location sharing coming soon!'); setShowAttachmentMenu(false); }} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-white/5 group">
                        <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 group-hover:scale-110 group-active:scale-95 transition-transform"><MapPin className="w-5 h-5" /></div>
                        <span className="text-[11px] text-white/70 font-medium">Location</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>'''

content = content.replace('''              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] active:text-[var(--cream)] md:hover:text-[var(--cream)] transform -rotate-45"
              >
                <Paperclip className="h-[20px] w-[20px]" strokeWidth={1.5} />
              </button>''', menu_html)

with open('components/chat/ChatInput.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
