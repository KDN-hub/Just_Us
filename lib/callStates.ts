// ============================================================
//  Just Us — Call state machine (single source of truth)
//
//  The /call screen used to derive its phase from loose strings
//  stored in React state. These helpers define the legal set of
//  phases and guard every transition, so an event from a stale
//  session can never push a call into an impossible state.
// ============================================================

/** Every phase the calling system can be in. */
export type CallState =
  | "idle" // nothing happening / settled after a call
  | "initiating" // outgoing: acquiring media + creating the offer
  | "ringing" // outgoing: offer on the wire, waiting for the partner
  | "incoming" // incoming: ringing banner is up
  | "accepting" // incoming: media acquisition after Accept
  | "connecting" // handshake running (answer sent / being applied)
  | "connected" // media flowing
  | "reconnecting" // media lost, bounded ICE restarts in progress
  | "ending" // deliberate teardown in progress
  | "ended" // partner hung up / we hung up / nobody answered
  | "declined"
  | "busy" // our attempted call was refused because partner was in a call
  | "failed"; // unrecoverable (permissions, negotiation, ICE…)

/** Phases grouped by what the UI needs to show. */
export const CONNECTED_STATES: readonly CallState[] = ["connected", "reconnecting"];
export const RINGING_STATES: readonly CallState[] = ["initiating", "ringing", "incoming", "accepting", "connecting"];

// Legal transitions. Any state may still go to "ending" (teardown
// is always legal) — that case is handled separately below.
const TRANSITIONS: Record<CallState, readonly CallState[]> = {
  idle: ["initiating", "incoming"],
  initiating: ["ringing", "connecting", "ended", "declined", "busy", "failed"],
  ringing: ["connecting", "ended", "declined", "busy", "failed"],
  incoming: ["accepting", "idle", "declined"], // idle = auto-expired before accept
  accepting: ["connecting", "ended", "failed"],
  connecting: ["connected", "reconnecting", "ending", "ended", "declined", "busy", "failed"],
  connected: ["reconnecting", "ending", "ended", "failed"],
  reconnecting: ["connected", "ending", "ended", "failed"],
  ending: [], // terminating locally; settled into a terminal state from here
  ended: ["idle", "initiating"],
  declined: ["idle", "initiating"],
  busy: ["idle", "initiating"],
  failed: ["idle", "initiating"],
};

/**
 * Is `next` reachable from `prev`? Teardown-like states ("ending",
 * "ended", "declined", "busy", "failed") are reachable from every
 * non-terminal phase because any subsystem may abort the session.
 */
export function canTransition(prev: CallState, next: CallState): boolean {
  if (prev === next) return false;
  if (
    next === "ending" ||
    next === "ended" ||
    next === "declined" ||
    next === "busy" ||
    next === "failed"
  ) {
    return prev !== "idle" && prev !== "ending";
  }
  return TRANSITIONS[prev].includes(next);
}

/** Waiting-on-media phases (used to mute the status ticker). */
export function isWaitingPhase(state: CallState): boolean {
  return state === "initiating" || state === "ringing" || state === "incoming" || state === "accepting";
}
