import Link from "next/link";
import { redirect } from "next/navigation";
import { PortfolioView } from "@/components/app/portfolio/portfolio-view";
import type { SwitcherOption, TimelineTabProject } from "@/components/app/portfolio/timeline-tabs";
import { monogramOf } from "@/lib/projects/project-chooser";
import { parseStatusFilter } from "@/lib/projects/project-portfolio";
import { CreateProjectForm } from "@/modules/timeline/app/_components/create-project-form";
import { getProjectEmptyCopy } from "@/modules/timeline/lib/onboarding/personalization";
import { buildTimelineProjectHref } from "@/modules/timeline/lib/project-switcher-model";
import {
  getCurrentWorkspace,
  requireUser,
  resolveTimelineContext,
} from "@/modules/timeline/server/auth";
import { getProjectsForWorkspace } from "@/modules/timeline/server/db/timeline-queries";
import { loadProjectPortfolio } from "@/server/projects/project-portfolio";
import styles from "./_components/timeline-index.module.css";

export const metadata = { title: "Timeline · Signal Studio" };
export const dynamic = "force-dynamic";

export type TimelineIndexSearchParams = {
  workspaceId?: string;
  planningPeriodId?: string;
  project?: string;
  projectSlug?: string;
  mode?: string;
  /** `project`: open this Project's primary plan (All projects rows use it). */
  open?: string;
  zoom?: string;
  group?: string;
  sort?: string;
  /** Status filter chips: `at-risk,on-track,…`. Parsed by `parseStatusFilter`. */
  status?: string;
};

/**
 * The Timeline index.
 *
 * With Active Project V3 on, a bare `/app/timeline` (or one carrying only the
 * sidebar's `?workspaceId=`) is **All projects**: every Project on one time
 * scale. Every request that names a plan keeps today's behaviour and
 * redirects into it: `?open=project` (what an All projects row emits),
 * `?project=`, `?projectSlug=` and the Milestones deep link `?mode=edit`. So
 * does everything when V3 is off or the portfolio read returns null.
 */
export default async function TimelineOwnerHome({
  searchParams,
}: {
  searchParams: Promise<TimelineIndexSearchParams>;
}) {
  const userId = await requireUser();
  const requested = await searchParams;
  const requestedWorkspaceId = requested.workspaceId?.trim();
  const namesAPlan =
    requested.open === "project" ||
    Boolean(requested.project?.trim()) ||
    Boolean(requested.projectSlug?.trim()) ||
    requested.mode === "edit";

  if (!namesAPlan) {
    const portfolio = await loadProjectPortfolio();
    if (portfolio) {
      const last = await lastPlanFor(userId, requestedWorkspaceId, requested.planningPeriodId?.trim());
      return (
        <PortfolioView
          portfolio={portfolio}
          openProjectId={requestedWorkspaceId ?? null}
          tabProject={last?.project ?? null}
          plans={last?.plans ?? []}
          allHref={requestedWorkspaceId ? `/app/timeline?${new URLSearchParams({ workspaceId: requestedWorkspaceId })}` : "/app/timeline"}
          search={{
            zoom: requested.zoom,
            group: requested.group,
            sort: requested.sort,
            status: parseStatusFilter(requested.status).size > 0 ? requested.status : undefined,
          }}
        />
      );
    }
  }

  const resolvedContext = requestedWorkspaceId
    ? await resolveTimelineContext(
        userId,
        requestedWorkspaceId,
        requested.planningPeriodId?.trim(),
      )
    : null;

  if (requestedWorkspaceId && !resolvedContext) {
    return <UnavailableProjectContext />;
  }

  const workspace =
    resolvedContext?.workspace ?? (await getCurrentWorkspace(userId));
  if (!workspace) {
    return (
      <IndexCard
        title="Your timelines will appear here"
        body="Create a project first. Tasks you mark as milestones become a private timeline you shape here before anything is shared."
      >
        <Link href="/app/project" className={styles.primary}>
          Open Projects
        </Link>
      </IndexCard>
    );
  }

  const projects = await getProjectsForWorkspace(workspace.slug);
  const requestedProjectSlug =
    requested.projectSlug?.trim() ?? requested.project?.trim();
  const project =
    projects.find((candidate) => candidate.slug === requestedProjectSlug) ??
    projects[0];
  if (project) {
    // Redirect, not a direct call: the [projectSlug] segment's own loading
    // boundary and metadata only run at the canonical address. The path comes
    // from the module's own URL helper (docs/SUITE_URL_AND_NAMING_CONTRACT.md),
    // and `mode` rides along so a Milestones deep link still opens the first
    // milestone's panel.
    redirect(
      buildTimelineProjectHref(project.slug, {
        workspaceId: resolvedContext?.workspaceId,
        planningPeriodId: resolvedContext?.planningPeriodId,
        mode: requested.mode === "edit" ? "edit" : null,
      }),
    );
  }

  // No plan to redirect to: the empty state speaks the Project's own
  // language (a venue that started from the wedding template is met in
  // wedding words), and offers the one action that fills it.
  const emptyCopy = getProjectEmptyCopy({ templateId: workspace.templateId });

  return (
    <IndexCard title={emptyCopy.headline} body={emptyCopy.body}>
      <div className={styles.form}>
        <CreateProjectForm workspaceSlug={workspace.slug} />
      </div>
    </IndexCard>
  );
}

/**
 * What the second tab names on All projects: the Project the reader was last
 * in (the sidebar's `?workspaceId=`, else their current one), where its tab
 * goes (its first plan), and its plans for the switcher. Everything comes
 * from the reader's own authorized context; a failure leaves "One project".
 */
async function lastPlanFor(
  userId: string,
  workspaceId: string | undefined,
  planningPeriodId: string | undefined,
): Promise<{ project: TimelineTabProject; plans: SwitcherOption[] } | null> {
  try {
    const context = workspaceId ? await resolveTimelineContext(userId, workspaceId, planningPeriodId) : null;
    const workspace = context?.workspace ?? (await getCurrentWorkspace(userId));
    if (!workspace) return null;
    const plans = await getProjectsForWorkspace(workspace.slug);
    const [first] = plans;
    if (!first) return null;
    const hrefFor = (slug: string) =>
      buildTimelineProjectHref(slug, {
        workspaceId: context?.workspaceId,
        planningPeriodId: context?.planningPeriodId,
      });
    return {
      project: {
        id: context?.workspaceId ?? workspace.suiteWorkspaceId ?? workspace.slug,
        name: workspace.name,
        monogram: monogramOf(workspace.name),
        href: hrefFor(first.slug),
      },
      plans: plans.map((plan) => ({ key: `plan:${plan.slug}`, name: plan.name, href: hrefFor(plan.slug) })),
    };
  } catch {
    return null;
  }
}

function IndexCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div data-timeline-module className={styles.page}>
      <section className={styles.card} aria-labelledby="timeline-index-title">
        <span className={styles.mark} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path d="M8 2.5 13.5 8 8 13.5 2.5 8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 id="timeline-index-title" className={styles.title}>
          {title}
        </h1>
        <p className={styles.body}>{body}</p>
        {children}
      </section>
    </div>
  );
}

function UnavailableProjectContext() {
  return (
    <IndexCard
      title="That project is not available"
      body="It may have been removed, or your access may have changed. Choose a project you can open."
    >
      <Link href="/app/project" className={styles.primary}>
        Open Projects
      </Link>
    </IndexCard>
  );
}
