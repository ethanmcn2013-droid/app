"use client";

export const TASKS_SYNC_EVENT = "tasks:sync-state";
export const TASKS_ACK_DIAGNOSTIC_EVENT = "tasks:ack-diagnostic";
export type TaskAckOperation = "create" | "edit" | "complete" | "other";
export type TaskAckDiagnosticDetail = {
  id: string;
  operation: TaskAckOperation;
  phase: "start" | "success" | "error";
  at: number;
};

function emitAckDiagnostic(detail: TaskAckDiagnosticDetail) {
  if (typeof window === "undefined" ||
      process.env.NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV !== "preview" ||
      process.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_DIAGNOSTIC !== "isolated-preview-task-ack-v1" ||
      window.location.origin !== process.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_ORIGIN) return;
  const until = Number(process.env.NEXT_PUBLIC_SIGNAL_TASK_ACK_UNTIL_MS);
  if (!Number.isSafeInteger(until) || until <= Date.now()) return;
  window.dispatchEvent(new CustomEvent<TaskAckDiagnosticDetail>(TASKS_ACK_DIAGNOSTIC_EVENT, { detail }));
}

export type TaskSyncPhase = "pending" | "success" | "error" | "cancelled";

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
export function beginTaskSync(
  operation: TaskAckOperation = "other",
  startedAt: number = performance.now(),
): ((error?: unknown, rejected?: boolean, uncertain?: boolean) => void) & { cancel: () => void } {
  const id = `tasks-sync-${++syncSequence}`;
  emitAckDiagnostic({ id, operation, phase: "start", at: startedAt });
  let announcedPending = false;
  let finished = false;
  const timer = typeof window === "undefined"
    ? undefined
    : window.setTimeout(() => {
        if (finished) return;
        announcedPending = true;
        emitSync({ id, phase: "pending" });
      }, 300);

  const finish = (error?: unknown, rejected = Boolean(error), uncertain = false) => {
    if (finished) return;
    finished = true;
    if (timer !== undefined) window.clearTimeout(timer);
    emitAckDiagnostic({ id, operation, phase: rejected ? "error" : "success", at: performance.now() });

    if (error) {
      emitSync({ id, phase: "error" });
      window.dispatchEvent(new CustomEvent("tasks:toast", {
        detail: {
          title: uncertain ? "The change could not be confirmed" : "The change was not saved",
          body: uncertain
            ? "Review the task before making another change."
            : "Tasks restored the last confirmed state. Try the action again.",
          tone: "error",
        },
      }));
      return;
    }

    if (announcedPending) emitSync({ id, phase: "success" });
  };
  finish.cancel = () => {
    if (finished) return;
    finished = true;
    if (timer !== undefined) window.clearTimeout(timer);
    if (announcedPending) emitSync({ id, phase: "cancelled" });
  };
  return finish;
}
