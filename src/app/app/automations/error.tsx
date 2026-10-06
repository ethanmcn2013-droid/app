"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AUTOMATIONS_APP_PATH, AUTOMATIONS_LABEL } from "@/lib/product-urls";
import styles from "@/components/app/automations/automations.module.css";

/**
 * /app/automations error boundary, for the list and the canvas. Drafts are
 * saved as they change, so the last saved one is still in this browser.
 */
export default function AutomationsError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error("automations: uncaught error", error);
  }, [error]);

  return (
    <main id="app-main-content" tabIndex={-1} className={styles.editor}>
      <div className={styles.missing} role="alert">
        <h1>Something went wrong on this page</h1>
        <p>Your drafts are saved as you go, so the last saved one is still in this browser. Try again, or go back to the list.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={styles.primary} onClick={() => (retry ?? reset)?.()}>
            Try again
          </button>
          <Link href={AUTOMATIONS_APP_PATH} className={styles.button}>
            Back to {AUTOMATIONS_LABEL}
          </Link>
        </div>
      </div>
    </main>
  );
}
