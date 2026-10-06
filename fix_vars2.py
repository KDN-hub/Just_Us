import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'  let actualType = type;\s*let actualContent = content;\s*if \(type === "text".*?actualContent = content\.replace\("VIDEO_URL:", ""\);\s*\}', re.DOTALL)

replacement = '''  let actualType = type;
  let actualContent = content;
  
  let isFile = false;
  let fileUrl = '';
  let fileName = '';
  let fileSize = 0;
  
  if (type === "text" && content.startsWith("AUDIO_URL:")) {
    actualType = "audio";
    actualContent = content.replace("AUDIO_URL:", "");
  } else if (type === "text" && content.startsWith("VIDEO_URL:")) {
    actualType = "video";
    actualContent = content.replace("VIDEO_URL:", "");
  } else if (type === "text" && content.startsWith("FILE_URL:")) {
    isFile = true;
    const parts = content.replace("FILE_URL:", "").split("|");
    fileUrl = parts[0];
    fileName = parts[1] || 'Document';
    fileSize = parseInt(parts[2] || '0', 10);
  }'''

content = pattern.sub(replacement, content)

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
