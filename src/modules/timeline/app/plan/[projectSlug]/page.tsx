import { notFound } from "next/navigation";
import { latestPublicationForProject } from "@/modules/timeline/app/audience/project-publications";
import { PlanSurface } from "@/modules/timeline/app/plan/[projectSlug]/_components/v3/plan-surface";
import type { SharePublicationSummary } from "@/modules/timeline/app/plan/[projectSlug]/_components/v3/share-state";
import { GuestPreview } from "@/modules/timeline/app/plan/[projectSlug]/_components/v3/guest-preview";
import { TimelineTabs, type SwitcherOption } from "@/components/app/portfolio/timeline-tabs";
import { monogramOf } from "@/lib/projects/project-chooser";
import { isDemoMode } from "@/lib/access-mode";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { portfolioRowHref } from "@/lib/projects/project-portfolio";
import { calendarDateInTimeZone } from "@/modules/timeline/lib/audience-timeline";
import { buildTimelineProjectHref, toAuthorizedProjectOptions } from "@/modules/timeline/lib/project-switcher-model";
import {
  getCurrentWorkspace,
  requireUser,
  resolveTimelineContext,
} from "@/modules/timeline/server/auth";
import { readBoundProjectArchiveState } from "@/modules/timeline/server/archived-project-policy";
import { readSyncFreshness } from "@/modules/timeline/server/sync/sync-state";
import { getOwnerAudiencePublications } from "@/modules/timeline/server/audience-timeline";
import {
  getEffectiveNodesForWorkspace,
  getProjectsForWorkspace,
} from "@/modules/timeline/server/db/timeline-queries";
import { loadProjectCatalogAction } from "@/server/actions/project-catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  return { title: `${projectSlug} · Timeline · Signal Studio` };
}

export const dynamic = "force-dynamic";

/** Keeps whichever Project and period the owner arrived with. */
function withContext(
  path: string,
  context: { workspaceId?: string | null; planningPeriodId?: string | null },
  extra?: Record<string, string>,
) {
  const query = new URLSearchParams(extra);
  const workspaceId = context.workspaceId?.trim();
  const planningPeriodId = context.planningPeriodId?.trim();
  if (workspaceId) {
    query.set("workspaceId", workspaceId);
    if (planningPeriodId) query.set("planningPeriodId", planningPeriodId);
  }
  const value = query.toString();
  return value ? `${path}?${value}` : path;
}

/** Other Projects for the plan menu. The catalog is authorized; a failure leaves the menu to this Project's plans. */
async function otherProjectsFor(currentProjectId: string | null): Promise<SwitcherOption[]> {
  try {
    const result = await loadProjectCatalogAction();
    if (!result.ok) return [];
    return result.catalog.rows
      .filter((row) => !row.archived && row.selectable && row.id !== currentProjectId)
      .slice(0, 12)
      .map((row) => ({
        key: `project:${row.id}`,
        name: row.name,
        href: portfolioRowHref(row.id),
        tile: { id: row.id, monogram: row.monogram },
      }));
  } catch {
    return [];
  }
}

/**
 * One plan (v3 redesign, 24 Sep 2026): one surface to read, edit and share.
 *
 * Every server read is exactly as before: the authorized context, the
 * effective nodes, the owner's publications and the one publication the whole
 * page means, read-through freshness, the archive state from the binding when
 * the entry carries no Project, and one clock. What changed is the
 * presentation: no embedded guest page, no View/Milestones tabs.
 */
