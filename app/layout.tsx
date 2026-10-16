import type { Metadata, Viewport } from "next";
import "@fontsource-variable/stack-sans-text";
import "./globals.css";

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
    <html lang="en">
      <body className="flex min-h-dvh flex-col font-sans antialiased overflow-x-hidden" style={{ background: "var(--gradient)" }}>
        {children}
        <GlobalOverlay />
      </body>
    </html>
  );
}
