import re

with open('components/chat/MessageList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('  onReply?: (id: string) => void;\n  onEdit?: (id: string) => void;\n  onDelete?: (id: string) => void;\n', '')
content = content.replace('  onReply,\n  onEdit,\n  onDelete,\n  onPin,\n  onForward,\n  onInfo,\n', '  onPin,\n  onForward,\n  onInfo,\n')
content = content.replace('                  onReply={() => onReply?.(item.data.id)}\n                  onEdit={() => onEdit?.(item.data.id)}\n                  onDelete={() => onDelete?.(item.data.id)}\n                  replyToText={item.data.reply_to_text}', '                  replyToText={item.data.reply_to_text}')

with open('components/chat/MessageList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
