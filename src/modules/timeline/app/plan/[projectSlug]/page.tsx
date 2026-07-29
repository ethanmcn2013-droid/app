import Link from "next/link";
import { notFound } from "next/navigation";
import { AnchorChip } from "@/modules/timeline/app/_components/anchor-countdown";
import { CurationSurface } from "@/modules/timeline/app/plan/[projectSlug]/_components/curation-surface";
import { ProjectSwitcher } from "@/modules/timeline/app/plan/[projectSlug]/_components/project-switcher";
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

function modeHref(
  projectSlug: string,
  context: { workspaceId?: string | null; planningPeriodId?: string | null },
  mode: OwnerMode,
) {
  const href = buildTimelineProjectHref(projectSlug, context);
  if (mode === "view") return href;
  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("mode", mode);
  return `${pathname}?${params.toString()}`;
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
  const mode: OwnerMode = requested.mode === "edit" ? "edit" : "view";
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

  const projects = await getProjectsForWorkspace(workspace.slug);
  const project = projects.find((candidate) => candidate.slug === projectSlug);
  if (!project) notFound();

  const projectOptions = toAuthorizedProjectOptions(projects, workspace.slug);
  const queryContext = {
    workspaceId: context?.workspaceId,
    planningPeriodId: context?.planningPeriodId,
  };
  const shareQuery = new URLSearchParams({ project: project.slug });
  if (queryContext.workspaceId) {
    shareQuery.set("workspaceId", queryContext.workspaceId);
  }
  if (queryContext.planningPeriodId) {
    shareQuery.set("planningPeriodId", queryContext.planningPeriodId);
  }
  const shareHref = `/app/timeline/audience?${shareQuery.toString()}`;
  // One clock: review mode reads the pinned suite calendar frame; production
  // reads the request clock at this RSC boundary only.
  const now = isDemoMode()
    ? new Date(PINNED_REVIEW_CALENDAR_FRAME.nowIso)
    : new Date();
  const [effectiveNodes, publications] = await Promise.all([
    getEffectiveNodesForWorkspace(workspace.slug),
    getOwnerAudiencePublications(workspace.slug),
  ]);
  const projectNodes = effectiveNodes.filter(
    (node) => node.projectSlug === project.slug,
  );
  const content = TimelineProjectContent({
    mode,
    project,
    workspace,
    shareHref,
    projectNodes,
    publications,
    now,
  });

  return (
    <div data-timeline-module className="flex min-h-full w-full flex-1 flex-col bg-white">
      <header className="relative z-30 border-b border-line-soft bg-white">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden text-xs font-semibold uppercase tracking-[0.13em] text-ink-quiet sm:inline">
              Project timeline
            </span>
            <ProjectSwitcher
              currentProject={{ slug: project.slug, name: project.name }}
              projects={projectOptions}
              context={queryContext}
            />
            <span className="hidden min-w-0 lg:inline-flex">
              <AnchorChip milestones={projectNodes} now={now.getTime()} />
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <nav
              aria-label="Timeline owner mode"
              className="inline-flex rounded-lg border border-line-soft bg-bg-sunken p-1"
            >
              <Link
                href={modeHref(project.slug, queryContext, "view")}
                aria-label="View timeline"
                aria-current={mode === "view" ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  mode === "view"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                View<span className="hidden sm:inline">&nbsp;timeline</span>
              </Link>
              <Link
                href={modeHref(project.slug, queryContext, "edit")}
                aria-label="Edit milestones"
                aria-current={mode === "edit" ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  mode === "edit"
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                Edit<span className="hidden sm:inline">&nbsp;milestones</span>
              </Link>
            </nav>
            <Link
              href={shareHref}
              aria-label="Preview and share"
              className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <span className="sm:hidden">Share</span>
              <span className="hidden sm:inline">Preview and share</span>
            </Link>
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
  shareHref,
  projectNodes,
  publications,
  now,
}: {
  mode: OwnerMode;
  project: Awaited<ReturnType<typeof getProjectsForWorkspace>>[number];
  workspace: NonNullable<Awaited<ReturnType<typeof getCurrentWorkspace>>>;
  shareHref: string;
  projectNodes: Awaited<ReturnType<typeof getEffectiveNodesForWorkspace>>;
  publications: Awaited<ReturnType<typeof getOwnerAudiencePublications>>;
  now: Date;
}) {
  if (mode === "edit") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-7 border-b border-line-soft pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-accent-hover">
            Private owner edit
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-ink">
            Shape {project.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
            Milestone tasks sync into this draft. Refine the labels, dates,
            order, lane, and visibility here. View timeline shows the exact
            artifact your audience will receive.
          </p>
        </div>
        <CurationSurface
          initialNodes={projectNodes}
          workspaceSlug={workspace.slug}
          projectSlug={project.slug}
          shareHref={shareHref}
        />
      </div>
    );
  }

  const sourceIds = new Set(projectNodes.map((node) => node.id));
  const latestPublication = publications
    .filter((publication) =>
      publication.items.some((item) => sourceIds.has(item.sourceRelation)),
    )
    .sort(
      (left, right) =>
        right.lastUpdatedAt.getTime() - left.lastUpdatedAt.getTime(),
    )[0];
  const visibleNodes = projectNodes.filter((node) => !node.hidden);

  if (visibleNodes.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8">
        <section className="w-full rounded-2xl border border-dashed border-line-soft bg-bg-sunken p-7 text-center sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-accent-hover">
            {project.name}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">
            No visible milestones yet.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-soft">
            Mark tasks as milestones, or add a manual milestone in the owner
            edit. This project stays private until you deliberately publish a
            frozen share link.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href={`/app/timeline/${encodeURIComponent(project.slug)}?mode=edit`}
              className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Edit milestones
            </Link>
            <Link
              href="/app/tasks"
              className="inline-flex min-h-11 items-center rounded-lg border border-line-soft bg-white px-4 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
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

  return (
    <div className="w-full flex-1 bg-white">
      <div className="mx-auto w-full max-w-[100rem] px-[clamp(1rem,4.2vw,4rem)]">
        <p className="border-b border-line-soft pb-2.5 pt-4 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-quiet">
          Owner view · the page your audience receives
        </p>
      </div>
      <TimelineArtifact timeline={timeline} embedded showProductHeader={false} />
    </div>
  );
}
