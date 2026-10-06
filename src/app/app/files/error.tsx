"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ShellIcon } from "@/components/shell/shell-icons";
import styles from "@/components/app/files/files.module.css";

/**
 * /app/files error boundary. The read failed; nothing was changed, and every
 * file is still on its task. Retry re-fetches the segment (Next 16 `retry`),
 * falling back to `reset` where it is absent.
 */
export default function FilesError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("files: uncaught error", error);
  }, [error]);

  return (
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>Files</h1>
            </div>
            <p className={styles.summary}>
              <span>Everything attached to this project&rsquo;s tasks.</span>
            </p>
          </div>
        </header>
        <section className={styles.empty} role="alert">
          <span className={styles.emptyIcon} aria-hidden="true">
            <ShellIcon.alert size={20} />
          </span>
          <h2 className={styles.emptyTitle}>The files didn&rsquo;t load</h2>
          <p className={styles.emptyBody}>
            Nothing was changed and every file is still on its task. Try again, or open the task you need.
          </p>
          {error.digest ? <p className={styles.foot}>Reference {error.digest}</p> : null}
          <div className={styles.emptyActions}>
            <button type="button" className={styles.btnPrimary} onClick={() => (retry ?? reset)?.()}>
              Try again
            </button>
            <Link href="/app/tasks" className={styles.btn}>
              Open Tasks
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
