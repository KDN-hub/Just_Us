import re

with open('components/MessageBubble.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('import { Check, CheckCheck, Clock, Heart, Play, Pause, X, Download, Mic, User, Plus, Reply, Copy, Pencil, Trash2 } from "lucide-react";', 'import { Check, CheckCheck, Clock, Heart, Play, Pause, X, Download, Mic, User, Plus, Reply, Copy, Pencil, Trash2, Share2, Pin, Info } from "lucide-react";')

with open('components/MessageBubble.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
