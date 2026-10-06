import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

variables_to_inject = '''    let actualType = type;
    let actualContent = content;
    
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

content = content.replace('    let actualType = type;\n    let actualContent = content;', variables_to_inject)

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
