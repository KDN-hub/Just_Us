import { RefObject } from "react";
import { Send, Heart, Paperclip, Mic, Square, X, Smile, Star } from "lucide-react";
import EmojiPicker from 'emoji-picker-react';
import TextareaAutosize from 'react-textarea-autosize';

interface ChatInputProps {
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  isOnline: boolean;
  showEmojiPicker: boolean;
  setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
  pickerTab: 'emoji' | 'sticker' | 'gif' | 'favorites';
  setPickerTab: React.Dispatch<React.SetStateAction<'emoji' | 'sticker' | 'gif' | 'favorites'>>;
  favorites: string[];
  toggleFavorite: (url: string, e: React.MouseEvent) => void;
  handleSendDirectURL: (url: string, type: string) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isRecording: boolean;
  recordingTime: number;
  stopRecording: () => void;
  startRecording: () => void;
  inputRef: RefObject<HTMLTextAreaElement>;
  signalChRef: RefObject<any>;
  myId: string;
  typingTimeoutRef: RefObject<NodeJS.Timeout | null>;
  handleSend: () => void;
  pendingMedia: { file: File | Blob, type: string, url: string } | null;
  setPendingMedia: React.Dispatch<React.SetStateAction<any>>;
  mediaCaption: string;
  setMediaCaption: React.Dispatch<React.SetStateAction<string>>;
  uploadMedia: (file: File | Blob, type: string, caption?: string) => void;
}

