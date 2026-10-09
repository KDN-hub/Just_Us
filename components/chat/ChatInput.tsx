import { RefObject, useState } from "react";
import { Send, Heart, Paperclip, Mic, Square, X, Smile, Star, Plus, Camera, Image as ImageIcon, FileText, Music } from "lucide-react";
import dynamic from 'next/dynamic';
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });
import TextareaAutosize from 'react-textarea-autosize';
import { motion, AnimatePresence } from 'framer-motion';
import MediaComposer from "@/components/chat/MediaComposer";
const StickerPicker = dynamic(() => import('@/components/chat/StickerPicker'), { ssr: false });
import StickerImportModal from "@/components/chat/StickerImportModal";

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
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showStickerImportModal, setShowStickerImportModal] = useState(false);

  return (
    <>
      <div className="relative z-10 shrink-0 flex items-center gap-2 bg-transparent px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {showEmojiPicker && (
          <div className="absolute bottom-[100%] left-5 mb-2 z-50 flex flex-col bg-[#18181A]/95 backdrop-blur-2xl rounded-[24px] overflow-hidden border border-white/10 shadow-2xl w-[320px] sm:w-[350px] animate-in slide-in-from-bottom-2">
            <div className="flex border-b border-white/10 bg-black/20">
              <button onClick={() => setPickerTab('emoji')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'emoji' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'}`}>Emojis</button>
              <button onClick={() => setPickerTab('sticker')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'sticker' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'}`}>Stickers</button>
              <button onClick={() => setPickerTab('gif')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'gif' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'}`}>GIFs</button>
              <button onClick={() => setPickerTab('favorites')} className={`flex-1 py-2 text-[13px] font-medium transition-colors ${pickerTab === 'favorites' ? 'text-white border-b-2 border-white' : 'text-white/50 hover:text-white/80'}`}>Favs</button>
            </div>
            <div className="h-[360px] overflow-hidden relative bg-transparent">
              {pickerTab === 'emoji' && (
                <div className="h-full overflow-y-auto">
                  <EmojiPicker theme={"dark" as any} width="100%" height={360} onEmojiClick={(e) => setDraft(prev => prev + e.emoji)} />
                </div>
              )}
              {pickerTab === 'sticker' && (
                <StickerPicker
                  userId={myId}
                  onSelectSticker={(sticker) => {
                    handleSendDirectURL(sticker.url, 'sticker');
                    setShowEmojiPicker(false);
                  }}
                  onOpenImport={() => {
                    setShowStickerImportModal(true);
                    setShowEmojiPicker(false);
                  }}
                />
              )}
              {pickerTab === 'favorites' && (
                <div className="grid grid-cols-3 gap-2 p-3 h-full overflow-y-auto">
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
              {pickerTab === 'gif' && (
                <div className="grid grid-cols-2 gap-2 p-3 h-full overflow-y-auto">
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

        <input type="file" ref={fileInputRef} accept="image/*,video/*,audio/*" multiple className="hidden" onChange={handleFileUpload} />
        
        {/* Input Bubble Container */}
        <div className="flex-1 flex items-center gap-1.5 rounded-[24px] bg-[#18181A]/85 backdrop-blur-2xl border border-white/10 px-2 py-1 min-h-[46px] shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 hover:text-white active:scale-95 transition-all"
            aria-label="Emoji picker"
          >
            <Smile className="h-[21px] w-[21px]" strokeWidth={1.6} />
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
                className="flex-1 bg-transparent py-2 px-1 text-[15.5px] leading-[22px] text-white outline-none placeholder:text-white/40 min-w-0"
              />

              <div className="relative flex items-center shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 active:text-white md:hover:text-white active:scale-95 transition-all"
                  aria-label="Attach media"
                >
                  <Plus className={`h-[21px] w-[21px] transition-transform duration-300 ${showAttachmentMenu ? "rotate-45" : ""}`} strokeWidth={1.75} />
                </button>
                <AnimatePresence>
                  {showAttachmentMenu && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className="absolute bottom-12 right-0 md:-left-16 z-50 grid grid-cols-4 gap-2 p-3 w-[290px] bg-[#18181A]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)] origin-bottom-right md:origin-bottom-left"
                    >
                      <button onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*,video/*'); fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 group">
                        <div className="w-11 h-11 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 group-active:scale-95 transition-transform"><ImageIcon className="w-5 h-5" /></div>
                        <span className="text-[11px] text-white/70 font-medium">Gallery</span>
                      </button>
                      <button onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*,video/*'); fileInputRef.current?.setAttribute('capture', 'environment'); fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 group">
                        <div className="w-11 h-11 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 group-active:scale-95 transition-transform"><Camera className="w-5 h-5" /></div>
                        <span className="text-[11px] text-white/70 font-medium">Camera</span>
                      </button>
                      <button onClick={() => { fileInputRef.current?.setAttribute('accept', '.pdf,.doc,.docx,.txt'); fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 group">
                        <div className="w-11 h-11 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 group-active:scale-95 transition-transform"><FileText className="w-5 h-5" /></div>
                        <span className="text-[11px] text-white/70 font-medium">Document</span>
                      </button>
                      <button onClick={() => { fileInputRef.current?.setAttribute('accept', 'audio/*'); fileInputRef.current?.removeAttribute('capture'); fileInputRef.current?.click(); setShowAttachmentMenu(false); }} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 group">
                        <div className="w-11 h-11 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 group-active:scale-95 transition-transform"><Music className="w-5 h-5" /></div>
                        <span className="text-[11px] text-white/70 font-medium">Audio</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
        <MediaComposer
          media={pendingMedia}
          caption={mediaCaption}
          onCaptionChange={setMediaCaption}
          onClose={() => {
            setPendingMedia(null);
            setMediaCaption("");
          }}
          onSend={(file, type, caption) => {
            uploadMedia(file, type, caption);
            setPendingMedia(null);
            setMediaCaption("");
          }}
        />
      )}

      <StickerImportModal
        isOpen={showStickerImportModal}
        onClose={() => setShowStickerImportModal(false)}
        userId={myId}
        onPackCreated={() => {
          setShowEmojiPicker(true);
          setPickerTab("sticker");
        }}
      />
    </>
  );
}




