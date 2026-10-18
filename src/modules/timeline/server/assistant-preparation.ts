import "server-only";
import { proveTasksProjectOwnership, type TasksProjectOwnership } from "../lib/tasks-project-ownership";
import type { TasksWorkspaceContextResult } from "./sync/tasks-workspace-context";

type Target = { actorClerkId: string; projectId: string };
type OwnedProject = { workspaceId: string; slug: string; name: string };

/** Explicit positive writer port. No publication, bearer-link creation, route action or default Tasks DB.
 * The injected form exists for module-owned guard tests; production dependencies stay below.
 */
export function createTimelineAssistantPreparation(deps: {
  session: () => Promise<{ userId: string | null; sessionId: string | null }>;
  context: (clerkId: string, projectId: string) => Promise<TasksWorkspaceContextResult>;
  provision: (clerkId: string, project: OwnedProject, ownership: TasksProjectOwnership) => Promise<{ slug: string } | null>;
  timelines: (workspaceSlug: string) => Promise<readonly { slug: string; sourceTasksWorkspaceId: string | null }[]>;
  sync: (workspaceSlug: string, timelineSlug: string) => Promise<{ ok?: true; complete?: boolean; error?: string }>;
}) {
  return async (input: Target) => {
    const session = await deps.session();
    if (!session.userId || !session.sessionId || session.userId !== input.actorClerkId) throw new Error("timeline_actor_required");
    const current = await deps.context(session.userId, input.projectId);
    const ownership = proveTasksProjectOwnership(session.userId, input.projectId, current);
    if (!ownership || current.kind !== "member" || current.context.archivedAt !== null) throw new Error("timeline_owner_required");
    const workspace = await deps.provision(session.userId, current.context, ownership);
    if (!workspace) throw new Error("timeline_preparation_unavailable");
    const matches = (await deps.timelines(workspace.slug)).filter(row => row.sourceTasksWorkspaceId === input.projectId);
    if (matches.length !== 1) throw new Error("timeline_binding_unavailable");
    const synced = await deps.sync(workspace.slug, matches[0].slug);
    if (synced.ok !== true || synced.complete !== true) throw new Error("timeline_refresh_unavailable");
    const after = await deps.context(session.userId, input.projectId);
    if (after.kind !== "member" || after.context.archivedAt !== null || !proveTasksProjectOwnership(session.userId, input.projectId, after)) throw new Error("timeline_access_changed");
    return { timelineSlug: matches[0].slug };
  };
}

/** Only the designated assistant host composes this exact public server port. */
export async function prepareTimelineForAssistant(input: Target) {
  const [{ auth }, { getCurrentTasksWorkspaceContext }, { provisionTimelineForTasksWorkspace }, { getProjectsForWorkspace }, { syncMilestonesAction }] = await Promise.all([
    import("@clerk/nextjs/server"), import("./sync/tasks-workspace-context"), import("./provision-workspace"),
    import("./db/timeline-queries"), import("./actions/workspaces"),
  ]);
  // The canonical context reader requires explicit TASKS_DATABASE_URL + TASKS_AUTH_TOKEN.
  // It has no ambient/default file target; the host also fences its admitted target before and after this port.
  return createTimelineAssistantPreparation({
    session: async () => { const session = await auth(); return { userId: session.userId, sessionId: session.sessionId }; },
    context: getCurrentTasksWorkspaceContext, provision: provisionTimelineForTasksWorkspace,
    timelines: getProjectsForWorkspace, sync: syncMilestonesAction,
  })(input);
}
