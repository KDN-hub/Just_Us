import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '  onDelete?: () => void;',
    '  onDelete?: () => void;\n  replyToText?: string;'
)

content = content.replace(
    '  onDelete,\n}: MessageBubbleProps) {',
    '  onDelete,\n  replyToText,\n}: MessageBubbleProps) {'
)

reply_banner = '''      ) : (
        <div
          className={px-[18px] py-[10px] text-[17px] leading-relaxed text-white shadow-sm break-words rounded-[24px] border border-white/5 relative }
        >
          {replyToText && (
            <div className={mb-2 pl-2 border-l-2  text-[14px] opacity-70 line-clamp-2}>
              {replyToText}
            </div>
          )}
          <span className="whitespace-pre-wrap">{actualContent}</span>'''

content = content.replace('''      ) : (
        <div
          className={px-[18px] py-[10px] text-[17px] leading-relaxed text-white shadow-sm break-words rounded-[24px] border border-white/5 relative }
        >
          <span className="whitespace-pre-wrap">{actualContent}</span>''', reply_banner)


with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
