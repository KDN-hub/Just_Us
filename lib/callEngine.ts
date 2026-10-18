// ============================================================
//  Just Us — Call engine (module-level singleton)
//
//  One instance owns the entire calling lifecycle so a call can
//  outlive the /call route (chat "return to call" pill + busy
//  detection), and so there is a single source of truth instead
//  of React state, sessionStorage and a peer connection racing
//  each other.
//
//  Signaling runs on a dedicated private Realtime broadcast
//  topic (`call-signal-<conversationId>-v2`) so call traffic and
//  chat traffic never share one channel lifecycle again. A
//  migration grants send/receive on that topic to the two
//  conversation members (supabase/migrations/011_*.sql).
//
//  Signaling correctness:
//   • every payload carries { callId, fromId } — stale or foreign
//     sessions are ignored;
//   • perfect negotiation (polite/impolite by ID comparison) makes
//     renegotiation legal in BOTH directions (voice→video from
//     either side) and resolves simultaneous outgoing calls: the
//     polite peer rolls back and answers the other side, so the
//     two calls merge instead of dead-locking;
//   • ICE candidates arriving before the remote description are
//     queued and drained; duplicate candidates are tolerated.
//
//  Resource lifecycle:
//   • camera-off releases the hardware (replaceTrack(null) keeps
//     the SDP stable, so switching back on needs no renegotiation);
//   • every timer is tracked in one registry, teardown is
//     idempotent, and the peer connection never leaks.
// ============================================================

import { supabase } from "@/lib/supabase";
import { canTransition, type CallState } from "@/lib/callStates";
import { generateUUID } from "@/hooks/useChatStore";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONVERSATION_ID = "c0000000-0000-0000-0000-000000000003";
export const CALL_SIGNAL_TOPIC = `call-signal-${CONVERSATION_ID}-v2`;

const RING_TIMEOUT_MS     = 45_000; // caller gives up → missed
const OFFER_RETRY_MS      = 3_000;  // re-send offer while ringing (callee may join late)
const RECONNECT_RETRY_MS  = 5_000;  // ICE-restart attempts while the link is down
const RECONNECT_GRACE_MS  = 20_000; // total time allowed to recover the link
const SIGNAL_BACKOFF_MS   = 1_000;  // signaling channel reconnect base delay
const SIGNAL_MAX_ATTEMPTS = 10;     // bounded; a dead link must not loop forever
const STATS_INTERVAL_MS   = 5_000;  // getStats cadence — well away from per-frame work
const AUTO_SETTLE_MS      = 1_800;  // terminal-state pause before returning to idle

// Video-sender bitrate ladder (bits/second). Only *sustained* bad samples
// move it — never a single noisy spike.
const VIDEO_BITRATE_FULL = 800_000;
const VIDEO_BITRATE_LOW  = 300_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CallType = "voice" | "video";

export type CallErrorKind =
  | "permission"   // mic/camera denied or blocked
  | "device"       // no usable device / device lost
  | "device-busy"  // hardware already in use by another app
  | "insecure"     // getUserMedia needs a secure context
  | "negotiation"  // SDP offer/answer failure
  | "ice"          // media could not find a path
  | "signaling"    // Realtime channel failed
  | "partner-busy" // we were declined because the partner was in a call
  | null;

export type CallQuality = "unknown" | "good" | "fair" | "poor";

export interface CallError {
  kind: CallErrorKind;
  message: string; // human-readable, no stack traces
}

export interface CallEngineSnapshot {
  state: CallState;
  /** Terminal phase of the most recent call, for the ended screen. */
  lastOutcome: CallState | null;
  callType: CallType;
  callId: string | null;
  error: CallError | null;
  muted: boolean;
  cameraOn: boolean;
  facingMode: "user" | "environment";
  quality: CallQuality;
  remoteMuted: boolean;
  remoteCameraOff: boolean;
  remoteMediaAvailable: boolean;
  /** True while a call session exists (any live or terminal phase). */
  callActive: boolean;
  /** True when this device is the caller of the session. */
  isCaller: boolean;
  /** True once at least one offer / restart offer has been broadcast. */
  sentOffer: boolean;
}

type SignalPayload = {
  callId?: unknown;
  fromId?: unknown;
  reason?: unknown;
  sdp?: unknown;
  candidate?: unknown;
  callType?: unknown;
};

interface TimerEntry { h: ReturnType<typeof setTimeout>; kind: "timeout" | "interval" }

function classifyMediaError(err: unknown): CallError {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
      return {
        kind: "permission",
        message:
          typeof window !== "undefined" && window.isSecureContext
            ? "Camera / microphone access was denied. Allow it in your browser settings and try again."
            : "Camera and microphone need a secure connection — open the app over HTTPS and try again.",
      };
    case "NotFoundError":
    case "OverconstrainedError":
      return { kind: "device", message: "No camera or microphone was found on this device." };
    case "NotReadableError":
      return { kind: "device-busy", message: "Your camera or microphone is being used by another app. Close it and try again." };
    case "AbortError":
      return { kind: "device", message: "Starting the camera took too long. Please try again." };
    default:
      return { kind: "device", message: "Couldn't access your camera or microphone." };
  }
}

