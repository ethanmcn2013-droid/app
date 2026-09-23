"use client";

import { useActionState } from "react";
import { openTasksProjectAction } from "@/server/actions/tasks-project-arrival";
import type { TasksArrivalSurface } from "@/lib/tasks/arrival-path";

export function OpenTasksProject({ workspaceId, name, surface, taskId }: {
  workspaceId: string;
  name: string;
  surface: TasksArrivalSurface;
  taskId?: string;
}) {
  const [state, action, pending] = useActionState(openTasksProjectAction, null);
  return (
    <form action={action} className="flex flex-col items-center gap-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="surface" value={surface} />
      {taskId ? <input type="hidden" name="task" value={taskId} /> : null}
      <button type="submit" disabled={pending} className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
        {pending ? `Opening ${name}…` : `Open ${name}`}
      </button>
      {state?.error ? <p role="alert" className="max-w-sm text-[13px] text-ink-soft">{state.error}</p> : null}
    </form>
  );
}
