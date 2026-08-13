import Link from "next/link";
import { notFound } from "next/navigation";
import { AnchorChip } from "@/modules/timeline/app/_components/anchor-countdown";
import { latestPublicationForProject } from "@/modules/timeline/app/audience/project-publications";
import { CurationSurface } from "@/modules/timeline/app/plan/[projectSlug]/_components/curation-surface";
import { FreshnessLine } from "@/modules/timeline/app/plan/[projectSlug]/_components/freshness-line";
import { LocalViewTabs } from "@/modules/timeline/app/plan/[projectSlug]/_components/local-view-tabs";
import { ProjectSwitcher } from "@/modules/timeline/app/plan/[projectSlug]/_components/project-switcher";
import {
  SharePanel,
  type SharePublicationSummary,
} from "@/modules/timeline/app/plan/[projectSlug]/_components/share-panel";
import { VisibilityLine } from "@/modules/timeline/app/plan/[projectSlug]/_components/visibility-line";
import { TimelineArtifact } from "@/modules/timeline/components/artifact";
import { ownerProjectToTimelineDto } from "@/modules/timeline/lib/owner-artifact";
import { isDemoMode } from "@/lib/access-mode";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import {
  buildTimelineProjectHref,
  toAuthorizedProjectOptions,
} from "@/modules/timeline/lib/project-switcher-model";
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

type OwnerMode = "view" | "edit";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  return { title: `${projectSlug} · Timeline · Signal Studio` };
}

export const dynamic = "force-dynamic";

