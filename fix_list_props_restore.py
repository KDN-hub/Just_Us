import re

with open('components/chat/MessageList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('  onPin?: (id: string) => void;', '  onReply?: (id: string) => void;\n  onEdit?: (id: string) => void;\n  onDelete?: (id: string) => void;\n  onPin?: (id: string) => void;')
content = content.replace('  onPin,\n  onForward,', '  onReply,\n  onEdit,\n  onDelete,\n  onPin,\n  onForward,')
content = content.replace('                  replyToText={item.data.reply_to_text}', '                  onReply={() => onReply?.(item.data.id)}\n                  onEdit={() => onEdit?.(item.data.id)}\n                  onDelete={() => onDelete?.(item.data.id)}\n                  replyToText={item.data.reply_to_text}')

with open('components/chat/MessageList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
