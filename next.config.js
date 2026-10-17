const runtimeCaching = require("next-pwa/cache");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  // Keeps next-pwa's default exclusion ('!noprecache/**/*') and drops three
  // unreferenced heavy files from the precache list. images/logo.png and
  // icons/icon-source.png are ~1.5MB each; test.html is a dev artifact. All three
  // stay in /public and are still served on demand — they're just not downloaded
  // during service-worker install.
  publicExcludes: [
    "!noprecache/**/*",
    "!images/logo.png",
    "!icons/icon-source.png",
    "!test.html",
  ],
  // Offline shell (Phase 4): a navigation that can't reach the network falls
  // back to the cached copy of that page; if even that is missing (a route
  // never visited before) the precached /offline page is served instead.
  fallbacks: {
    document: "/offline",
  },
  // next-pwa's default runtime caching plus one curated rule: page documents
  // live in their own long-lived cache instead of the generic 24h bucket,
  // with a shorter network timeout so the offline shell shows up fast.
  runtimeCaching: [
    {
      urlPattern: ({ request, url }) => request.mode === "navigate" && url.origin === self.location.origin,
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    ...runtimeCaching,
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withPWA(nextConfig);
