import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  requireUser,
  getCurrentWorkspace,
  resolveTimelineContext,
} from "@/modules/timeline/server/auth";
import {
  getProjectsForWorkspace,
  getEffectiveNodesForWorkspace,
} from "@/modules/timeline/server/db/timeline-queries";
import { CurationSurface } from "@/modules/timeline/app/plan/[projectSlug]/_components/curation-surface";
import { ProjectSwitcher } from "@/modules/timeline/app/plan/[projectSlug]/_components/project-switcher";
import {
  buildTimelineProjectHref,
  toAuthorizedProjectOptions,
} from "@/modules/timeline/lib/project-switcher-model";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  return { title: `${projectSlug} · Timeline · Signal Studio` };
}

export const dynamic = "force-dynamic";

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>;
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
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

  const projects = await getProjectsForWorkspace(workspace.slug);
  const project = projects.find((p) => p.slug === projectSlug);
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

  return (
    <div data-timeline-module className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
      {/* Breadcrumb, renders immediately; no data-dependent await below this point */}
      <nav
        aria-label="Timeline project"
        className="mb-6 flex flex-wrap items-center gap-1.5 text-xs"
        style={{ color: "var(--ink-quiet)" }}
      >
        <Link
          href={buildTimelineProjectHref(null, queryContext)}
          className="transition-colors hover:text-ink"
          style={{ color: "var(--ink-soft)" }}
        >
          {workspace.name}
        </Link>
        <span aria-hidden>/</span>
        <ProjectSwitcher
          currentProject={{ slug: project.slug, name: project.name }}
          projects={projectOptions}
          context={queryContext}
        />
      </nav>

      {/* Heading, renders immediately */}
      <div className="mb-8 flex flex-col justify-between gap-5 border-b border-line-soft pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
            Private owner view
          </p>
          <h1
            className="mt-2 text-3xl font-semibold"
            style={{ letterSpacing: "-0.035em", color: "var(--ink)" }}
          >
            {project.name}
          </h1>
          <p
            className="mt-2 max-w-xl text-sm leading-6"
            style={{ color: "var(--ink-soft)" }}
          >
            Milestone tasks sync into this draft. Refine their labels, dates,
            order and visibility here; nothing changes for viewers until you
            publish a frozen copy.
          </p>
        </div>
        <Link
          href={shareHref}
          className="inline-flex min-h-11 flex-none items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Preview & publish
        </Link>
      </div>

      {/* T7: scoped Suspense split — breadcrumb + heading above are immediate,
          only the data-heavy curation surface is behind Suspense. */}
      <Suspense fallback={<CurationSurfaceSkeleton />}>
        <PlanPageContent
          workspaceSlug={workspace.slug}
          projectSlug={projectSlug}
          shareHref={shareHref}
        />
      </Suspense>
    </div>
  );
}

// ── Async data component, deferred behind Suspense ───────────────────────────

async function PlanPageContent({
  workspaceSlug,
  projectSlug,
  shareHref,
}: {
  workspaceSlug: string;
  projectSlug: string;
  shareHref: string;
}) {
  const effectiveNodes = await getEffectiveNodesForWorkspace(workspaceSlug);

  return (
    <CurationSurface
      initialNodes={effectiveNodes.filter(
        (node) => node.projectSlug === projectSlug,
      )}
      workspaceSlug={workspaceSlug}
      projectSlug={projectSlug}
      shareHref={shareHref}
    />
  );
}

// ── Skeleton fallback ─────────────────────────────────────────────────────────

function CurationSurfaceSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl border px-4 py-3.5"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-1.5">
            <div className="tl-skeleton-shimmer h-3.5 w-48 rounded" />
            <div className="tl-skeleton-shimmer h-3 w-24 rounded" />
          </div>
          <div className="tl-skeleton-shimmer h-5 w-5 rounded" />
        </div>
      ))}
    </div>
  );
}
