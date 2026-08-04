"use client";

export const TASKS_SYNC_EVENT = "tasks:sync-state";

export type TaskSyncPhase = "pending" | "success" | "error";

export type TaskSyncEventDetail = {
  id: string;
  phase: TaskSyncPhase;
};

let syncSequence = 0;

function emitSync(detail: TaskSyncEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TaskSyncEventDetail>(TASKS_SYNC_EVENT, { detail }));
}

/**
 * Starts the quiet async-truth clock for one optimistic mutation.
 *
 * Fast operations stay visually instant. Only work that survives 300ms
 * announces a pending state. The returned finisher resolves that exact
 * operation so overlapping mutations cannot hide one another.
 */
export function beginTaskSync(): (error?: unknown) => void {
  const id = `tasks-sync-${++syncSequence}`;
  let announcedPending = false;
  let finished = false;
  const timer = typeof window === "undefined"
    ? undefined
    : window.setTimeout(() => {
        if (finished) return;
        announcedPending = true;
        emitSync({ id, phase: "pending" });
      }, 300);

  return (error?: unknown) => {
    if (finished) return;
    finished = true;
    if (timer !== undefined) window.clearTimeout(timer);

    if (error) {
      emitSync({ id, phase: "error" });
      window.dispatchEvent(new CustomEvent("tasks:toast", {
        detail: {
          title: "The change was not saved",
          body: "Tasks restored the last confirmed state. Try the action again.",
          tone: "error",
        },
      }));
      return;
    }

    if (announcedPending) emitSync({ id, phase: "success" });
  };
}
