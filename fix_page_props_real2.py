import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_str = """      <MessageList
        timeline={timeline}
        myId={myId}
        handleReaction={handleReaction}"""

new_str = """      <MessageList
        timeline={timeline}
        myId={myId}
        handleReaction={handleReaction}
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPin={(id) => handlePin(id, !!pinsMap[id])}
        onForward={handleForward}
        onInfo={handleInfo}"""

if old_str in content:
    content = content.replace(old_str, new_str)
else:
    print("Not found! trying regex")
    content = re.sub(r'<MessageList[^>]*handleReaction=\{handleReaction\}', lambda m: m.group(0) + '\n        onReply={handleReply}\n        onEdit={handleEdit}\n        onDelete={handleDelete}\n        onPin={(id) => handlePin(id, !!pinsMap[id])}\n        onForward={handleForward}\n        onInfo={handleInfo}', content)

with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
