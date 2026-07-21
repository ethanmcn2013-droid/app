/**
 * Loading skeleton for /app/task/[id].
 * Matches the focus layout: header bar + centred max-w-[860px] with
 * two-column structure at lg (primary + right rail).
 */
export default function TaskFocusLoading() {
  return (
    <div className="flex h-full flex-col bg-bg-elevated">
      {/* Header skeleton */}
      <div className="flex-shrink-0 border-b border-line-soft px-5 pb-3 pt-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2.5 w-16 rounded-full bg-bg-sunken" />
          <div className="h-2.5 w-px bg-bg-sunken" />
          <div className="h-2.5 w-10 rounded-full bg-bg-sunken" />
        </div>
        <div className="mt-2.5 flex items-start gap-3">
          <div className="h-5 w-20 rounded-md bg-bg-sunken" />
          <div className="h-6 flex-1 rounded-full bg-bg-sunken" />
        </div>
        <div className="mt-3 h-7 w-24 rounded-md bg-bg-sunken" />
      </div>

      {/* Body skeleton */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-[860px] px-6 pb-12 pt-6 lg:grid lg:grid-cols-[1fr_280px] lg:gap-8 lg:px-8">
          {/* Primary column */}
          <div className="min-w-0 space-y-8">
            {/* Description block */}
            <div className="border-b border-line-soft pb-6 space-y-2">
              <div className="h-2 w-20 rounded-full bg-bg-sunken" />
              <div className="h-3.5 w-full rounded-full bg-bg-sunken" />
              <div className="h-3.5 w-5/6 rounded-full bg-bg-sunken" />
              <div className="h-3.5 w-4/6 rounded-full bg-bg-sunken" />
            </div>
            {/* Subtasks block */}
            <div className="border-b border-line-soft pb-6 space-y-2">
              <div className="h-2 w-16 rounded-full bg-bg-sunken" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-bg-sunken" />
                  <div className="h-3 flex-1 rounded-full bg-bg-sunken" />
                </div>
              ))}
            </div>
            {/* Conversation block */}
            <div className="space-y-3">
              <div className="h-2 w-20 rounded-full bg-bg-sunken" />
              {[1, 2].map((i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="h-[22px] w-[22px] flex-shrink-0 rounded-full bg-bg-sunken" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-1/4 rounded-full bg-bg-sunken" />
                    <div className="h-3 w-3/4 rounded-full bg-bg-sunken" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right rail */}
          <aside className="order-first mb-8 space-y-4 lg:order-none lg:mb-0 lg:border-l lg:border-line-soft lg:pl-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-2 w-1/3 rounded-full bg-bg-sunken" />
                <div className="h-4 w-2/3 rounded-full bg-bg-sunken" />
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  );
}
