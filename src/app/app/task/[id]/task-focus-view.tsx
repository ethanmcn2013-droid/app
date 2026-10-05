"use client";

/**
 * TaskFocusView: one task on its own page, the same sections as the sheet
 * laid out in two columns (the work on the left, properties on the right).
 *
 * Resolution order for the task object:
 *   1. Live store task (updated by board mutations, real-time sync)
 *   2. Server snapshot inflated from the initialTask DTO. This covers
 *      subtask ids, which getTasks filters out of the store. Mutations on a
 *      fallback task still persist through the server actions; only the
 *      local reflection lags until the next hydrate.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { TaskSheet } from "@/components/app/detail-panel/task-sheet";
import { plainToTask, type TaskPlain } from "@/components/app/task-detail/task-plain";
import { getVisibleTaskOrder } from "@/components/tasks/sheet-bridge";
import { taskFocusPath } from "@/lib/product-urls";
import type { Task } from "@/lib/data";

export function TaskFocusView({
  taskId,
  initialTask,
}: {
  taskId: string;
  initialTask: TaskPlain;
}) {
  const router = useRouter();
  const state = useTasksState();
  const [serverTask] = useState<Task>(() => plainToTask(initialTask));
  const task = state.tasks.find((t) => t.id === taskId) ?? serverTask;

  // Walk the order the board last showed, else the store's order.
  const navigate = useCallback(
    (direction: "prev" | "next") => {
      const visible = getVisibleTaskOrder();
      const ids = visible.includes(taskId) ? [...visible] : state.tasks.map((t) => t.id);
      const at = ids.indexOf(taskId);
      if (at === -1) return;
      const next = ids[Math.max(0, Math.min(ids.length - 1, at + (direction === "prev" ? -1 : 1)))];
      if (next && next !== taskId) router.replace(taskFocusPath(next));
    },
    [router, state.tasks, taskId],
  );

  // Back to the board with this task open in the sheet.
  const collapse = useCallback(() => {
    router.push(`/app/tasks?task=${encodeURIComponent(taskId)}`);
  }, [router, taskId]);

  return <TaskSheet task={task} mode="page" onClose={collapse} onExpand={collapse} onNavigate={navigate} />;
}