function pcDescriptionToInit(desc: RTCSessionDescription | null): RTCSessionDescriptionInit | null {
  if (!desc) return null;
  return { type: desc.type, sdp: desc.sdp };
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Transceiver kind: `kind` is in the spec but missing from some TS 5.x DOM
    libs — fall back to the attached unaffected-by-negotiation track kinds. */
function txKind(tx: RTCRtpTransceiver): "audio" | "video" | "" {
  const withKind = tx as RTCRtpTransceiver & { kind?: string };
  if (withKind.kind === "audio" || withKind.kind === "video") return withKind.kind;
  const kind = tx.sender?.track?.kind ?? tx.receiver?.track?.kind;
  return kind === "audio" || kind === "video" ? kind : "";
}

type Listener = () => void;

type PendingOffer = {
  sdp: RTCSessionDescriptionInit;
  callType: CallType;
  callerId: string;
  callId: string;
};

class CallEngine {
  // ── Identity (filled once by consuming screens, from trusted auth) ──
  private myId = "";
  private partnerId = "";

  // ── Gestalt state ──
  private state: CallState = "idle";
  private lastOutcome: CallState | null = null;
  private callType: CallType = "voice";
  private callId: string | null = null;
  private isCaller = false;
  private error: CallError | null = null;
  private sentOffer = false;
  private gotRemoteHangup = false;

  // ── Control state ──
  private muted = false;
  private cameraOn = false;
  private facingMode: "user" | "environment" = "user";
  private quality: CallQuality = "unknown";
  private remoteMuted = false;
  private remoteCameraOff = false;
  private remoteMediaAvailable = false;

  // ── WebRTC / signaling ──
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreamRef: MediaStream | null = null;
  private signalChannel: ReturnType<typeof supabase.channel> | null = null;
  private makingOffer = false;
  private ignoreOffer = false;
  private remoteDescriptionSet = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private outgoingCandidates: RTCIceCandidateInit[] = []; // replayed once the partner joins
  private candidatesReplayed = false;

  private pendingRemoteOffer: PendingOffer | null = null;

  // ── Session bookkeeping ──
  private timers = new Map<string, TimerEntry>();
  private done = false;
  private settlingBack = false;
  private callLogWritten = false;
  private callLogId: string | null = null;
  private signalAttempts = 0;

  // ── Stats machinery ──
  private statsStreak: { kind: CallQuality; count: number } | null = null;
  private bitrateLadder: "full" | "low" = "full";

  // ── UI element attachers — media never flows through React state ──
  private uiRefs: {
    localVideo?: HTMLVideoElement | null;
    remoteVideo?: HTMLVideoElement | null;
    remoteAudio?: HTMLAudioElement | null;
  } = {};

  // ── Subscriptions ──
  private listeners = new Set<Listener>();
  private elapsedListeners = new Set<Listener>();
  private elapsed = 0;
  private snapshot: CallEngineSnapshot = this.buildSnapshot();

  private journal: { t: number; msg: string }[] = [];

  // ═══════════════════════════════════════════════════════════════
  //  Snapshot / subscriptions
  // ═══════════════════════════════════════════════════════════════

  getSnapshot = (): CallEngineSnapshot => this.snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    this.ensureIdleWatch(); // a mounted page → engine listens for incoming rings
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.maybeTearDownWatch();
    };
  };

  /** Fine-grained ticker so the per-second timer never re-renders the page. */
  subscribeElapsed = (listener: Listener): (() => void) => {
    this.elapsedListeners.add(listener);
    return () => {
      this.elapsedListeners.delete(listener);
    };
  };

  getElapsed = (): number => this.elapsed;
  getJournal = (): readonly { t: number; msg: string }[] => this.journal;

  /** Identity must come from trusted auth state — never a user-typed field. */
  setIdentity(myId: string, partnerId: string): void {
    if (myId) this.myId = myId;
    if (partnerId) this.partnerId = partnerId;
  }

  // Media elements register themselves; the engine attaches streams directly.
  attachLocalVideo = (el: HTMLVideoElement | null): void => {
    this.uiRefs.localVideo = el;
    if (el && this.localStream) {
      el.srcObject = this.localStream;
      el.play().catch(() => {});
    }
  };
  attachRemoteVideo = (el: HTMLVideoElement | null): void => {
    this.uiRefs.remoteVideo = el;
    if (el && this.remoteStreamRef) {
      el.srcObject = this.remoteStreamRef;
      el.play().catch(() => {});
    }
  };
  attachRemoteAudio = (el: HTMLAudioElement | null): void => {
    this.uiRefs.remoteAudio = el;
    if (el && this.remoteStreamRef) {
      el.srcObject = this.remoteStreamRef;
      el.play().catch(() => {});
    }
  };
  detachAllElements = (): void => { this.uiRefs = {}; };

  /** Browser Picture-in-Picture for the remote video (feature-detected). */
  async requestPictureInPicture(): Promise<{ ok: boolean; reason?: "unsupported" | "error" }> {
    const el = this.uiRefs.remoteVideo;
    const maybe = el as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null;
    if (!el || typeof maybe?.requestPictureInPicture !== "function") {
      return { ok: false, reason: "unsupported" };
    }
    try {
      await el.requestPictureInPicture();
      return { ok: true };
    } catch {
      return { ok: false, reason: "error" };
    }
  }

  /** Audio output routing — only where setSinkId exists (Chromium desktop).
      On mobile the OS owns the route; we refuse honestly rather than fake it. */
  async setAudioOutput(deviceId: string): Promise<boolean> {
    const el = (this.uiRefs.remoteAudio ?? this.uiRefs.remoteVideo) as
      | (HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (!el || typeof el.setSinkId !== "function") return false;
    try {
      await el.setSinkId(deviceId);
      return true;
    } catch {
      return false;
    }
  }

  async listAudioOutputs(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audiooutput");
    } catch {
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Outgoing call
  // ═══════════════════════════════════════════════════════════════

  async startCall(type: CallType): Promise<void> {
    if (this.callActiveSession()) return; // one call at a time — UI routes back instead

    this.resetSessionState();
    this.callType = type;
    this.callId = generateUUID();
    this.isCaller = true;
    this.cameraOn = type === "video";

    if (!this.transitionTo("initiating")) return;

    try {
      await this.openSignalChannel();
      await this.createPeerConnection();
      await this.acquireMedia(type); // addTrack fires negotiation → first offer
      this.transitionTo("ringing");
      this.scheduleRingRetry();
      this.armRingTimeout();
      // The caller owns the log row (matches the existing RLS grant).
      void this.insertCallLogRow();
    } catch (err) {
      if (err instanceof DOMException) {
        this.fail(classifyMediaError(err));
      } else {
        this.jot("startCall failed");
        this.fail({ kind: "negotiation", message: "The call could not be started." });
      }
    }
  }

  private resetSessionState(): void {
    this.done = false;
    this.settlingBack = false;
    this.callLogWritten = false;
    this.callLogId = null;
    this.iceServerPromise = null; // fresh TURN credentials per session
    this.clearAllTimers();
    this.muted = false;
    this.facingMode = "user";
    this.quality = "unknown";
    this.remoteMuted = false;
    this.remoteCameraOff = false;
    this.remoteMediaAvailable = false;
    this.remoteStreamRef = null;
    this.elapsed = 0;
    this.error = null;
    this.lastOutcome = null;
    this.sentOffer = false;
    this.gotRemoteHangup = false;
    this.journal = [];
    this.statsStreak = null;
    this.bitrateLadder = "full";
    this.pendingCandidates = [];
    this.outgoingCandidates = [];
    this.runningRestart = false;
    this.pendingRemoteOffer = null;
  }

  // ═══════════════════════════════════════════════════════════════
  //  Incoming call
  // ═══════════════════════════════════════════════════════════════

  private presentIncoming(offer: PendingOffer): void {
    // Only the authorized partner may ring us.
    if (offer.callerId !== this.partnerId || offer.callerId === this.myId) return;
    // A repeated offer for the already-ringing session is not a new ring.
    if (this.state === "incoming" && this.callId === offer.callId) return;
    // Busy → answer for them with an explicit busy refusal.
    if (this.callActiveSession()) {
      this.signalChannel?.send({
        type: "broadcast",
        event: "declined",
        payload: { callId: offer.callId, fromId: this.myId, reason: "busy" },
      }).catch(() => {});
      return;
    }

    this.resetSessionState();
    this.callId = offer.callId;
    this.callType = offer.callType;
    this.isCaller = false;
    this.cameraOn = offer.callType === "video";
    this.pendingRemoteOffer = offer;
    this.transitionTo("incoming");
    this.armIncomingExpiry(); // the banner must never outlive the caller
  }

  async acceptIncoming(): Promise<void> {
    const offer = this.pendingRemoteOffer;
    if (!offer || this.state !== "incoming") return;
    this.pendingRemoteOffer = null;
    this.clearTimer("incoming-expiry");
    if (!this.transitionTo("accepting")) return;

    try {
      await this.openSignalChannel();
      await this.createPeerConnection();
      const pc = this.pc;
      if (!pc) return;

      // Order matters: remote description first, then tracks fold into the
      // answer — no extra negotiation round and no spurious negotiationneeded.
      await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
      this.remoteDescriptionSet = true;
      await this.drainCandidateQueue();

      const stream = await this.acquireStreamsForAnswer();
      this.addLocalTracksToPeer();
      await pc.setLocalDescription();
      this.postSignal(offer.callId, "answer", { sdp: pcDescriptionToInit(pc.localDescription) });
      this.transitionTo("connecting");
      if (stream) this.emit(); // local preview availability
    } catch (err) {
      this.jot("accept failed");
      if (err instanceof DOMException) this.fail(classifyMediaError(err));
      else this.fail({ kind: "negotiation", message: "Couldn't connect the call." });
    }
  }

  declineIncoming(reason: "declined" | "busy" = "declined"): void {
    if (this.state !== "incoming") return;
    if (this.callId) this.postSignal(this.callId, "declined", { reason });
    this.pendingRemoteOffer = null;
    this.clearTimer("incoming-expiry");
    this.done = true; // nothing to clean up — no media was acquired
    this.lastOutcome = "declined";
    this.transitionTo("declined");
    this.settleBackSoon();
  }

  /** Explicit cancel of an outgoing ring before it was answered. */
  cancelOutgoing(): void {
    if (this.state !== "ringing" && this.state !== "initiating") return;
    this.lastOutcome = "declined";
    this.finishCall("declined");
  }

  // ═══════════════════════════════════════════════════════════════
  //  Controls — every control reflects real media state
  // ═══════════════════════════════════════════════════════════════

  toggleMute(): void {
    if (!this.localStream) return;
    const next = !this.muted;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !next; // this genuinely stops sending microphone audio
    }
    this.muted = next;
    this.emit();
  }

  /** Camera off physically releases the hardware (heat/battery).
      replaceTrack(null) keeps the SDP stable, so switching back on needs no
      renegotiation round at all. */
  async toggleCamera(): Promise<void> {
    if (this.callType === "voice" && !this.cameraOn) {
      await this.enableVideoFromVoice();
      return;
    }

    if (this.cameraOn) {
      for (const track of this.localStream?.getVideoTracks() ?? []) {
        track.stop(); // light off, sensor released
        this.localStream?.removeTrack(track);
      }
      for (const tx of this.pc?.getTransceivers() ?? []) {
        if (txKind(tx) === "video" && tx.sender.track) {
          await tx.sender.replaceTrack(null).catch(() => {});
        }
      }
      this.cameraOn = false;
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: this.videoConstraints() });
        const track = stream.getVideoTracks()[0];
        if (!track) return;
        track.contentHint = "motion";
        this.localStream?.addTrack(track);

        const videoTx = this.pc?.getTransceivers().find((t) => txKind(t) === "video");
        if (videoTx && this.remoteDescriptionSet) {
          // replaceTrack INTO the negotiated transceiver — no renegotiation.
          await videoTx.sender.replaceTrack(track).catch(() => {});
        } else if (this.pc) {
          // Transceiver not negotiated yet (voice migrated to video).
          this.pc.addTrack(track, this.localStream ?? new MediaStream([track]));
        }
        if (this.uiRefs.localVideo && this.localStream) {
          this.uiRefs.localVideo.srcObject = this.localStream;
          this.uiRefs.localVideo.play().catch(() => {});
        }
        this.cameraOn = true;
      } catch (err) {
        this.jot("camera reacquire failed");
        this.error = classifyMediaError(err);
      }
    }
    this.emit();
  }

  async flipCamera(): Promise<void> {
    if (!this.cameraOn) return;
    const next = this.facingMode === "user" ? "environment" : "user";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: next } });
      const newTrack = stream.getVideoTracks()[0];
      if (!newTrack) throw new Error("no track");
      newTrack.contentHint = "motion";

      const videoTx = this.pc?.getTransceivers().find((t) => txKind(t) === "video");
      if (videoTx) await videoTx.sender.replaceTrack(newTrack);

      const old = this.localStream?.getVideoTracks()[0];
      old?.stop();
      if (old) this.localStream?.removeTrack(old);
      this.localStream?.addTrack(newTrack);
      if (this.uiRefs.localVideo && this.localStream) {
        this.uiRefs.localVideo.srcObject = this.localStream;
      }
      this.facingMode = next; // only after it actually worked
      this.emit();
    } catch {
      // No such camera — the flip is a no-op rather than a failure.
      this.emit();
    }
  }

  /** Voice→video upgrade, legal from EITHER side thanks to perfect negotiation. */
  async enableVideoFromVoice(): Promise<void> {
    if (this.cameraOn) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: this.videoConstraints() });
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      track.contentHint = "motion";
      this.localStream = this.localStream ?? new MediaStream();
      this.localStream.addTrack(track);
      this.pc?.addTrack(track, this.localStream);
      this.cameraOn = true;
      this.callType = "video";
      this.emit();
      // negotiationneeded (with politeness) drives the renegotiation.
    } catch (err) {
      this.jot("enable-video failed");
      this.error = classifyMediaError(err);
      this.emit();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Termination — idempotent
  // ═══════════════════════════════════════════════════════════════

  hangUp(): void {
    this.finishCall("ended");
  }

  private finishCall(outcome: "ended" | "declined" | "busy" | "failed"): void {
    if (this.done) return;
    this.done = true;
    this.lastOutcome = outcome;

    // Tell the partner even if media never connected — but never echo their
    // own hangup back at them. The remote-description check covers the callee
    // (who never sends an offer, so their sentOffer stays false all call long).
    if (this.callId && !this.gotRemoteHangup && (this.sentOffer || this.remoteDescriptionSet)) {
      this.postSignal(this.callId, "hangup", {});
    }

    // Timers first — nothing else gets to fire after this.
    this.clearAllTimers();

    // Hardware and peer connection
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    this.remoteStreamRef = null;
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onnegotiationneeded = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.remoteDescriptionSet = false;
    this.pendingCandidates = [];
    this.outgoingCandidates = [];
    this.makingOffer = false;
    this.ignoreOffer = false;

    // Call log — the caller owns the row (preserving existing RLS behavior).
    if (this.isCaller) void this.finalizeCallLog();

    this.transitionTo(outcome);
    // Failed calls stay on screen so the user can retry or read the reason;
    // every other terminal phase settles back to idle and the UI returns home.
    if (outcome !== "failed") this.settleBackSoon();
  }

  private fail(err: CallError): void {
    this.jot(`${err.kind}: ${err.message}`);
    this.error = err;
    this.finishCall("failed");
  }

  private settleBackSoon(): void {
    if (this.settlingBack) return;
    this.settlingBack = true;
    const t = setTimeout(() => {
      this.timers.delete("settle");
      this.settlingBack = false;
      this.transitionTo("idle");
    }, AUTO_SETTLE_MS);
    this.timers.set("settle", { h: t, kind: "timeout" });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Peer connection + perfect negotiation
  // ═══════════════════════════════════════════════════════════════

  private polite(): boolean {
    return this.myId === "" ? true : this.myId > this.partnerId;
  }

  private iceServerPromise: Promise<RTCIceServer[]> | null = null;

  private async createPeerConnection(): Promise<void> {
    if (this.pc) return;
    // Fetch TURN once per session; the STUN fallback keeps construction from
    // blocking when the endpoint is slow or unavailable.
    if (!this.iceServerPromise) this.iceServerPromise = this.getIceServers();
    const iceServers = await this.iceServerPromise;
    const pc = new RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle" });
    this.pc = pc;

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        if (this.callId && pc.localDescription) {
          const isInitialRing = this.state === "initiating" || this.state === "ringing";
          this.sentOffer = true;
          this.postSignal(this.callId, "offer", {
            sdp: pcDescriptionToInit(pc.localDescription),
            ...(isInitialRing ? { callType: this.callType } : {}),
          });
        }
      } catch {
        this.jot("negotiationneeded failed");
        if (!this.done && this.state !== "idle") {
          this.fail({ kind: "negotiation", message: "The call connection could not be established." });
        }
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onicecandidate = (e) => {
      if (!e.candidate || !this.callId) return;
      const cand = e.candidate.toJSON();
      this.outgoingCandidates.push(cand);
      this.postSignal(this.callId, "ice", { candidate: cand });
    };

    pc.ontrack = (e) => {
      const streams = e.streams?.length ? e.streams : [new MediaStream([e.track])];
      const stream = streams[0];
      this.remoteStreamRef = stream;
      const track = e.track;
      if (track.kind === "audio") {
        const el = this.uiRefs.remoteAudio;
        if (el) { el.srcObject = stream; el.play().catch(() => {}); }
        track.onmute = () => { if (!this.done) { this.remoteMuted = true; this.emit(); } };
        track.onunmute = () => { if (!this.done) { this.remoteMuted = false; this.emit(); } };
      } else {
        const el = this.uiRefs.remoteVideo;
        if (el) { el.srcObject = stream; el.play().catch(() => {}); }
        track.onmute = () => {
          // Only label "camera off" while the link itself is healthy — a
          // stalled network mutes tracks too, and that reads as "reconnecting".
          if (!this.done && this.pc?.connectionState === "connected") {
            this.remoteCameraOff = true;
            this.emit();
          }
        };
        track.onunmute = () => { if (!this.done) { this.remoteCameraOff = false; this.emit(); } };
      }
      if (!this.remoteMediaAvailable) {
        this.remoteMediaAvailable = true;
        this.emit();
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.done) return;
      switch (pc.connectionState) {
        case "connected":
          this.onConnected();
          break;
        case "disconnected":
        case "failed":
          // "disconnected" is often a brief blip — recover before giving up.
          this.startReconnecting();
          break;
        case "closed":
          this.finishCall("ended");
          break;
      }
    };
  }

  private async acquireMedia(type: CallType): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === "video" ? this.videoConstraints() : false,
      });
      if (this.done) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.localStream = stream;
      const video = stream.getVideoTracks()[0];
      if (video) video.contentHint = "motion";
      this.addLocalTracksToPeer();
      const lv = this.uiRefs.localVideo;
      if (lv) { lv.srcObject = stream; lv.play().catch(() => {}); }
    } catch (err) {
      this.fail(classifyMediaError(err));
    }
  }

  /** Callee media acquisition — ordered between setRemoteDescription and
      setLocalDescription so the tracks land inside the answer. */
  private async acquireStreamsForAnswer(): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: this.callType === "video" ? this.videoConstraints() : false,
      });
      if (this.done) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }
      this.localStream = stream;
      const video = stream.getVideoTracks()[0];
      if (video) video.contentHint = "motion";
      const lv = this.uiRefs.localVideo;
      if (lv) { lv.srcObject = stream; lv.play().catch(() => {}); }
      return stream;
    } catch (err) {
      this.fail(classifyMediaError(err));
      return null;
    }
  }

  private addLocalTracksToPeer(): void {
    if (!this.pc || !this.localStream) return;
    for (const track of this.localStream.getTracks()) {
      const already = this.pc.getSenders().some((s) => s.track === track);
      if (!already) this.pc.addTrack(track, this.localStream);
    }
  }

  private videoConstraints(): MediaTrackConstraints {
    return {
      facingMode: this.facingMode,
      width:  { ideal: 1280, max: 1920 },
      height: { ideal: 720,  max: 1080 },
      frameRate: { ideal: 24, max: 30 },
    };
  }

  /** Authenticated TURN fetch; hard STUN fallback so calls survive downtime. */
  private async getIceServers(): Promise<RTCIceServer[]> {
    const fallback: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return fallback;
      const res = await fetch("/api/turn", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) return data.iceServers as RTCIceServer[];
      }
    } catch {
      this.jot("TURN fetch failed — falling back to STUN");
    }
    return fallback;
  }

  // ═══════════════════════════════════════════════════════════════
  //  Connection lifecycle
  // ═══════════════════════════════════════════════════════════════

  private onConnected(): void {
    this.stopReconnectTimers();
    if (!this.transitionTo("connected")) return;
    this.remoteMuted = false;
    this.remoteCameraOff = false;
    this.startStatsLoop();
    this.armElapsedTicker();
  }

  private armElapsedTicker(): void {
    if (this.timers.has("elapsed")) return;
    const h = setInterval(() => {
      this.elapsed += 1;
      this.elapsedListeners.forEach((l) => l());
    }, 1000);
    this.timers.set("elapsed", { h, kind: "interval" });
  }

  private startReconnecting(): void {
    if (this.timers.has("grace") || this.timers.has("reconnect")) return;
    if (!this.transitionTo("reconnecting")) return;
    this.jot("connection lost — recovering");
    void this.attemptIceRestart();
    const h = setInterval(() => void this.attemptIceRestart(), RECONNECT_RETRY_MS);
    this.timers.set("reconnect", { h, kind: "interval" });
    const grace = setTimeout(() => {
      this.timers.delete("grace");
      if (!this.done && this.pc && this.pc.connectionState !== "connected") {
        this.fail({ kind: "ice", message: "We couldn't re-establish the connection." });
      }
    }, RECONNECT_GRACE_MS);
    this.timers.set("grace", { h: grace, kind: "timeout" });
  }

  private runningRestart = false;

  private stopReconnectTimers(): void {
    this.clearTimer("reconnect");
    this.clearTimer("grace");
  }

  private async attemptIceRestart(): Promise<void> {
    if (this.done || this.runningRestart) return;
    const pc = this.pc;
    if (!pc) return;
    if (pc.signalingState !== "stable") {
      // The restart offer may have been lost — rebroadcast the local one.
      if (pc.signalingState === "have-local-offer" && pc.localDescription && this.callId) {
        this.postSignal(this.callId, "offer", { sdp: pcDescriptionToInit(pc.localDescription) });
      }
      return;
    }
    this.runningRestart = true;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      this.sentOffer = true;
      if (this.callId) this.postSignal(this.callId, "offer", { sdp: pcDescriptionToInit(pc.localDescription) });
    } catch {
      this.jot("ICE restart failed");
    } finally {
      this.runningRestart = false;
    }
  }

  /** Public: called when the page becomes visible again after suspension. */
  notePageVisible(): void {
    if (this.pc && this.pc.connectionState === "disconnected") {
      void this.attemptIceRestart();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Quality — getStats read on evidence, never per-frame
  // ═══════════════════════════════════════════════════════════════

  private startStatsLoop(): void {
    if (this.timers.has("stats")) return;
    const h = setInterval(() => void this.sampleStats(), STATS_INTERVAL_MS);
    this.timers.set("stats", { h, kind: "interval" });
  }

  private async sampleStats(): Promise<void> {
    const pc = this.pc;
    if (!pc || pc.connectionState !== "connected") return;
    try {
      const report = await pc.getStats();
      let rtt: number | null = null;
      let lossPct: number | null = null;
      let jitter = 0;
      report.forEach((s) => {
        const stat = s as unknown as Record<string, unknown>;
        if (s.type === "candidate-pair" && s.state === "succeeded" && s.nominated === true) {
          if (typeof stat.currentRoundTripTime === "number") rtt = stat.currentRoundTripTime as number;
        }
        if (s.type === "inbound-rtp" && typeof stat.kind === "string") {
          const packetsLost = Number(stat.packetsLost ?? 0);
          const packetsReceived = Number(stat.packetsReceived ?? 0);
          const total = packetsLost + packetsReceived;
          if (total > 0) {
            const pct = (packetsLost / total) * 100;
            lossPct = lossPct === null ? pct : Math.max(lossPct, pct);
          }
          if (typeof stat.jitter === "number") jitter = Math.max(jitter, stat.jitter as number);
        }
      });

      const verdict: CallQuality =
        lossPct !== null && (lossPct > 10 || (rtt ?? 0) > 1.2 || jitter > 0.4)
          ? "poor"
          : lossPct !== null && (lossPct > 4 || (rtt ?? 0) > 0.6)
          ? "fair"
          : "good";

      if (this.quality !== verdict) { this.quality = verdict; this.emit(); }

      // Sustained verdicts move the bitrate ladder — never a single spike.
      const streak = this.statsStreak?.kind === verdict ? this.statsStreak.count + 1 : 1;
      this.statsStreak = { kind: verdict, count: streak };
      if (verdict === "poor" && streak >= 3 && this.bitrateLadder === "full") {
        await this.applyVideoBitrate(VIDEO_BITRATE_LOW);
        this.bitrateLadder = "low";
        this.jot("bitrate → 300k (sustained poor link)");
      } else if (verdict === "good" && streak >= 6 && this.bitrateLadder === "low") {
        await this.applyVideoBitrate(VIDEO_BITRATE_FULL);
        this.bitrateLadder = "full";
        this.jot("bitrate → 800k (link healthy)");
      }
    } catch {
      // getStats may throw mid-teardown; the next tick simply retries.
    }
  }

  private async applyVideoBitrate(maxBitrate: number): Promise<void> {
    for (const tx of this.pc?.getTransceivers() ?? []) {
      if (txKind(tx) !== "video") continue;
      try {
        const params = tx.sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        params.encodings[0].maxBitrate = maxBitrate;
        await tx.sender.setParameters(params);
      } catch {
        // Some browsers reject parameter writes; quality simply stays put.
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Signaling channel
  // ═══════════════════════════════════════════════════════════════

  private async openSignalChannel(): Promise<void> {
    if (this.signalChannel) return;
    this.jot("signaling open");
    const ch = supabase.channel(CALL_SIGNAL_TOPIC, {
      config: { broadcast: { self: false }, private: true },
    });
    this.signalChannel = ch;

    ch
      .on("broadcast", { event: "offer" }, ({ payload }) => void this.onOfferSignal(payload as SignalPayload))
      .on("broadcast", { event: "answer" }, ({ payload }) => void this.onAnswerSignal(payload as SignalPayload))
      .on("broadcast", { event: "ice" }, ({ payload }) => void this.onIceSignal(payload as SignalPayload))
      .on("broadcast", { event: "hangup" }, ({ payload }) => this.onHangupSignal(payload as SignalPayload))
      .on("broadcast", { event: "declined" }, ({ payload }) => this.onDeclinedSignal(payload as SignalPayload));

    ch.subscribe((status, err) => {
      if (this.signalChannel !== ch) return; // a stale incarnation
      if (status === "SUBSCRIBED") {
        this.signalAttempts = 0;
        this.jot("signaling subscribed");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.jot(`signaling ${status}`);
        if (err && err.message) this.jot(`channel: ${err.message}`);
        void this.reopenSignalChannel();
      }
    });
  }

  private async reopenSignalChannel(): Promise<void> {
    if (this.done || this.timers.has("signal-reopen")) return;
    if (this.signalAttempts >= SIGNAL_MAX_ATTEMPTS) {
      this.fail({ kind: "signaling", message: "Lost the connection to the call service." });
      return;
    }
    this.signalAttempts += 1;
    const old = this.signalChannel;
    this.signalChannel = null;
    if (old) supabase.removeChannel(old);
    const t = setTimeout(() => {
      this.timers.delete("signal-reopen");
      void this.openSignalChannel();
    }, SIGNAL_BACKOFF_MS * Math.min(this.signalAttempts, 5));
    this.timers.set("signal-reopen", { h: t, kind: "timeout" });
  }

  private postSignal(callId: string, event: string, payload: Record<string, unknown>): void {
    const ch = this.signalChannel;
    if (!ch) return;
    void ch
      .send({ type: "broadcast", event, payload: { callId, fromId: this.myId, ...payload } })
      .catch(() => {});
  }

  private validSignal(payload: SignalPayload): boolean {
    if (!payload || typeof payload !== "object") return false;
    if (asString(payload.fromId) !== this.partnerId) return false;
    return asString(payload.callId) === this.callId; // strict: sessions are exact
  }

  private isFromPartner(payload: SignalPayload): boolean {
    return Boolean(payload && typeof payload === "object") && asString(payload.fromId) === this.partnerId;
  }

  // ── Signal handlers ──

  private async onOfferSignal(payload: SignalPayload): Promise<void> {
    if (!this.isFromPartner(payload)) return;

    // 1. Idle → a genuine incoming ring.
    if (this.state === "idle") {
      const sdp = payload.sdp as RTCSessionDescriptionInit | undefined;
      if (!sdp || typeof sdp !== "object" || !sdp.sdp) return;
      this.presentIncoming({
        sdp,
        callType: payload.callType === "video" ? "video" : "voice",
        callerId: asString(payload.fromId),
        callId: asString(payload.callId, generateUUID()),
      });
      return;
    }

    // 2. Simultaneous-call offer or mid-call renegotiation.
    if (!this.validSignal(payload)) return;
    const sdp = payload.sdp as RTCSessionDescriptionInit | undefined;
    if (!sdp || !this.pc || this.done) return;
    // The caller rebroadcasts its offer every few seconds while ringing — an
    // identical SDP is that retry, never a new negotiation. Applying it during
    // our answer construction would corrupt the handshake.
    if (sdp.type === "offer" && this.pc.remoteDescription?.sdp === sdp.sdp) return;
    await this.applyRemoteOffer(sdp);
  }

  private async applyRemoteOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    const collision = this.makingOffer || pc.signalingState !== "stable";

    if (collision && !this.polite()) {
      this.ignoreOffer = true; // our offer wins; theirs is discarded
      return;
    }

    try {
      if (collision && this.polite()) {
        // Roll our local offer back and answer the partner instead — the
        // two simultaneous calls merge into one.
        try {
          await pc.setRemoteDescription({ type: "rollback" } as RTCSessionDescriptionInit);
        } catch {
          await pc.setRemoteDescription({ type: "offer", sdp: sdp.sdp }); // implicit-rollback browsers
        }
      }
      await pc.setRemoteDescription({ type: "offer", sdp: sdp.sdp });
      this.remoteDescriptionSet = true;
      await this.drainCandidateQueue();
      await pc.setLocalDescription();
      if (this.callId && pc.localDescription) {
        this.postSignal(this.callId, "answer", { sdp: pcDescriptionToInit(pc.localDescription) });
      }
      if (this.state === "ringing" || this.state === "initiating") {
        // Both of us were calling at once — we take the incoming side and
        // our own ringing row is closed honestly.
        this.isCaller = false;
        this.lastOutcome = "ended";
        this.error = { kind: null, message: "You answered each other." };
        void this.finalizeCallLog();
        this.transitionTo("connecting");
      }
    } catch {
      if (!this.ignoreOffer) {
        this.jot("applyRemoteOffer failed");
        this.fail({ kind: "negotiation", message: "The call connection could not be established." });
      }
    } finally {
      this.ignoreOffer = false;
    }
  }

  private async onAnswerSignal(payload: SignalPayload): Promise<void> {
    if (!this.validSignal(payload) || !this.pc || this.done) return;
    const sdp = payload.sdp as RTCSessionDescriptionInit | undefined;
    if (!sdp || !sdp.sdp) return;
    try {
      await this.pc.setRemoteDescription({ type: "answer", sdp: sdp.sdp });
      this.remoteDescriptionSet = true;
      await this.drainCandidateQueue();
      if (this.state === "ringing" || this.state === "initiating") this.transitionTo("connecting");
      // Replay candidates gathered before the partner's channel joined (once).
      if (this.callId && !this.candidatesReplayed) {
        this.candidatesReplayed = true;
        for (const cand of this.outgoingCandidates) {
          this.postSignal(this.callId, "ice", { candidate: cand });
        }
      }
    } catch {
      this.jot("answer apply failed");
      this.fail({ kind: "negotiation", message: "The call connection could not be established." });
    }
  }

  private async onIceSignal(payload: SignalPayload): Promise<void> {
    if (!this.validSignal(payload) || !this.pc || this.done) return;
    const candidate = payload.candidate as RTCIceCandidateInit | undefined;
    if (!candidate) return;
    try {
      if (!this.remoteDescriptionSet) {
        this.pendingCandidates.push(candidate);
        return;
      }
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Harmless: duplicates and candidates-after-close are expected noise.
    }
  }

  private async drainCandidateQueue(): Promise<void> {
    const pc = this.pc;
    if (!pc || this.pendingCandidates.length === 0) return;
    const queue = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const cand of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignore */ }
    }
  }

  private onHangupSignal(payload: SignalPayload): void {
    if (!this.isFromPartner(payload)) return;
    if (this.callActiveSession() && this.validSignal(payload)) {
      // The partner hung up — never echo a hangup back.
      this.gotRemoteHangup = true;
      this.finishCall("ended");
    }
  }

  private onDeclinedSignal(payload: SignalPayload): void {
    if (!this.isFromPartner(payload)) return;
    if (!this.callId || asString(payload.callId) !== this.callId) return;
    if (this.state !== "ringing" && this.state !== "initiating") return;
    if (payload.reason === "busy") {
      this.error = { kind: "partner-busy", message: `${this.partnerLabel()} was on another call.` };
      this.lastOutcome = "busy";
    } else {
      this.lastOutcome = "declined";
    }
    this.done = true;
    void this.finalizeCallLog();
    this.transitionTo(this.lastOutcome);
    this.settleBackSoon();
  }

  private partnerLabel(): string {
    if (typeof window === "undefined") return "Your partner";
    try { return localStorage.getItem("partner_name") || "Your partner"; } catch { return "Your partner"; }
  }

  // ═══════════════════════════════════════════════════════════════
  //  Ringing machinery
  // ═══════════════════════════════════════════════════════════════

  private scheduleRingRetry(): void {
    if (this.timers.has("ring-retry")) return;
    const h = setInterval(() => {
      if (this.state !== "ringing" || !this.pc?.localDescription) {
        this.clearTimer("ring-retry");
        return;
      }
      this.sentOffer = true;
      this.postSignal(this.callId!, "offer", {
        sdp: pcDescriptionToInit(this.pc.localDescription),
        callType: this.callType,
      });
    }, OFFER_RETRY_MS);
    this.timers.set("ring-retry", { h, kind: "interval" });
  }

  private armRingTimeout(): void {
    this.clearTimer("ring-timeout");
    const t = setTimeout(() => {
      this.timers.delete("ring-timeout");
      if (this.state !== "ringing" || this.done) return;
      this.jot("no answer — timing out");
      this.lastOutcome = "ended";
      this.error = { kind: null, message: "No answer." };
      this.done = true;
      void this.finalizeCallLog();
      this.transitionTo("ended");
      this.settleBackSoon();
    }, RING_TIMEOUT_MS);
    this.timers.set("ring-timeout", { h: t, kind: "timeout" });
  }

  private armIncomingExpiry(): void {
    this.clearTimer("incoming-expiry");
    const t = setTimeout(() => {
      this.timers.delete("incoming-expiry");
      if (this.state !== "incoming") return;
      // Caller vanished — the banner goes away; no row exists, nothing to log.
      this.pendingRemoteOffer = null;
      this.done = true;
      this.transitionTo("idle");
    }, RING_TIMEOUT_MS);
    this.timers.set("incoming-expiry", { h: t, kind: "timeout" });
  }

  private callActiveSession(): boolean {
    return (
      this.state === "initiating" || this.state === "ringing" ||
      this.state === "incoming"   || this.state === "accepting" ||
      this.state === "connecting" || this.state === "connected" ||
      this.state === "reconnecting" || this.state === "ending"
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Idle watch — the engine listens for rings while UI is mounted
  // ═══════════════════════════════════════════════════════════════

  private ensureIdleWatch(): void {
    if (this.callActiveSession()) return;
    void this.openSignalChannel();
  }

  /** A live call owns the channel; idle + nobody watching releases it. */
  private maybeTearDownWatch(): void {
    if (this.callActiveSession() || this.listeners.size > 0) return;
    const t = setTimeout(() => {
      this.timers.delete("watch-release");
      if (this.listeners.size === 0 && !this.callActiveSession()) {
        const old = this.signalChannel;
        this.signalChannel = null;
        this.signalAttempts = 0;
        if (old) supabase.removeChannel(old);
        this.jot("signaling watch released");
      }
    }, 1_500);
    this.timers.set("watch-release", { h: t, kind: "timeout" });
  }

  // ═══════════════════════════════════════════════════════════════
  //  Call log (existing RLS: the caller inserts and finalizes)
  // ═══════════════════════════════════════════════════════════════

  private async insertCallLogRow(): Promise<void> {
    if (!this.isCaller || !this.callId) return;
    const { data, error } = await supabase
      .from("call_log")
      .insert({
        id: this.callId, // stable ID shared with signaling
        conversation_id: CONVERSATION_ID,
        caller_id: this.myId,
        type: this.callType,
        // started_at is stamped by the database (004_server_timestamps.sql).
      })
      .select("id")
      .single();
    if (error) this.jot(`call_log insert failed: ${error.message}`);
    if (data) this.callLogId = data.id as string;
  }

  private async finalizeCallLog(): Promise<void> {
    if (this.callLogWritten || !this.isCaller || !this.callId) return;
    this.callLogWritten = true;
    // DB CHECK constraint allows missed | answered | declined only.
    const dbStatus =
      this.lastOutcome === "declined" || this.lastOutcome === "busy"
        ? "declined"
        : this.elapsed > 0
        ? "answered"
        : "missed";
    const { error } = await supabase
      .from("call_log")
      .update({
        status: dbStatus,
        ended_at: new Date().toISOString(),
        duration_seconds: Math.max(0, this.elapsed),
      })
      .eq("id", this.callLogId ?? this.callId);
    if (error) this.jot(`call_log update failed: ${error.message}`);
  }

  // ═══════════════════════════════════════════════════════════════
  //  Utilities
  // ═══════════════════════════════════════════════════════════════

  private transitionTo(next: CallState): boolean {
    if (!canTransition(this.state, next)) return false;
    this.state = next;
    this.emit();
    return true;
  }

  private clearTimer(name: string): void {
    const entry = this.timers.get(name);
    if (entry) {
      if (entry.kind === "interval") clearInterval(entry.h);
      else clearTimeout(entry.h);
      this.timers.delete(name);
    }
  }

  private clearAllTimers(): void {
    for (const name of Array.from(this.timers.keys())) this.clearTimer(name);
  }

  private jot(msg: string): void {
    this.journal.push({ t: Date.now(), msg });
    if (this.journal.length > 24) this.journal.shift();
    if (process.env.NODE_ENV === "development") {
      // Development diagnostics only — never payloads, SDP or tokens.
      console.debug("[call]", msg);
    }
  }

  private buildSnapshot(): CallEngineSnapshot {
    return {
      state: this.state,
      lastOutcome: this.lastOutcome,
      callType: this.callType,
      callId: this.callId,
      error: this.error,
      muted: this.muted,
      cameraOn: this.cameraOn,
      facingMode: this.facingMode,
      quality: this.quality,
      remoteMuted: this.remoteMuted,
      remoteCameraOff: this.remoteCameraOff,
      remoteMediaAvailable: this.remoteMediaAvailable,
      callActive: this.callActiveSession(),
      isCaller: this.isCaller,
      sentOffer: this.sentOffer,
    };
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }
}

// A module-level singleton lives for the browser session — exactly the
// lifetime a call needs to survive route changes.
export const callEngine = new CallEngine();

// Ambient: if the peer link decayed while the tab was hidden, kick recovery
// once the page is foreground again (no timers run on visibility alone).
if (typeof document !== "undefined") {
  const g = globalThis as Record<string, unknown>;
  if (!g.__justUsCallVisibility) {
    g.__justUsCallVisibility = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") callEngine.notePageVisible();
    });
  }
}
