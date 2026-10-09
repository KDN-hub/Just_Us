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
});

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = withPWA(nextConfig);
