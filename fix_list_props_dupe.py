import re

with open('components/chat/MessageList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Just deduplicate the props!
content = re.sub(r'  onReply\?: \(id: string\) => void;\n  onEdit\?: \(id: string\) => void;\n  onDelete\?: \(id: string\) => void;\n', '', content)
content = re.sub(r'  onReply,\n  onEdit,\n  onDelete,\n', '', content)
content = re.sub(r'                  onReply=\{\(\) => onReply\?\.\(item\.data\.id\)\}\n                  onEdit=\{\(\) => onEdit\?\.\(item\.data\.id\)\}\n                  onDelete=\{\(\) => onDelete\?\.\(item\.data\.id\)\}\n', '', content)

with open('components/chat/MessageList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
