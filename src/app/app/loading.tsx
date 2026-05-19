/**
 * /app segment loading skeleton — DESIGN.md §13 loading-boundary canon.
 *
 * Paints while AppShell (auth + DB reads) resolves inside the Suspense
 * boundary in layout.tsx:124. Mirrors the shell shape: sidebar ghost
 * (desktop-only, w-[252px]) + main content area with column-header
 * and card ghosts. No animation beyond a single CSS pulse — reduced-motion
 * respected via the Tailwind animate-pulse class.
 *
 * SuiteChrome already renders synchronously above this in the layout
 * (monotonic reveal contract, LOADING_SYSTEM.md §4) so the chrome is
 * never blank while this skeleton shows.
 */
export default function AppLoading() {
  return (
    <div className="flex min-w-0 flex-1 overflow-hidden" aria-hidden="true">
      {/* Sidebar ghost — desktop only, matches DesktopSidebar w-[252px] */}
      <div className="hidden h-full w-[252px] flex-shrink-0 flex-col border-r border-line-soft bg-bg-sunken/40 md:flex">
        {/* Header row */}
        <div className="flex h-12 items-center border-b border-line-soft/70 px-4">
          <div className="h-4 w-20 animate-pulse rounded bg-line-soft" />
        </div>
        {/* Nav items */}
        <div className="flex flex-col gap-1 p-3">
          {[80, 64, 56, 72, 56, 64, 48].map((w, i) => (
            <div
              key={i}
              className="flex h-8 items-center gap-2 rounded-md px-2"
            >
              <div className="h-4 w-4 flex-shrink-0 animate-pulse rounded bg-line-soft" />
              <div
                className="h-3 animate-pulse rounded bg-line-soft"
                style={{ width: `${w}%` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Page header */}
        <div className="flex h-12 flex-shrink-0 items-center border-b border-line-soft px-5 gap-3">
          <div className="h-4 w-28 animate-pulse rounded bg-line-soft" />
          <div className="ml-auto h-7 w-20 animate-pulse rounded-full bg-line-soft" />
        </div>

        {/* Board column ghosts — 4 columns on desktop, 1 on mobile */}
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {[4, 3, 2, 3].map((cards, colIdx) => (
            <div
              key={colIdx}
              className="flex w-[260px] flex-shrink-0 flex-col gap-2 md:flex"
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-1 pb-1">
                <div className="h-3 w-16 animate-pulse rounded bg-line-soft" />
                <div className="h-3 w-6 animate-pulse rounded bg-line-soft" />
              </div>
              {/* Task card ghosts */}
              {Array.from({ length: cards }).map((_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="flex flex-col gap-2 rounded-lg border border-line-soft bg-bg-elevated/60 p-3"
                >
                  <div
                    className="h-3 animate-pulse rounded bg-line-soft"
                    style={{ width: `${65 + ((colIdx * 3 + cardIdx * 7) % 30)}%` }}
                  />
                  <div className="h-3 w-2/5 animate-pulse rounded bg-line-soft" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
