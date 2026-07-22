/**
 * Loading skeleton for /app/project.
 * Matches the overview layout: header band + three-section body
 * (progress / team / milestones / recent activity).
 */
export default function ProjectOverviewLoading() {
  return (
    <div className="flex h-full flex-col overflow-auto bg-bg-elevated">
      {/* Header skeleton — mirrors the brief header band */}
      <div className="flex-shrink-0 border-b border-line-soft px-8 pb-6 pt-8">
        <div className="mb-2 h-7 w-48 rounded-full bg-bg-sunken" />
        <div className="mb-4 h-3.5 w-64 rounded-full bg-bg-sunken" />
        <div className="flex items-center gap-3">
          <div className="h-6 w-24 rounded-full bg-bg-sunken" />
          <div className="h-6 w-28 rounded-full bg-bg-sunken" />
        </div>
      </div>

      {/* Body skeleton */}
      <div className="mx-auto w-full max-w-[860px] space-y-8 px-8 py-8">
        {/* Progress */}
        <div className="space-y-3">
          <div className="h-2.5 w-20 rounded-full bg-bg-sunken" />
          <div className="h-2 w-full rounded-full bg-bg-sunken" />
          <div className="flex gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-2 w-12 rounded-full bg-bg-sunken" />
                <div className="h-3 w-8 rounded-full bg-bg-sunken" />
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="space-y-3">
          <div className="h-2.5 w-12 rounded-full bg-bg-sunken" />
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 flex-shrink-0 rounded-full bg-bg-sunken" />
              <div className="space-y-1">
                <div className="h-3 w-28 rounded-full bg-bg-sunken" />
                <div className="h-2 w-20 rounded-full bg-bg-sunken" />
              </div>
            </div>
          ))}
        </div>

        {/* Milestones */}
        <div className="space-y-3">
          <div className="h-2.5 w-24 rounded-full bg-bg-sunken" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-bg-sunken" />
              <div className="h-3 flex-1 rounded-full bg-bg-sunken" />
              <div className="h-2.5 w-12 rounded-full bg-bg-sunken" />
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div className="space-y-2">
          <div className="h-2.5 w-28 rounded-full bg-bg-sunken" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-baseline justify-between gap-4">
              <div className="h-3 w-2/3 rounded-full bg-bg-sunken" />
              <div className="h-2 w-10 rounded-full bg-bg-sunken" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
