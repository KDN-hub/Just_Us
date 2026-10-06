import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Locate the a-tag block and replace it entirely
a_tag_pattern = re.compile(r'<a href=\{fileUrl\}.*?</a>', re.DOTALL)

clean_a_tag = '''<a href={fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-3 px-4 py-3 rounded-[24px] border border-white/5 relative shadow-sm hover:opacity-90 active:scale-[0.98] transition-all min-w-[200px] ${isMine ? 'bg-white/20 backdrop-blur-md' : 'bg-[#18181A]/80 backdrop-blur-md'}`}>
           <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${isMine ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`}>
              <Download className="w-5 h-5" />
           </div>
           <div className="flex flex-col flex-1 min-w-0 pr-8">
              <span className="text-[15px] font-medium text-white truncate">{fileName}</span>
              <span className="text-[12px] text-white/50">{fileSize > 0 ? (fileSize / 1024 / 1024).toFixed(1) + ' MB' : 'Document'}</span>
           </div>
           <span className="absolute bottom-[10px] right-[18px] flex items-center gap-1">
             {isEdited && <span className="text-[10px] text-white/40 italic mr-1">Edited</span>}
             <span className={`text-[11px] font-medium ${isMine ? 'text-white/50' : 'text-[#5BD05F]'}`}>{formatTime(timestamp)}</span>
             {isMine && status && <MessageStatusTicks status={status} queued={queued} className="h-3 w-3" />}
          </span>
        </a>'''

content = a_tag_pattern.sub(clean_a_tag, content)

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
