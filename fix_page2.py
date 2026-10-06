import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '       reply_to: repliesMap[m.id]',
    '       reply_to: repliesMap[m.id],\n       reply_to_text: repliesMap[m.id] ? realMessages.find(om => om.id === repliesMap[m.id])?.content : undefined'
)

with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
