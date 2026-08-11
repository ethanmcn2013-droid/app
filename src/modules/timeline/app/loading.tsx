/**
 * Loading boundary for /app/timeline, the module's own entry.
 *
 * Without one, this segment fell through to the app-root boundary at
 * src/app/app/loading.tsx — which is the Tasks wordmark loader, letters
 * spelling t-a-s-k-s over an entry into Timeline. Correct for the cold /app
 * boot it was written for; wrong as the arrival state of a different product.
 *
 * Nothing new is invented here. It is the plan boundary's own skeleton in the
 * same register (`tl-skeleton-shimmer` from timeline.css, loaded for every
 * timeline route by the segment layout), shaped to what /app/timeline
 * actually paints: the project header row, then the artifact's hero and its
 * rail. Server Component, no "use client", zero client JS, and the only
 * announced content is the status line — the skeleton itself is decoration
 * and says so.
 */
export default function TimelineHomeLoading() {
  return (
    <div
      data-timeline-module
      className="flex w-full flex-1 flex-col"
    >
      <p className="sr-only" role="status" aria-live="polite">
        Loading your timeline.
      </p>
      <div aria-hidden className="flex flex-1 flex-col">
        {/* Owner header: switcher, anchor line, view control, share */}
        <div className="border-b border-line-soft">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex flex-col gap-1.5">
              <div className="tl-skeleton-shimmer h-4 w-44 rounded" />
              <div className="tl-skeleton-shimmer h-3 w-56 rounded" />
            </div>
            {/* A literal 44px: this repo remaps Tailwind's numeric spacing
                scale, so `h-11` resolves to 80px and would paint a control
                row nearly twice the height of the one it is standing in for. */}
            <div className="flex items-center gap-2">
              <div className="tl-skeleton-shimmer h-[44px] w-44 rounded-lg" />
              <div className="tl-skeleton-shimmer h-[44px] w-24 rounded-lg" />
              <div className="tl-skeleton-shimmer h-[44px] w-24 rounded-full" />
            </div>
          </div>
        </div>

        {/* The artifact: name on the left, the stat unit on the right */}
        <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col px-6 py-10 sm:px-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-3">
              <div className="tl-skeleton-shimmer h-3.5 w-32 rounded" />
              <div className="tl-skeleton-shimmer h-14 w-72 rounded" />
              <div className="tl-skeleton-shimmer h-4 w-64 rounded" />
            </div>
            <div className="flex w-52 flex-col items-start gap-2 border-t pt-4 lg:items-end" style={{ borderColor: "var(--hairline)" }}>
              <div className="tl-skeleton-shimmer h-3 w-28 rounded" />
              <div className="tl-skeleton-shimmer h-10 w-24 rounded" />
              <div className="tl-skeleton-shimmer h-3 w-32 rounded" />
            </div>
          </div>

          {/* The rail: one line, marks along it */}
          <div className="relative mt-12 h-40">
            <div
              className="absolute inset-x-0 top-1/2 h-px"
              style={{ background: "var(--ink-ghost)" }}
            />
            <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
              {[0, 1, 2, 3, 4, 5].map((mark) => (
                <div key={mark} className="tl-skeleton-shimmer h-2.5 w-2.5 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
