"use client";

import { useEffect } from "react";

/**
 * Error boundary for the briefing. buildBriefingForUser() reads the
 * Tasks source server-side; a failure should stay recoverable inside
 * the app shell in Signal's own quiet register — never a bounce to a
 * sibling product.
 */
export default function SignalBriefError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("signal/app: uncaught error", error);
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
            color: "var(--ink)",
            marginBottom: "0.5rem",
          }}
        >
          The briefing didn&rsquo;t assemble.
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "var(--ink-soft)",
            marginBottom: "1.25rem",
          }}
        >
          Signal could not finish reading your work just now. Nothing was
          marked healthy in the meantime. Try again, or come back in a
          moment.
        </p>
        {error.digest ? (
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "0.7rem",
              color: "var(--ink-faint)",
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
            background: "var(--accent)",
            color: "var(--paper)",
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
