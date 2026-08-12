"use client";

import { useEffect } from "react";

/**
 * /app/tasks error boundary.
 *
 * Tasks had none, so a failure in any of the four views fell through to the
 * /app boundary — which speaks in the suite's voice and offers "Back to
 * board" as the way out. Offering the board as an escape from the board is
 * a dead end. A Tasks failure speaks Tasks, stays inside the app shell, and
 * says the one thing the reader actually needs to know: the work is still
 * there.
 *
 * Same register as the Notes, Signal and Home boundaries (module-local,
 * quiet, one primary action) — no card chrome, no alarm colour, no stack.
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
          This view didn&rsquo;t open.
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "var(--ink-soft)",
            marginBottom: "1.25rem",
          }}
        >
          Your tasks are safe — nothing was changed and nothing was lost.
          Try again, or switch to another view from the tabs above.
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
            borderRadius: "999px",
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
