import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

props = '''        <MessageList
          timeline={timeline}
          myId={myId}
          handleReaction={handleReaction}
          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPin={(id) => handlePin(id, !!pinsMap[id])}
          onForward={handleForward}
          onInfo={handleInfo}'''

content = re.sub(r'        <MessageList\s*timeline=\{timeline\}\s*myId=\{myId\}\s*handleReaction=\{handleReaction\}', props, content)

with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
