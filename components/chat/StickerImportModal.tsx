"use client";

import React, { useState, useRef } from "react";
import { X, Upload, Plus, Trash2, Check, Loader2, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { validateStickerFile, createStickerPack, StickerPack } from "@/lib/stickers";

interface StickerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onPackCreated: (pack: StickerPack) => void;
}

interface SelectedItem {
  id: string;
  file: File;
  previewUrl: string;
  width?: number;
  height?: number;
  error?: string;
}

export default function StickerImportModal({
  isOpen,
  onClose,
  userId,
  onPackCreated,
}: StickerImportModalProps) {
  const [packName, setPackName] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrorMessage("");

    const newItems: SelectedItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = await validateStickerFile(file);
      newItems.push({
        id: `${file.name}-${Date.now()}-${i}`,
        file,
        previewUrl: validation.previewUrl || URL.createObjectURL(file),
        width: validation.width,
        height: validation.height,
        error: validation.ok ? undefined : validation.error,
      });
    }

    setItems((prev) => [...prev, ...newItems]);
    e.target.value = "";
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const found = prev.find((it) => it.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  };

  const handleImport = async () => {
    if (!packName.trim()) {
      setErrorMessage("Please enter a name for this sticker pack.");
      return;
    }

    const validItems = items.filter((it) => !it.error);
    if (validItems.length === 0) {
      setErrorMessage("Please select at least one valid sticker file.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    try {
      const result = await createStickerPack(
        packName.trim(),
        validItems.map((it) => it.file),
        userId
      );

      if (result.ok && result.pack) {
        onPackCreated(result.pack);
        handleClose();
      } else {
        setErrorMessage(result.error || "Failed to create sticker pack.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during import.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]);
    setPackName("");
    setErrorMessage("");
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
      >
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="bg-[#18181A] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--wine)]/30 border border-[var(--wine)]/40 flex items-center justify-center text-[var(--gold)]">
                <ImageIcon className="w-4 h-4" />
              </div>
              <h3 className="text-[17px] font-semibold text-white">Import Stickers</h3>
            </div>
            <button
              onClick={handleClose}
              disabled={isUploading}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {/* Pack Name Input */}
            <div>
              <label className="block text-[12px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                Pack Name
              </label>
              <input
                type="text"
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                placeholder="e.g. Baby & Me ❤️"
                disabled={isUploading}
                maxLength={40}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder:text-white/30 text-[14.5px] focus:outline-none focus:border-[var(--wine)] transition-colors"
              />
            </div>

            {/* Sticker Preview Grid & File Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[12px] font-semibold text-white/60 uppercase tracking-wider">
                  Stickers ({items.length})
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1 text-[12px] text-[var(--gold)] hover:underline font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add more
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                accept="image/webp,image/png,image/gif,image/jpeg"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />

              {items.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/15 hover:border-[var(--wine)]/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-white/[0.02]"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/60 mb-2.5">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-[14px] font-medium text-white mb-0.5">Choose sticker images</p>
                  <p className="text-[12px] text-white/40">Transparent WebP, PNG, GIF, or JPEG (Max 5MB)</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto p-1 bg-black/30 rounded-2xl border border-white/5">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className={`relative group aspect-square rounded-xl p-1.5 flex items-center justify-center overflow-hidden border ${
                        it.error ? "border-red-500/50 bg-red-500/10" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <img src={it.previewUrl} alt="" className="w-full h-full object-contain" />
                      {!isUploading && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      {it.error && (
                        <span className="absolute bottom-1 inset-x-1 text-[9px] bg-red-600/90 text-white text-center rounded px-0.5 py-0.2 truncate">
                          Invalid
                        </span>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="aspect-square rounded-xl border border-dashed border-white/20 hover:border-white/40 flex flex-col items-center justify-center text-white/50 hover:text-white transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-[10px] mt-0.5">Add</span>
                  </button>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-[12.5px] leading-tight">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-white/10 bg-white/5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isUploading}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-medium text-[14px] transition-colors active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isUploading || items.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-[var(--wine)] hover:brightness-110 text-white font-medium text-[14px] transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing…</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Import Pack</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
