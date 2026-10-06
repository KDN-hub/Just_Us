import re

with open('components/chat/MessageList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('  handleReaction,\n  partnerTyping,', '  handleReaction,\n  onReply,\n  onEdit,\n  onDelete,\n  partnerTyping,')

props = '''                  onReply={() => onReply?.(item.data.id)}
                  onEdit={() => onEdit?.(item.data.id)}
                  onDelete={() => onDelete?.(item.data.id)}
                  replyToText={item.data.reply_to_text}'''

content = content.replace('                  replyToText={item.data.reply_to_text}', props)

with open('components/chat/MessageList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
