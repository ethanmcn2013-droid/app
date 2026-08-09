import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCurrentWorkspace,
  requireUser,
  resolveTimelineContext,
} from "@/modules/timeline/server/auth";
import { getEffectiveNodesForWorkspace } from "@/modules/timeline/server/db/timeline-queries";
import { getProjectsForWorkspace } from "@/modules/timeline/server/db/timeline-queries";
import {
  audienceTimelineEnabled,
  getOwnerAudiencePublications,
} from "@/modules/timeline/server/audience-timeline";
import { AudienceManager } from "./audience-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shared timelines · Timeline", robots: { index: false, follow: false } };

export default async function AudienceTimelineManagerPage({
  searchParams,
}: {
  searchParams: Promise<{
    workspaceId?: string;
    planningPeriodId?: string;
    project?: string;
  }>;
}) {
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
  if (!workspace || workspace.ownerUserId !== userId) notFound();
  const contextQuery = context
    ? `?workspaceId=${encodeURIComponent(context.workspaceId)}${
        context.planningPeriodId
          ? `&planningPeriodId=${encodeURIComponent(context.planningPeriodId)}`
          : ""
      }`
    : "";

  const [nodes, projects, publications] = await Promise.all([
    getEffectiveNodesForWorkspace(workspace.slug),
    getProjectsForWorkspace(workspace.slug),
    getOwnerAudiencePublications(workspace.slug),
  ]);
  const requestedProject = requested.project?.trim();
  const project = requestedProject
    ? projects.find((candidate) => candidate.slug === requestedProject)
    : null;
  if (requestedProject && !project) notFound();
  const eligibleNodes = nodes.filter(
    (node) => !node.hidden && (!project || node.projectSlug === project.slug),
  );
  const eligibleNodeIds = new Set(eligibleNodes.map((node) => node.id));
  const projectPublications = project
    ? publications.filter(
        (publication) =>
          publication.projectSlug === project.slug ||
          (publication.projectSlug === null &&
            publication.items.some((item) =>
              eligibleNodeIds.has(item.sourceRelation),
            )),
      )
    : publications;

  return (
    <div data-timeline-module className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-sm text-ink-quiet" aria-label="Breadcrumb">
        <Link href={`/app/timeline${contextQuery}`} className="hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          {workspace.name}
        </Link>
        {project ? (
          <>
            <span aria-hidden className="mx-2">/</span>
            <Link
              href={`/app/timeline/${encodeURIComponent(project.slug)}${contextQuery}`}
              className="hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {project.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden className="mx-2">/</span>
        <span className="text-ink">Shared timelines</span>
      </nav>
      <header className="mb-10 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-hover">Link-only sharing</p>
        <h1 className="mt-2 text-[clamp(2rem,1.4rem+2vw,3.25rem)] font-semibold leading-none tracking-[-0.04em] text-ink">
          {project ? `Share ${project.name}, not the workspace.` : "Share the journey, not the workspace."}
        </h1>
        <p className="mt-4 text-base leading-7 text-ink-soft">
          Anyone with a published link can open and forward the frozen copy.
          It is absent from directories and search, never grants workspace
          access, and source changes wait for your review before they appear.
        </p>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3" role="list" aria-label="Sharing boundary">
          <p className="rounded-lg border border-line-soft bg-white p-3 text-ink-soft" role="listitem"><strong className="block text-ink">1. Choose</strong>Only the milestones you select are copied.</p>
          <p className="rounded-lg border border-line-soft bg-white p-3 text-ink-soft" role="listitem"><strong className="block text-ink">2. Review</strong>The shared copy stays separate from your plan.</p>
          <p className="rounded-lg border border-line-soft bg-white p-3 text-ink-soft" role="listitem"><strong className="block text-ink">3. Publish</strong>Anyone with the link can view or forward it.</p>
        </div>
      </header>
      <AudienceManager
        workspaceSlug={workspace.slug}
        suiteWorkspaceId={workspace.suiteWorkspaceId}
        workspaceName={workspace.name}
        enabled={audienceTimelineEnabled()}
        sourceNodes={eligibleNodes.map((node) => ({
            id: node.id,
            title: node.title,
            targetDate: node.targetDate,
            lane: node.lane,
            audienceState: node.audienceState,
          }))}
        publications={projectPublications}
        defaultLabel={project?.name}
        defaultAudienceKind={
          workspace.templateId?.includes("wedding") ? "couple" : "class"
        }
        projectName={project?.name}
        projectSlug={project?.slug}
      />
    </div>
  );
}
