import re

with open('components/chat/MessageList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  handleReaction: (messageId: string, emoji: string) => void;',
    '  handleReaction: (messageId: string, emoji: string) => void;\n  onReply?: (messageId: string) => void;\n  onEdit?: (messageId: string) => void;\n  onDelete?: (messageId: string) => void;'
)

content = content.replace(
    '  handleReaction,\n  partnerTyping,',
    '  handleReaction,\n  onReply,\n  onEdit,\n  onDelete,\n  partnerTyping,'
)

content = content.replace(
    'onReact={(emoji) => handleReaction(item.data.id, emoji)}',
    'onReact={(emoji) => handleReaction(item.data.id, emoji)}\n                onReply={() => onReply?.(item.data.id)}\n                onEdit={() => onEdit?.(item.data.id)}\n                onDelete={() => onDelete?.(item.data.id)}'
)

with open('components/chat/MessageList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
