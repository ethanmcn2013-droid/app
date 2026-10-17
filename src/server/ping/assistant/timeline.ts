import "server-only";
import { proveTasksProjectOwnership } from "@/modules/timeline/lib/tasks-project-ownership";

type Target = { actorId: string; projectId: string; kind: "preview_timeline" | "read_timeline"; runId: string; stepId: string };
type Project = { clerkId: string; ownerClerkId: string; id: string; slug: string; name: string };
/** Explicit action-only preparation. Its canonical operations are idempotent; GET never invokes it. */
export function createAssistantTimelinePreparation(deps: {
  project: (actorId: string, projectId: string) => Promise<Project>;
  provision: (project: Project) => Promise<{ slug: string } | null>;
  timelines: (workspaceSlug: string) => Promise<readonly { slug: string; sourceTasksWorkspaceId: string | null }[]>;
  sync: (workspaceSlug: string, timelineSlug: string) => Promise<{ ok?: true; complete?: boolean; error?: string }>;
}) {
  return async (input: Target) => {
    const project = await deps.project(input.actorId, input.projectId);
    if (project.clerkId !== project.ownerClerkId) throw new Error("timeline_owner_required");
    const workspace = await deps.provision(project);
    if (!workspace) throw new Error("timeline_preparation_unavailable");
    const matches = (await deps.timelines(workspace.slug)).filter(p => p.sourceTasksWorkspaceId === input.projectId);
    if (matches.length !== 1) throw new Error("timeline_binding_unavailable");
    const synced = await deps.sync(workspace.slug, matches[0].slug);
    if (synced.ok !== true || synced.complete !== true) throw new Error("timeline_refresh_unavailable");
    // Membership and erasure can change while the second database is working.
    const current = await deps.project(input.actorId, input.projectId);
    if (current.clerkId !== project.clerkId || current.ownerClerkId !== project.ownerClerkId) throw new Error("timeline_access_changed");
    return { href: `/app/timeline/${encodeURIComponent(matches[0].slug)}/current-preview?workspaceId=${encodeURIComponent(input.projectId)}`,
      summary: "The current timeline is ready in private preview. This request did not publish or change a shared copy." };
  };
}

export async function prepareAssistantTimeline(input: Target, project: (actorId: string, projectId: string) => Promise<Project>) {
  const [{ provisionTimelineForTasksWorkspace }, { getProjectsForWorkspace }, { syncMilestonesAction }] = await Promise.all([
    import("@/modules/timeline/server/provision-workspace"), import("@/modules/timeline/server/db/timeline-queries"), import("@/modules/timeline/server/actions/workspaces"),
  ]);
  return createAssistantTimelinePreparation({ project,
    provision: p => {
      const ownership = proveTasksProjectOwnership(p.clerkId, p.id, { kind: "member", context: { workspaceId: p.id, ownerClerkId: p.ownerClerkId } });
      if (!ownership) throw new Error("timeline_owner_required");
      return provisionTimelineForTasksWorkspace(p.clerkId, { workspaceId: p.id, slug: p.slug, name: p.name }, ownership);
    }, timelines: getProjectsForWorkspace, sync: syncMilestonesAction })(input);
}
