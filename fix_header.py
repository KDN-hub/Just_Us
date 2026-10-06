import re

with open('components/chat/ChatHeader.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  onOpenAvatarUpload?: () => void;',
    '  onOpenAvatarUpload?: () => void;\n  onSearchClick?: () => void;'
)

content = content.replace(
    '  onOpenAvatarUpload,\n}: ChatHeaderProps) {',
    '  onOpenAvatarUpload,\n  onSearchClick,\n}: ChatHeaderProps) {'
)

search_btn = '''                <button 
                  onClick={() => { setShowMenu(false); onOpenUsername?.(); }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-white active:bg-white/10"
                >
                  <UserPen className="h-5 w-5 text-[var(--gold)]" strokeWidth={2} />
                  <span className="text-[15px]">Change Username</span>
                </button>
                <button 
                  onClick={() => { setShowMenu(false); onSearchClick?.(); }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-white active:bg-white/10"
                >
                  <Search className="h-5 w-5 text-gray-400" strokeWidth={2} />
                  <span className="text-[15px]">Search Chat</span>
                </button>'''

content = content.replace('''                <button 
                  onClick={() => { setShowMenu(false); onOpenUsername?.(); }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors text-white active:bg-white/10"
                >
                  <UserPen className="h-5 w-5 text-[var(--gold)]" strokeWidth={2} />
                  <span className="text-[15px]">Change Username</span>
                </button>''', search_btn)

if 'Search' not in content:
    content = content.replace('import { ChevronLeft, Phone', 'import { ChevronLeft, Phone, Search')

with open('components/chat/ChatHeader.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
