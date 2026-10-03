import { isActiveProjectV3Enabled } from "@/lib/projects/flags";

/**
 * Loading skeleton for /app/project (v3). Mirrors the settled page so
 * nothing jumps when it arrives: the Projects index (title, cards) when the
 * index renders, then the open Project's header, view switcher, and the
 * two-column body (progress + milestones beside team + details).
 */
const BLOCK = "rounded-full bg-[var(--v3-sunken)]";
const CARD =
  "rounded-[var(--v3-radius-lg)] border border-[color:var(--v3-border)] bg-[var(--v3-surface)] [box-shadow:var(--v3-shadow-1)]";

export default function ProjectOverviewLoading() {
  const withIndex = isActiveProjectV3Enabled();
  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-[var(--v3-canvas)] motion-safe:animate-pulse"
      aria-busy="true"
      aria-label="Loading projects"
    >
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-5 md:px-8 md:pt-[28px]">
        {withIndex ? (
          <>
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-2.5">
                <div className={`h-6 w-36 ${BLOCK}`} />
                <div className={`h-3 w-60 ${BLOCK}`} />
              </div>
              <div className="h-[34px] w-[124px] rounded-[var(--v3-radius)] bg-[var(--v3-sunken)]" />
            </div>
            <div className="mt-5 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1].map((i) => (
                <div key={i} className={`${CARD} h-[176px] p-4`}>
                  <div className="flex items-start gap-3">
                    <div className="size-[36px] rounded-[10px] bg-[var(--v3-sunken)]" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className={`h-3.5 w-2/5 ${BLOCK}`} />
                      <div className={`h-3 w-3/5 ${BLOCK}`} />
                    </div>
                  </div>
                  <div className={`mt-6 h-3 w-1/3 ${BLOCK}`} />
                  <div className={`mt-2.5 h-1.5 w-full ${BLOCK}`} />
                </div>
              ))}
            </div>
            <div className="mt-[36px] mb-[28px] h-px bg-[var(--v3-border)]" />
          </>
        ) : null}

        <div className="flex items-start gap-3.5">
          <div className="size-[44px] shrink-0 rounded-[11px] bg-[var(--v3-sunken)]" />
          <div className="flex-1 space-y-2.5 pt-1">
            <div className={`h-5 w-56 ${BLOCK}`} />
            <div className={`h-3 w-80 max-w-full ${BLOCK}`} />
            <div className="flex gap-2 pt-1">
              <div className={`h-[26px] w-24 ${BLOCK}`} />
              <div className={`h-[26px] w-32 ${BLOCK}`} />
            </div>
          </div>
        </div>
        <div className="mt-5 h-[32px] w-[300px] max-w-full rounded-[var(--v3-radius)] bg-[var(--v3-sunken)]" />

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className={`${CARD} p-4`}>
              <div className={`h-3.5 w-20 ${BLOCK}`} />
              <div className="mt-5 h-[36px] w-24 rounded-[var(--v3-radius)] bg-[var(--v3-sunken)]" />
              <div className={`mt-4 h-2 w-full ${BLOCK}`} />
              <div className="mt-4 h-[60px] rounded-[var(--v3-radius)] bg-[var(--v3-sunken)]" />
            </div>
            <div className={`${CARD} space-y-3 p-4`}>
              <div className={`h-3.5 w-24 ${BLOCK}`} />
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="size-[28px] rounded-[var(--v3-radius-sm)] bg-[var(--v3-sunken)]" />
                  <div className={`h-3 flex-1 ${BLOCK}`} />
                  <div className={`h-3 w-16 ${BLOCK}`} />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <div className={`${CARD} space-y-3 p-4`}>
              <div className={`h-3.5 w-14 ${BLOCK}`} />
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="size-[32px] rounded-full bg-[var(--v3-sunken)]" />
                  <div className="flex-1 space-y-1.5">
                    <div className={`h-3 w-28 ${BLOCK}`} />
                    <div className={`h-2.5 w-40 ${BLOCK}`} />
                  </div>
                </div>
              ))}
            </div>
            <div className={`${CARD} h-[150px]`} />
          </div>
        </div>
      </div>
    </div>
  );
}
