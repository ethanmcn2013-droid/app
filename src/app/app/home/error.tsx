"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "@/components/app/home/bento/home-bento.module.css";

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
      <div className={styles.inner} role="alert">
        <header className={styles.head}>
          <h1 className={styles.h1}>Home did not load</h1>
          <p className={styles.welcome}>Your work could not be read just now. Nothing has changed. Try again, or go straight to your tasks.</p>
          {error.digest ? <p className={styles.date}>Reference {error.digest}</p> : null}
        </header>
        <div className={styles.actions}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={reset}>
            Try again
          </button>
          <Link href="/app/tasks" className={styles.btn} style={{ border: "1px solid var(--v3-border-strong)", color: "var(--v3-text)" }}>
            Open Tasks
          </Link>
        </div>
      </div>
    </div>
  );
}
