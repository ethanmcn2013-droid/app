"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./_components/timeline-index.module.css";

/**
 * Error boundary for the Timeline /app/timeline/* routes (v3, round 2).
 * Keeps a per-user failure recoverable, says what happened in plain words,
 * and offers the one way back that fits where it happened: All projects for
 * a plan, Projects for All projects. It makes no promise about work it cannot
 * check.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() ?? "";
  const onPlan = /^\/app\/timeline\/(?!audience)[^/]+/.test(pathname);

  useEffect(() => {
    console.error("timeline/app: uncaught error", error);
  }, [error]);

  return (
    <div data-timeline-module className={styles.page}>
      <section className={styles.card} aria-labelledby="timeline-error-title">
        <span className={styles.mark} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 4.75v3.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="10.9" r="0.9" fill="currentColor" />
          </svg>
        </span>
        <h1 id="timeline-error-title" className={styles.title}>
          {onPlan ? "This plan didn’t load" : "Timeline didn’t load"}
        </h1>
        <p className={styles.body}>Something went wrong while loading it. Try again in a moment.</p>
        {error.digest ? <p className={styles.digest}>Reference {error.digest}</p> : null}
        <div className={styles.actions}>
          <button type="button" onClick={reset} className={styles.primary}>
            Try again
          </button>
          {onPlan ? (
            <Link href="/app/timeline" className={styles.secondary}>
              Back to all projects
            </Link>
          ) : (
            <Link href="/app/project" className={styles.secondary}>
              Open Projects
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