export default function ChatInput({
  draft,
  setDraft,
  isOnline,
  showEmojiPicker,
  setShowEmojiPicker,
  pickerTab,
  setPickerTab,
  favorites,
  toggleFavorite,
  handleSendDirectURL,
  fileInputRef,
  handleFileUpload,
  isRecording,
  recordingTime,
  stopRecording,
  startRecording,
  inputRef,
  signalChRef,
  myId,
  typingTimeoutRef,
  handleSend,
  pendingMedia,
  setPendingMedia,
  mediaCaption,
  setMediaCaption,
  uploadMedia
}: ChatInputProps) {
  return (
    <>
      <div className="relative z-10 shrink-0 flex items-center gap-2 bg-transparent px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {showEmojiPicker && (
          <div className="absolute bottom-[100%] left-5 mb-2 z-50 flex flex-col bg-[#18181A]/95 backdrop-blur-2xl rounded-[24px] overflow-hidden border border-white/10 shadow-2xl w-[320px] animate-in slide-in-from-bottom-2">
            <div className="flex border-b border-white/10 bg-black/20">
              <button onClick={() => setPickerTab('emoji')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'emoji' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'}`}>Emojis</button>
              <button onClick={() => setPickerTab('sticker')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'sticker' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'}`}>Stickers</button>
              <button onClick={() => setPickerTab('gif')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'gif' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'}`}>GIFs</button>
              <button onClick={() => setPickerTab('favorites')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'favorites' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'}`}>Favs</button>
            </div>
            <div className="h-[350px] overflow-y-auto relative bg-transparent">
              {pickerTab === 'emoji' && (
                <EmojiPicker theme={"dark" as any} width="100%" height={350} onEmojiClick={(e) => setDraft(prev => prev + e.emoji)} />
              )}
              {pickerTab === 'favorites' && (
                <div className="grid grid-cols-3 gap-2 p-3">
                  {favorites.length === 0 && <p className="col-span-3 text-center text-white/40 text-[13px] mt-10">No favorites yet</p>}
                  {favorites.map((url, i) => (
                    <div key={i} className="relative group aspect-square">
                      <img src={url} alt="Favorite" className="w-full h-full object-contain cursor-pointer active:bg-white/10 md:hover:bg-white/10 rounded-lg p-1" onClick={() => handleSendDirectURL(url, 'image')} />
                      <button onClick={(e) => toggleFavorite(url, e)} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pickerTab === 'sticker' && (
                <div className="grid grid-cols-3 gap-2 p-3">
                  {["https://media.tenor.com/E_2t3a9fNrwAAAAi/peach-cat.gif", "https://media.tenor.com/T0b-Oa0u7sYAAAAi/tkthao219-bubududu.gif", "https://media.tenor.com/Jd0n2J1e3hMAAAAi/mocha-bear.gif", "https://media.tenor.com/xIID7d983VMAAAAi/milk-and-mocha-bear.gif", "https://media.tenor.com/YwN9qRkQ7f0AAAAi/mochi-peach.gif", "https://media.tenor.com/B942y020TTEAAAAi/dudu-bubu.gif"].map((url, i) => (
                    <div key={i} className="relative group aspect-square">
                      <img src={url} alt="Sticker" className="w-full h-full object-contain cursor-pointer active:bg-white/10 md:hover:bg-white/10 rounded-lg p-1" onClick={() => handleSendDirectURL(url, 'image')} />
                      <button onClick={(e) => toggleFavorite(url, e)} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <Star className={`h-3 w-3 ${favorites.includes(url) ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {pickerTab === 'gif' && (
                <div className="grid grid-cols-2 gap-2 p-3">
                  {["https://media.tenor.com/N2sS-WtyHhgAAAAM/cat-meme.gif", "https://media.tenor.com/Z4XW47B_3b4AAAAM/hugging.gif", "https://media.tenor.com/n14aQZ2E86QAAAAM/love-cute.gif", "https://media.tenor.com/w1j0bM6sSCAAAAAM/sad-puss-in-boots.gif"].map((url, i) => (
                    <div key={i} className="relative group aspect-square">
                      <img src={url} alt="GIF" className="w-full h-full object-cover cursor-pointer active:bg-white/10 md:hover:bg-white/10 rounded-lg" onClick={() => handleSendDirectURL(url, 'image')} />
                      <button onClick={(e) => toggleFavorite(url, e)} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <Star className={`h-3 w-3 ${favorites.includes(url) ? 'fill-yellow-400 text-yellow-400' : 'text-white'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <input type="file" ref={fileInputRef} accept="image/*,video/*,audio/*" className="hidden" onChange={handleFileUpload} />
        
        {/* Input Bubble Container */}
        <div className="flex-1 flex items-end gap-1.5 rounded-[24px] bg-white/20 border border-white/10 px-1.5 py-1 min-h-[46px]">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 hover:text-white transition-colors"
          >
            <Smile className="h-[22px] w-[22px]" strokeWidth={1.5} />
          </button>
          
          {isRecording ? (
            <div className="flex-1 flex items-center justify-center gap-2 py-2 animate-in slide-in-from-right-4 duration-300">
               <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
               <span className="text-[15px] font-mono text-white">
                 {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
               </span>
            </div>
          ) : (
            <>
              <TextareaAutosize ref={inputRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (!signalChRef.current || !isOnline) return;
                  if (!typingTimeoutRef.current) {
                    signalChRef.current.send({ type: "broadcast", event: "typing", payload: { userId: myId, isTyping: true } });
                  } else {
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                  }
                  // @ts-ignore
                  typingTimeoutRef.current = setTimeout(() => {
                    signalChRef.current?.send({ type: "broadcast", event: "typing", payload: { userId: myId, isTyping: false } });
                    // @ts-ignore
                    typingTimeoutRef.current = null;
                  }, 2000);
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} maxRows={6} style={{ resize: "none" }}
                placeholder="Message…"
                autoComplete="off"
                className="flex-1 bg-transparent py-2.5 text-[16px] text-white outline-none placeholder:text-white/40 min-w-0"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] active:text-[var(--cream)] md:hover:text-[var(--cream)] transform -rotate-45"
              >
                <Paperclip className="h-[20px] w-[20px]" strokeWidth={1.5} />
              </button>
            </>
          )}

        </div>

        {/* Outside Circle Button (Send or Mic) */}
        <div className="shrink-0">
          {draft.trim() ? (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!isOnline}
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#18181A]/80 backdrop-blur-xl border border-white/10 text-white transition-all active:scale-[0.97] active:bg-white/10 md:hover:bg-white/10 shadow-lg disabled:opacity-40"
            >
              <Send className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!isOnline}
              aria-label={isRecording ? "Stop Recording" : "Record Voice Note"}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#18181A]/80 backdrop-blur-xl border border-white/10 transition-all active:scale-[0.97] active:bg-white/10 md:hover:bg-white/10 shadow-lg disabled:opacity-40 ${isRecording ? 'text-red-500 animate-pulse' : 'text-[var(--cream)]'}`}
            >
              {isRecording ? <Square className="h-[20px] w-[20px]" strokeWidth={2} /> : <Mic className="h-[20px] w-[20px]" strokeWidth={1.5} />}
            </button>
          )}
        </div>
      </div>

      {pendingMedia && (
        <div className="fixed inset-y-0 inset-x-0 mx-auto max-w-md z-50 flex flex-col bg-black">
          <div className="flex items-center p-4">
            <button onClick={() => setPendingMedia(null)} className="text-white"><X className="h-6 w-6" /></button>
          </div>
          <div className="flex-1 flex items-center justify-center min-h-0">
            {pendingMedia.type === 'video' ? <video src={pendingMedia.url} controls className="max-h-full max-w-full" /> : <img src={pendingMedia.url} className="max-h-full max-w-full object-contain" />}
          </div>
          <div className="p-4 flex gap-2">
            <input type="text" value={mediaCaption} onChange={e => setMediaCaption(e.target.value)} placeholder="Add a caption..." className="flex-1 rounded-full bg-zinc-800 text-white px-4 py-2 outline-none" />
            <button onClick={() => {
               uploadMedia(pendingMedia.file, pendingMedia.type, mediaCaption);
               setPendingMedia(null);
               setMediaCaption("");
            }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4C7A5B] text-white">
              <Send className="h-[17px] w-[17px]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}


