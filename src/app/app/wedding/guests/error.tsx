"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "@/components/app/wedding/wedding-error.module.css";

/**
 * /app/wedding/guests error boundary. The read failed; nothing was changed
 * and every guest is still on the list. Retry re-fetches the segment (Next 16
 * `retry`), falling back to `reset` where it is absent.
 */
export default function WeddingGuestsError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("wedding-guests: uncaught error", error);
  }, [error]);
  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Wedding tools</p>
        <h1 className={styles.title}>Guest list</h1>
        <section className={styles.empty} role="alert">
          <h2 className={styles.emptyTitle}>The guest list didn&rsquo;t load</h2>
          <p className={styles.emptyBody}>Nothing was changed and every guest is still on the list. Try again in a moment.</p>
          {error.digest ? <p className={styles.hint}>Reference {error.digest}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.btnPrimary} onClick={() => (retry ?? reset)?.()}>Try again</button>
            <Link href="/app/tasks" className={styles.btn}>Open Tasks</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
