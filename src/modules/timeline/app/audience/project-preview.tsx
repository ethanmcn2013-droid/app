import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { PINNED_REVIEW_CALENDAR_FRAME } from "@/lib/calendar-frame";
import { TimelineArtifact } from "@/modules/timeline/components/artifact";
import { publicationStateLabel } from "@/modules/timeline/lib/format";
import { ownerPublicationToTimelineDto } from "@/modules/timeline/lib/owner-artifact";
import { buildTimelineProjectHref } from "@/modules/timeline/lib/project-switcher-model";
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
import { latestPublicationForProject } from "./project-publications";

export const metadata: Metadata = {
  title: "Preview · Timeline · Signal Studio",
  robots: { index: false, follow: false },
};

/**
 * Preview: the frozen page a guest receives, and nothing else.
 *
 * The owner's Timeline view renders `ownerProjectToTimelineDto` — live current
 * nodes. That is the plan as it stands, which is exactly what an owner wants
 * while working, and exactly what a guest does not get: guests read a frozen
 * publication that only changes when the owner publishes. Preview therefore
 * reads the publication, through `ownerPublicationToTimelineDto`, the same
 * source and the same component the artifact studio and /s/[token] use.
 *
 * Rendered with the artifact's own defaults — not `embedded`, not `compact` —
 * so the layout floor matches the real public page rather than the softened
 * owner and studio variants.
 *
 * Two deliberate absences. `QualifiedViewTracker` is not mounted, so looking
 * at your own timeline never counts as a viewer. `onShare` is not passed, so
 * the artifact's Share control stays hidden: it shares the current address,
 * and the current address here is an owner-only route, not a bearer link.
 */
export default async function TimelineProjectPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectSlug: string }>;
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string }>;
}) {
  const userId = await requireUser();
  const [{ projectSlug }, requested] = await Promise.all([params, searchParams]);
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

  const queryContext = {
    workspaceId: context?.workspaceId,
    planningPeriodId: context?.planningPeriodId,
  };
  const backHref = buildTimelineProjectHref(project.slug, queryContext);
  const shareQuery = new URLSearchParams({ project: project.slug });
  if (queryContext.workspaceId) {
    shareQuery.set("workspaceId", queryContext.workspaceId);
  }
  if (queryContext.planningPeriodId) {
    shareQuery.set("planningPeriodId", queryContext.planningPeriodId);
  }
  const manageHref = `/app/timeline/audience?${shareQuery.toString()}`;

  const [effectiveNodes, publications] = await Promise.all([
    getEffectiveNodesForWorkspace(workspace.slug),
    getOwnerAudiencePublications(workspace.slug),
  ]);
  const sourceIds = new Set(
    effectiveNodes
      .filter((node) => node.projectSlug === project.slug)
      .map((node) => node.id),
  );
  const publication = latestPublicationForProject(
    publications,
    project.slug,
    sourceIds,
  );

  if (!publication) {
    return (
      <div
        data-timeline-module
        className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8"
      >
        <section className="w-full rounded-2xl border border-dashed border-line-soft bg-bg-sunken p-7 text-center sm:p-10">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-quiet">
            Preview
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">
            There is nothing to preview yet.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink-soft">
            A preview shows the page people actually receive, and that page only
            exists once you publish. Your own plan is not it — showing it here
            would suggest people can read work they cannot.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href={manageHref}
              className="inline-flex min-h-[44px] items-center rounded-lg bg-ink px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Pick what to publish
            </Link>
            <Link
              href={backHref}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-line-soft bg-white px-4 text-sm font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Back to {project.name}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // One clock: review mode reads the pinned suite calendar frame so the
  // fixture never drifts; production reads the request clock here only.
  const now = isDemoMode()
    ? new Date(PINNED_REVIEW_CALENDAR_FRAME.nowIso)
    : new Date();
  const timeline = ownerPublicationToTimelineDto(publication, now);
  const linkLive =
    publication.state === "published" && publication.activeShareCount > 0;
  const effectiveState = linkLive
    ? "published"
    : publication.state === "published"
      ? "revoked"
      : publication.state;

  return (
    <div data-timeline-module className="flex min-h-full w-full flex-1 flex-col bg-white">
      {/* The only owner element on this route, and it says so. Everything
          below the rule is the guest's page. */}
      <div className="border-b border-line-soft bg-bg-sunken">
        <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-[clamp(1rem,4.2vw,4rem)] py-2">
          <Link
            href={backHref}
            className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            Back to {project.name}
          </Link>
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-quiet">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: linkLive ? "var(--accent)" : "var(--ink-ghost)" }}
            />
            Preview · {publicationStateLabel(effectiveState)}
          </p>
        </div>
      </div>

      <TimelineArtifact timeline={timeline} />
    </div>
  );
}
