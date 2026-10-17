import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { ownerProjectToTimelineDto } from "@/modules/timeline/lib/owner-artifact";
import { buildTimelineProjectHref } from "@/modules/timeline/lib/project-switcher-model";
import { requireUser, resolveTimelineContext } from "@/modules/timeline/server/auth";
import { getEffectiveNodesForWorkspace, getProjectsForWorkspace, getWorkspacesForUser } from "@/modules/timeline/server/db/timeline-queries";
import { getCurrentTasksWorkspaceContext } from "@/modules/timeline/server/sync/tasks-workspace-context";
import { selectCurrentPreviewWorkspace } from "./current-project-preview-model";
import { CurrentProjectPreviewView } from "./current-project-preview-view";

export const metadata: Metadata = { title: "Private preview · Timeline · Signal Studio", robots: { index: false, follow: false } };

/** Reads current owner-plan data only. No publication lookup, token, share control, sync or provisioning. */
export default async function CurrentProjectPreview({ params, searchParams }: {
  params: Promise<{ projectSlug: string }>;
  searchParams: Promise<{ workspaceId?: string | string[]; planningPeriodId?: string | string[] }>;
}) {
  const userId = await requireUser();
  const [{ projectSlug }, requested] = await Promise.all([params, searchParams]);
  if (typeof requested.workspaceId !== "string" || !requested.workspaceId.trim() ||
    (requested.planningPeriodId !== undefined && typeof requested.planningPeriodId !== "string")) notFound();
  const workspaceId = requested.workspaceId.trim();
  const planningPeriodId = requested.planningPeriodId?.trim();
  // Only the synthetic demo branch uses the demo resolver. Real reads do not call
  // resolveTimelineContext because it can provision a missing Timeline binding.
  const demo = isDemoMode() ? await resolveTimelineContext(userId, workspaceId, planningPeriodId) : null;
  const workspace = isDemoMode() ? demo?.workspace : selectCurrentPreviewWorkspace(
    await getWorkspacesForUser(userId), workspaceId, planningPeriodId,
    await getCurrentTasksWorkspaceContext(userId, workspaceId),
  );
  if (!workspace) notFound();
  const projects = await getProjectsForWorkspace(workspace.slug);
  const project = projects.find(candidate => candidate.slug === projectSlug);
  if (!project) notFound();
  const nodes = (await getEffectiveNodesForWorkspace(workspace.slug)).filter(node => node.projectSlug === project.slug);
  const timeline = ownerProjectToTimelineDto({ project, workspace, nodes,
    now: isDemoMode() ? new Date(PINNED_REVIEW_CALENDAR_FRAME.nowIso) : new Date(),
    settings: { ownerDisplayLabel: null },
  });
  const backHref = buildTimelineProjectHref(project.slug, { workspaceId, planningPeriodId });
  return <CurrentProjectPreviewView timeline={timeline} backHref={backHref} />;
}
