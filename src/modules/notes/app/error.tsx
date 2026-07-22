"use client";

import { useEffect } from "react";

/**
 * Error boundary for the notebook itself. listNotes() reads Turso
 * server-side; a failure here should stay recoverable inside the app
 * shell rather than blanking the notebook. Notes' own quiet register.
 */
export default function NotebookError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("notes/app: uncaught error", error);
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
            color: "var(--color-ink)",
            marginBottom: "0.5rem",
          }}
        >
          The notebook didn&rsquo;t load.
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "var(--color-ink-soft)",
            marginBottom: "1.25rem",
          }}
        >
          Nothing was lost, your notes are saved. This was a loading
          hiccup, not a deletion.
        </p>
        {error.digest ? (
          <p
            style={{
              fontFamily: "monospace",
              fontSize: "0.7rem",
              color: "var(--color-ink-faint)",
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
            background: "var(--color-accent)",
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
