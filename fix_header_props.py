import re

with open('components/chat/ChatHeader.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'  onOpenAvatarUpload\r?\n\}: ChatHeaderProps\) \{', '  onOpenAvatarUpload,\n  onSearchClick\n}: ChatHeaderProps) {', content)

with open('components/chat/ChatHeader.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
