"use client";

export function ChatCatalogUnavailable({ retrying, onRetry, className }: { retrying: boolean; onRetry: () => void; className?: string }) {
  return <section className={className} aria-label="Project conversations unavailable"><h2>Conversations are unavailable</h2><p>Signal Studio cannot reach your Project conversations. Try again shortly.</p><button disabled={retrying} onClick={onRetry} type="button">{retrying ? "Trying again…" : "Try again"}</button></section>;
}
