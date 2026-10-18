"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ImageOff, Loader2, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import PhotoCropEditor from "@/components/PhotoCropEditor";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — validated before any decode work
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Explicit single-source-of-truth stage for the photo interaction. */
type Stage = "closed" | "preview" | "editing";

interface ProfilePhotoFlowProps {
  open: boolean;
  onClose: () => void;
  avatarUrl: string | null;
  name: string;
  initial: string;
  color: string;
  /** Commit the (already validated) new avatar — implementors persist + broadcast. */
  onSave: (dataUrl: string) => Promise<void> | void;
  /** Remove the custom photo and fall back to the default avatar. */
  onRemove: () => Promise<void> | void;
}

/**
 * WhatsApp-style profile photo flow.
 *
 * Stage A — tapping the avatar opens a large, quiet preview of the current
 * photo (object-contain, full original framing) with Change / Remove actions.
 * Stage B — Change opens the device file picker; the file is only decoded and
 * staged locally, nothing is saved yet.
 * Stage C — a crop screen lets the user pan/zoom the image behind a fixed
 * circular window, then confirm; only confirmation triggers onSave.
 */
export default function ProfilePhotoFlow({
  open,
  onClose,
  avatarUrl,
  name,
  initial,
  color,
  onSave,
  onRemove,
}: ProfilePhotoFlowProps) {
  const [stage, setStage] = useState<Stage>("closed");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [pendingImage, setPendingImage] = useState<HTMLImageElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Guards: stale file decodes and stale saves must never win.
  const sessionIdRef = useRef(0);
  const savingRef = useRef(false);
  // The staged file's object URL must stay alive for the whole editing session:
  // the crop screen renders a second <img> from image.src, which fails to load
  // once the URL is revoked. Revoked at session end instead (see releaseStaged).
  const objectUrlRef = useRef<string | null>(null);

  const releaseStaged = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPendingImage(null);
  }, []);

  useEffect(() => {
    if (open) {
      setStage("preview");
      releaseStaged();
      setError(null);
      setPreviewError(false);
      setPreviewLoading(false);
    } else {
      setStage("closed");
      // Release the staged image as soon as the session ends.
      releaseStaged();
    }
  }, [open, releaseStaged]);

  // Escape closes the preview (desktop parity with the backdrop tap).
  useEffect(() => {
    if (stage === "closed") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage === "preview") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onClose]);

  // Invalidate in-flight work when the flow closes or unmounts.
  useEffect(() => () => {
    sessionIdRef.current += 1;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    // Reset so picking the same file again re-triggers change.
    input.value = "";
    if (!file) return; // user cancelled the picker — nothing changes

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("That file type isn’t supported. Please choose a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That image is too large (over 10 MB). Please pick a smaller one.");
      return;
    }

    const session = ++sessionIdRef.current;
    setError(null);
    setPreviewLoading(true);

    // Replace any previously staged file before creating the new one.
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    const img = new window.Image();
    img.onload = () => {
      if (session !== sessionIdRef.current) return; // stale session
      setPreviewLoading(false);
      setPendingImage(img);
      setStage("editing");
    };
    img.onerror = () => {
      if (objectUrlRef.current === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrlRef.current = null;
      }
      if (session !== sessionIdRef.current) return;
      setPreviewLoading(false);
      setError("Couldn’t read that image. It may be corrupt or an unsupported format (e.g. HEIC).");
    };
    img.src = objectUrl;
  }, []);

  const handleConfirmCrop = useCallback(async (dataUrl: string) => {
    if (savingRef.current) return; // block double-taps
    savingRef.current = true;
    setSaving(true);
    setError(null);
    const session = sessionIdRef.current;
    try {
      await onSave(dataUrl);
      if (session !== sessionIdRef.current) return;
      releaseStaged();
      onClose();
    } catch (err) {
      if (session !== sessionIdRef.current) return;
      // Keep the editor open with the crop intact so the user can retry.
      setError(err instanceof Error ? err.message : "Couldn’t save the photo. Please try again.");
    } finally {
      if (session === sessionIdRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }, [onSave, onClose, releaseStaged]);

  const handleRemove = useCallback(async () => {
    if (removing) return;
    setRemoving(true);
    setError(null);
    try {
      await onRemove();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t remove the photo. Please try again.");
    } finally {
      setRemoving(false);
    }
  }, [onRemove, onClose, removing]);

  if (stage === "editing" && pendingImage) {
    return (
      <PhotoCropEditor
        image={pendingImage}
        saving={saving}
        error={error}
        onCancel={() => { setError(null); releaseStaged(); setStage("preview"); }}
        onConfirm={handleConfirmCrop}
      />
    );
  }

  if (stage !== "preview") return null;

  const hasPhoto = !!avatarUrl;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-2">
        <button
          onClick={onClose}
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 active:scale-90 active:bg-white/10 motion-safe:transition-transform"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <p className="text-[16px] font-medium text-white/90">Profile photo</p>
        <div className="h-10 w-10" aria-hidden />
      </div>

      {/* Photo presentation — object-contain so the full original framing is inspectable */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        {hasPhoto ? (
          <>
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            )}
            {previewError ? (
              <div className="flex flex-col items-center gap-3 text-white/50">
                <ImageOff className="h-10 w-10" strokeWidth={1.5} />
                <p className="text-[14px]">Couldn’t load this photo.</p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl!}
                alt={`${name}’s profile photo`}
                onLoad={() => setPreviewLoading(false)}
                onError={() => { setPreviewLoading(false); setPreviewError(true); }}
                className="max-h-full max-w-full object-contain motion-safe:transition-opacity motion-safe:duration-300"
                style={{ opacity: previewLoading ? 0 : 1 }}
              />
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar initial={initial} color={color} size={140} className="opacity-60" />
            <p className="text-[14px] text-white/50">No profile photo yet</p>
          </div>
        )}
      </div>

      {/* Name + actions */}
      <div className="shrink-0 px-6 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] pt-4">
        <p className="mb-4 text-center text-[17px] font-semibold text-white">{name}</p>
        {error && <p className="mb-3 text-center text-[13px] text-red-400">{error}</p>}
        <div className="flex gap-3">
          {hasPhoto && (
            <button
              onClick={handleRemove}
              disabled={removing || previewLoading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-3.5 text-[15px] font-semibold text-white active:scale-[0.98] disabled:opacity-60 motion-safe:transition-transform"
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={previewLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--wine)] py-3.5 text-[15px] font-semibold text-white shadow-md active:scale-[0.98] disabled:opacity-60 motion-safe:transition-transform"
          >
            <Camera className="h-5 w-5" />
            {hasPhoto ? "Change Photo" : "Add Photo"}
          </button>
        </div>
      </div>

      {/* Hidden picker — opened only by the Change Photo action, never on avatar tap */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
