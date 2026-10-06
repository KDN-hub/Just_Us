import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the broken form-feed className with the proper one
content = re.sub(r'className=\{lex items-center gap-3 px-4 py-3 rounded-\[24px\] border border-white/5 relative shadow-sm hover:opacity-90 active:scale-\[0.98\] transition-all min-w-\[200px\] \}', 'className={`flex items-center gap-3 px-4 py-3 rounded-[24px] border border-white/5 relative shadow-sm hover:opacity-90 active:scale-[0.98] transition-all min-w-[200px] ${isMine ? "bg-white/20 backdrop-blur-md" : "bg-[#18181A]/80 backdrop-blur-md"}`}', content)

content = re.sub(r'className=\{lex items-center justify-center w-10 h-10 rounded-xl \}', 'className={`flex items-center justify-center w-10 h-10 rounded-xl ${isMine ? "bg-white/20 text-white" : "bg-white/10 text-white/80"}`}', content)

content = re.sub(r'className=\{ext-\[11px\] font-medium \}', 'className={`text-[11px] font-medium ${isMine ? "text-white/50" : "text-[#5BD05F]"}`}', content)

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
