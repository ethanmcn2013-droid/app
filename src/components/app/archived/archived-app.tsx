"use client";

/**
 * Archived tasks surface (/app/archived). Lists the workspace's archived
 * tasks with Restore (clears archived_at → back to the board) and Delete
 * (permanent). Server-rendered list; mutations refresh via the router so the
 * list re-reads from the DB.
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@/lib/data";
import { LANES } from "@/lib/data";
import { setTaskArchivedAction, removeTaskAction } from "@/server/actions/tasks";
import { useToast } from "@/components/primitives/toast";

export function ArchivedApp({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  function restore(task: Task) {
    startTransition(async () => {
      try {
        await setTaskArchivedAction(task.id, false);
        toast("Task restored", {
          tone: "success",
          body: "It's back on the board.",
        });
        router.refresh();
      } catch (e) {
        toast("Couldn't restore", { tone: "error", body: (e as Error).message });
      }
    });
  }

  function remove(task: Task) {
    startTransition(async () => {
      try {
        await removeTaskAction(task.id);
        toast("Task deleted", { tone: "success" });
        router.refresh();
      } catch (e) {
        toast("Couldn't delete", { tone: "error", body: (e as Error).message });
      }
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="mx-auto flex max-w-[560px] flex-col items-center px-6 py-20 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-bg-sunken text-ink-quiet">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
            <path d="M10 12h4" />
          </svg>
        </div>
        <h2 className="mt-4 text-[15px] font-semibold text-ink">Nothing archived</h2>
        <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-soft">
          Archive a task from its card menu or detail panel and it lands here,
          out of the way but never gone. Restore it any time.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-5 md:px-8">
      <p className="mb-3 text-[12.5px] text-ink-quiet">
        {tasks.length} archived {tasks.length === 1 ? "task" : "tasks"}. Restore
        returns a task to the board; delete is permanent.
      </p>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-3 rounded-lg border border-line-soft bg-white px-3.5 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{task.title}</p>
              <p className="mt-0.5 text-[11px] text-ink-quiet">
                {LANES[task.lane]?.name ?? task.lane}
                {task.due ? ` · was due ${task.due}` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => restore(task)}
              className="flex-shrink-0 rounded-full border border-line bg-white px-3 py-1 text-[12px] font-medium text-ink-soft transition-colors hover:border-brand/40 hover:text-ink disabled:opacity-50"
            >
              Restore
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(task)}
              className="flex-shrink-0 rounded-full border border-rose-200 bg-white px-3 py-1 text-[12px] font-medium text-rose-700 transition-colors hover:border-rose-400 hover:bg-rose-50 disabled:opacity-50"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
