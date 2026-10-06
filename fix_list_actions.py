import re

with open('components/chat/MessageList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('  onDelete?: (id: string) => void;', '  onDelete?: (id: string) => void;\n  onPin?: (id: string) => void;\n  onForward?: (id: string) => void;\n  onInfo?: (id: string) => void;')
content = content.replace('  onDelete,\n}: MessageListProps) {', '  onDelete,\n  onPin,\n  onForward,\n  onInfo,\n}: MessageListProps) {')

props = '''                  replyToText={item.data.reply_to_text}
                  isEdited={item.data.is_edited}
                  isPinned={item.data.is_pinned}
                  onPin={() => onPin?.(item.data.id)}
                  onForward={() => onForward?.(item.data.id)}
                  onInfo={() => onInfo?.(item.data.id)}'''

content = content.replace('''                  replyToText={item.data.reply_to_text}
                  isEdited={item.data.is_edited}''', props)

with open('components/chat/MessageList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('hooks/useChatStore.ts', 'r', encoding='utf-8') as f:
    store = f.read()

store = store.replace('  reply_to_text?: string;', '  reply_to_text?: string;\n  is_pinned?: boolean;')
with open('hooks/useChatStore.ts', 'w', encoding='utf-8') as f:
    f.write(store)
