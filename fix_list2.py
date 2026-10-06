import re

with open('components/chat/MessageList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '                  onDelete={() => onDelete?.(item.data.id)}',
    '                  onDelete={() => onDelete?.(item.data.id)}\n                  replyToText={item.data.reply_to_text}'
)

with open('components/chat/MessageList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
