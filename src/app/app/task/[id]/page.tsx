import Link from "next/link";
import { getActiveWorkspace } from "@/server/auth";
import { getTaskDetail } from "@/server/db/queries";
import { TaskFocusView } from "./task-focus-view";
import { taskToPlain } from "@/components/app/task-detail/task-plain";

// Inherited from the /app layout: force-dynamic
export const dynamic = "force-dynamic";

export default async function TaskFocusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ws = await getActiveWorkspace();
  const result = await getTaskDetail(id, ws);

  // Not found or wrong workspace — calm empty state
  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-[16px] font-semibold text-ink">Task not found</div>
        <div className="max-w-[32ch] text-[13px] text-ink-soft">
          It may have been deleted, or the link is stale.
        </div>
        <Link
          href="/app/tasks"
          className="mt-2 text-[12.5px] text-ink-quiet underline underline-offset-2 transition-colors hover:text-ink-soft"
        >
          Back to board
        </Link>
      </div>
    );
  }

  const { task, archived } = result;

  // Archived task — read-only display, no editors
  if (archived) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-[16px] font-semibold text-ink">{task.title}</div>
        <div className="text-[13px] text-ink-soft">This task is archived.</div>
        <div className="mt-2 flex items-center gap-4 text-[12.5px]">
          <Link
            href="/app/archived"
            className="text-ink-quiet underline underline-offset-2 transition-colors hover:text-ink-soft"
          >
            Open archive
          </Link>
          <Link
            href="/app/tasks"
            className="text-ink-quiet underline underline-offset-2 transition-colors hover:text-ink-soft"
          >
            Back to board
          </Link>
        </div>
      </div>
    );
  }

  // Active task — full focus view
  return <TaskFocusView taskId={task.id} initialTask={taskToPlain(task)} />;
}