/** Preview keeps whichever workspace and period the owner arrived with. */
function previewHref(
  projectSlug: string,
  context: { workspaceId?: string | null; planningPeriodId?: string | null },
) {
  const query = new URLSearchParams();
  const workspaceId = context.workspaceId?.trim();
  const planningPeriodId = context.planningPeriodId?.trim();
  if (workspaceId) {
    query.set("workspaceId", workspaceId);
    if (planningPeriodId) query.set("planningPeriodId", planningPeriodId);
  }
  const value = query.toString();
  const path = `/app/timeline/${encodeURIComponent(projectSlug)}/preview`;
  return value ? `${path}?${value}` : path;
}

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
  const requestedMode: OwnerMode = requested.mode === "edit" ? "edit" : "view";
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
  // The resolver has always been able to say `archived`; this page used to
  // render that case as the full edit surface — rename, reorder, hide, add,
  // publish — because the word never reached it. A bare entry carries no
  // requested Project, so the archive state is read from the binding instead
  // of assumed to be false.
  const archived = context
    ? context.archived
    : (await readBoundProjectArchiveState(userId, workspace)).kind === "archived";
  // `?mode=edit` is not a permission. Forcing view here is the presentation
  // half; the refusal that matters lives in the actions, because a Server
  // Action is addressable whatever this page renders.
  const mode: OwnerMode = archived ? "view" : requestedMode;

  const projects = await getProjectsForWorkspace(workspace.slug);
  const project = projects.find((candidate) => candidate.slug === projectSlug);
  if (!project) notFound();

  const projectOptions = toAuthorizedProjectOptions(projects, workspace.slug);
  // Mode rides the switcher context: changing projects mid-edit stays in
  // edit. The local view tabs override it per destination.
  const queryContext = {
    workspaceId: context?.workspaceId,
    planningPeriodId: context?.planningPeriodId,
    mode: mode === "edit" ? ("edit" as const) : null,
  };
  const shareQuery = new URLSearchParams({ project: project.slug });
  if (queryContext.workspaceId) {
    shareQuery.set("workspaceId", queryContext.workspaceId);
  }
  if (queryContext.planningPeriodId) {
    shareQuery.set("planningPeriodId", queryContext.planningPeriodId);
  }
  const manageHref = `/app/timeline/audience?${shareQuery.toString()}`;
  // One clock: review mode reads the pinned suite calendar frame; production
  // reads the request clock at this RSC boundary only.
  const now = isDemoMode()
    ? new Date(PINNED_REVIEW_CALENDAR_FRAME.nowIso)
    : new Date();
  const [effectiveNodes, publications, syncFreshness] = await Promise.all([
    getEffectiveNodesForWorkspace(workspace.slug),
    getOwnerAudiencePublications(workspace.slug),
    // Read-through freshness, on View as well as Edit (plan §6.5). The loader
    // READS the persisted state; the refresh itself is a client act, because a
    // Server Component render must not perform a mutation or call
    // revalidatePath. What changes is that View now runs one at all, and that
    // both modes can say how old what they are showing is.
    readSyncFreshness({
      timelineWorkspaceSlug: workspace.slug,
      timelineSlug: project.slug,
    }),
  ]);
  const projectNodes = effectiveNodes.filter(
    (node) => node.projectSlug === project.slug,
  );
  // One selection rule for the whole owner surface — the header metadata
  // below, Preview, and Share must all mean the same publication.
  const latestPublication = latestPublicationForProject(
    publications,
    project.slug,
    new Set(projectNodes.map((node) => node.id)),
  );
  const shareSummary: SharePublicationSummary | null = latestPublication
    ? {
        id: latestPublication.id,
        label: latestPublication.label,
        state: latestPublication.state,
        activeShareCount: latestPublication.activeShareCount,
        timezone: latestPublication.timezone,
        divergedTitles: latestPublication.items
          .filter((item) => item.divergedAt !== null)
          .map((item) => item.title),
      }
    : null;
  // The same publication the header metadata, Preview and Share all mean,
  // narrowed to the four facts the visibility line is allowed to speak from.
  const visibility = latestPublication
    ? {
        state: latestPublication.state,
        activeShareCount: latestPublication.activeShareCount,
        publishedAt: latestPublication.publishedAt,
        timezone: latestPublication.timezone,
      }
    : null;
  const content = TimelineProjectContent({
    mode,
    project,
    workspace,
    manageHref,
    projectNodes,
    latestPublication,
    now,
  });

  return (
    <div data-timeline-module className="flex min-h-full w-full flex-1 flex-col bg-paper">
      <header className="relative z-30 border-b border-line-soft bg-paper">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {/* Parent context, then the project itself. No wordmark here: the
                  Studio Bar above already carries `timeline.` and it already
                  links to Timeline home (studio-bar.tsx, activeModuleIdentity),
                  so a second one is duplicated chrome, not context. What stood
                  here was dead text reading "Project timeline". */}
              <Link
                href={buildTimelineProjectHref(null, queryContext)}
                className="hidden min-h-[44px] max-w-[18ch] shrink-0 items-center truncate rounded-md px-1 text-[13px] text-ink-quiet transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:inline-flex"
              >
                {workspace.name}
              </Link>
              <span aria-hidden className="hidden h-3.5 w-px bg-ink-ghost lg:block" />
              <ProjectSwitcher
                currentProject={{ slug: project.slug, name: project.name }}
                projects={projectOptions}
                context={queryContext}
              />
              {/* The countdown is the plan's pulse — phone owners deserve it
                  too. Only the smallest headers go without. */}
              <span className="hidden min-w-0 sm:inline-flex">
                <AnchorChip milestones={projectNodes} now={now.getTime()} />
              </span>
            </div>
            {/* Who can see this page, before the owner types a word into it.
                Preview and Share stood in this header explaining neither. */}
            <VisibilityLine publication={visibility} />
            {/* How old what you are reading is, on both View and Edit, plus
                Retry and the truncation sentence nothing used to say. An
                archived Project does not refresh from Tasks at all, so it gets
                the read-only line below instead of a freshness one that would
                never move. */}
            {archived ? null : (
              <FreshnessLine
                workspaceSlug={workspace.slug}
                projectSlug={project.slug}
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
                serverNowMs={now.getTime()}
                // Edit already refreshes on mount inside CurationSurface. A
                // second refresh here would double every Tasks read and race
                // the first for the same generation.
                autoRefresh={mode === "view"}
              />
            )}
            {/* Read-only is stated once, in plain words, with the one action
                that changes it. Not an alert: nothing has gone wrong and
                nothing is waiting on the reader. */}
            {archived ? (
              <p
                role="status"
                className="mt-1 text-[13px] leading-5 text-ink-quiet"
              >
                This project is archived, so its timeline is read-only. Existing
                shared links still work and can still be switched off. Restore
                the project in Tasks to make changes.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* No Milestones tab on an archived Project: it opens the editing
                surface, and there is nothing to edit here. The tabs are
                removed rather than disabled — a control that cannot act is
                worse than an absent one, and the line below says why. */}
            {archived ? null : (
              <LocalViewTabs
                projectSlug={project.slug}
                current={mode === "edit" ? "milestones" : "timeline"}
                context={queryContext}
              />
            )}
            <span aria-hidden className="hidden h-5 w-px bg-line-soft sm:block" />
            {/* Two acts, two controls. Preview opens the frozen page a guest
                receives; Share opens the link itself. One button could only
                ever do one of them, and the old one did neither. */}
            <Link
              href={previewHref(project.slug, queryContext)}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-line-soft bg-bg-elevated px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-ink-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Preview
            </Link>
            <SharePanel
              workspaceSlug={workspace.slug}
              projectName={project.name}
              publication={shareSummary}
              manageHref={manageHref}
              canManage={workspace.ownerUserId === userId}
              // ADR 0001 §5, exactly: existing bearer links remain manageable
              // and revocable; new publishing is disabled. Revoke is the
              // security control and it stays reachable.
              canPublish={!archived}
            />
          </div>
        </div>
      </header>

      {content}
    </div>
  );
}

