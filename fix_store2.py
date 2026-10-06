import re

with open('hooks/useChatStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  reply_to?: string;',
    '  reply_to?: string;\n  reply_to_text?: string;'
)

with open('hooks/useChatStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)
