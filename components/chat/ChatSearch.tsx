import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Message } from '@/hooks/useChatStore';

interface ChatSearchProps {
  onClose: () => void;
  conversationId: string;
  onResultClick: (msgId: string) => void;
  myId: string;
}

export default function ChatSearch({ onClose, conversationId, onResultClick, myId }: ChatSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('type', 'text')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      
      setLoading(false);
      if (!error && data) {
         // Filter out edits/reactions/metadata just in case, though they usually start with uppercase keywords
         const filtered = data.filter((m: any) => 
           !m.content.startsWith('REACTION:') && 
           !m.content.startsWith('EDIT:') && 
           !m.content.startsWith('DELETE:') &&
           !m.content.startsWith('PIN:') &&
           !m.content.startsWith('UNPIN:')
         );
         setResults(filtered);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query, conversationId]);

  return (
    <div className="absolute inset-0 z-[60] bg-[#0A0A0A] flex flex-col animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-3 p-4 bg-[#18181A] border-b border-white/10">
        <div className="flex-1 relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-white/50" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search in conversation..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/10 text-white text-[15px] placeholder:text-white/40 rounded-full py-2 pl-9 pr-4 outline-none focus:bg-white/15 transition-colors"
          />
        </div>
        <button onClick={onClose} className="p-2 -mr-2 text-white/70 hover:text-white active:bg-white/10 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
          </div>
        )}
        {!loading && query && results.length === 0 && (
          <div className="text-center text-white/50 py-10 text-[15px]">
            No messages found for &quot;{query}&quot;
          </div>
        )}
        {!loading && results.map(msg => (
          <button
            key={msg.id}
            onClick={() => onResultClick(msg.id)}
            className="w-full text-left bg-white/5 hover:bg-white/10 active:bg-white/15 p-3 rounded-2xl transition-colors border border-white/5"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-medium text-white/50">{msg.sender_id === myId ? 'You' : 'Partner'}</span>
              <span className="text-[11px] text-white/40">{new Date(msg.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="text-[15px] text-white/90 line-clamp-2">
              {msg.content.startsWith('REPLY:') ? msg.content.split(':').slice(2).join(':') : msg.content}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

