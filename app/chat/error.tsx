"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[chat] Unhandled error:", error);
  }, [error]);

  return (
    <main
      className="flex h-dvh flex-col items-center justify-center p-6 text-center font-sans"
      style={{ background: "var(--gradient)" }}
    >
      <div className="mb-6 rounded-full bg-red-900/30 p-4 ring-1 ring-red-500/50">
        <AlertTriangle className="h-10 w-10 text-red-500" strokeWidth={1.5} />
      </div>
      <h2 className="mb-2 text-2xl font-semibold text-[var(--cream)]">
        Something went wrong
      </h2>
      <p className="mb-8 max-w-sm text-sm text-[var(--muted)]">
        The chat encountered an unexpected error.
      </p>
      
      <div className="flex flex-col gap-3 w-full max-w-[240px]">
        <button
          onClick={() => reset()}
          className="flex h-12 w-full items-center justify-center rounded-full bg-[var(--wine)] font-medium text-white transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="flex h-12 w-full items-center justify-center rounded-full border border-[var(--border)] font-medium text-[var(--cream)] transition-colors hover:bg-white/5"
        >
          Go back home
        </Link>
      </div>
    </main>
  );
}
