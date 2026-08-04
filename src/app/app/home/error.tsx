"use client";

import { useEffect } from "react";

/**
 * /app/home error boundary. The briefing read failed; Home stays
 * recoverable inside the app shell, in the suite's quiet register.
 * The products remain one click away — a Home failure must never
 * strand the reader.
 */
export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("home: uncaught error", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "50vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: "24rem" }}>
        <h1
          style={{
            fontSize: "1.05rem",
            fontWeight: 600,
            color: "var(--color-ink, var(--ink))",
            marginBottom: "0.5rem",
          }}
        >
          Home didn&rsquo;t load.
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "var(--color-ink-soft, var(--ink-soft))",
            marginBottom: "1.25rem",
          }}
        >
          The briefing couldn&rsquo;t be read just now. Your work is
          untouched — try again, or go straight to Notes, Tasks or
          Timeline from the rail.
        </p>
        {error.digest ? (
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "0.7rem",
              color: "var(--color-ink-faint, var(--ink-faint))",
              marginBottom: "1rem",
            }}
          >
            ref · {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            background: "var(--color-accent, var(--accent))",
            color: "var(--paper, #ffffff)",
            border: "none",
            borderRadius: "8px",
            padding: "0.6rem 1.1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
