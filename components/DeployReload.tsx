"use client";

import { useEffect } from "react";

/**
 * Deploy freshness for the PWA.
 *
 * Why: next-pwa's generated service worker runs with skipWaiting + clientsClaim,
 * so a newly deployed worker takes over already-open pages almost immediately
 * (the page sees `controllerchange`). But the default registration never acts
 * on that event — an in-memory page keeps running the old bundle until the next
 * *cold* load, and after a deploy a cold load is a race:
 *   • fast network → fresh HTML → new build (it "worked")
 *   • slow network → the navigation fetch times out (5s) and the SW serves the
 *     previous HTML still living in the 30-day "pages" cache → old build again
 *     (it "went back") — until yet another later load happens to win the race.
 *
 * This component closes the loop in code of its own (no shared files with
 * work in progress):
 *  1. An explicit `registration.update()` on every mount nudges the update
 *     check so takeover lands this session rather than one open later. sw.js
 *     is served `max-age=0, must-revalidate`, so the check always sees the
 *     freshly deployed worker; `updateViaCache: "none"` is set as well so the
 *     update algorithm itself never trusts an intermediary cache.
 *  2. A real takeover of an already-controlled page (`controllerchange`) is
 *     answered with exactly one reload so the user is left on the deployed
 *     version. First installs (no previous controller) are ignored — reloading
 *     there would only re-flash a brand-new visitor.
 */
export default function DeployReload() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Only react to takeover-of-an-already-controlled page.
    const hadControllerAtStart = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;

    const onControllerChange = () => {
      if (reloaded || !hadControllerAtStart || !navigator.serviceWorker.controller) return;
      reloaded = true;
      location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {
        // Registration failures (offline sessions, private mode) are not
        // actionable here; the default registration already logs them.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
