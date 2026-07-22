"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for the Timeline /app/plan/* routes.
 * Keeps a per-user DB failure recoverable and scopes "go back" to the dashboard.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("timeline/app: uncaught error", error);
  }, [error]);

  return (
    <div data-timeline-module className="mx-auto w-full max-w-md py-20 px-6 text-center">
      <p
        className="mb-2 text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--brand)", letterSpacing: "0.12em" }}
      >
        Something went wrong
      </p>
      <h1
        className="mb-2 text-2xl font-semibold"
        style={{ letterSpacing: "-0.02em", color: "var(--ink)" }}
      >
        Your workspace hit a snag.
      </h1>
      <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
        Nothing was lost, the last load failed. Try again, or head back to
        your dashboard.
      </p>
      {error.digest ? (
        <p
          className="mb-4 font-mono text-[11px] tabular-nums"
          style={{ color: "var(--ink-quiet)" }}
        >
          ref · {error.digest}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all"
          style={{ background: "var(--brand)" }}
        >
          Try again
        </button>
        <Link
          href="/app/plan"
          className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
