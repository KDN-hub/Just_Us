import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add states
content = content.replace(
    '  const [showSearch, setShowSearch] = useState(false);',
    '  const [showSearch, setShowSearch] = useState(false);\n  const [infoMessageId, setInfoMessageId] = useState<string | null>(null);'
)

# Parse pins
pin_parser = '''  const editsMap: Record<string, string> = {};
  const repliesMap: Record<string, string> = {}; // newMsgId -> originalMsgId
  const pinsMap: Record<string, boolean> = {};'''

content = content.replace('''  const editsMap: Record<string, string> = {};
  const repliesMap: Record<string, string> = {}; // newMsgId -> originalMsgId''', pin_parser)

pin_logic = '''    if (m.type === 'text' && m.content.startsWith('DELETE:')) {
      const targetId = m.content.split(':')[1];
      if (targetId) editsMap[targetId] = 'This message was deleted';
      continue;
    }
    
    if (m.type === 'text' && (m.content.startsWith('PIN:') || m.content.startsWith('UNPIN:'))) {
      const parts = m.content.split(':');
      if (parts.length >= 2) {
         const targetId = parts[1];
         pinsMap[targetId] = m.content.startsWith('PIN:');
      }
      continue;
    }'''

content = content.replace('''    if (m.type === 'text' && m.content.startsWith('DELETE:')) {
      const targetId = m.content.split(':')[1];
      if (targetId) editsMap[targetId] = 'This message was deleted';
      continue;
    }''', pin_logic)


map_logic = '''       content: editsMap[m.id] || m.content,
       is_edited: !!editsMap[m.id],
       reply_to: repliesMap[m.id],
       reply_to_text: repliesMap[m.id] ? realMessages.find(om => om.id === repliesMap[m.id])?.content : undefined,
       is_pinned: pinsMap[m.id] || false
    };'''

content = content.replace('''       content: editsMap[m.id] || m.content,
       is_edited: !!editsMap[m.id],
       reply_to: repliesMap[m.id],
       reply_to_text: repliesMap[m.id] ? realMessages.find(om => om.id === repliesMap[m.id])?.content : undefined
    };''', map_logic)

# Handlers
handlers = '''  const handlePin = async (messageId: string, isCurrentlyPinned: boolean) => {
    const tempId = generateUUID();
    const action = isCurrentlyPinned ? 'UNPIN' : 'PIN';
    addOrUpdateMessage({ id: tempId, sender_id: myId, content: `${action}:${messageId}`, type: 'text', status: 'sent', created_at: new Date().toISOString(), pending: true });
    await supabase.from('messages').insert({ id: tempId, conversation_id: CONVERSATION_ID, sender_id: myId, type: 'text', content: `${action}:${messageId}`, status: 'sent' });
  };
  const handleForward = () => {
    alert("This conversation is currently private to you two.");
  };
  const handleInfo = (messageId: string) => {
    setInfoMessageId(messageId);
  };
  
  const handleReply = (messageId: string) => {'''

content = content.replace('  const handleReply = (messageId: string) => {', handlers)

# MessageList props
props = '''          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPin={(id) => handlePin(id, !!pinsMap[id])}
          onForward={handleForward}
          onInfo={handleInfo}'''

content = content.replace('''          onReply={handleReply}
          onEdit={handleEdit}
          onDelete={handleDelete}''', props)

# Info Modal UI
modal = '''      {infoMessageId && (
        <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setInfoMessageId(null)}>
           <div className="bg-[#18181A] rounded-2xl p-5 w-full max-w-sm shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-4">Message info</h3>
              {(() => {
                 const m = realMessages.find(msg => msg.id === infoMessageId);
                 if (!m) return <p className="text-white/50">Message not found</p>;
                 return (
                   <div className="space-y-4">
                     <div className="flex justify-between items-center border-b border-white/5 pb-2">
                       <span className="text-white/60 text-sm">Sent</span>
                       <span className="text-white text-sm">{new Date(m.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                     </div>
                     <div className="flex justify-between items-center border-b border-white/5 pb-2">
                       <span className="text-white/60 text-sm">Delivered</span>
                       <span className="text-white text-sm">{new Date(m.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                     </div>
                     {m.status === 'read' && (
                       <div className="flex justify-between items-center border-b border-white/5 pb-2">
                         <span className="text-white/60 text-sm">Read</span>
                         <span className="text-white text-sm">{new Date(m.created_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                     )}
                   </div>
                 );
              })()}
              <button onClick={() => setInfoMessageId(null)} className="w-full mt-6 py-2.5 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 active:bg-white/20 transition-colors">Close</button>
           </div>
        </div>
      )}
      {showSearch && ('''

content = content.replace('      {showSearch && (', modal)


with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
