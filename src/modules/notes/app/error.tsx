"use client";

import { useEffect } from "react";
import styles from "./loading.module.css";

/**
 * Error boundary for the notebook. listNotes() reads the database on the
 * server; a failure here stays recoverable inside the app shell rather than
 * blanking the page, and says the one thing a person needs to hear first.
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
    <div className={styles.error}>
      <div className={styles.errorCard} role="alert">
        <span className={styles.errorMark} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="8" cy="8" r="5.75" />
            <path d="M8 5v3.5M8 10.75v.01" />
          </svg>
        </span>
        <h1 className={styles.errorTitle}>Notes did not load. Your notes are safe.</h1>
        <p className={styles.errorBody}>
          Nothing was changed. Try again, and if it keeps happening, come back in a few minutes.
        </p>
        {error.digest ? <p className={styles.errorRef}>Reference {error.digest}</p> : null}
        <button type="button" className={styles.retry} onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
