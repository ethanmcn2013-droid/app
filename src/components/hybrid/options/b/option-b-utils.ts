import { scheduleStart } from "../../dates";
import type { LabTask } from "../../types";

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, select, textarea, a, [contenteditable='true']"));
}

export function focusTaskElement(taskId: string, selector = "[data-task-id]"): void {
  window.setTimeout(() => {
    const candidates = document.querySelectorAll<HTMLElement>(`[data-option="b"] ${selector}[data-task-id="${taskId}"]`);
    const target = [...candidates].find((element) => element.offsetParent !== null);
    target?.focus();
  }, 0);
}

export function sortRoomTasks(tasks: LabTask[], mode: "manual" | "date" | "title"): LabTask[] {
  return [...tasks].sort((a, b) => {
    if (mode === "title") return a.title.localeCompare(b.title);
    if (mode === "date") {
      const aDate = scheduleStart(a.schedule) ?? "9999-12-31";
      const bDate = scheduleStart(b.schedule) ?? "9999-12-31";
      return aDate.localeCompare(bDate) || a.order - b.order;
    }
    return a.order - b.order;
  });
}

export function completedChecks(task: LabTask): { done: number; total: number } {
  if (task.subtasks.length === 0) return { done: task.completed ? 1 : 0, total: 1 };
  return {
    done: task.subtasks.filter((subtask) => subtask.completed).length,
    total: task.subtasks.length,
  };
}
