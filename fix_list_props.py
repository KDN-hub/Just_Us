import re

with open('components/chat/MessageList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'  partnerAvatarUrl\?: string \| null;', '  partnerAvatarUrl?: string | null;\n  onReply?: (id: string) => void;\n  onEdit?: (id: string) => void;\n  onDelete?: (id: string) => void;\n  onPin?: (id: string) => void;\n  onForward?: (id: string) => void;\n  onInfo?: (id: string) => void;', content)
content = re.sub(r'  partnerAvatarUrl,\r?\n\}: MessageListProps\) \{', '  partnerAvatarUrl,\n  onReply,\n  onEdit,\n  onDelete,\n  onPin,\n  onForward,\n  onInfo,\n}: MessageListProps) {', content)

props = '''                  onReply={() => onReply?.(item.data.id)}
                  onEdit={() => onEdit?.(item.data.id)}
                  onDelete={() => onDelete?.(item.data.id)}
                  replyToText={item.data.reply_to_text}
                  isEdited={item.data.is_edited}
                  isPinned={item.data.is_pinned}
                  onPin={() => onPin?.(item.data.id)}
                  onForward={() => onForward?.(item.data.id)}
                  onInfo={() => onInfo?.(item.data.id)}'''

content = re.sub(r'                  onDelete=\{\(\) => onDelete\?\.\(item\.data\.id\)\}', props, content)

with open('components/chat/MessageList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
