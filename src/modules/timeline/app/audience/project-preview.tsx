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
import styles from "./preview.module.css";

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
  searchParams: Promise<{ workspaceId?: string; planningPeriodId?: string; device?: string }>;
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
      <div data-timeline-module className={styles.emptyPage}>
        <section className={styles.emptyCard} aria-labelledby="preview-empty-title">
          <p className={styles.emptyEyebrow}>Preview</p>
          <h1 id="preview-empty-title" className={styles.emptyTitle}>
            There is nothing to preview yet
          </h1>
          <p className={styles.emptyBody}>
            A preview shows the page guests actually receive, and that page only exists once you publish. Your own
            plan is not it; showing it here would suggest guests can read work they cannot.
          </p>
          <div className={styles.emptyActions}>
            <Link href={manageHref} className={styles.primary}>
              Choose what to share
            </Link>
            <Link href={backHref} className={styles.secondary}>
              Back to timeline
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

  const device = requested.device === "phone" ? "phone" : "desktop";
  const deviceHref = (next: "desktop" | "phone") => {
    const query = new URLSearchParams();
    if (queryContext.workspaceId) query.set("workspaceId", queryContext.workspaceId);
    if (queryContext.planningPeriodId) query.set("planningPeriodId", queryContext.planningPeriodId);
    if (next === "phone") query.set("device", "phone");
    const value = query.toString();
    return `/app/timeline/${encodeURIComponent(project.slug)}/preview${value ? `?${value}` : ""}`;
  };

  return (
    <div data-timeline-module className={styles.page}>
      {/* The only owner element on this route, and it says so. Everything
          below the bar is the guest's page, unchanged. */}
      <div className={styles.bar}>
        <Link href={backHref} className={styles.back}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M12.5 8h-9m3.5-3.5L3.5 8 7 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to timeline
        </Link>
        <p className={styles.what}>
          <span className={styles.whatText}>This is what guests see</span>
          <span className={styles.pill} data-live={linkLive ? "" : undefined}>
            <span className={styles.pillDot} aria-hidden="true" />
            {publicationStateLabel(effectiveState)}
          </span>
        </p>
        <nav className={styles.devices} aria-label="Preview size">
          <Link href={deviceHref("desktop")} className={styles.device} aria-current={device === "desktop" ? "page" : undefined} replace scroll={false}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M5.5 13.75h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Desktop
          </Link>
          <Link href={deviceHref("phone")} className={styles.device} aria-current={device === "phone" ? "page" : undefined} replace scroll={false}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="4.25" y="1.75" width="7.5" height="12.5" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            Phone
          </Link>
        </nav>
      </div>

      {device === "phone" ? (
        <div className={styles.phoneStage}>
          {/* The guest's own page at a phone's width, in a plain frame. */}
          <div className={styles.phoneDevice}>
            <div className={styles.phoneScreen}>
              <TimelineArtifact timeline={timeline} compact />
            </div>
          </div>
          <p className={styles.phoneNote}>The same page guests open on their phones. Looking at it here never counts as a view.</p>
        </div>
      ) : (
        <TimelineArtifact timeline={timeline} />
      )}
    </div>
  );
}
