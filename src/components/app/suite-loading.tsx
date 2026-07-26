import { LongWaitStatus } from "@/components/system/long-wait-status";

/**
 * Product-neutral fallback for the shared authenticated frame. Product route
 * boundaries may provide richer loaders; this one must never identify a
 * sibling product incorrectly while the common access check resolves.
 */
export function SuiteLoading() {
  return (
    <main
      id="app-main-content"
      tabIndex={-1}
      aria-busy="true"
      className="grid min-h-0 min-w-0 flex-1 place-items-center bg-[var(--paper)]"
    >
      <div
        aria-label="Opening Signal Studio"
        className="flex flex-col items-center gap-4"
        role="status"
      >
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none"
        />
        <LongWaitStatus line="Opening Signal Studio" />
      </div>
    </main>
  );
}
