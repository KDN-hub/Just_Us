"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mic,
  MicOff,
  PhoneOff,
  RotateCcw,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONVERSATION_ID = "c0000000-0000-0000-0000-000000000003";
const SIGNAL_CHANNEL  = `call-signal-${CONVERSATION_ID}`;

const RING_TIMEOUT_MS      = 45_000; // caller gives up → "missed"
const OFFER_RETRY_MS       = 3_000;  // re-send offer while ringing (callee may open the app late)
const RECONNECT_RETRY_MS   = 5_000;  // ICE-restart attempts while the link is down
const RECONNECT_GRACE_MS   = 20_000; // give up and end the call after this long

/**
 * TODO(security): the TURN password is a NEXT_PUBLIC_ var, so it ships to every browser,
 * and the current one was pasted into a chat. Rotate it in coturn + .env.local and
 * consider short-lived credentials from a server endpoint.
 *
 * STUN is free/public. TURN is required for calls to connect across strict NATs
 * and mobile carriers — set these env vars once the coturn server is running:
 *   NEXT_PUBLIC_TURN_URL        e.g. "turn:1.2.3.4:3478" (comma-separate to add turns:/tcp variants)
 *   NEXT_PUBLIC_TURN_USERNAME
 *   NEXT_PUBLIC_TURN_CREDENTIAL
 */
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const turnUrl      = process.env.NEXT_PUBLIC_TURN_URL?.trim();
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME?.trim();
  // Accept either name for the secret (NEXT_PUBLIC_ vars must be referenced literally to be inlined)
  const turnPassword =
    (process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? process.env.NEXT_PUBLIC_TURN_PASSWORD)?.trim();

  // Browsers throw InvalidAccessError (and the call crashes) if a turn:/turns: URL
  // is given without BOTH username and credential, so only add it when complete.
  if (turnUrl && turnUsername && turnPassword) {
    servers.push({
      urls: turnUrl.split(",").map((u) => u.trim()),
      username: turnUsername,
      credential: turnPassword,
    });
  } else if (turnUrl) {
    console.warn(
      "[call] NEXT_PUBLIC_TURN_URL is set but NEXT_PUBLIC_TURN_USERNAME / NEXT_PUBLIC_TURN_CREDENTIAL (or _PASSWORD) are missing — TURN disabled.",
    );
  } else {
    console.warn("[call] No TURN server configured. Calls may fail across strict NATs / mobile data.");
  }
  return servers;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type CallStatus =
  | "requesting"
  | "calling"
  | "receiving"
  | "connected"
  | "reconnecting"
  | "declined"
  | "noanswer";

// ─── Inner component (needs useSearchParams inside Suspense) ─────────────────

