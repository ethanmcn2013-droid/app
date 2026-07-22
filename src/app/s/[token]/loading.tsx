export default function SharedTimelineLoading() {
  return (
    <main className="min-h-dvh bg-paper px-[clamp(1.25rem,4vw,4.5rem)] py-8" aria-label="Loading timeline">
      <div className="h-px w-full bg-ink" />
      <div className="mt-4 h-3 w-20 animate-pulse rounded-full bg-hairline motion-reduce:animate-none" />
      <div className="mt-[18vh] h-20 w-2/3 max-w-2xl animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--paper-deep)_99%,var(--ink))] motion-reduce:animate-none" />
      <div className="mt-[20vh] h-px w-full bg-ink-ghost" />
      <span className="sr-only">Loading shared timeline</span>
    </main>
  );
}
