"use client";

import { useEffect } from "react";
import Link from "next/link";
import { HOME_APP_PATH } from "@/lib/product-urls";

/**
 * /app/tasks error boundary. A Tasks failure speaks Tasks, stays inside the
 * app shell, and says the one thing the reader needs to know first: the
 * work is still there. One way to try again, one way home.
 */
export default function TasksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app/tasks: uncaught error", error);
  }, [error]);

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-[color:var(--v3-canvas)] px-4 py-16">
      <div role="alert" className="flex w-full max-w-[420px] flex-col items-start gap-3 rounded-[var(--v3-radius-xl)] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface)] p-6 shadow-[var(--v3-shadow-1)]">
        <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--v3-fill)] text-[color:var(--v3-text-2)]">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 5v3.25M8 10.75v.01" />
          </svg>
        </span>
        <h1 className="text-[17px] font-semibold leading-snug text-[color:var(--v3-text)]">Tasks didn&rsquo;t load. Your work is safe.</h1>
        <p className="text-[13.5px] leading-relaxed text-[color:var(--v3-text-2)]">
          Nothing was lost. This is usually a connection that dropped for a moment.
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[44px] items-center rounded-[var(--v3-radius)] bg-[color:var(--v3-accent)] px-4 text-[13px] font-medium text-[color:var(--v3-on-accent)] hover:bg-[color:var(--v3-accent-hover)] md:min-h-[36px]"
          >
            Try again
          </button>
          <Link
            href={HOME_APP_PATH}
            className="inline-flex min-h-[44px] items-center rounded-[var(--v3-radius)] border border-[color:var(--v3-border)] bg-[color:var(--v3-surface)] px-4 text-[13px] font-medium text-[color:var(--v3-text)] hover:bg-[color:var(--v3-hover)] md:min-h-[36px]"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
