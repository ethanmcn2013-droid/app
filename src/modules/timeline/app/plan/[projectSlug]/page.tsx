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
  isWorkspacePublished,
} from "@/modules/timeline/server/db/timeline-queries";
import { CurationSurface } from "@/modules/timeline/app/plan/[projectSlug]/_components/curation-surface";
import { TIMELINE_URL } from "@/lib/product-urls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  return { title: `Plan, ${projectSlug}, Timeline` };
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

  // T3: NEXT_PUBLIC_TIMELINE_SITE_URL points at the public Timeline deployment.
  const publicBase = process.env.NEXT_PUBLIC_TIMELINE_SITE_URL ?? TIMELINE_URL;
  const publicUrl = `${publicBase}/${workspace.slug}`;
  const contextQuery = context
    ? `?workspaceId=${encodeURIComponent(context.workspaceId)}${
        context.planningPeriodId
          ? `&planningPeriodId=${encodeURIComponent(context.planningPeriodId)}`
          : ""
      }`
    : "";

  return (
    <div data-timeline-module className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10">
      {/* Breadcrumb, renders immediately; no data-dependent await below this point */}
      <nav
        className="mb-6 flex items-center gap-1.5 text-xs"
        style={{ color: "var(--ink-quiet)" }}
      >
        <Link
          href={`/app/plan${contextQuery}`}
          className="transition-colors hover:text-ink"
          style={{ color: "var(--ink-soft)" }}
        >
          {workspace.name}
        </Link>
        <span aria-hidden>/</span>
        <span style={{ color: "var(--ink)" }}>{project.name}</span>
      </nav>

      {/* Heading, renders immediately */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold"
          style={{ letterSpacing: "-0.025em", color: "var(--ink)" }}
        >
          {project.name}
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--ink-soft)" }}
        >
          Curate your milestones. Use the eye icon to hide items from your public link.
        </p>
      </div>

      {/* T7: scoped Suspense split — breadcrumb + heading above are immediate,
          only the data-heavy curation surface is behind Suspense. */}
      <Suspense fallback={<CurationSurfaceSkeleton />}>
        <PlanPageContent
          workspaceSlug={workspace.slug}
          projectSlug={projectSlug}
          publicUrl={publicUrl}
        />
      </Suspense>
    </div>
  );
}

// ── Async data component, deferred behind Suspense ───────────────────────────

async function PlanPageContent({
  workspaceSlug,
  projectSlug,
  publicUrl,
}: {
  workspaceSlug: string;
  projectSlug: string;
  publicUrl: string;
}) {
  const [effectiveNodes, workspacePublished] = await Promise.all([
    getEffectiveNodesForWorkspace(workspaceSlug),
    isWorkspacePublished(workspaceSlug),
  ]);

  return (
    <CurationSurface
      initialNodes={effectiveNodes}
      workspaceSlug={workspaceSlug}
      projectSlug={projectSlug}
      isPublished={workspacePublished}
      publicUrl={publicUrl}
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
