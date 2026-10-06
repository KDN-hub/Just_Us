import re

with open('hooks/useChatStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  reactions?: Record<string, string>; // sender_id -> emoji',
    '  reactions?: Record<string, string>; // sender_id -> emoji\n  reply_to?: string;\n  is_edited?: boolean;'
)

with open('hooks/useChatStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)
