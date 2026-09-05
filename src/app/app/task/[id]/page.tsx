import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { isDemoMode } from "@/lib/access-mode";
import { getTaskDetail } from "@/server/db/queries";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { authorizeObjectProject } from "@/server/projects/route-authz";
import { assertProjectId } from "@/lib/projects/project-ref";
import { tasksArrivalPath } from "@/lib/tasks/arrival-path";
import { resolveTasksArrival, TasksArrivalRefusal } from "@/components/app/tasks-project-arrival";
import { DEMO_WORKSPACE_ID } from "@/server/demo/tasks-demo";
import {
  canonicalTaskUrl,
  decideTaskRouteWith,
  type TaskRouteDecision,
} from "./resolve-task-route";

// Inherited from the /app layout: force-dynamic
export const dynamic = "force-dynamic";

async function decide(id: string): Promise<TaskRouteDecision> {
  // Demo and Review hold exactly one workspace and never reach a database
  // (`access-mode.ts` safety invariant), so the in-memory board resolves the
  // task directly, exactly as it did before.
  if (isDemoMode()) {
    const demoWorkspaceId = assertProjectId(DEMO_WORKSPACE_ID);
    const result = await getTaskDetail(id, demoWorkspaceId);
    if (!result) return { kind: "not-found" };
    return result.archived
      ? { kind: "archived", workspaceId: demoWorkspaceId, task: result.task }
      : { kind: "canonical", workspaceId: demoWorkspaceId, taskId: result.task.id };
  }

  return decideTaskRouteWith(id, {
    loadTaskProject: async (taskId) => {
      // Learn only the stored Project. The client Task mapper deliberately
      // omits this field; it cannot supply authority for an object route.
      const [row] = await db.select({ workspaceId: tasks.workspaceId })
        .from(tasks)
        // isolation-ok: object-route bootstrap reads only the owning project
        // id; decideTaskRouteWith proves membership before reading content.
        .where(eq(tasks.id, taskId)).limit(1);
      return row?.workspaceId;
    },
    authorize: authorizeObjectProject,
    loadDetail: (taskId, provenWorkspaceId) =>
      getTaskDetail(taskId, provenWorkspaceId),
  });
}

export default async function TaskFocusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decision = await decide(id);

  // An active task belongs on the canonical Tasks URL, carrying its own
  // Project. `redirect` throws Next's control-flow exception, so it must stay
  // outside any try/catch — there is none here, deliberately.
  if (decision.kind === "canonical") {
    redirect(canonicalTaskUrl(decision.workspaceId, decision.taskId));
  }

  // Missing, forbidden and deleted — one state, never distinguishable.
  if (decision.kind === "not-found") {
    return (
      <TasksRuntimePageMount>
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
      </TasksRuntimePageMount>
    );
  }

  // Archived task — read-only display, no editors. It stays on this route
  // rather than canonicalising: `getTasks` filters archived rows out of the
  // board (`queries.ts:109`), so redirecting here would open a detail panel
  // for a task the board cannot list.
  {
    const { task, workspaceId } = decision;
    // Only the stored, proven object Project may move this runtime. A legacy
    // layout still needs an explicit selection POST before it can follow B.
    const arrival = await resolveTasksArrival(workspaceId);
    if (arrival.kind !== "ready") {
      return <TasksArrivalRefusal arrival={arrival} requested={workspaceId} surface="task-focus" taskId={task.id} />;
    }
    const searchParams = Promise.resolve({ workspaceId });
    return (
      <TasksRuntimePageMount searchParams={searchParams}>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="text-[16px] font-semibold text-ink">{task.title}</div>
          <div className="text-[13px] text-ink-soft">This task is archived.</div>
          <div className="mt-2 flex items-center gap-4 text-[12.5px]">
            <Link
              href={tasksArrivalPath("archive", workspaceId)}
              className="text-ink-quiet underline underline-offset-2 transition-colors hover:text-ink-soft"
            >
              Open archive
            </Link>
            <Link
              href={tasksArrivalPath("tasks", workspaceId)}
              className="text-ink-quiet underline underline-offset-2 transition-colors hover:text-ink-soft"
            >
              Back to board
            </Link>
          </div>
        </div>
      </TasksRuntimePageMount>
    );
  }
}
