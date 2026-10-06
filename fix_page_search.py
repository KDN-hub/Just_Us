import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  const [replyingTo, setReplyingTo] = useState<string | null>(null);',
    '  const [replyingTo, setReplyingTo] = useState<string | null>(null);\n  const [showSearch, setShowSearch] = useState(false);'
)

if 'ChatSearch' not in content:
    content = content.replace('import ChatHeader from "@/components/chat/ChatHeader";', 'import ChatHeader from "@/components/chat/ChatHeader";\nimport ChatSearch from "@/components/chat/ChatSearch";')

handler = '''  const handleSearchResultClick = (msgId: string) => {
    setShowSearch(false);
    setTimeout(() => {
      const msgEl = document.getElementById(msg-);
      if (msgEl) {
        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        msgEl.classList.add('bg-white/20', 'transition-colors', 'duration-500');
        setTimeout(() => msgEl.classList.remove('bg-white/20'), 2000);
      } else {
        alert("This message is older and not loaded in the current view.");
      }
    }, 100);
  };'''

content = content.replace('  const handleReply = (messageId: string) => {', handler + '\n\n  const handleReply = (messageId: string) => {')

content = content.replace('onOpenAvatarUpload={() => setShowAvatarPrompt(true)}', 'onOpenAvatarUpload={() => setShowAvatarPrompt(true)}\n          onSearchClick={() => setShowSearch(true)}')

content = content.replace('      <ChatHeader', '      {showSearch && (\n        <ChatSearch\n          onClose={() => setShowSearch(false)}\n          conversationId={CONVERSATION_ID}\n          onResultClick={handleSearchResultClick}\n          myId={myId}\n        />\n      )}\n      <ChatHeader')

with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