function TimelineProjectContent({
  mode,
  project,
  workspace,
  manageHref,
  projectNodes,
  latestPublication,
  now,
}: {
  mode: OwnerMode;
  project: Awaited<ReturnType<typeof getProjectsForWorkspace>>[number];
  workspace: NonNullable<Awaited<ReturnType<typeof getCurrentWorkspace>>>;
  manageHref: string;
  projectNodes: Awaited<ReturnType<typeof getEffectiveNodesForWorkspace>>;
  latestPublication:
    | Awaited<ReturnType<typeof getOwnerAudiencePublications>>[number]
    | undefined;
  now: Date;
}) {
  if (mode === "edit") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-7 border-b border-line-soft pb-6">
          {/* Sentence case, no tracking: the artifact below this header
              retired the uppercase-tracked eyebrow for its own kicker a wave
              ago, on the grounds that it reads as a system label above a name
              rather than as the first thing a person is told. Same decision,
              same reason, owner side. */}
          <p className="text-[13px] font-medium text-accent-hover">
            Private owner edit
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ink">
            Shape {project.name}
          </h1>
          {/* This used to promise that the Timeline view showed "the exact
              artifact your audience will receive". It does not: that view
              renders your live milestones, while a guest reads a frozen copy
              made when you published. Preview is the only screen that shows
              the guest's page. */}
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            Milestone tasks arrive here from Tasks. Rename them, move dates,
            reorder, and choose what stays private. Nothing you change reaches a
            shared page until you publish it again.
          </p>
        </div>
        <CurationSurface
          initialNodes={projectNodes}
          workspaceSlug={workspace.slug}
          projectSlug={project.slug}
          shareHref={manageHref}
        />
      </div>
    );
  }

  const visibleNodes = projectNodes.filter((node) => !node.hidden);

  if (visibleNodes.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8">
        <section className="w-full rounded-2xl border border-dashed border-line-soft bg-bg-sunken p-7 text-center sm:p-10">
          <p className="text-[13px] font-medium text-accent-hover">
            {project.name}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">
            No visible milestones yet.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-soft">
            Mark tasks as milestones, or add one by hand under Milestones. This
            project stays private until you publish a frozen copy of it.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href={`/app/timeline/${encodeURIComponent(project.slug)}?mode=edit`}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Open milestones
            </Link>
            <Link
              href="/app/tasks"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-line-soft bg-bg-elevated px-4 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Open Tasks
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const timeline = ownerProjectToTimelineDto({
    project,
    workspace,
    nodes: projectNodes,
    settings: latestPublication
      ? {
          publicationId: latestPublication.id,
          label: latestPublication.label,
          audienceKind: latestPublication.audienceKind,
          ownerDisplayLabel: latestPublication.ownerDisplayLabel,
          primaryDateLabel: latestPublication.primaryDateLabel,
          primaryDate: latestPublication.primaryDate,
          timezone: latestPublication.timezone,
        }
      : undefined,
    now,
  });

  // No caption. The one that stood here — "Owner view · the page your audience
  // receives" — was untrue: this renders ownerProjectToTimelineDto, the live
  // current milestones, not the frozen publication a guest reads. Preview is
  // where that claim can be made honestly, so it is made there instead.
  return (
    <div className="w-full flex-1 bg-paper">
      <TimelineArtifact timeline={timeline} embedded showProductHeader={false} />
    </div>
  );
}