export default async function TimelineProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>;
  searchParams: Promise<{
    workspaceId?: string;
    planningPeriodId?: string;
    mode?: string;
  }>;
}) {
  const { projectSlug } = await params;
  const userId = await requireUser();
  const requested = await searchParams;
  const requestedWorkspaceId = requested.workspaceId?.trim();
  const context = requestedWorkspaceId
    ? await resolveTimelineContext(
        userId,
        requestedWorkspaceId,
        requested.planningPeriodId?.trim(),
      )
    : null;
  if (requestedWorkspaceId && !context) notFound();
  const workspace = context?.workspace ?? (await getCurrentWorkspace(userId));
  if (!workspace) notFound();

  // ── F6 · AN ARCHIVED PROJECT'S TIMELINE IS READ-ONLY (ADR 0001 §5) ───────
  // A bare entry carries no requested Project, so the archive state is read
  // from the binding instead of assumed to be false.
  const archived = context
    ? context.archived
    : (await readBoundProjectArchiveState(userId, workspace)).kind === "archived";
  // `?mode=edit` is not a permission: on an archived Project it opens
  // nothing. The refusal that matters lives in the actions, because a Server
  // Action is addressable whatever this page renders.
  const openFirstPanel = !archived && requested.mode === "edit";

  const projects = await getProjectsForWorkspace(workspace.slug);
  const project = projects.find((candidate) => candidate.slug === projectSlug);
  if (!project) notFound();

  const projectOptions = toAuthorizedProjectOptions(projects, workspace.slug);
  const queryContext = {
    workspaceId: context?.workspaceId,
    planningPeriodId: context?.planningPeriodId,
  };
  const manageHref = withContext("/app/timeline/audience", queryContext, { project: project.slug });
  const previewHref = withContext(`/app/timeline/${encodeURIComponent(project.slug)}/preview`, queryContext);
  const suiteProjectId = context?.workspaceId ?? workspace.suiteWorkspaceId ?? null;
  const tasksHref = suiteProjectId ? `/app/tasks?${new URLSearchParams({ workspaceId: suiteProjectId })}` : "/app/tasks";
  const overviewHref = suiteProjectId ? `/app/project?${new URLSearchParams({ workspaceId: suiteProjectId })}` : null;
  const allHref = suiteProjectId ? `/app/timeline?${new URLSearchParams({ workspaceId: suiteProjectId })}` : "/app/timeline";

  // One clock: review reads the pinned suite calendar frame; production reads
  // the request clock at this boundary only.
  const now = isDemoMode() ? new Date(PINNED_REVIEW_CALENDAR_FRAME.nowIso) : new Date();
  const todayIso = isDemoMode() ? PINNED_REVIEW_CALENDAR_FRAME.today : now.toISOString().slice(0, 10);
  const [effectiveNodes, publications, syncFreshness, otherProjects] = await Promise.all([
    getEffectiveNodesForWorkspace(workspace.slug),
    getOwnerAudiencePublications(workspace.slug),
    // Read-through freshness: the loader READS the persisted state; the
    // refresh itself is a client act (a render must not mutate).
    readSyncFreshness({
      timelineWorkspaceSlug: workspace.slug,
      timelineSlug: project.slug,
    }),
    otherProjectsFor(suiteProjectId),
  ]);
  const projectNodes = effectiveNodes.filter((node) => node.projectSlug === project.slug);
  // One selection rule for the whole surface: the header, Preview and Share
  // all mean the same publication.
  const latestPublication = latestPublicationForProject(
    publications,
    project.slug,
    new Set(projectNodes.map((node) => node.id)),
  );
  const publication: SharePublicationSummary | null = latestPublication
    ? {
        id: latestPublication.id,
        label: latestPublication.label,
        state: latestPublication.state,
        activeShareCount: latestPublication.activeShareCount,
        timezone: latestPublication.timezone,
        divergedTitles: latestPublication.items
          .filter((item) => item.divergedAt !== null)
          .map((item) => item.title),
        publishedOn: latestPublication.publishedAt
          ? calendarDateInTimeZone(latestPublication.publishedAt, latestPublication.timezone)
          : null,
      }
    : null;

  return (
    <div data-timeline-module className="flex min-h-0 w-full flex-1 flex-col">
      <PlanSurface
        initialNodes={projectNodes}
        workspaceSlug={workspace.slug}
        projectSlug={project.slug}
        planName={project.name}
        suiteProjectName={workspace.name}
        suiteProjectId={suiteProjectId ?? workspace.slug}
        overviewHref={overviewHref}
        todayIso={todayIso}
        nowMs={now.getTime()}
        archived={archived}
        canManage={workspace.ownerUserId === userId}
        // ADR 0001 §5, exactly: existing links stay manageable and revocable;
        // new publishing is disabled. Revoke is the security control.
        canPublish={!archived}
        // Archived Projects do not refresh from Tasks, and review is a
        // read-only fixture boundary with no Tasks source behind it.
        autoSync={!archived && !isDemoMode()}
        reviewMode={isDemoMode()}
        freshness={
          syncFreshness
            ? {
                status: syncFreshness.status,
                lastSuccessAtMs: syncFreshness.lastSuccessAt?.getTime() ?? null,
                sourceCount: syncFreshness.sourceCount,
                importedCount: syncFreshness.importedCount,
                truncated: syncFreshness.truncated,
                errorCode: syncFreshness.errorCode,
              }
            : null
        }
        publication={publication}
        // What guests see: the same frozen page `/s/[token]` renders, from the
        // same publication, drawn read-only in the side column.
        guestPreview={latestPublication ? <GuestPreview publication={latestPublication} now={now} /> : null}
        previewHref={previewHref}
        manageHref={manageHref}
        tasksHref={tasksHref}
        openFirstPanel={openFirstPanel}
        viewSwitch={
          <TimelineTabs
            key="view-switch"
            current="project"
            allHref={allHref}
            project={{
              id: suiteProjectId ?? workspace.slug,
              name: workspace.name,
              monogram: monogramOf(workspace.name),
              href: buildTimelineProjectHref(project.slug, queryContext),
            }}
            sections={[
              {
                title: `Timelines in ${workspace.name}`,
                options: projectOptions.map((option) => ({
                  key: `plan:${option.slug}`,
                  name: option.name,
                  href: buildTimelineProjectHref(option.slug, queryContext),
                  current: option.slug === project.slug,
                })),
              },
              { title: "Other projects", options: otherProjects },
            ]}
          />
        }
      />
    </div>
  );
}
