import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add state variables
content = content.replace(
    '  const [draft, setDraft] = useState("");',
    '  const [draft, setDraft] = useState("");\n  const [editingMessage, setEditingMessage] = useState<string | null>(null);\n  const [replyingTo, setReplyingTo] = useState<string | null>(null);'
)

# Update message parser
old_parser = '''  const realMessages: Message[] = [];
  const reactionsMap: Record<string, Record<string, string>> = {};

  for (const m of messageList) {
    if (m.type === 'text' && m.content.startsWith('REACTION:')) {
      const parts = m.content.split(':');
      if (parts.length >= 3) {
        const targetId = parts[1];
        const emoji = parts.slice(2).join(':'); 
        if (!reactionsMap[targetId]) reactionsMap[targetId] = {};
        if (emoji === 'NONE') {
          delete reactionsMap[targetId][m.sender_id];
        } else {
          reactionsMap[targetId][m.sender_id] = emoji;
        }
      }
    } else {
      realMessages.push(m);
    }
  }

  for (const m of realMessages) {
    m.reactions = reactionsMap[m.id] || {};
  }'''

new_parser = '''  let realMessages: Message[] = [];
  const reactionsMap: Record<string, Record<string, string>> = {};
  const editsMap: Record<string, string> = {};
  const repliesMap: Record<string, string> = {}; // newMsgId -> originalMsgId

  for (const m of messageList) {
    if (m.type === 'text' && m.content.startsWith('REACTION:')) {
      const parts = m.content.split(':');
      if (parts.length >= 3) {
        const targetId = parts[1];
        const emoji = parts.slice(2).join(':'); 
        if (!reactionsMap[targetId]) reactionsMap[targetId] = {};
        if (emoji === 'NONE') delete reactionsMap[targetId][m.sender_id];
        else reactionsMap[targetId][m.sender_id] = emoji;
      }
      continue;
    }
    
    if (m.type === 'text' && m.content.startsWith('EDIT:')) {
      const parts = m.content.split(':');
      if (parts.length >= 3) {
        const targetId = parts[1];
        const newText = parts.slice(2).join(':');
        editsMap[targetId] = newText;
      }
      continue;
    }
    
    if (m.type === 'text' && m.content.startsWith('REPLY:')) {
      const parts = m.content.split(':');
      if (parts.length >= 3) {
        const targetId = parts[1];
        repliesMap[m.id] = targetId;
        m.content = parts.slice(2).join(':');
      }
    }
    
    realMessages.push(m);
  }

  realMessages = realMessages.map(m => {
    return {
       ...m,
       reactions: reactionsMap[m.id] || {},
       content: editsMap[m.id] || m.content,
       is_edited: !!editsMap[m.id],
       reply_to: repliesMap[m.id]
    };
  });'''

content = content.replace(old_parser, new_parser)

# Handlers
handlers_to_insert = '''  const handleReply = (messageId: string) => {
    setReplyingTo(messageId);
    setEditingMessage(null);
    inputRef.current?.focus();
  };

  const handleEdit = (messageId: string) => {
    const msg = useChatStore.getState().messages[messageId];
    if (msg && msg.type === 'text') {
      let content = msg.content;
      if (content.startsWith('REPLY:')) content = content.split(':').slice(2).join(':');
      
      const latestEdit = Object.values(useChatStore.getState().messages).filter(m => m.type === 'text' && m.content.startsWith('EDIT:' + messageId + ':')).pop();
      if (latestEdit) {
         content = latestEdit.content.split(':').slice(2).join(':');
      }
      
      setDraft(content);
      setEditingMessage(messageId);
      setReplyingTo(null);
      inputRef.current?.focus();
    }
  };

  const handleDelete = async (messageId: string) => {
    // Delete for me vs everyone - soft delete using empty content or hard delete
    const offline = !navigator.onLine;
    const tempId = generateUUID();
    
    // We send a DELETE instruction
    addOrUpdateMessage({
      id: tempId,
      sender_id: myId,
      content: DELETE:,
      type: 'text',
      status: 'sent',
      created_at: new Date().toISOString(),
      pending: true,
      queued: offline,
    });
    
    const { data, error } = await supabase.from('messages').insert({
      id: tempId,
      conversation_id: CONVERSATION_ID,
      sender_id: myId,
      type: 'text',
      content: DELETE:,
      status: 'sent',
    }).select('created_at').single();
    
    if (error) {
       const m = useChatStore.getState().messages[tempId];
       if (m) addOrUpdateMessage({ ...m, queued: true });
    } else if (data) {
       const m = useChatStore.getState().messages[tempId];
       if (m) addOrUpdateMessage({ ...m, created_at: data.created_at, pending: false });
    }
  };
'''

content = content.replace(
    '  const handleReaction = async (messageId: string, emoji: string) => {',
    handlers_to_insert + '\n  const handleReaction = async (messageId: string, emoji: string) => {'
)

# Modify handleDelete logic in parsing
delete_parser = '''    if (m.type === 'text' && m.content.startsWith('DELETE:')) {
      const targetId = m.content.split(':')[1];
      if (targetId) editsMap[targetId] = 'This message was deleted';
      continue;
    }
'''

content = content.replace("if (m.type === 'text' && m.content.startsWith('EDIT:')) {", delete_parser + "    if (m.type === 'text' && m.content.startsWith('EDIT:')) {")


with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
