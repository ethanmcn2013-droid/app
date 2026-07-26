/**
 * Loading boundary for /app/timeline/[projectSlug].
 *
 * Renders in normal document flow below the persistent StudioBar shell.
 * Skeleton uses tl-skeleton-shimmer (T4: scoped in timeline.css).
 * Server Component, no "use client", zero client JS.
 */
export default function PlanLoading() {
  return (
    <div
      data-timeline-module
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10"
      aria-hidden
    >
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex items-center gap-1.5">
        <div className="tl-skeleton-shimmer h-3 w-20 rounded" />
        <div className="h-3 w-2 rounded" style={{ background: "var(--bg-deep)" }} />
        <div className="tl-skeleton-shimmer h-3 w-28 rounded" />
      </div>

      {/* Title block skeleton */}
      <div className="mb-8 flex flex-col gap-2">
        <div className="tl-skeleton-shimmer h-7 w-56 rounded" />
        <div className="tl-skeleton-shimmer h-4 w-72 rounded" />
      </div>

      {/* Milestones section skeleton */}
      <div className="flex flex-col gap-3">
        <div className="tl-skeleton-shimmer h-4 w-24 rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="tl-skeleton-shimmer h-4 w-4 flex-shrink-0 rounded" />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className="tl-skeleton-shimmer h-3.5 w-48 rounded" />
              <div className="tl-skeleton-shimmer h-3 w-32 rounded" />
            </div>
            <div className="tl-skeleton-shimmer h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
