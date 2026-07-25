import Link from "next/link";
import {
  getCurrentWorkspace,
  requireUser,
  resolveTimelineContext,
} from "@/modules/timeline/server/auth";
import {
  getEffectiveNodesForWorkspace,
  getProjectsForWorkspace,
} from "@/modules/timeline/server/db/timeline-queries";
import { getOwnerAudiencePublications } from "@/modules/timeline/server/audience-timeline";
import { resolveEntitlement } from "@/lib/entitlements-shared/reads";
import { TIER_LABEL } from "@/lib/entitlements-shared/tiers";
import { CreateProjectForm } from "@/modules/timeline/app/_components/create-project-form";

export const metadata = { title: "Timeline · Signal Studio" };
export const dynamic = "force-dynamic";

type SearchParams = {
  workspaceId?: string;
  planningPeriodId?: string;
};

function contextHref(
  pathname: string,
  context: { workspaceId?: string; planningPeriodId?: string },
  extra?: Record<string, string>,
) {
  const query = new URLSearchParams();
  if (context.workspaceId) query.set("workspaceId", context.workspaceId);
  if (context.planningPeriodId) {
    query.set("planningPeriodId", context.planningPeriodId);
  }
  for (const [key, value] of Object.entries(extra ?? {})) {
    query.set(key, value);
  }
  const encoded = query.toString();
  return encoded ? `${pathname}?${encoded}` : pathname;
}

function formatDateRange(dates: string[]) {
  if (dates.length === 0) return "Dates can be added in the owner view";
  const sorted = [...dates].sort();
  const formatter = new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
  });
  const first = formatter.format(new Date(`${sorted[0]}T12:00:00Z`));
  const last = formatter.format(
    new Date(`${sorted[sorted.length - 1]}T12:00:00Z`),
  );
  return first === last ? first : `${first} – ${last}`;
}

