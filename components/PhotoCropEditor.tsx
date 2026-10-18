"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Loader2 } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Square output resolution for the saved avatar (JPEG q0.85 ≈ 40–90 KB). */
const OUTPUT_SIZE = 512;

interface PhotoCropEditorProps {
  /** Decoded source image, owned by the parent editing session. */
  image: HTMLImageElement;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}

/**
 * WhatsApp-style crop screen: the image pans and zooms behind a fixed circular
 * window; the window (not the image) defines the crop. All high-frequency
 * pointer/wheel movement writes styles straight to the DOM through refs — no
 * React re-render happens per frame. The final square is rendered to a 512×512
 * canvas only when the user confirms.
 */
export default function PhotoCropEditor({
  image,
  saving,
  error,
  onCancel,
  onConfirm,
}: PhotoCropEditorProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  /** Crop window side length in CSS px (measured from the available area). */
  const [side, setSide] = useState(0);

  // Displayed size of the whole image at zoom 1 ("cover" the crop window) and
  // the live transform. Kept in refs so gesture handlers never see stale values
  // and never trigger a render.
  const baseRef = useRef({ w: 0, h: 0 });
  const transformRef = useRef({ zoom: MIN_ZOOM, tx: 0, ty: 0 });

  // ── Measure the crop area ──────────────────────────────────────────────────
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const measure = () => {
      const rect = area.getBoundingClientRect();
      setSide(Math.max(1, Math.floor(Math.min(rect.width, rect.height))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(area);
    return () => ro.disconnect();
  }, []);

  const applyTransform = useCallback(() => {
    const el = imgRef.current;
    const s = side;
    if (!el || !s) return;
    const t = transformRef.current;
    // Clamp so the crop window is always fully covered — no empty edges.
    const maxTx = Math.max(0, (baseRef.current.w * t.zoom - s) / 2);
    const maxTy = Math.max(0, (baseRef.current.h * t.zoom - s) / 2);
    t.tx = Math.min(maxTx, Math.max(-maxTx, t.tx));
    t.ty = Math.min(maxTy, Math.max(-maxTy, t.ty));
    el.style.width = `${baseRef.current.w * t.zoom}px`;
    el.style.height = `${baseRef.current.h * t.zoom}px`;
    el.style.transform = `translate(-50%, -50%) translate(${t.tx}px, ${t.ty}px)`;
  }, [side]);

  // Reset the framing whenever the window size or the source image changes.
  useEffect(() => {
    const nw = image.naturalWidth || 1;
    const nh = image.naturalHeight || 1;
    if (!side) return;
    const scale = side / Math.min(nw, nh); // cover
    baseRef.current = { w: nw * scale, h: nh * scale };
    transformRef.current = { zoom: MIN_ZOOM, tx: 0, ty: 0 };
    if (sliderRef.current) sliderRef.current.value = String(MIN_ZOOM);
    applyTransform();
  }, [image, side, applyTransform]);

  /** Zoom while keeping the image point under the focal (fx, fy) — crop-window
   *  center-relative CSS px — pinned in place. */
  const zoomTo = useCallback(
    (targetZoom: number, fx: number, fy: number) => {
      const t = transformRef.current;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
      const ratio = next / t.zoom;
      t.tx = fx - (fx - t.tx) * ratio;
      t.ty = fy - (fy - t.ty) * ratio;
      t.zoom = next;
      // Always sync the slider — a gesture can clamp at MIN/MAX, leaving the
      // slider visually out of sync with the actual zoom.
      if (sliderRef.current) sliderRef.current.value = String(next);
      applyTransform();
    },
    [applyTransform],
  );

  // ── Pointer gestures (works for touch, pen and mouse alike) ────────────────
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const viewportCenter = () => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return rect
      ? { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
      : { cx: 0, cy: 0 };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: transformRef.current.zoom };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pts = pointersRef.current;
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size === 1) {
      const t = transformRef.current;
      t.tx += e.clientX - prev.x;
      t.ty += e.clientY - prev.y;
      applyTransform();
      return;
    }

    if (pts.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pts.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchRef.current.dist < 1) return;
      const { cx, cy } = viewportCenter();
      const midX = (a.x + b.x) / 2 - cx;
      const midY = (a.y + b.y) / 2 - cy;
      zoomTo((dist / pinchRef.current.dist) * pinchRef.current.zoom, midX, midY);
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Wheel zoom (desktop) must be a native non-passive listener to preventDefault.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const fx = e.clientX - (rect.left + rect.width / 2);
      const fy = e.clientY - (rect.top + rect.height / 2);
      zoomTo(transformRef.current.zoom * Math.exp(-e.deltaY * 0.002), fx, fy);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  // Keyboard access: arrows pan, +/− zoom around the center.
  const handleViewportKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const t = transformRef.current;
    const step = 16;
    switch (e.key) {
      case "ArrowLeft": t.tx += step; break;
      case "ArrowRight": t.tx -= step; break;
      case "ArrowUp": t.ty += step; break;
      case "ArrowDown": t.ty -= step; break;
      case "+": case "=": zoomTo(t.zoom * 1.2, 0, 0); return;
      case "-": zoomTo(t.zoom / 1.2, 0, 0); return;
      default: return;
    }
    e.preventDefault();
    applyTransform();
  };

  const handleConfirm = () => {
    if (saving) return;
    const nw = image.naturalWidth || 1;
    const nh = image.naturalHeight || 1;
    const t = transformRef.current;
    const dispW = baseRef.current.w * t.zoom;
    const dispH = baseRef.current.h * t.zoom;
    // Map the crop window back to source-image pixels.
    const factor = nw / dispW;
    let sx = (dispW / 2 - side / 2 - t.tx) * factor;
    let sy = (dispH / 2 - side / 2 - t.ty) * factor;
    const sw = side * factor;
    const sh = side * factor;
    // Guard against sub-pixel drift at the clamp edges.
    sx = Math.min(Math.max(0, sx), Math.max(0, nw - sw));
    sy = Math.min(Math.max(0, sy), Math.max(0, nh - sh));

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    onConfirm(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 px-4 pt-[max(env(safe-area-inset-top,0px),1rem)] pb-3">
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 active:scale-90 active:bg-white/10 motion-safe:transition-transform"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <p className="text-[16px] font-medium text-white">Preview profile photo</p>
      </div>

      {/* Crop area */}
      <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center px-4">
        <div
          ref={viewportRef}
          role="application"
          aria-label="Photo crop area. Drag to reposition, scroll or pinch to zoom."
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onKeyDown={handleViewportKeyDown}
          className="relative touch-none overflow-hidden rounded-lg outline-none ring-1 ring-white/10 focus-visible:ring-[var(--gold)]"
          style={{ width: side || undefined, height: side || undefined }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={image.src}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none select-none"
          />
          {/* Dim everything outside the circular crop guide */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full border border-white/70" />
        </div>
      </div>

      {/* Zoom slider */}
      <div className="flex shrink-0 items-center gap-3 px-6 pt-4">
        <span aria-hidden className="text-[18px] font-semibold leading-none text-white/60">−</span>
        <input
          ref={sliderRef}
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          defaultValue={MIN_ZOOM}
          aria-label="Zoom"
          onChange={(e) => zoomTo(parseFloat(e.target.value), 0, 0)}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[var(--gold)] outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
        />
        <span aria-hidden className="text-[16px] font-semibold leading-none text-white/60">+</span>
      </div>

      {/* Actions */}
      <div className="shrink-0 px-6 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] pt-4">
        {error && <p className="mb-3 text-center text-[13px] text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 rounded-2xl bg-white/10 py-3.5 text-[15px] font-semibold text-white active:scale-[0.98] disabled:opacity-60 motion-safe:transition-transform"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--wine)] py-3.5 text-[15px] font-semibold text-white shadow-md active:scale-[0.98] disabled:opacity-70 motion-safe:transition-transform"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={2.5} />}
            {saving ? "Saving…" : "Use Photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
