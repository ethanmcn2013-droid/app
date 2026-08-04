export default function SharedTimelineNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6 py-16 text-ink">
      <div className="w-full max-w-md border-t border-ink pt-6">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-ink-faint">
          timeline
        </p>
        {/* Sized for the 404's narrow measure; voice (tracking + leading)
            rides the ratified artifact display register. */}
        <h1 className="mt-16 max-w-[9ch] text-[clamp(3rem,12vw,5.5rem)] font-semibold leading-[var(--x-artifact-display-leading)] tracking-[var(--x-artifact-display-tracking)]">
          This link has reached its end.
        </h1>
        <p className="mt-8 max-w-sm text-sm leading-6 text-[color-mix(in_srgb,var(--ink-faint)_88%,var(--ink))]">
          The owner may have rotated, revoked or unpublished this timeline.
          Ask them for the current link.
        </p>
      </div>
    </main>
  );
}
