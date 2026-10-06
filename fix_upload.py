import re

with open('app/chat/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

upload_replacement = '''      const { data: publicData } = supabase.storage.from('chat_media').getPublicUrl(fileName);
      const url = publicData.publicUrl;
      
      let dbType = type === 'image' ? 'image' : 'text';
      let dbContent = url;
      if (type === 'audio') dbContent = AUDIO_URL:;
      if (type === 'video') dbContent = VIDEO_URL:;
      if (type === 'file') {
         const originalName = (file as File).name || 'Document';
         dbContent = FILE_URL:||;
      }'''

content = re.sub(r'      const { data: publicData } = supabase\.storage\.from\(\'chat_media\'\)\.getPublicUrl\(fileName\);\s*const url = publicData\.publicUrl;\s*let dbType = type === \'image\' \? \'image\' : \'text\';\s*let dbContent = url;\s*if \(type === \'audio\'\) dbContent = AUDIO_URL:\$\{url\};\s*if \(type === \'video\'\) dbContent = VIDEO_URL:\$\{url\};', upload_replacement, content, flags=re.DOTALL)

upload_handler = '''  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    let type = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    if (type === 'file' || type === 'audio') {
      // Direct upload without preview for documents and audio files
      uploadMedia(file, type);
    } else {
      setPendingMedia({ file, type, url: URL.createObjectURL(file) });
    }
    e.target.value = '';
  };'''

content = re.sub(r'  const handleFileUpload = \(e: React\.ChangeEvent<HTMLInputElement>\) => \{.*?e\.target\.value = \'\';\s*\};', upload_handler, content, flags=re.DOTALL)

with open('app/chat/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
