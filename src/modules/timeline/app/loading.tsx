/**
 * In-app loading boundary for the Timeline dashboard (/app/plan).
 *
 * Renders in normal document flow, no fixed positioning, no z-index override.
 * The StudioBar shell (host) remains visible above this content well.
 *
 * Skeleton classes reference tl-skeleton-shimmer (T4: scoped to
 * [data-timeline-module] in timeline.css). Reduced-motion: degrades to
 * a static var(--bg-deep) block.
 *
 * Server Component, no "use client", zero client JS.
 */
export default function AppLoading() {
  return (
    <div data-timeline-module className="mx-auto w-full max-w-4xl px-6 py-12" aria-hidden>
      {/* Workspace header skeleton */}
      <div className="mb-10 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="tl-skeleton-shimmer h-3 w-20 rounded" />
          <div className="tl-skeleton-shimmer h-7 w-48 rounded" />
          <div className="tl-skeleton-shimmer mt-1 h-4 w-32 rounded" />
        </div>
        <div className="tl-skeleton-shimmer mt-1 h-5 w-16 rounded-full" />
      </div>

      {/* Projects section skeleton */}
      <section>
        <div className="mb-4">
          <div className="tl-skeleton-shimmer h-3.5 w-14 rounded" />
        </div>
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl border px-4 py-3.5"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex flex-col gap-1.5">
                <div className="tl-skeleton-shimmer h-3.5 w-36 rounded" />
                <div className="tl-skeleton-shimmer h-3 w-20 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
