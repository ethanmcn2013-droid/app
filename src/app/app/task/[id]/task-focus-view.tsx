"use client";

/**
 * TaskFocusView — client wrapper for the focus shell of TaskDetail.
 *
 * Resolution order for the task object:
 *   1. Live store task (updated by board mutations, real-time sync)
 *   2. Server-snapshot inflated from initialTask DTO. This fallback covers
 *      subtask ids, which getTasks filters out of the store (parent_task_id
 *      set). Mutations on a fallback task still persist through the server
 *      actions; only the local reflection lags until the next hydrate.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { TaskDetail } from "@/components/app/task-detail/task-detail";
import { plainToTask, type TaskPlain } from "@/components/app/task-detail/task-plain";
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

  // Inflate the server snapshot once
  const [serverTask] = useState<Task>(() => plainToTask(initialTask));

  // Live store task takes priority; server snapshot is the fallback
  const task = state.tasks.find((t) => t.id === taskId) ?? serverTask;

  // Navigate between top-level store tasks via router.replace
  function navigate(direction: "prev" | "next") {
    const ids = state.tasks.map((t) => t.id);
    const idx = ids.indexOf(taskId);
    if (idx === -1) return;
    const next = direction === "prev" ? idx - 1 : idx + 1;
    const clamped = Math.max(0, Math.min(ids.length - 1, next));
    const nextId = ids[clamped];
    if (nextId && nextId !== taskId) {
      router.replace(`/app/task/${nextId}`);
    }
  }

  // Both onClose and onFocusToggle collapse back to the board panel.
  // The ?task= param opens production's panel on arrival; no pushState
  // gymnastics on the focus URL first.
  function collapseToPanel() {
    router.push(`/app/tasks?task=${taskId}`);
  }

  return (
    <div className="h-full bg-bg-elevated">
      <TaskDetail
        task={task}
        shell="focus"
        onClose={collapseToPanel}
        onFocusToggle={collapseToPanel}
        onNavigate={navigate}
      />
    </div>
  );
}
