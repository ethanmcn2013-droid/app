"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShellIcon } from "@/components/shell/shell-icons";
import styles from "@/components/app/analytics/analytics.module.css";

/**
 * /app/analytics error boundary. The read failed; nothing was changed, and
 * the work itself is one click away on the board. Retry re-fetches the
 * segment (Next 16 `retry`), falling back to `reset` where it is absent.
 */
export default function AnalyticsError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("analytics: uncaught error", error);
  }, [error]);

  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Analytics</h1>
            <p className={styles.subtitle}>How work is moving in this project.</p>
          </div>
        </header>
        <section className={styles.empty} role="alert">
          <span className={styles.emptyIcon} aria-hidden="true">
            <ShellIcon.alert size={20} />
          </span>
          <h2 className={styles.emptyTitle}>The numbers didn&rsquo;t load</h2>
          <p className={styles.emptyBody}>
            Nothing was changed and your tasks are safe. Try again, or open the board while this sorts itself out.
          </p>
          {error.digest ? <p className={styles.cardSub}>Reference {error.digest}</p> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" className={styles.buttonPrimary} onClick={() => (retry ?? reset)?.()}>
              Try again
            </button>
            <Link href="/app/tasks" className={styles.button}>
              Open Tasks
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
