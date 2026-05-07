"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export default function ShareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="px-6 pt-6">
        <Wordmark size="md" />
      </div>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[460px] rounded-2xl border border-line-soft bg-bg-elevated p-7 text-center shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)]">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-rose-700">
            Couldn&rsquo;t open this share link
          </div>
          <h2 className="mt-2 text-balance text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ink">
            Something with this link isn&rsquo;t right.
          </h2>
          <p className="mx-auto mt-2 max-w-[40ch] text-[12.5px] leading-[1.55] text-ink-soft">
            Could be revoked, expired, or just a typo in the URL. Ping
            whoever sent it for a fresh one.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition-transform hover:-translate-y-px"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
