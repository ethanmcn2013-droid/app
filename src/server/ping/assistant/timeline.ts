import "server-only";
import { prepareTimelineForAssistant } from "@/modules/timeline/server/assistant-preparation";

type Target = { actorId: string; projectId: string; kind: "preview_timeline" | "read_timeline"; runId: string; stepId: string };
type Project = { clerkId: string; ownerClerkId: string; id: string; slug: string; name: string };
/** Explicit action-only preparation. Its canonical operations are idempotent; GET never invokes it. */
export function createAssistantTimelinePreparation(deps: {
  project: (actorId: string, projectId: string) => Promise<Project>;
  prepare: (input: { actorClerkId: string; projectId: string }) => Promise<{ timelineSlug: string }>;
}) {
  return async (input: Target) => {
    const project = await deps.project(input.actorId, input.projectId);
    if (project.clerkId !== project.ownerClerkId) throw new Error("timeline_owner_required");
    const prepared = await deps.prepare({ actorClerkId: project.clerkId, projectId: input.projectId });
    // Membership and erasure can change while the second database is working.
    const current = await deps.project(input.actorId, input.projectId);
    if (current.clerkId !== project.clerkId || current.ownerClerkId !== project.ownerClerkId) throw new Error("timeline_access_changed");
    return { href: `/app/timeline/${encodeURIComponent(prepared.timelineSlug)}/current-preview?workspaceId=${encodeURIComponent(input.projectId)}`,
      summary: "The current timeline is ready in private preview. This request did not publish or change a shared copy." };
  };
}

export async function prepareAssistantTimeline(input: Target, project: (actorId: string, projectId: string) => Promise<Project>) {
  return createAssistantTimelinePreparation({ project, prepare: prepareTimelineForAssistant })(input);
}
