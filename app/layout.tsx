import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Phase 6: self-hosted Stack Sans (OFL) via next/font — the text face is
// preloaded with a metric-adjusted fallback (no layout shift on first paint).
// woff2 files copied from @fontsource into app/fonts.
const stackSansText = localFont({
  src: "./fonts/stack-sans-text-latin-wght-normal.woff2",
  weight: "200 700",
  display: "swap",
  variable: "--font-stack-sans",
  preload: true,
});

const stackSansNotch = localFont({
  src: [
    { path: "./fonts/stack-sans-notch-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/stack-sans-notch-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-notch",
  preload: false,
});

export const metadata: Metadata = {
  title: "Just Us",
  description: "A private chat & calling app for two.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Just Us",
  },
  // Chrome deprecated apple-mobile-web-app-capable alone; it wants the standard tag too
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#1E1B18",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

import GlobalOverlay from "@/components/GlobalOverlay";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${stackSansText.variable} ${stackSansNotch.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans antialiased overflow-x-hidden" style={{ background: "var(--gradient)" }}>
        {children}
        <GlobalOverlay />
      </body>
    </html>
  );
}
