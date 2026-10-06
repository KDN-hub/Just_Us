import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

file_render = '''    if (type === "text" && content.startsWith("AUDIO_URL:")) {
      actualType = "audio";
      actualContent = content.replace("AUDIO_URL:", "");
    }
    if (type === "text" && content.startsWith("VIDEO_URL:")) {
      actualType = "video";
      actualContent = content.replace("VIDEO_URL:", "");
    }
    
    let isFile = false;
    let fileUrl = '';
    let fileName = '';
    let fileSize = 0;
    
    if (type === "text" && content.startsWith("FILE_URL:")) {
       isFile = true;
       const parts = content.replace("FILE_URL:", "").split("|");
       fileUrl = parts[0];
       fileName = parts[1] || 'Document';
       fileSize = parseInt(parts[2] || '0', 10);
    }
'''

content = content.replace(
    '    if (type === "text" && content.startsWith("AUDIO_URL:")) {\n      actualType = "audio";\n      actualContent = content.replace("AUDIO_URL:", "");\n    }\n    if (type === "text" && content.startsWith("VIDEO_URL:")) {\n      actualType = "video";\n      actualContent = content.replace("VIDEO_URL:", "");\n    }',
    file_render
)

file_html = '''      ) : isFile ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={lex items-center gap-3 px-4 py-3 rounded-[24px] border border-white/5 relative shadow-sm hover:opacity-90 active:scale-[0.98] transition-all min-w-[200px] }>
           <div className={lex items-center justify-center w-10 h-10 rounded-xl }>
              <Download className="w-5 h-5" />
           </div>
           <div className="flex flex-col flex-1 min-w-0 pr-8">
              <span className="text-[15px] font-medium text-white truncate">{fileName}</span>
              <span className="text-[12px] text-white/50">{fileSize > 0 ? (fileSize / 1024 / 1024).toFixed(1) + ' MB' : 'Document'}</span>
           </div>
           <span className="absolute bottom-[10px] right-[18px] flex items-center gap-1">
             {isEdited && <span className="text-[10px] text-white/40 italic mr-1">Edited</span>}
             <span className={	ext-[11px] font-medium }>{formatTime(timestamp)}</span>
             {isMine && status && <MessageStatusTicks status={status} queued={queued} className="h-3 w-3" />}
          </span>
        </a>
      ) : actualType === "audio" ? ('''

content = content.replace('      ) : actualType === "audio" ? (', file_html)

# Add Download and FileIcon to lucide-react import if needed
if 'Download' not in content:
    content = content.replace('import { Check', 'import { Download, Check')


with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
