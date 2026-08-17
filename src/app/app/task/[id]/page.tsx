import Link from "next/link";
import { redirect } from "next/navigation";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { isDemoMode } from "@/lib/access-mode";
import { getTaskById, getTaskDetail } from "@/server/db/queries";
import { authorizeObjectProject } from "@/server/projects/route-authz";
import { assertProjectId } from "@/lib/projects/project-ref";
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
      ? { kind: "archived", task: result.task }
      : { kind: "canonical", workspaceId: demoWorkspaceId, taskId: result.task.id };
  }

  return decideTaskRouteWith(id, {
    loadTaskProject: async (taskId) => (await getTaskById(taskId))?.workspaceId,
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

  // Both rendered states mount the runtime with no explicit `workspaceId`
  // (D-022): this route's Project authority is the task object itself
  // (ADR 0001 §9), never the URL's query, so the chrome stays on the ambient
  // Project exactly as it always has.

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
    const { task } = decision;
    return (
      <TasksRuntimePageMount>
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
      </TasksRuntimePageMount>
    );
  }
}
