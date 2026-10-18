import Link from "next/link";

export const metadata = {
  title: "Offline — Just Us",
};

// Last-resort offline shell (Phase 4). The service worker precaches this page
// and serves it when a navigation can't reach the network and no cached copy
// of the requested page exists. Everything the user actually wrote is already
// safe in IndexedDB — this page just needs to say so, gently.
export default function OfflinePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--bg)] px-8 text-center text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--wine)]/30 bg-[var(--wine)]/20 text-[var(--gold)] shadow-xl">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
          aria-hidden="true"
        >
          <path d="M2 8.82a15 15 0 0 1 20 0" />
          <path d="M5 12.859a10 10 0 0 1 14 0" />
          <path d="M8.5 16.429a5 5 0 0 1 7 0" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      </div>

      <h1 className="mt-5 text-[20px] font-bold">You&rsquo;re offline</h1>
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-white/55">
        No internet right now — but everything you two have sent is safe on this device and will
        sync the moment you&rsquo;re back.
      </p>

      <Link
        href="/"
        className="mt-7 inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-[var(--wine)] px-6 text-[15px] font-semibold text-white shadow-lg active:scale-[0.97]"
      >
        Try again
      </Link>
    </main>
  );
}
