"use client";

import { useEffect } from "react";
import styles from "../components/overview/overview.module.css";

/**
 * Error boundary for the Overview. buildBriefingForUser() reads the Tasks
 * source server-side; a failure stays recoverable inside the app shell, in
 * the page's own register, and never bounces to a sibling product.
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
    <div className={`${styles.page} thin-scroll`}>
      <div className={styles.inner}>
        <div className={styles.failure}>
          <h1 className={styles.failureTitle}>The Overview didn&rsquo;t load.</h1>
          <p className={styles.failureBody}>
            Signal could not finish reading your work just now. Nothing was
            marked healthy in the meantime. Try again, or come back in a
            moment.
          </p>
          <button type="button" onClick={reset} className={styles.button}>
            Try again
          </button>
          {error.digest ? (
            <p className={styles.failureRef}>Reference {error.digest}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
