import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(', MousePointerSquare', '')

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
