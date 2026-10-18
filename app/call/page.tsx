"use client";

// ============================================================
//  Just Us — Call screen
//
//  A thin UI bound to the module-level call engine
//  (lib/callEngine.ts). The engine owns media, signaling, timers
//  and the call log; this page only renders state, attaches
//  media elements by ref (no streams flow through React state)
//  and forwards user intent.
//
//  Leaving this screen while connected MINIMIZES the call (the
//  engine is route-independent) — the chat page shows a
//  "return to call" pill. Leaving while ringing cancels; leaving
//  while an incoming ring is up declines, exactly like a phone.
// ============================================================

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  PictureInPicture2,
  SignalHigh,
  SignalLow,
  SignalMedium,
  ChevronLeft,
  PhoneIncoming,
  PhoneMissed,
  PhoneCall,
} from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { callEngine, type CallEngineSnapshot } from "@/lib/callEngine";
import type { CallState } from "@/lib/callStates";
import Avatar from "@/components/Avatar";
import MotionProvider from "@/components/MotionProvider";

// ─── Per-second timer, isolated so the page never re-renders for it ──────────

function CallTimer() {
  const [sec, setSec] = useState(() => callEngine.getElapsed());
  useEffect(() => {
    setSec(callEngine.getElapsed());
    return callEngine.subscribeElapsed(() => setSec(callEngine.getElapsed()));
  }, []);
  if (callEngine.getSnapshot().state !== "connected") return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return (
    <span aria-hidden="true">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

// ─── Quality pill (always labeled — never color alone) ───────────────────────

function QualityPill({ quality }: { quality: CallEngineSnapshot["quality"] }) {
  if (quality === "unknown") return null;
  const map = {
    good: { Icon: SignalHigh, label: "Good signal", cls: "bg-[#31473A]/80 text-[#9FE3B4]" },
    fair: { Icon: SignalMedium, label: "Fair signal", cls: "bg-[#4A3F13]/80 text-[#F5C842]" },
    poor: { Icon: SignalLow, label: "Poor signal", cls: "bg-[#4A2213]/80 text-[#F5A742]" },
  } as const;
  const { Icon, label, cls } = map[quality];
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {label}
    </span>
  );
}

// ─── Small building blocks ────────────────────────────────────────────────────

function RoundButton({
  onClick, label, pressed, className = "", children, disabled,
}: {
  onClick: () => void;
  label: string;
  pressed?: boolean;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      title={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Inner screen (needs useSearchParams inside Suspense) ────────────────────

function CallScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const paramType = params.get("type") === "video" ? ("video" as const) : params.get("type") === "voice" ? ("voice" as const) : null;

  const sa = useSyncExternalStore(callEngine.subscribe, callEngine.getSnapshot, callEngine.getSnapshot);

  // ── Partner identity (set from trusted localStorage cached profile) ──
  const partnerName    = typeof window !== "undefined" ? localStorage.getItem("partner_name")   ?? "Partner" : "Partner";
  const partnerColor   = typeof window !== "undefined" ? localStorage.getItem("partner_color")  ?? "var(--wine)" : "var(--wine)";
  const partnerAvatar  = typeof window !== "undefined" ? localStorage.getItem("partner_avatar") : null;
  const partnerInitial = partnerName[0]?.toUpperCase() ?? "?";

  // Engine identity comes from the session that AuthGate already validated.
  useEffect(() => {
    try {
      callEngine.setIdentity(
        localStorage.getItem("user_id") ?? "",
        localStorage.getItem("partner_id") ?? "",
      );
    } catch {}
  }, []);

  // ── Lifecycle: start when idle + route param; drop dead sessions on unmount ──
  const startTriedRef = useRef(false);
  useEffect(() => {
    if (sa.state === "idle" && !startTriedRef.current) {
      startTriedRef.current = true;
      if (paramType) void callEngine.startCall(paramType);
      else router.replace("/chat"); // nothing to return to
      return;
    }
    // An idle engine on this page after a settled call → return home once.
    if (sa.state === "idle" && startTriedRef.current) {
      router.replace("/chat");
    }
  }, [sa.state, paramType, router]);

  // Pause nonessential animation while hidden (battery friendly), paint-only.
  const [pageHidden, setPageHidden] = useState(false);
  useEffect(() => {
    const h = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  // Leaving this screen: minimize when live, cancel/decline when only ringing.
  useEffect(() => {
    return () => {
      callEngine.detachAllElements();
      const snap = callEngine.getSnapshot();
      if (snap.state === "initiating" || snap.state === "ringing") callEngine.cancelOutgoing();
      if (snap.state === "incoming") callEngine.declineIncoming();
      // accepting / connecting / connected / reconnecting keep running real calls.
    };
  }, []);

  // Closing the whole tab must still hang up on the partner (best effort).
  useEffect(() => {
    const onPageHide = () => {
      const snap = callEngine.getSnapshot();
      if (snap.callActive && snap.state !== "incoming") callEngine.hangUp();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  // ── Draggable local preview (percent-anchored, no fixed pixels) ──
  const stageRef   = useRef<HTMLDivElement>(null);
  const pipRef     = useRef<HTMLDivElement>(null);
  const pipPos     = useRef<{ left: number; top: number } | null>(null); // committed %
  const dragOrigin = useRef<{ px: number; py: number; left: number; top: number } | null>(null);
  const [pipDragging, setPipDragging] = useState(false);

  const defaultPipStyle: React.CSSProperties = { left: "auto", right: 16, top: "auto", bottom: 116 };
  const placedPipStyle = (p: { left: number; top: number }): React.CSSProperties => ({
    left: `${p.left}%`, top: `${p.top}%`, right: "auto", bottom: "auto",
  });

  const onPipDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current, pip = pipRef.current;
    if (!stage || !pip) return;
    const rect = pip.getBoundingClientRect();
    const base = pipPos.current ?? {
      left: ((rect.left + rect.width / 2) - stage.getBoundingClientRect().left) / stage.clientWidth * 100,
      top:  ((rect.top + rect.height / 2) - stage.getBoundingClientRect().top) / stage.clientHeight * 100,
    };
    dragOrigin.current = { px: e.clientX, py: e.clientY, left: base.left, top: base.top };
    pip.setPointerCapture(e.pointerId);
    setPipDragging(true);
  };
  const onPipMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current, pip = pipRef.current, o = dragOrigin.current;
    if (!stage || !pip || !o) return;
    const dx = e.clientX - o.px, dy = e.clientY - o.py;
    const nextLeft = Math.min(88, Math.max(12, o.left + (dx / stage.clientWidth) * 100));
    const nextTop  = Math.min(86, Math.max(6,  o.top  + (dy / stage.clientHeight) * 100));
    pip.style.left = `${nextLeft}%`;
    pip.style.top = `${nextTop}%`;
    pip.style.right = "auto";
    pip.style.bottom = "auto";
    pip.style.transform = "translate(-50%, -50%)";
  };
  const onPipUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const pip = pipRef.current, o = dragOrigin.current;
    dragOrigin.current = null;
    setPipDragging(false);
    if (!pip || !o) return;
    const rect = pip.getBoundingClientRect();
    const stage = stageRef.current;
    if (!stage) return;
    pipPos.current = {
      left: ((rect.left + rect.width / 2) - stage.getBoundingClientRect().left) / stage.clientWidth * 100,
      top:  ((rect.top + rect.height / 2) - stage.getBoundingClientRect().top) / stage.clientHeight * 100,
    };
    pip.style.transform = "translate(-50%, -50%)";
  };

  // ── Audio output routing — only where the browser actually supports it ──
  const sinkSupported = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
  const [audioRouteOpen, setAudioRouteOpen] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [currentSink, setCurrentSink] = useState<string>("");
  const [sinkMessage, setSinkMessage] = useState<string | null>(null);

  const openAudioRoute = useCallback(async () => {
    if (!sinkSupported) {
      setSinkMessage("Audio output selection isn't available in this browser.");
      return;
    }
    setAudioRouteOpen((v) => !v);
    if (!audioRouteOpen) setAudioOutputs(await callEngine.listAudioOutputs());
  }, [sinkSupported, audioRouteOpen]);

  const pickAudioOutput = async (id: string) => {
    const ok = await callEngine.setAudioOutput(id);
    if (ok) { setCurrentSink(id); setSinkMessage(null); }
    else setSinkMessage("This device refused the output switch. Try the browser's own audio controls.");
  };

  const [pipNote, setPipNote] = useState<string | null>(null);
  const requestPip = useCallback(async () => {
    const res = await callEngine.requestPictureInPicture();
    if (!res.ok && res.reason === "unsupported") {
      setPipNote("Picture-in-Picture isn't supported in this browser.");
    } else if (!res.ok) {
      setPipNote("Picture-in-Picture couldn't start right now.");
    }
  }, []);

  // ── State shortcuts ──
  const state: CallState = sa.state;
  const isActivePhase = state === "connected" || state === "reconnecting";
  const isOutgoingWait = state === "initiating" || state === "ringing";
  const isIncoming = state === "incoming";
  const isHandshake = state === "accepting" || state === "connecting";
  const isTerminal = state === "ended" || state === "declined" || state === "busy" || state === "failed";
  const isFailed = state === "failed";

  const showVideo = sa.callType === "video";
  const showRemoteMedia = (isActivePhase || isHandshake) && sa.remoteMediaAvailable;

  // Visual status (not announced each second — the sr-only line below carries
  // meaningful state changes only).
  const statusLabel =
    isTerminal
      ? (sa.error?.message ??
        { ended: "Call ended", declined: "Call declined", busy: "Partner was busy", failed: "Call failed" }[state])
      : state === "reconnecting"
      ? "Reconnecting…"
      : state === "ringing"
      ? "Ringing…"
      : state === "incoming"
      ? `${partnerName} is calling`
      : isHandshake
      ? "Connecting…"
      : isActivePhase
      ? "Connected"
      : "Starting…";

  // Screen-reader announcements on state changes only (never on timer ticks).
  const announcement =
    state === "connected" ? "Call connected."
      : state === "reconnecting" ? "Connection unstable. Reconnecting."
      : state === "failed" ? `Call failed. ${sa.error?.message ?? ""}`
      : state === "ended" ? "Call ended."
      : state === "declined" ? "Call declined."
      : state === "busy" ? "Your partner was busy."
      : state === "ringing" ? "Ringing your partner."
      : state === "incoming" ? `${partnerName} is calling you.`
      : "";

  const endOrCancel = () => {
    if (state === "incoming") callEngine.declineIncoming();
    else if (isOutgoingWait) callEngine.cancelOutgoing();
    else callEngine.hangUp();
  };

  const retry = () => {
    const t = paramType ?? sa.callType;
    void callEngine.startCall(t);
  };

  return (
    <m.main
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="shell-h relative mx-auto flex w-full max-w-md flex-col overflow-hidden font-sans"
      style={{ backgroundColor: "#0F0D0B" }}
    >
      {/* Remote audio lives in every phase where media may flow */}
      {!showVideo && <audio ref={callEngine.attachRemoteAudio} autoPlay style={{ display: "none" }} />}

      {/* ── Stage ─────────────────────────────────────────────────────── */}
      <div ref={stageRef} className="relative flex-1 overflow-hidden">
        {/* Remote video fills the stage in video calls */}
        {showVideo && (
          <video
            ref={callEngine.attachRemoteVideo}
            autoPlay
            playsInline
            className={`absolute inset-0 h-full w-full bg-black object-cover transition-opacity duration-700 ${
              showRemoteMedia ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Scrim keeps the header readable over video */}
        {showVideo && showRemoteMedia && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />
        )}

        {/* ── Inner overlay column ─────────────────────────────────── */}
        <div className="relative z-10 flex h-full flex-col">
          {/* Top row: back/minimize, identity, quality */}
          <div className="flex items-start justify-between gap-2 px-3 pt-[max(env(safe-area-inset-top,0px),0.75rem)]">
            <button
              type="button"
              onClick={() => (isActivePhase ? router.push("/chat") : endOrCancel())}
              aria-label={isActivePhase ? "Minimize call and return to chat" : "Back — call is cancelled"}
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/30 text-[var(--cream)] backdrop-blur-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            </button>

            <div className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex items-center gap-2">
                <p className="truncate text-[15px] font-medium text-[var(--cream)]">{partnerName}</p>
                {/* Remote-mute / camera-off badges — always labeled */}
                {sa.remoteMuted && (isActivePhase || isHandshake) && (
                  <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[var(--cream)]">
                    <MicOff className="h-3 w-3" /> muted
                  </span>
                )}
                {sa.remoteCameraOff && showVideo && isActivePhase && (
                  <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[var(--cream)]">
                    <VideoOff className="h-3 w-3" /> camera off
                  </span>
                )}
              </div>
              <p
                aria-hidden="true"
                className={`text-[12px] ${state === "reconnecting" ? "animate-pulse text-[var(--gold)]" : "text-[var(--muted)]"}`}
              >
                {statusLabel} {isActivePhase && <CallTimer />}
              </p>
              <p role="status" className="sr-only">{announcement}</p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <QualityPill quality={sa.quality} />
              {showVideo && isActivePhase && (
                <button
                  type="button"
                  onClick={requestPip}
                  aria-label="Picture-in-Picture"
                  title="Picture-in-Picture"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-[var(--cream)] backdrop-blur-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                >
                  <PictureInPicture2 className="h-[18px] w-[18px]" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          {/* Center: identity / avatar for voice & waiting phases */}
          {(sa.callType === "voice" || !showRemoteMedia || isIncoming || isOutgoingWait) && (
            <div className="flex flex-1 items-center justify-center">
              <div className="relative flex items-center justify-center">
                {/* Pulse rings only while ringing — no decorative animation while connected */}
                {isOutgoingWait && !pageHidden && (
                  <>
                    <span
                      className="absolute h-40 w-40 animate-ping rounded-full opacity-[0.12]"
                      style={{ backgroundColor: partnerColor }}
                    />
                    <span
                      className="absolute h-28 w-28 animate-ping rounded-full opacity-[0.18]"
                      style={{ backgroundColor: partnerColor, animationDelay: "0.35s" }}
                    />
                  </>
                )}
                {/* Fade the rings when connected — voice calls stay calm */}
                <Avatar
                  initial={partnerInitial}
                  color={partnerColor}
                  size={isIncoming ? 108 : 96}
                  imageUrl={partnerAvatar}
                />
              </div>
            </div>
          )}

          {/* Incoming-call action block (also shown when /call is opened manually) */}
          {isIncoming && (
            <div className="flex flex-col items-center gap-4 pb-6">
              <p className="flex items-center gap-2 text-[13px] text-[var(--muted)]">
                <PhoneIncoming className="h-4 w-4" />
                {sa.callType === "video" ? "Video" : "Voice"} call
              </p>
              <div className="flex items-center gap-14">
                <RoundButton
                  onClick={() => callEngine.declineIncoming()}
                  label="Decline"
                  className="bg-[#7E1A21] text-[var(--cream)]"
                >
                  <PhoneOff className="h-6 w-6" strokeWidth={2} />
                </RoundButton>
                <RoundButton
                  onClick={() => void callEngine.acceptIncoming()}
                  label="Accept"
                  className="bg-[#4C7A5B] text-white"
                >
                  <PhoneIncoming className="h-6 w-6" strokeWidth={2} />
                </RoundButton>
              </div>
            </div>
          )}

          {/* Handshake hint while connecting without media yet */}
          {isHandshake && !sa.remoteMediaAvailable && (
            <div className="pb-8 text-center text-[12px] text-[var(--muted)]">
              Setting up the secure line…
            </div>
          )}
        </div>

        {/* ── Local draggable preview (video only, hardware on) ────────── */}
        {showVideo && sa.cameraOn && !isIncoming && (
          <div
            ref={pipRef}
            onPointerDown={onPipDown}
            onPointerMove={onPipMove}
            onPointerUp={onPipUp}
            onPointerCancel={onPipUp}
            style={{ ...defaultPipStyle, touchAction: "none" }}
            className={`absolute z-20 h-36 w-[92px] overflow-hidden rounded-[12px] border border-white/20 bg-black shadow-lg ${
              pipDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <video
              ref={callEngine.attachLocalVideo}
              autoPlay
              muted
              playsInline
              className="pointer-events-none h-full w-full object-cover"
              style={{ transform: sa.facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          </div>
        )}
        {showVideo && !sa.cameraOn && !isIncoming && (
          <div className="absolute left-4 bottom-[calc(env(safe-area-inset-bottom,0px)+9.5rem)] z-20 rounded-full bg-black/45 px-3 py-1.5 text-[11px] text-[var(--cream)] backdrop-blur-sm">
            Your camera is off
          </div>
        )}
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      {!isIncoming && !isTerminal && (
        <div className="flex items-center justify-center gap-4 py-4 pb-[max(env(safe-area-inset-bottom,0px),1.25rem)]">
          <RoundButton
            onClick={() => callEngine.toggleMute()}
            pressed={sa.muted}
            label={sa.muted ? "Unmute microphone" : "Mute microphone"}
            className={`text-[var(--cream)] ${sa.muted ? "bg-[#7E1A21]" : "bg-white/10 active:bg-white/20"}`}
          >
            {sa.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </RoundButton>

          {/* Camera pair */}
          {showVideo ? (
            <>
              <RoundButton
                onClick={() => void callEngine.toggleCamera()}
                pressed={!sa.cameraOn}
                label={sa.cameraOn ? "Turn camera off" : "Turn camera on"}
                className={`text-[var(--cream)] ${sa.cameraOn ? "bg-white/10 active:bg-white/20" : "bg-[#7E1A21]"}`}
              >
                {sa.cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </RoundButton>

              <RoundButton
                onClick={() => { endOrCancel(); }}
                pressed={false}
                label={isActivePhase ? "End call" : "Cancel call"}
                className="h-14 w-24 bg-[var(--wine)] text-[var(--cream)] active:opacity-80"
              >
                <PhoneOff className="h-5 w-5" />
              </RoundButton>

              <RoundButton
                onClick={() => void callEngine.flipCamera()}
                label="Flip camera"
                disabled={!sa.cameraOn}
                className="bg-white/10 text-[var(--cream)] active:bg-white/20"
              >
                <RotateCcw className="h-5 w-5" />
              </RoundButton>
            </>
          ) : (
            /* Voice pair: enable video + speaker/route where actually supported */
            <>
              <RoundButton
                onClick={() => void callEngine.enableVideoFromVoice()}
                label="Turn camera on"
                className="bg-white/10 text-[var(--cream)] active:bg-white/20"
              >
                <VideoOff className="h-5 w-5" />
              </RoundButton>

              <RoundButton
                onClick={() => { endOrCancel(); }}
                pressed={false}
                label={isActivePhase ? "End call" : "Cancel call"}
                className="h-14 w-24 bg-[var(--wine)] text-[var(--cream)] active:opacity-80"
              >
                <PhoneOff className="h-5 w-5" />
              </RoundButton>

              <RoundButton
                onClick={() => void openAudioRoute()}
                pressed={audioRouteOpen}
                label="Audio output"
                className="bg-white/10 text-[var(--cream)] active:bg-white/20"
              >
                <Volume2 className="h-5 w-5" />
              </RoundButton>
            </>
          )}
        </div>
      )}

      {/* Audio-route sheet (honest: only on setSinkId-capable browsers) */}
      <AnimatePresence>
        {audioRouteOpen && (
          <m.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-end bg-black/60 p-4"
            onClick={() => setAudioRouteOpen(false)}
          >
            <m.div
              initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-[#18181A] p-4"
            >
              <p className="mb-3 text-[14px] font-semibold text-white">Audio output</p>
              {audioOutputs.length === 0 && (
                <p className="text-[13px] text-white/50">No separate speakers found. Your phone&apos;s speaker comes from the system.</p>
              )}
              <div className="flex flex-col gap-2">
                {audioOutputs.map((d) => (
                  <button
                    key={d.deviceId}
                    type="button"
                    onClick={() => pickAudioOutput(d.deviceId)}
                    aria-pressed={currentSink === d.deviceId}
                    className={`w-full rounded-xl px-4 py-3 text-left text-[14px] ${
                      currentSink === d.deviceId ? "bg-[var(--wine)] text-white" : "bg-white/5 text-white/80"
                    }`}
                  >
                    {d.label || "Speaker"}
                  </button>
                ))}
              </div>
              {sinkMessage && <p className="mt-3 text-[12px] text-[#F5C842]">{sinkMessage}</p>}
              <button
                type="button"
                onClick={() => setAudioRouteOpen(false)}
                className="mt-3 w-full rounded-xl bg-white/10 py-3 text-[14px] text-white/80 active:bg-white/15"
              >
                Close
              </button>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pipNote && (
          <m.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute left-1/2 top-[max(env(safe-area-inset-top,0px),3.5rem)] z-40 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-[12px] text-[var(--cream)] backdrop-blur-sm"
            onClick={() => setPipNote(null)}
          >
            {pipNote}
            <VolumeX className="ml-2 inline h-3.5 w-3.5" />
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Ended / failed screen ────────────────────────────────────────── */}
      <AnimatePresence>
        {isTerminal && (
          <m.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#0F0D0B]/97 px-8 text-center"
          >
            <div className="rounded-full bg-white/5 p-6 ring-1 ring-white/10">
              {state === "failed" ? (
                <PhoneMissed className="h-9 w-9 text-[var(--gold)]" strokeWidth={1.5} />
              ) : state === "declined" ? (
                <PhoneOff className="h-9 w-9 text-[var(--wine-l)]" strokeWidth={1.5} />
              ) : state === "busy" ? (
                <Phone className="h-9 w-9 text-[var(--muted)]" strokeWidth={1.5} />
              ) : (
                <PhoneCall className="h-9 w-9 text-[#4C7A5B]" strokeWidth={1.5} />
              )}
            </div>
            <p className="text-[17px] font-semibold text-[var(--cream)]">
              {state === "failed"
                ? "Call failed"
                : state === "declined"
                ? "Call declined"
                : state === "busy"
                ? "Busy"
                : "Call ended"}
            </p>
            <p className="max-w-[240px] text-[13px] text-[var(--muted)]" role="status">
              {sa.error?.message ?? statusLabel}
            </p>
            {isFailed && (
              <div className="mt-2 flex w-56 flex-col gap-3">
                {sa.isCaller && (
                  <button
                    type="button"
                    onClick={retry}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--wine)] font-medium text-white active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
                  >
                    <Phone className="h-[18px] w-[18px]" /> Call again
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.replace("/chat")}
                  className="flex h-12 w-full items-center justify-center rounded-full border border-white/15 font-medium text-[var(--cream)] active:bg-white/5"
                >
                  Back to chat
                </button>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.main>
  );
}

// ─── Page export (Suspense wraps useSearchParams, mirroring the old page) ────

export default function CallPage() {
  return (
    <MotionProvider>
      <Suspense
        fallback={<div className="shell-h font-sans" style={{ backgroundColor: "#0F0D0B" }} />}
      >
        <CallScreen />
      </Suspense>
    </MotionProvider>
  );
}
