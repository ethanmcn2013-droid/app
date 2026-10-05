/**
 * Loading for /app/task/[id]: the settled page geometry (header bar, the
 * work column and the properties column) in quiet fills, so the page
 * settles into its tracing. Server component, no client state.
 */
import { SheetSkeleton } from "@/components/tasks/skeletons";

export default function TaskFocusLoading() {
  return (
    <div className="flex h-full flex-col bg-[color:var(--v3-canvas)]" aria-busy="true" aria-label="Loading the task">
      <div className="h-[52px] flex-shrink-0 border-b border-[color:var(--v3-border)]" />
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-[48px] px-4 pt-4 md:px-8 lg:grid-cols-[minmax(0,720px)_300px] lg:justify-center">
        <SheetSkeleton />
        <div className="hidden rounded-[var(--v3-radius-lg)] border border-[color:var(--v3-border)] lg:block">
          <SheetSkeleton />
        </div>
      </div>
    </div>
  );
}
