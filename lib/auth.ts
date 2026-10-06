import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

/**
 * Auth model
 * ──────────
 *  • Real identity = a Supabase Auth session (email + password, entered once per device).
 *    The server (RLS) trusts only this.
 *  • The 4-digit PIN is a LOCAL app lock. Its bcrypt hash lives only in this device's
 *    localStorage and is never sent anywhere. 5 wrong tries sign the device out.
 *  • "Unlocked" lives in sessionStorage, so the PIN is asked again each time the app
 *    (tab / installed PWA) is opened.
 */

export const CONVERSATION_ID = "c0000000-0000-0000-0000-000000000003";
export const MAX_PIN_ATTEMPTS = 5;

const PIN_HASH_KEY  = "pin_lock_hash";
const PIN_FAILS_KEY = "pin_lock_fails";
const UNLOCKED_KEY  = "app_unlocked";
const NOTICE_KEY    = "signin_notice";

export interface AppProfile {
  id: string;
  name: string;
  nickname: string | null;
  avatar_color: string | null;
}

// ─── Local PIN lock ───────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "sha256:" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const hasLocalPin = (): boolean =>
  typeof window !== "undefined" && !!localStorage.getItem(PIN_HASH_KEY);

export function clearLocalPin(): void {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(PIN_FAILS_KEY);
}

export async function setLocalPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_HASH_KEY, await hashPin(pin));
  localStorage.removeItem(PIN_FAILS_KEY);
}

/** Checks the PIN and tracks failed attempts. Migrates legacy bcrypt hashes to SHA-256 on success. */
export async function verifyLocalPin(
  pin: string,
): Promise<{ ok: boolean; attemptsLeft: number }> {
  const storedHash = localStorage.getItem(PIN_HASH_KEY);
  if (!storedHash) return { ok: false, attemptsLeft: 0 };

  let isMatch = false;

  if (storedHash.startsWith("sha256:")) {
    const currentHash = await hashPin(pin);
    isMatch = currentHash === storedHash;
  } else {
    // Legacy bcrypt hash fallback
    isMatch = await bcrypt.compare(pin, storedHash);
    if (isMatch) {
      // Migrate to fast hash immediately so subsequent logins are instant
      localStorage.setItem(PIN_HASH_KEY, await hashPin(pin));
    }
  }

  if (isMatch) {
    localStorage.removeItem(PIN_FAILS_KEY);
    return { ok: true, attemptsLeft: MAX_PIN_ATTEMPTS };
  }

  const fails = Number(localStorage.getItem(PIN_FAILS_KEY) ?? "0") + 1;
  localStorage.setItem(PIN_FAILS_KEY, String(fails));
  return { ok: false, attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - fails) };
}

export const isUnlocked = (): boolean =>
  typeof window !== "undefined" && sessionStorage.getItem(UNLOCKED_KEY) === "1";
export const setUnlocked = (): void => sessionStorage.setItem(UNLOCKED_KEY, "1");
export const lockApp = (): void => sessionStorage.removeItem(UNLOCKED_KEY);

// ─── Notices shown on the sign-in screen (e.g. "too many wrong PINs") ─────────

export const setSignInNotice = (msg: string): void => sessionStorage.setItem(NOTICE_KEY, msg);
export function takeSignInNotice(): string | null {
  const msg = sessionStorage.getItem(NOTICE_KEY);
  if (msg) sessionStorage.removeItem(NOTICE_KEY);
  return msg;
}

// ─── Profile (maps the Auth account → the app's users row) ───────────────────

function cacheProfile(p: AppProfile) {
  localStorage.setItem("user_id", p.id);
  localStorage.setItem("user_name", p.nickname ?? p.name);
  localStorage.setItem("avatar_color", p.avatar_color ?? "#7A2C3B");
}

/**
 * Loads the signed-in user's `users` row and caches it in localStorage, which the
 * chat/call pages read synchronously. The cache is only a convenience — the server
 * enforces identity from the session, so editing it can't grant access.
 */
export async function loadProfile(opts: { useCache?: boolean } = {}): Promise<AppProfile | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  if (opts.useCache && localStorage.getItem("user_id")) {
    return {
      id: localStorage.getItem("user_id")!,
      name: localStorage.getItem("user_name") ?? "",
      nickname: localStorage.getItem("user_name"),
      avatar_color: localStorage.getItem("avatar_color"),
    };
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, name, nickname, avatar_color")
    .eq("auth_id", session.user.id)
    .maybeSingle();

  if (error) console.error("[auth] could not load profile:", error.message);
  if (!data) return null;

  cacheProfile(data as AppProfile);
  return data as AppProfile;
}

/** Marks onboarding finished on this device. */
export const markSetupComplete = (): void => localStorage.setItem("setup_complete", "true");

// ─── Sign out ─────────────────────────────────────────────────────────────────

/** Signs THIS device out (the partner's device is unaffected) and wipes local state. */
export async function signOutAndWipe(): Promise<void> {
  lockApp();
  await supabase.auth.signOut({ scope: "local" });
  [
    PIN_HASH_KEY, PIN_FAILS_KEY,
    "biometric_enabled", "biometric_credential_id",
    "user_id", "user_name", "avatar_color", "setup_complete",
    "partner_id", "partner_name", "partner_color",
  ].forEach((k) => localStorage.removeItem(k));
}
