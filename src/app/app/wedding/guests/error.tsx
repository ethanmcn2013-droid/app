"use client";

import { useEffect } from "react";
import { WeddingError } from "@/components/app/wedding/wedding-states";

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
  return <WeddingError digest={error.digest} onRetry={() => (retry ?? reset)?.()} />;
}