export default async function TimelineOwnerHome({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const userId = await requireUser();
  const requested = await searchParams;
  const requestedWorkspaceId = requested.workspaceId?.trim();
  const resolvedContext = requestedWorkspaceId
    ? await resolveTimelineContext(
        userId,
        requestedWorkspaceId,
        requested.planningPeriodId?.trim(),
      )
    : null;

  if (requestedWorkspaceId && !resolvedContext) {
    return <UnavailableWorkspaceContext />;
  }

  const workspace =
    resolvedContext?.workspace ?? (await getCurrentWorkspace(userId));
  if (!workspace) {
    return (
      <div
        data-timeline-module
        className="mx-auto flex w-full max-w-3xl flex-1 items-center px-5 py-16 sm:px-8"
      >
        <div className="w-full rounded-2xl border border-line-soft bg-white p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
            Timeline
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">
            Your projects will appear here.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
            Create a workspace in Tasks first. Milestone tasks become the
            private draft you shape here before anything is shared.
          </p>
          <Link
            href="/app/tasks"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Open Tasks
          </Link>
        </div>
      </div>
    );
  }

  const context = {
    workspaceId: resolvedContext?.workspaceId,
    planningPeriodId: resolvedContext?.planningPeriodId ?? undefined,
  };
  const [projects, nodes, publications, { tier }] = await Promise.all([
    getProjectsForWorkspace(workspace.slug),
    getEffectiveNodesForWorkspace(workspace.slug),
    getOwnerAudiencePublications(workspace.slug),
    resolveEntitlement(userId),
  ]);
  const publishedLinks = publications.reduce(
    (sum, publication) =>
      sum +
      (publication.state === "published" ? publication.activeShareCount : 0),
    0,
  );
  const visibleMilestones = nodes.filter((node) => !node.hidden).length;

  return (
    <div
      data-timeline-module
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10 lg:px-10"
    >
      <header className="border-b border-line-soft pb-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
                Owner workspace
              </p>
              <span className="rounded-full border border-line-soft bg-bg-deep px-2.5 py-1 text-xs font-medium text-ink-soft">
                {TIER_LABEL[tier]}
              </span>
            </div>
            <h1 className="mt-3 text-[clamp(2.25rem,1.6rem+2vw,3.8rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-ink">
              Shape the story before you share it.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
              Each project has its own private milestone draft. Edit the
              wording, dates, order and visibility here, then publish a frozen
              link when it reads exactly right.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={contextHref("/app/timeline/audience", context)}
              className="inline-flex min-h-11 items-center rounded-lg border border-line-soft bg-white px-4 text-sm font-medium text-ink hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Manage shared links
            </Link>
            <Link
              href="/app/tasks"
              className="inline-flex min-h-11 items-center rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Open milestone tasks
            </Link>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line-soft bg-line-soft sm:grid-cols-4">
          {[
            ["Workspace", workspace.name],
            ["Project timelines", String(projects.length)],
            ["Visible milestones", String(visibleMilestones)],
            ["Live share links", String(publishedLinks)],
          ].map(([label, value]) => (
            <div key={label} className="bg-white px-4 py-4 sm:px-5">
              <dt className="text-xs font-medium text-ink-quiet">{label}</dt>
              <dd className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="py-8" aria-labelledby="project-timelines-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="project-timelines-heading"
              className="text-2xl font-semibold tracking-[-0.035em] text-ink"
            >
              Project timelines
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              A milestone task appears automatically in its project’s owner
              view.
            </p>
          </div>
          <details className="group relative">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-line-soft bg-white px-4 text-sm font-medium text-ink outline-none hover:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
              Add project
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line-soft bg-white p-5 shadow-[0_18px_50px_-24px_rgba(20,21,26,0.35)]">
              <p className="mb-4 text-sm font-medium text-ink">
                Start a project timeline
              </p>
              <CreateProjectForm workspaceSlug={workspace.slug} />
            </div>
          </details>
        </div>

        {projects.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-line-soft bg-bg-deep px-6 py-12 text-center">
            <h3 className="text-lg font-semibold text-ink">
              No project timelines yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">
              Add a project here, or mark tasks as milestones in Tasks. The
              owner view stays private until you deliberately publish a frozen
              artifact.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {projects.map((project, projectIndex) => {
              const projectNodes = nodes.filter(
                (node) => node.projectSlug === project.slug,
              );
              const visible = projectNodes.filter((node) => !node.hidden);
              const hiddenCount = projectNodes.length - visible.length;
              const sourceIds = new Set(projectNodes.map((node) => node.id));
              const projectPublications = publications.filter((publication) =>
                publication.items.some((item) =>
                  sourceIds.has(item.sourceRelation),
                ),
              );
              const activeLinks = projectPublications.reduce(
                (sum, publication) =>
                  sum +
                  (publication.state === "published"
                    ? publication.activeShareCount
                    : 0),
                0,
              );
              const driftCount = projectNodes.filter(
                (node) => node.driftDetected,
              ).length;
              const dates = visible
                .map((node) => node.targetDate)
                .filter((date): date is string => Boolean(date));
              const editHref = contextHref(
                `/app/timeline/${encodeURIComponent(project.slug)}`,
                context,
              );
              const shareHref = contextHref(
                "/app/timeline/audience",
                context,
                { project: project.slug },
              );

              return (
                <article
                  key={project.slug}
                  className="group flex min-h-72 flex-col rounded-2xl border border-line-soft bg-white p-5 transition-[border-color,box-shadow] hover:border-indigo-200 hover:shadow-[0_18px_50px_-32px_rgba(20,21,26,0.35)] sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.13em] text-ink-quiet">
                        {String(projectIndex + 1).padStart(2, "0")} ·{" "}
                        {activeLinks > 0
                          ? `${activeLinks} live link${activeLinks === 1 ? "" : "s"}`
                          : projectPublications.length > 0
                            ? "Private preview"
                            : "Owner draft"}
                      </p>
                      <h3 className="mt-2 truncate text-2xl font-semibold tracking-[-0.04em] text-ink">
                        {project.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-soft">
                        {project.oneLiner || "A project timeline ready to shape."}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className="mt-1 h-3 w-3 flex-none rounded-full"
                      style={{ background: project.accent }}
                    />
                  </div>

                  <div className="my-7 rounded-xl border border-line-soft bg-bg-deep px-4 py-5">
                    <div className="relative h-8" aria-hidden>
                      <span className="absolute left-0 right-0 top-[15px] h-px bg-line-soft" />
                      {visible.slice(0, 7).map((node, index) => (
                        <span
                          key={node.id}
                          className="absolute top-[10px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-indigo-600 shadow-[0_0_0_1px_rgba(79,70,229,0.24)]"
                          style={{
                            left:
                              visible.length === 1
                                ? "50%"
                                : `${(index / (Math.min(visible.length, 7) - 1)) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-soft">
                      <span>{formatDateRange(dates)}</span>
                      <span>
                        {visible.length} milestone
                        {visible.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <div className="mb-4 flex flex-wrap gap-2 text-xs text-ink-quiet">
                      {hiddenCount > 0 ? (
                        <span>{hiddenCount} hidden</span>
                      ) : null}
                      {driftCount > 0 ? (
                        <span className="text-amber-700">
                          {driftCount} source change
                          {driftCount === 1 ? "" : "s"} to review
                        </span>
                      ) : null}
                      {hiddenCount === 0 && driftCount === 0 ? (
                        <span>Private until you publish</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={editHref}
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-ink px-4 text-sm font-medium text-white hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      >
                        Open owner view
                      </Link>
                      <Link
                        href={shareHref}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-soft bg-white px-4 text-sm font-medium text-ink hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      >
                        Preview & publish
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className="mb-8 grid gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-ink">
            The owner view and the public artifact are separate.
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">
            Owner edits never leak live. Publishing copies only the milestone
            labels, dates and states you select into a frozen, revocable link.
            Notes, people, comments and attachments are not part of that copy.
          </p>
        </div>
        <Link
          href={contextHref("/app/timeline/audience", context)}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-indigo-200 bg-white px-4 text-sm font-medium text-indigo-800 hover:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Review all artifacts
        </Link>
      </aside>
    </div>
  );
}

function UnavailableWorkspaceContext() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 items-center px-6 py-16 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-quiet">
          Workspace context
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink">
          That workspace is not available here.
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          Timeline could not confirm a current Tasks membership. Return to
          Your Work and choose a workspace you can access.
        </p>
      </div>
    </div>
  );
}
