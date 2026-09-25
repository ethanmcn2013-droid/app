/**
 * /app/tasks loading boundary: the settled Tasks geometry (header, facts,
 * toolbar and the board's columns) in quiet fills, inside the shell. No
 * takeover and no fake tasks; the shimmer stands still under reduced motion.
 * The same shapes serve List and Calendar, whose own skeletons take over
 * once the view's code arrives.
 */
import { BoardSkeleton, HeaderSkeleton } from "@/components/tasks/skeletons";

export default function TasksLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--v3-canvas)]" aria-busy="true" aria-label="Loading tasks">
      <div className="mx-auto w-full max-w-[1180px]">
        <HeaderSkeleton />
      </div>
      <BoardSkeleton />
    </div>
  );
}
