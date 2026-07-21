"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { PanelShell } from "./panel-shell";
import { TaskDetail } from "@/components/app/task-detail/task-detail";

export function TaskDetailPanel() {
  const { taskId, closeTask, openTask } = useTaskPanel();
  const state = useTasksState();
  const router = useRouter();

  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;

  // Stale id (e.g. task was deleted): degrade gracefully by closing after a beat.
  useEffect(() => {
    if (taskId && !task) {
      const timer = window.setTimeout(closeTask, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [taskId, task, closeTask]);

  // j/k navigation over board-ordered top-level tasks
  function navigate(direction: "prev" | "next") {
    if (!taskId) return;
    const ids = state.tasks.map((t) => t.id);
    const idx = ids.indexOf(taskId);
    if (idx === -1) return;
    const next = direction === "prev" ? idx - 1 : idx + 1;
    const clamped = Math.max(0, Math.min(ids.length - 1, next));
    if (ids[clamped] && ids[clamped] !== taskId) {
      openTask(ids[clamped]!);
    }
  }

  // Focus toggle: close panel param, then push to focus route.
  // closeTask uses replaceState so history stays clean; push adds one entry.
  function handleFocusToggle() {
    if (!task) return;
    closeTask();
    router.push(`/app/task/${task.id}`);
  }

  return (
    <PanelShell open={!!taskId} onClose={closeTask}>
      {task ? (
        <TaskDetail
          task={task}
          shell="panel"
          onClose={closeTask}
          onFocusToggle={handleFocusToggle}
          onNavigate={navigate}
        />
      ) : taskId ? (
        <EmptyState />
      ) : null}
    </PanelShell>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
      <div className="text-[14.5px] font-medium text-ink">Task not found</div>
      <div className="max-w-[28ch] text-[12.5px] text-ink-soft">
        It may have been deleted or this link is stale. Closing in a moment.
      </div>
    </div>
  );
}
