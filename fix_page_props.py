import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '        <MessageList\n          timeline={timeline}\n          myId={myId}\n          handleReaction={handleReaction}',
    '        <MessageList\n          timeline={timeline}\n          myId={myId}\n          handleReaction={handleReaction}\n          onReply={handleReply}\n          onEdit={handleEdit}\n          onDelete={handleDelete}'
)

with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
