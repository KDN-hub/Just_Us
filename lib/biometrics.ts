"use client";

const BIOMETRIC_ENABLED_KEY = "biometric_enabled";
const BIOMETRIC_CRED_KEY = "biometric_credential_id";

/**
 * Helper to convert an ArrayBuffer to a base64 string.
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Helper to convert a base64 string to an ArrayBuffer.
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Checks if the current browser and device support platform biometrics (Face ID, Touch ID, Windows Hello, Android Biometric).
 */
export async function isBiometricsSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  if (!window.PublicKeyCredential) return false;
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Checks if biometric unlock is currently enabled on this device.
 */
export function isBiometricsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true" && !!localStorage.getItem(BIOMETRIC_CRED_KEY);
}

/**
 * Disables and clears biometric credentials from this device.
 */
export function disableBiometrics(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  localStorage.removeItem(BIOMETRIC_CRED_KEY);
}

/**
 * Prompts the user to register their platform biometric (Face ID / Fingerprint / Passkey).
 */
export async function registerBiometrics(
  userName: string = "User"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supported = await isBiometricsSupported();
    if (!supported) {
      return { ok: false, error: "Biometrics is not available on this device." };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new Uint8Array(16);
    window.crypto.getRandomValues(userId);

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "Just Us",
        },
        user: {
          id: userId,
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256
          { alg: -257, type: "public-key" }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { ok: false, error: "Registration was cancelled or failed." };
    }

    const credIdBase64 = bufferToBase64(credential.rawId);
    localStorage.setItem(BIOMETRIC_CRED_KEY, credIdBase64);
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");

    return { ok: true };
  } catch (err: unknown) {
    console.warn("[biometrics] registration error:", err);
    const name = (err as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "AbortError") {
      return { ok: false, error: "Biometric setup was cancelled." };
    }
    return { ok: false, error: (err as Error)?.message || "Failed to set up biometrics." };
  }
}

/**
 * Prompts the user to authenticate using their platform biometric (Face ID / Fingerprint).
 */
export async function authenticateBiometrics(): Promise<{
  ok: boolean;
  cancelled?: boolean;
  error?: string;
}> {
  try {
    if (!isBiometricsEnabled()) {
      return { ok: false, error: "Biometrics is not enabled on this device." };
    }

    const supported = await isBiometricsSupported();
    if (!supported) {
      return { ok: false, error: "Biometrics is not supported." };
    }

    const credIdBase64 = localStorage.getItem(BIOMETRIC_CRED_KEY);
    if (!credIdBase64) {
      return { ok: false, error: "No biometric credential found." };
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: base64ToBuffer(credIdBase64),
            type: "public-key",
          },
        ],
        userVerification: "required",
        timeout: 60000,
      },
    });

    if (assertion) {
      return { ok: true };
    }
    return { ok: false, error: "Biometric verification failed." };
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "AbortError") {
      return { ok: false, cancelled: true };
    }
    console.warn("[biometrics] auth error:", err);
    return { ok: false, error: (err as Error)?.message || "Biometric authentication failed." };
  }
}