function CallScreen() {
  const router     = useRouter();
  const params     = useSearchParams();
  const callType   = (params.get("type") ?? "voice") as "voice" | "video";

  // Identity from localStorage — set by chat page when partner is fetched
  const myId        = typeof window !== "undefined" ? localStorage.getItem("user_id")      ?? "" : "";
  const partnerName = typeof window !== "undefined" ? localStorage.getItem("partner_name") ?? "…" : "…";
  const partnerColor= typeof window !== "undefined" ? localStorage.getItem("partner_color")?? "var(--wine)" : "var(--wine)";
  const partnerInitial = partnerName[0]?.toUpperCase() ?? "?";

  // Callee detection: chat page stores the offer in sessionStorage before navigating here.
  // Read ONCE — the setup code removes the key, so re-reading it on later renders
  // would wrongly flip a callee into a caller.
  const [pendingOfferRaw] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("pending_offer") : null,
  );
  const isCallee = !!pendingOfferRaw;

  // ── Refs ──────────────────────────────────────────────────────────────────
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef        = useRef(false);   // guard against double-cleanup
  // Ringing / reconnect timers
  const offerRetryRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceTimeoutRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Call log tracking
  const callLogIdRef   = useRef<string | null>(null);           // DB row id
  const logInsertRef   = useRef<Promise<void> | null>(null);    // resolves when the row exists
  const callStatusRef  = useRef<"answered" | "missed" | "declined">("missed"); // outcome
  const elapsedRef     = useRef(0);                             // mirrors elapsed state

  // ── State ─────────────────────────────────────────────────────────────────
  const [status,     setStatus]     = useState<CallStatus>(isCallee ? "receiving" : "requesting");
  const [elapsed,    setElapsed]    = useState(0);
  const [muted,      setMuted]      = useState(false);
  const [cameraOn,   setCameraOn]   = useState(callType === "video");
  const [speakerOn,  setSpeakerOn]  = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // ── Timers ────────────────────────────────────────────────────────────────
  const clearRingTimers = useCallback(() => {
    if (offerRetryRef.current)  { clearInterval(offerRetryRef.current);  offerRetryRef.current  = null; }
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current);  ringTimeoutRef.current = null; }
  }, []);

  const clearReconnectTimers = useCallback(() => {
    if (reconnectIntervalRef.current) { clearInterval(reconnectIntervalRef.current); reconnectIntervalRef.current = null; }
    if (graceTimeoutRef.current)      { clearTimeout(graceTimeoutRef.current);       graceTimeoutRef.current      = null; }
  }, []);

  // ── Resource cleanup (no network, no navigate) ────────────────────────────
  const stopEverything = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    clearRingTimers();
    clearReconnectTimers();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  }, [clearRingTimers, clearReconnectTimers]);

  // ── Caller writes the final status to call_log ────────────────────────────
  const finalizeLog = useCallback(async () => {
    if (isCallee) return;
    await logInsertRef.current; // make sure the row exists before updating it
    if (!callLogIdRef.current) return;
    const { error } = await supabase
      .from("call_log")
      .update({
        status: callStatusRef.current,
        ended_at: new Date().toISOString(),
        duration_seconds: elapsedRef.current,
      })
      .eq("id", callLogIdRef.current);
    if (error) console.error("[call] call_log update failed:", error.message);
  }, [isCallee]);

  // ── End call (sends hangup, writes call log, navigates) ───────────────────
  const handleEnd = useCallback(
    async (sendHangup = true) => {
      if (doneRef.current) return;
      doneRef.current = true;
      if (sendHangup) {
        channelRef.current?.send({
          type: "broadcast",
          event: "hangup",
          payload: {},
        });
      }
      stopEverything();
      await finalizeLog();
      router.replace("/chat");
    },
    [router, stopEverything, finalizeLog],
  );

  // ── Drain queued ICE candidates ───────────────────────────────────────────
  async function drainQueue(pc: RTCPeerConnection) {
    for (const c of candidateQueue.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
    candidateQueue.current = [];
  }

  // ── Main WebRTC setup ─────────────────────────────────────────────────────
  useEffect(() => {
    // Per-run flag: under React StrictMode this effect runs, is cleaned up and runs
    // again. A shared ref can't tell the two runs apart, which used to produce two
    // peer connections and two call_log rows.
    let cancelled = false;
    doneRef.current = false;

    // Leaving the page any way other than the End button (back button, tab close)
    // must still tell the partner and close out the log.
    const endSilently = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      channelRef.current?.send({ type: "broadcast", event: "hangup", payload: {} });
      finalizeLog();
    };
    const onPageHide = () => { endSilently(); stopEverything(); };
    window.addEventListener("pagehide", onPageHide);

    async function setup() {
      // 1. Acquire local media
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video" ? { facingMode } : false,
        });
      } catch {
        if (cancelled) return;
        alert("Camera / microphone access was denied.");
        router.replace("/chat");
        return;
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setStatus(isCallee ? "receiving" : "calling");

      // 2. Create peer connection
      const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
      pcRef.current = pc;

      // Attach local tracks
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // Every local candidate is remembered so the caller can replay them once the
      // callee has actually joined the channel (see "answer" handler below).
      const localCandidates: RTCIceCandidateInit[] = [];

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const cand = e.candidate.toJSON();
        localCandidates.push(cand);
        channelRef.current?.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: cand },
        });
      };

      // Remote track → wire to media element
      pc.ontrack = (e) => {
        if (e.streams[0]) setRemoteStream(e.streams[0]);
      };

      // 3. Signaling channel
      // private: only signed-in members can join (enforced by RLS on realtime.messages)
      const ch = supabase.channel(SIGNAL_CHANNEL, {
        config: { broadcast: { self: false }, private: true },
      });
      channelRef.current = ch;

      const sendOffer = () =>
        ch.send({
          type: "broadcast",
          event: "offer",
          payload: { sdp: pc.localDescription, callType, callerId: myId },
        });

      // ── Reconnection (caller drives ICE restarts; callee just answers) ──
      const attemptRecovery = async () => {
        if (isCallee || cancelled || doneRef.current) return;
        try {
          if (pc.signalingState === "stable") {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            sendOffer();
          } else if (pc.signalingState === "have-local-offer") {
            sendOffer(); // previous restart offer may have been lost
          }
        } catch (err) {
          console.error("[call] ICE restart failed:", err);
        }
      };

      const startReconnecting = () => {
        if (reconnectIntervalRef.current || doneRef.current) return;
        console.warn("[call] Connection lost — attempting to recover…");
        setStatus("reconnecting");
        attemptRecovery();
        reconnectIntervalRef.current = setInterval(attemptRecovery, RECONNECT_RETRY_MS);
        graceTimeoutRef.current = setTimeout(() => {
          console.error("[call] Could not recover the connection — ending call.");
          if (!doneRef.current) handleEnd(true);
        }, RECONNECT_GRACE_MS);
      };

      pc.onconnectionstatechange = () => {
        switch (pc.connectionState) {
          case "connected":
            clearRingTimers();
            clearReconnectTimers();
            setStatus("connected");
            callStatusRef.current = "answered";
            if (!timerRef.current) {
              timerRef.current = setInterval(() => {
                elapsedRef.current += 1;
                setElapsed(elapsedRef.current);
              }, 1000);
            }
            break;
          case "disconnected":
          case "failed":
            // "disconnected" is often a brief network blip — recover before giving up.
            startReconnecting();
            break;
          case "closed":
            if (!doneRef.current) handleEnd(false);
            break;
        }
      };

      // ── Listeners common to caller and callee ──
      ch
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (pc.remoteDescription) {
            try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { /* ignore */ }
          } else {
            candidateQueue.current.push(payload.candidate);
          }
        })
        .on("broadcast", { event: "hangup" }, () => {
          if (!doneRef.current) handleEnd(false);
        })
        .on("broadcast", { event: "declined" }, () => {
          clearRingTimers(); // stop re-sending the offer or the callee's overlay would pop back up
          callStatusRef.current = "declined"; // mark as declined before handleEnd writes log
          setStatus("declined");
          setTimeout(() => { if (!doneRef.current) handleEnd(false); }, 1800);
        });

      let started = false; // SUBSCRIBED can fire again after a Realtime reconnect

      if (isCallee) {
        // ── Callee: answer the offer handed over by the chat page ────────
        // Later "offer" events are ICE-restart renegotiations from the caller.
        ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
          const sdp = payload.sdp as RTCSessionDescriptionInit | null;
          if (!sdp || !pc.remoteDescription) return;          // initial offer not applied yet
          if (pc.remoteDescription.sdp === sdp.sdp) return;   // duplicate of an offer we already have
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await drainQueue(pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ch.send({ type: "broadcast", event: "answer", payload: { sdp: pc.localDescription } });
          } catch (err) {
            console.error("[call] renegotiation failed:", err);
          }
        });

        ch.subscribe(async (sub, err) => {
          if (sub === "CHANNEL_ERROR") console.error("[call] signaling channel error", err ?? "");
          if (sub !== "SUBSCRIBED" || started || cancelled) return;
          started = true;
          const raw = pendingOfferRaw;
          if (!raw) return;
          sessionStorage.removeItem("pending_offer");

          try {
            const { sdp } = JSON.parse(raw) as { sdp: RTCSessionDescriptionInit };
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            await drainQueue(pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ch.send({
              type: "broadcast",
              event: "answer",
              payload: { sdp: pc.localDescription },
            });
          } catch (e) {
            console.error("[call] failed to answer call:", e);
            handleEnd(true);
          }
        });
      } else {
        // ── Caller: create offer, wait for answer ────────────────────────
        let answered = false;

        ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (pc.signalingState !== "have-local-offer") return;
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription(payload.sdp as RTCSessionDescriptionInit),
            );
          } catch (e) {
            console.error("[call] failed to apply answer:", e);
            return;
          }
          if (!answered) {
            answered = true;
            clearRingTimers();
          }
          await drainQueue(pc);

          // The callee only joined the channel after tapping Accept, so every
          // candidate we gathered before that went nowhere. Replay them now.
          for (const cand of localCandidates) {
            ch.send({ type: "broadcast", event: "ice-candidate", payload: { candidate: cand } });
          }
        });

        ch.subscribe(async (sub, err) => {
          if (sub === "CHANNEL_ERROR") console.error("[call] signaling channel error", err ?? "");
          if (sub !== "SUBSCRIBED" || started || cancelled) return;
          started = true;

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (cancelled) return;
          sendOffer();

          // Keep ringing: the partner may open the app a few seconds after we call.
          offerRetryRef.current = setInterval(() => {
            if (answered || doneRef.current) { clearRingTimers(); return; }
            sendOffer();
          }, OFFER_RETRY_MS);

          // Nobody picked up → tell the partner's overlay to go away and log "missed".
          ringTimeoutRef.current = setTimeout(() => {
            if (answered || doneRef.current) return;
            clearRingTimers();
            channelRef.current?.send({ type: "broadcast", event: "hangup", payload: {} });
            callStatusRef.current = "missed";
            setStatus("noanswer");
            setTimeout(() => { if (!doneRef.current) handleEnd(false); }, 1800);
          }, RING_TIMEOUT_MS);

          // Create the call_log row (status null = in-progress, updated on end)
          logInsertRef.current = (async () => {
            const { data: logRow, error } = await supabase
              .from("call_log")
              .insert({
                conversation_id: CONVERSATION_ID,
                caller_id: myId,
                type: callType,
                // started_at is stamped by the database (see 004_server_timestamps.sql) so
                // call entries sort correctly against messages regardless of device clocks.
              })
              .select("id")
              .single();
            if (error) console.error("[call] call_log insert failed:", error.message);
            if (logRow) callLogIdRef.current = logRow.id;
          })();
        });
      }
    }

    setup();

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", onPageHide);
      endSilently();
      doneRef.current = true;
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach remote stream to the media element whenever it changes.
  // Voice calls have no <video>, so they need the <audio> element or they're silent.
  useEffect(() => {
    if (!remoteStream) return;
    const el = callType === "video" ? remoteVideoRef.current : remoteAudioRef.current;
    if (el) {
      el.srcObject = remoteStream;
      el.play().catch(() => { /* autoplay blocked — user gesture already happened on Accept/Call */ });
    }
  }, [remoteStream, callType]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
    setMuted((m) => !m);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !cameraOn; });
    setCameraOn((c) => !c);
  };

  const flipCamera = async () => {
    const next = facingMode === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: next },
      });
      const newTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current
        ?.getSenders()
        .find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      const old = localStreamRef.current?.getVideoTracks()[0];
      old?.stop();
      if (old) localStreamRef.current?.removeTrack(old);
      localStreamRef.current?.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setFacingMode(next); // only after it actually worked
    } catch { /* device may not support rear camera */ }
  };

  // ── Derived UI values ─────────────────────────────────────────────────────
  const isConnected    = status === "connected";
  const isReconnecting = status === "reconnecting";
  const showRemote     = isConnected || isReconnecting;
  const isCalling      = status === "calling" || status === "receiving";
  const isDeclined     = status === "declined";

  const statusLabel = isDeclined
    ? "Call declined"
    : status === "noanswer"
    ? "No answer"
    : isReconnecting
    ? "Reconnecting…"
    : status === "calling"
    ? "Calling…"
    : status === "receiving"
    ? "Connecting…"
    : isConnected
    ? fmt(elapsed)
    : "Connecting…";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main
      className="relative mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden font-sans"
      style={{ backgroundColor: "#0F0D0B" }}
    >
      {/* ── Remote audio (voice calls) — without this a voice call is silent ── */}
      {callType === "voice" && <audio ref={remoteAudioRef} autoPlay />}

      {/* ── Remote video (video calls, fills screen) ───────────────────── */}
      {callType === "video" && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            showRemote ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* ── Scrim so text stays readable over video ────────────────────── */}
      {callType === "video" && showRemote && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      )}

      {/* ── Content overlay ────────────────────────────────────────────── */}
      <div className="relative z-10 flex h-full flex-col">

        {/* Top: partner name + status/timer */}
        <div className="flex flex-col items-center gap-1 pt-[60px]">
          <p className="text-[15px] font-medium text-[var(--cream)]">
            {partnerName}
          </p>
          <p
            className={`text-[12px] ${isReconnecting ? "animate-pulse text-[var(--gold)]" : "text-[var(--muted)]"}`}
            role="status"
          >
            {statusLabel}
          </p>
        </div>

        {/* Center: avatar with pulse rings for voice / spacer for video */}
        <div className="flex flex-1 items-center justify-center">
          {(callType === "voice" || !showRemote) && (
            <div className="relative flex items-center justify-center">
              {isCalling && (
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
              <Avatar initial={partnerInitial} color={partnerColor} size={96} />
            </div>
          )}
        </div>

        {/* Self PiP — video only, bottom-right corner */}
        {callType === "video" && (
          <div className="absolute bottom-36 right-4 h-36 w-[88px] overflow-hidden rounded-[10px] border border-white/20 shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-center gap-5 pb-14">

          {/* Mute / Unmute */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-[var(--cream)] transition-colors active:bg-white/20"
          >
            {muted
              ? <MicOff className="h-5 w-5" strokeWidth={2} />
              : <Mic    className="h-5 w-5" strokeWidth={2} />}
          </button>

          {/* Camera on/off (video) / Speaker (voice) */}
          <button
            type="button"
            onClick={callType === "video" ? toggleCamera : () => setSpeakerOn((s) => !s)}
            aria-label={callType === "video" ? "Toggle camera" : "Toggle speaker"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-[var(--cream)] transition-colors active:bg-white/20"
          >
            {callType === "video"
              ? cameraOn
                ? <Video    className="h-5 w-5" strokeWidth={2} />
                : <VideoOff className="h-5 w-5" strokeWidth={2} />
              : speakerOn
                ? <Volume2  className="h-5 w-5" strokeWidth={2} />
                : <VolumeX  className="h-5 w-5" strokeWidth={2} />}
          </button>

          {/* End call — wide pill, wine */}
          <button
            type="button"
            onClick={() => handleEnd(true)}
            aria-label="End call"
            className="flex h-14 w-24 items-center justify-center rounded-full bg-[var(--wine)] text-[var(--cream)] transition-opacity active:opacity-80"
          >
            <PhoneOff className="h-5 w-5" strokeWidth={2} />
          </button>

          {/* Flip camera (video) / Speaker toggle (voice) */}
          <button
            type="button"
            onClick={callType === "video" ? flipCamera : () => setSpeakerOn((s) => !s)}
            aria-label={callType === "video" ? "Flip camera" : "Speaker"}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-[var(--cream)] transition-colors active:bg-white/20"
          >
            {callType === "video"
              ? <RotateCcw className="h-5 w-5" strokeWidth={2} />
              : <Volume2   className="h-5 w-5" strokeWidth={2} />}
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── Page export (wraps in Suspense for useSearchParams) ─────────────────────

export default function CallPage() {
  return (
    <Suspense
      fallback={
        <div className="h-dvh font-sans" style={{ backgroundColor: "#0F0D0B" }} />
      }
    >
      <CallScreen />
    </Suspense>
  );
}
