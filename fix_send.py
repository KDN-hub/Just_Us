import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

handle_send_replacement = '''  const handleSend = useCallback(async (overrideText?: string | React.MouseEvent | React.KeyboardEvent) => {
    const rawText = (typeof overrideText === 'string' ? overrideText : draft).trim();
    if (!rawText) return;

    if (typeof overrideText !== 'string') setDraft('');

    const tempId = generateUUID();
    const offline = !navigator.onLine;
    
    let text = rawText;
    if (editingMessage) {
      text = EDIT::;
      setEditingMessage(null);
    } else if (replyingTo) {
      text = REPLY::;
      setReplyingTo(null);
    }

    addOrUpdateMessage({
      id: tempId,
      sender_id: myId,
      content: text,'''

content = re.sub(r'  const handleSend = useCallback.*?addOrUpdateMessage\(\{.*?id: tempId,.*?sender_id: myId,.*?content: text,', handle_send_replacement, content, flags=re.DOTALL)

with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
