// ============================================================
//  Just Us — PWA helpers (Phase 4)
//
//  requestPersistentStorage(): asks the browser to make this
//  origin's storage (IndexedDB = every message we hold) exempt
//  from automatic eviction. Chrome grants it silently for
//  installed/engaged PWAs; elsewhere the browser may ignore it
//  and that is fine — Dexie keeps working either way.
// ============================================================

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    const granted = await navigator.storage.persist();
    if (granted) console.info("[pwa] persistent storage granted");
    return granted;
  } catch {
    return false;
  }
}
