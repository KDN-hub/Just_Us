"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Crop, RotateCw, PenTool, Type, Send, Undo2, Check, Trash2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DrawPoint {
  x: number;
  y: number;
}

interface DrawStroke {
  color: string;
  size: number;
  points: DrawPoint[];
}

interface SnapchatTextOverlay {
  id: string;
  text: string;
  color: string;
  yPercent: number; // 0 to 100 vertical position on image
  style: "classic" | "bold";
}

interface CropBox {
  x: number; // 0 to 1
  y: number; // 0 to 1
  w: number; // 0 to 1
  h: number; // 0 to 1
}

interface MediaComposerProps {
  media: {
    file: File | Blob;
    type: string;
    url: string;
  };
  caption: string;
  onCaptionChange: (caption: string) => void;
  onClose: () => void;
  onSend: (file: File | Blob, type: string, caption?: string) => void;
}

const DRAW_COLORS = [
  "#FFFFFF",
  "#BC1529", // System wine red
  "#C9A66B", // System gold
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#AF52DE",
  "#FF2D55",
];

export default function MediaComposer({
  media,
  caption,
  onCaptionChange,
  onClose,
  onSend,
}: MediaComposerProps) {
  const isVideo = media.type === "video";

  // Tools: "none" | "crop" | "draw" | "text"
  const [activeTool, setActiveTool] = useState<"none" | "crop" | "draw" | "text">("none");
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270

  // Drawing state
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[1]);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawStroke | null>(null);

  // Snapchat-style Text Overlay state
  const [textOverlays, setTextOverlays] = useState<SnapchatTextOverlay[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textStyle, setTextStyle] = useState<"classic" | "bold">("classic");
  const [isEditingText, setIsEditingText] = useState(false);
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null);

  // Crop state
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0, y: 0, w: 1, h: 1 });
  const [cropRatio, setCropRatio] = useState<"free" | "1:1" | "4:5" | "16:9">("free");
  const [cropHistory, setCropHistory] = useState<string[]>([]);
  const [cropDragMode, setCropDragMode] = useState<"box" | "tl" | "tr" | "bl" | "br" | null>(null);
  const cropStartPos = useRef<{ clientX: number; clientY: number; initialBox: CropBox }>({
    clientX: 0,
    clientY: 0,
    initialBox: { x: 0, y: 0, w: 1, h: 1 },
  });

  // Confirmation dialog
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Redraw canvas whenever rotation, strokes, or active drawing changes
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageObjRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isRotated90or270 = rotation % 180 !== 0;
    const targetW = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
    const targetH = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

    canvas.width = targetW;
    canvas.height = targetH;

    ctx.clearRect(0, 0, targetW, targetH);

    // Save and transform for rotation
    ctx.save();
    ctx.translate(targetW / 2, targetH / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const drawW = img.naturalWidth;
    const drawH = img.naturalHeight;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Render drawings
    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 1) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = (stroke.size * targetW) / 500;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const p0 = stroke.points[0];
      ctx.moveTo(p0.x * targetW, p0.y * targetH);
      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        ctx.lineTo(pt.x * targetW, pt.y * targetH);
      }
      ctx.stroke();
    }

    // Render Snapchat text overlays onto canvas
    for (const overlay of textOverlays) {
      const fontSize = Math.max(22, Math.round(targetW * 0.054));
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const y = (overlay.yPercent / 100) * targetH;

      if (overlay.style === "classic") {
        // Iconic Snapchat dark horizontal banner spanning width
        ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
        ctx.fillRect(0, y - fontSize * 1.15, targetW, fontSize * 2.3);
      } else {
        // Badge style
        const textMetrics = ctx.measureText(overlay.text);
        const boxW = textMetrics.width + fontSize * 1.8;
        const boxH = fontSize * 2.1;
        ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(targetW / 2 - boxW / 2, y - boxH / 2, boxW, boxH, 14);
        } else {
          ctx.rect(targetW / 2 - boxW / 2, y - boxH / 2, boxW, boxH);
        }
        ctx.fill();
      }

      // Draw text
      ctx.fillStyle = overlay.color;
      ctx.fillText(overlay.text, targetW / 2, y);
    }
  }, [rotation, strokes, currentStroke, textOverlays]);

  // Load image object
  useEffect(() => {
    if (isVideo) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = media.url;
    img.onload = () => {
      imageObjRef.current = img;
      renderCanvas();
    };
  }, [media.url, isVideo, renderCanvas]);

  useEffect(() => {
    if (!isVideo) {
      renderCanvas();
    }
  }, [renderCanvas, isVideo]);

  // Handle pointer drawing
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool !== "draw") return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setCurrentStroke({
      color: drawColor,
      size: 6,
      points: [pt],
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool !== "draw" || !currentStroke) return;
    const pt = getCanvasPoint(e);
    if (!pt) return;
    setCurrentStroke((prev) => (prev ? { ...prev, points: [...prev.points, pt] } : null));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool !== "draw" || !currentStroke) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setStrokes((prev) => [...prev, currentStroke]);
    setCurrentStroke(null);
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // ===================== CROP FEATURE =====================
  const applyCropRatio = (ratio: "free" | "1:1" | "4:5" | "16:9") => {
    setCropRatio(ratio);
    if (ratio === "free") {
      setCropBox({ x: 0, y: 0, w: 1, h: 1 });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const aspect = canvas.width / canvas.height;

    let targetAspect = 1;
    if (ratio === "1:1") targetAspect = 1;
    if (ratio === "4:5") targetAspect = 4 / 5;
    if (ratio === "16:9") targetAspect = 16 / 9;

    let newW = 1;
    let newH = 1;

    if (aspect > targetAspect) {
      // Image is wider than target aspect
      newW = (canvas.height * targetAspect) / canvas.width;
      newH = 1;
    } else {
      // Image is taller than target aspect
      newW = 1;
      newH = (canvas.width / targetAspect) / canvas.height;
    }

    setCropBox({
      x: (1 - newW) / 2,
      y: (1 - newH) / 2,
      w: newW,
      h: newH,
    });
  };

  const handleCropPointerDown = (
    mode: "box" | "tl" | "tr" | "bl" | "br",
    e: React.PointerEvent
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setCropDragMode(mode);
    cropStartPos.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialBox: { ...cropBox },
    };
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    if (!cropDragMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - cropStartPos.current.clientX) / rect.width;
    const dy = (e.clientY - cropStartPos.current.clientY) / rect.height;
    const init = cropStartPos.current.initialBox;

    if (cropDragMode === "box") {
      const newX = Math.max(0, Math.min(1 - init.w, init.x + dx));
      const newY = Math.max(0, Math.min(1 - init.h, init.y + dy));
      setCropBox({ ...init, x: newX, y: newY });
    } else if (cropDragMode === "tl") {
      const newX = Math.max(0, Math.min(init.x + init.w - 0.15, init.x + dx));
      const newY = Math.max(0, Math.min(init.y + init.h - 0.15, init.y + dy));
      setCropBox({
        x: newX,
        y: newY,
        w: init.x + init.w - newX,
        h: init.y + init.h - newY,
      });
    } else if (cropDragMode === "tr") {
      const newW = Math.max(0.15, Math.min(1 - init.x, init.w + dx));
      const newY = Math.max(0, Math.min(init.y + init.h - 0.15, init.y + dy));
      setCropBox({
        x: init.x,
        y: newY,
        w: newW,
        h: init.y + init.h - newY,
      });
    } else if (cropDragMode === "bl") {
      const newX = Math.max(0, Math.min(init.x + init.w - 0.15, init.x + dx));
      const newH = Math.max(0.15, Math.min(1 - init.y, init.h + dy));
      setCropBox({
        x: newX,
        y: init.y,
        w: init.x + init.w - newX,
        h: newH,
      });
    } else if (cropDragMode === "br") {
      const newW = Math.max(0.15, Math.min(1 - init.x, init.w + dx));
      const newH = Math.max(0.15, Math.min(1 - init.y, init.h + dy));
      setCropBox({
        x: init.x,
        y: init.y,
        w: newW,
        h: newH,
      });
    }
  };

  const handleCropPointerUp = (e: React.PointerEvent) => {
    if (cropDragMode) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setCropDragMode(null);
    }
  };

  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cropW = Math.max(10, Math.round(canvas.width * cropBox.w));
    const cropH = Math.max(10, Math.round(canvas.height * cropBox.h));
    const cropX = Math.round(canvas.width * cropBox.x);
    const cropY = Math.round(canvas.height * cropBox.y);

    const offCanvas = document.createElement("canvas");
    offCanvas.width = cropW;
    offCanvas.height = cropH;
    const offCtx = offCanvas.getContext("2d");
    if (!offCtx) return;

    // Draw current canvas cropped
    offCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const newUrl = offCanvas.toDataURL("image/jpeg", 0.95);
    const newImg = new Image();
    newImg.src = newUrl;
    newImg.onload = () => {
      if (imageObjRef.current) {
        setCropHistory((prev) => [...prev, imageObjRef.current!.src]);
      }
      imageObjRef.current = newImg;
      setRotation(0);
      setCropBox({ x: 0, y: 0, w: 1, h: 1 });
      setActiveTool("none");
      renderCanvas();
    };
  };

  const cancelCrop = () => {
    setCropBox({ x: 0, y: 0, w: 1, h: 1 });
    setActiveTool("none");
  };

  // ===================== SNAPCHAT TEXT OVERLAY =====================
  const openTextEditor = (existing?: SnapchatTextOverlay) => {
    if (existing) {
      setActiveTextId(existing.id);
      setTextInput(existing.text);
      setTextColor(existing.color);
      setTextStyle(existing.style);
    } else {
      setActiveTextId(null);
      setTextInput("");
      setTextColor("#FFFFFF");
      setTextStyle("classic");
    }
    setIsEditingText(true);
  };

  const confirmTextOverlay = () => {
    const trimmed = textInput.trim();
    if (trimmed) {
      if (activeTextId) {
        setTextOverlays((prev) =>
          prev.map((t) =>
            t.id === activeTextId
              ? { ...t, text: trimmed, color: textColor, style: textStyle }
              : t
          )
        );
      } else {
        setTextOverlays((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            text: trimmed,
            color: textColor,
            yPercent: 48 + prev.length * 10,
            style: textStyle,
          },
        ]);
      }
    } else if (activeTextId) {
      setTextOverlays((prev) => prev.filter((t) => t.id !== activeTextId));
    }
    setIsEditingText(false);
    setTextInput("");
    setActiveTextId(null);
    setActiveTool("none");
  };

  // Drag text overlay up and down (Snapchat style)
  const handleTextDragMove = (e: React.PointerEvent) => {
    if (!draggedTextId || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const newYPercent = Math.max(10, Math.min(88, ((e.clientY - rect.top) / rect.height) * 100));
    setTextOverlays((prev) =>
      prev.map((t) => (t.id === draggedTextId ? { ...t, yPercent: newYPercent } : t))
    );
  };

  // Check if any edits made
  const hasEdits =
    rotation !== 0 ||
    strokes.length > 0 ||
    textOverlays.length > 0 ||
    cropHistory.length > 0 ||
    caption.trim().length > 0;

  const handleAttemptClose = () => {
    if (hasEdits) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  // Export and send
  const handleSendAction = () => {
    if (isVideo) {
      onSend(media.file, "video", caption.trim() || undefined);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      onSend(media.file, "image", caption.trim() || undefined);
      return;
    }

    try {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            onSend(blob, "image", caption.trim() || undefined);
          } else {
            onSend(media.file, "image", caption.trim() || undefined);
          }
        },
        "image/jpeg",
        0.92
      );
    } catch (err) {
      console.warn("Canvas export error, falling back to original media file:", err);
      onSend(media.file, "image", caption.trim() || undefined);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black flex flex-col font-sans select-none animate-in fade-in duration-200"
      onPointerMove={(e) => {
        if (cropDragMode) handleCropPointerMove(e);
        if (draggedTextId) handleTextDragMove(e);
      }}
      onPointerUp={(e) => {
        if (cropDragMode) handleCropPointerUp(e);
        if (draggedTextId) setDraggedTextId(null);
      }}
    >
      {/* Top Navigation & Tool Header - Dropped down to comfortably clear status bar & notch */}
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top,0px),3.75rem)] pb-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent z-30">
        <button
          onClick={handleAttemptClose}
          className="flex items-center justify-center w-10 h-10 rounded-full text-white/90 hover:text-white active:scale-95 transition-all bg-black/60 border border-white/10 shadow-lg backdrop-blur-md shrink-0"
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {!isVideo && (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/60 backdrop-blur-xl px-3 py-1 rounded-full border border-white/10 shadow-xl">
            {/* Crop Button */}
            <button
              onClick={() => {
                if (activeTool === "crop") {
                  setActiveTool("none");
                } else {
                  setActiveTool("crop");
                  setCropBox({ x: 0, y: 0, w: 1, h: 1 });
                }
              }}
              className={`p-2 rounded-full transition-colors ${
                activeTool === "crop"
                  ? "bg-[var(--wine)] text-white shadow"
                  : "text-white/80 hover:text-white"
              }`}
              title="Crop image"
            >
              <Crop className="w-4 h-4" />
            </button>

            {/* Rotate Button */}
            <button
              onClick={handleRotate}
              className="p-2 rounded-full text-white/80 hover:text-white active:scale-95 transition-transform"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Draw Button */}
            <button
              onClick={() => setActiveTool(activeTool === "draw" ? "none" : "draw")}
              className={`p-2 rounded-full transition-colors ${
                activeTool === "draw"
                  ? "bg-[var(--wine)] text-white shadow"
                  : "text-white/80 hover:text-white"
              }`}
              title="Draw / Doodle"
            >
              <PenTool className="w-4 h-4" />
            </button>

            {/* Snapchat Text Button */}
            <button
              onClick={() => openTextEditor()}
              className="p-2 rounded-full text-white/80 hover:text-white active:scale-95 transition-colors"
              title="Add Snapchat-style text"
            >
              <Type className="w-4 h-4" />
            </button>

            {/* Undo Button */}
            {(strokes.length > 0 || textOverlays.length > 0 || cropHistory.length > 0) && (
              <button
                onClick={() => {
                  if (strokes.length > 0) {
                    setStrokes((prev) => prev.slice(0, -1));
                  } else if (textOverlays.length > 0) {
                    setTextOverlays((prev) => prev.slice(0, -1));
                  } else if (cropHistory.length > 0) {
                    const prevUrl = cropHistory[cropHistory.length - 1];
                    setCropHistory((prev) => prev.slice(0, -1));
                    const img = new Image();
                    img.src = prevUrl;
                    img.onload = () => {
                      imageObjRef.current = img;
                      renderCanvas();
                    };
                  }
                }}
                className="p-2 rounded-full text-white/80 hover:text-white active:scale-95 transition-transform"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        <button
          onClick={handleAttemptClose}
          className="flex items-center justify-center w-10 h-10 rounded-full text-white/90 hover:text-white active:scale-95 transition-all bg-black/60 border border-white/10 shadow-lg backdrop-blur-md shrink-0"
          aria-label="Cancel"
          title="Cancel / Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Interactive Crop Sub-bar */}
      {activeTool === "crop" && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-black/75 backdrop-blur-xl z-20 border-b border-white/10 animate-in slide-in-from-top-2">
          {/* Preset Ratios */}
          <div className="flex items-center gap-1.5">
            {(["free", "1:1", "4:5", "16:9"] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => applyCropRatio(ratio)}
                className={`px-3 py-1 rounded-full text-[11.5px] font-semibold uppercase transition-all ${
                  cropRatio === ratio
                    ? "bg-white text-black shadow-md scale-105"
                    : "bg-white/10 text-white/70 hover:text-white"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {/* Crop Action Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={cancelCrop}
              className="p-1.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              title="Cancel crop"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={applyCrop}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--wine)] text-white text-[12px] font-semibold shadow-md active:scale-95 transition-all"
              title="Apply crop"
            >
              <Check className="w-4 h-4" />
              <span>Apply</span>
            </button>
          </div>
        </div>
      )}

      {/* Drawing Color Sub-bar */}
      {activeTool === "draw" && (
        <div className="flex items-center justify-between px-4 py-2 bg-black/70 backdrop-blur-xl z-20 border-b border-white/10 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            {DRAW_COLORS.map((col) => (
              <button
                key={col}
                onClick={() => setDrawColor(col)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  drawColor === col ? "scale-125 border-white shadow-lg" : "border-transparent"
                }`}
                style={{ backgroundColor: col }}
              />
            ))}
          </div>
          {strokes.length > 0 && (
            <button
              onClick={() => setStrokes([])}
              className="flex items-center gap-1 text-[12px] text-white/60 hover:text-red-400 px-2 py-1 rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Main Preview Viewport */}
      <div
        ref={viewportRef}
        className="flex-1 flex items-center justify-center p-3 relative min-h-0 overflow-hidden"
      >
        {isVideo ? (
          <video
            src={media.url}
            controls
            playsInline
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
          />
        ) : (
          <div className="relative max-h-full max-w-full flex items-center justify-center">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`max-h-[66vh] sm:max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl ${
                activeTool === "draw" ? "cursor-crosshair touch-none" : "cursor-default"
              }`}
            />

            {/* Interactive Crop Overlay with Handles */}
            {activeTool === "crop" && canvasRef.current && (
              <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                {/* Dark Shaded Regions Outside Crop Box */}
                <div
                  className="absolute left-0 top-0 right-0 bg-black/60 pointer-events-none"
                  style={{ height: `${cropBox.y * 100}%` }}
                />
                <div
                  className="absolute left-0 bottom-0 right-0 bg-black/60 pointer-events-none"
                  style={{ height: `${(1 - (cropBox.y + cropBox.h)) * 100}%` }}
                />
                <div
                  className="absolute left-0 bg-black/60 pointer-events-none"
                  style={{
                    top: `${cropBox.y * 100}%`,
                    height: `${cropBox.h * 100}%`,
                    width: `${cropBox.x * 100}%`,
                  }}
                />
                <div
                  className="absolute right-0 bg-black/60 pointer-events-none"
                  style={{
                    top: `${cropBox.y * 100}%`,
                    height: `${cropBox.h * 100}%`,
                    width: `${(1 - (cropBox.x + cropBox.w)) * 100}%`,
                  }}
                />

                {/* The Crop Bounding Box */}
                <div
                  style={{
                    left: `${cropBox.x * 100}%`,
                    top: `${cropBox.y * 100}%`,
                    width: `${cropBox.w * 100}%`,
                    height: `${cropBox.h * 100}%`,
                  }}
                  onPointerDown={(e) => handleCropPointerDown("box", e)}
                  className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move pointer-events-auto touch-none"
                >
                  {/* Rule-of-Thirds Grid Lines */}
                  <div className="absolute left-1/3 inset-y-0 w-px border-l border-white/35 pointer-events-none" />
                  <div className="absolute left-2/3 inset-y-0 w-px border-l border-white/35 pointer-events-none" />
                  <div className="absolute top-1/3 inset-x-0 h-px border-t border-white/35 pointer-events-none" />
                  <div className="absolute top-2/3 inset-x-0 h-px border-t border-white/35 pointer-events-none" />

                  {/* Corner Handles */}
                  <div
                    onPointerDown={(e) => handleCropPointerDown("tl", e)}
                    className="absolute -top-3 -left-3 w-6 h-6 bg-white border-2 border-black rounded-full shadow-lg cursor-nwse-resize z-20"
                  />
                  <div
                    onPointerDown={(e) => handleCropPointerDown("tr", e)}
                    className="absolute -top-3 -right-3 w-6 h-6 bg-white border-2 border-black rounded-full shadow-lg cursor-nesw-resize z-20"
                  />
                  <div
                    onPointerDown={(e) => handleCropPointerDown("bl", e)}
                    className="absolute -bottom-3 -left-3 w-6 h-6 bg-white border-2 border-black rounded-full shadow-lg cursor-nesw-resize z-20"
                  />
                  <div
                    onPointerDown={(e) => handleCropPointerDown("br", e)}
                    className="absolute -bottom-3 -right-3 w-6 h-6 bg-white border-2 border-black rounded-full shadow-lg cursor-nwse-resize z-20"
                  />
                </div>
              </div>
            )}

            {/* Snapchat Text Overlays Display & Dragging */}
            {activeTool !== "crop" &&
              textOverlays.map((overlay) => (
                <div
                  key={overlay.id}
                  style={{ top: `${overlay.yPercent}%` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    setDraggedTextId(overlay.id);
                  }}
                  className="absolute inset-x-0 -translate-y-1/2 flex items-center justify-center cursor-grab active:cursor-grabbing select-none group z-20 touch-none"
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      openTextEditor(overlay);
                    }}
                    className={`max-w-full px-4 py-2 transition-transform active:scale-95 ${
                      overlay.style === "classic"
                        ? "w-full bg-black/60 backdrop-blur-sm text-center"
                        : "bg-black/80 rounded-2xl border border-white/20 px-6 py-2 text-center shadow-xl"
                    }`}
                  >
                    <span
                      className="font-bold text-[17px] sm:text-[19px] drop-shadow-md tracking-wide break-words"
                      style={{ color: overlay.color }}
                    >
                      {overlay.text}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTextOverlays((prev) => prev.filter((t) => t.id !== overlay.id));
                    }}
                    className="absolute right-3 p-1 rounded-full bg-black/60 text-white/70 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete text"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Bottom Composer Dock */}
      <div className="px-3 sm:px-4 pt-3 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] bg-gradient-to-t from-black via-black/90 to-transparent z-30">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          {/* Caption Input Field */}
          <div className="flex-1 flex items-center bg-[#18181A]/90 backdrop-blur-2xl border border-white/10 rounded-full px-4 py-2 shadow-xl focus-within:border-white/25 transition-colors">
            <input
              type="text"
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSendAction();
                }
              }}
              placeholder="Add a caption..."
              className="w-full bg-transparent text-[15px] text-white placeholder:text-white/40 outline-none"
            />
          </div>

          {/* Send Button - Signature Red/Wine Shade */}
          <button
            onClick={handleSendAction}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--wine)] hover:brightness-110 active:scale-95 text-white shadow-xl transition-all"
            aria-label="Send media"
          >
            <Send className="h-5 w-5 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Snapchat-Style Text Overlay Composer */}
      <AnimatePresence>
        {isEditingText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-md flex flex-col justify-between p-4"
            onClick={confirmTextOverlay}
          >
            {/* Top Toolbar */}
            <div className="flex items-center justify-between w-full pt-[max(env(safe-area-inset-top,0px),3.75rem)] px-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setTextStyle((prev) => (prev === "classic" ? "bold" : "classic"))}
                className="px-3.5 py-1.5 rounded-full bg-white/15 text-white text-[12.5px] font-semibold tracking-wide border border-white/10"
              >
                Style: {textStyle === "classic" ? "Classic Banner" : "Badge"}
              </button>

              <button
                onClick={confirmTextOverlay}
                className="px-5 py-1.5 rounded-full bg-[var(--wine)] text-white text-[13.5px] font-semibold hover:brightness-110 active:scale-95 shadow-lg"
              >
                Done
              </button>
            </div>

            {/* Snapchat Center Banner Input */}
            <div
              className="w-full my-auto flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`w-full ${
                  textStyle === "classic"
                    ? "bg-black/60 backdrop-blur-md py-4 px-4"
                    : "max-w-xs bg-black/80 rounded-2xl border border-white/20 py-3 px-6 shadow-2xl"
                } flex items-center justify-center`}
              >
                <input
                  type="text"
                  autoFocus
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      confirmTextOverlay();
                    }
                  }}
                  placeholder="Tap to type..."
                  className="w-full bg-transparent text-center font-bold text-[22px] sm:text-[24px] outline-none placeholder:text-white/30"
                  style={{ color: textColor }}
                />
              </div>
            </div>

            {/* Color Palette Dots */}
            <div
              className="flex items-center justify-center gap-3 pb-[max(env(safe-area-inset-bottom,0px),2.5rem)]"
              onClick={(e) => e.stopPropagation()}
            >
              {DRAW_COLORS.map((col) => (
                <button
                  key={col}
                  onClick={() => setTextColor(col)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    textColor === col ? "scale-125 border-white shadow-xl" : "border-transparent"
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discard Confirmation Dialog */}
      <AnimatePresence>
        {showDiscardConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-xs bg-[#18181A] border border-white/10 rounded-2xl p-5 shadow-2xl text-center"
            >
              <h3 className="text-white text-[17px] font-bold mb-1">Discard edits?</h3>
              <p className="text-white/60 text-[13px] mb-5">
                If you leave now, any crops, drawings, text overlays, and caption will be lost.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    onClose();
                  }}
                  className="w-full py-2.5 rounded-xl bg-[var(--wine)] text-white text-[14px] font-semibold hover:brightness-110 active:scale-95"
                >
                  Discard
                </button>
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="w-full py-2.5 rounded-xl bg-white/10 text-white text-[14px] font-medium hover:bg-white/15"
                >
                  Keep editing
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
