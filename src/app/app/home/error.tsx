"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "@/components/app/home/home.module.css";

/**
 * /app/home error boundary. The read behind Home failed; Home stays
 * recoverable inside the app shell, and the work itself is one click away.
 * A Home failure must never strand the reader.
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
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <div className={styles.centered} role="alert">
          <h1 className={styles.h1}>Home did not load</h1>
          <p className={styles.centeredText}>
            Your work could not be read just now. Nothing has changed. Try again, or go straight to your tasks.
          </p>
          {error.digest ? (
            <p className={styles.footnote} style={{ marginTop: 12 }}>
              Reference {error.digest}
            </p>
          ) : null}
          <div className={styles.centeredActions}>
            <button type="button" className={styles.primary} onClick={reset}>
              Try again
            </button>
            <Link href="/app/tasks" className={styles.secondary}>
              Open Tasks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
