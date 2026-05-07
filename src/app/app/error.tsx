"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

/**
 * Error boundary for the protected `/app/*` routes. Catches any
 * uncaught error in a server component or client effect and shows a
 * friendly fallback while logging to Sentry. The "try again" button
 * resets the boundary's error state and re-renders the failed segment.
 */
export default function AppError({
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
    <div className="flex min-h-[60vh] flex-1 items-center justify-center px-6">
      <div className="w-full max-w-[460px] rounded-2xl border border-line-soft bg-bg-elevated p-7 text-center shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)]">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-rose-700">
          Something snapped
        </div>
        <h2 className="mt-2 text-balance text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ink">
          The workspace took a wrong turn.
        </h2>
        <p className="mx-auto mt-2 max-w-[40ch] text-[12.5px] leading-[1.55] text-ink-soft">
          We logged the failure and our team will see it. Try again, or
          duck back to the home view while we sort it out.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[10.5px] tabular-nums text-ink-quiet">
            ref · {error.digest}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition-transform hover:-translate-y-px"
          >
            Try again
          </button>
          <Link
            href="/app/board"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
          >
            Back to board
          </Link>
        </div>
      </div>
    </div>
  );
}
