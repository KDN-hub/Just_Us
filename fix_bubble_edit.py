import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  replyToText?: string;',
    '  replyToText?: string;\n  isEdited?: boolean;'
)

content = content.replace(
    '  replyToText,\n}: MessageBubbleProps) {',
    '  replyToText,\n  isEdited,\n}: MessageBubbleProps) {'
)

content = content.replace(
    '             <span className={	ext-[13px] font-medium }>{formatTime(timestamp)}</span>',
    '             {isEdited && <span className="text-[12px] text-white/40 italic mr-1">Edited</span>}\n             <span className={	ext-[13px] font-medium }>{formatTime(timestamp)}</span>'
)

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('components/chat/MessageList.tsx', 'r', encoding='utf-8') as f:
    content2 = f.read()

content2 = content2.replace(
    '                  replyToText={item.data.reply_to_text}',
    '                  replyToText={item.data.reply_to_text}\n                  isEdited={item.data.is_edited}'
)

with open('components/chat/MessageList.tsx', 'w', encoding='utf-8') as f:
    f.write(content2)
