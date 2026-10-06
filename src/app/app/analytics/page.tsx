import { requireAppAccessTasks } from "@/server/app-access";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import {
  loadAnalyticsProjects,
  loadPortfolioAnalytics,
  loadProjectAnalytics,
  loadProjectStanding,
} from "@/server/projects/project-analytics";
import { loadAnalyticsWall } from "@/server/projects/project-analytics-wall";
import { ActiveProjectRouteSync } from "@/components/app/active-project-route-sync";
import { AnalyticsUnavailable, AnalyticsView, parseAnalyticsPart } from "@/components/app/analytics/analytics-view";
import { parseAnalyticsRange, type ProjectAnalytics } from "@/lib/projects/project-analytics";
import { parseQuestion, type ProjectStanding } from "@/lib/projects/project-analytics-questions";
import { parseWallSort } from "@/lib/projects/project-analytics-wall";
import { isActiveProjectV3Enabled } from "@/lib/projects/flags";
import type { ProjectCardStats } from "@/lib/projects/project-hub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics · Signal Studio" };

/** The open Project's card figures, from the calculation already on the page. */
function cardStats(analytics: ProjectAnalytics, standing: ProjectStanding): ProjectCardStats {
  return {
    status: standing.status,
    targetDate: standing.targetDate,
    purpose: null,
    total: analytics.status.reduce((sum, row) => sum + row.count, 0),
    complete: analytics.status.filter((row) => row.isDone).reduce((sum, row) => sum + row.count, 0),
    overdue: analytics.overdue.count,
  };
}

/**
 * /app/analytics: plain questions answered from real tasks (`?ask=`), across
 * every Project the reader can open (`?scope=all`) or for one
 * (`?workspaceId=`), and a card per Project (`?view=projects`).
 *
 * The open Project comes from the same route boundary as Tasks and Files, so
 * a stale cookie or a Project the reader cannot open is one quiet
 * "unavailable" answer, and nothing is read before that proof. The wider
 * scope reads only Projects from the reader's own membership catalog. With no
 * scope in the address the page covers every project when the reader has
 * more than one, and the open project otherwise.
 */
export default async function AnalyticsPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  await requireAppAccessTasks();
  const params = await searchParams ?? {};
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : null);
  const requested = one("workspaceId");
  const range = parseAnalyticsRange(one("range"));
  const decision = await resolveProjectForRoute(requested);
  if (decision.kind === "unavailable" || decision.kind === "empty") {
    return <>
      <ActiveProjectRouteSync project={null} requestedProjectId={requested} />
      <AnalyticsUnavailable />
    </>;
  }

  const everyProject = isActiveProjectV3Enabled();
  const projects = everyProject ? await loadAnalyticsProjects() : null;
  const part = projects ? parseAnalyticsPart(one("view")) : "ask";
  const scopeParam = one("scope");
  const wantsAll = projects !== null && (scopeParam === "all" || (requested === null && projects.length > 1));
  const portfolio = wantsAll ? await loadPortfolioAnalytics(range) : null;
  const shared = {
    projects: projects ?? [],
    part,
    ask: parseQuestion(one("ask")),
    sort: parseWallSort(one("sort")),
    everyProject: projects !== null,
  };

  if (portfolio) {
    const standing = await loadProjectStanding(decision.workspaceId);
    const wall = await loadAnalyticsWall({ id: decision.workspaceId, stats: cardStats(portfolio.analytics, standing) });
    return <>
      <ActiveProjectRouteSync project={decision.project} requestedProjectId={requested} />
      <AnalyticsView {...shared} scope={{ kind: "all" }} analytics={portfolio.analytics} wall={wall} linkProjectId={null} />
    </>;
  }

  const [analytics, standing] = await Promise.all([
    loadProjectAnalytics(decision.workspaceId, range),
    loadProjectStanding(decision.workspaceId),
  ]);
  const wall = part === "projects"
    ? await loadAnalyticsWall({ id: decision.workspaceId, stats: cardStats(analytics, standing) })
    : null;
  return <>
    <ActiveProjectRouteSync project={decision.project} requestedProjectId={requested} />
    <AnalyticsView
      {...shared}
      scope={{ kind: "one", projectId: decision.workspaceId, name: decision.name, standing }}
      analytics={analytics}
      wall={wall}
      // With more than one project a bare address means every project, so
      // links that stay on this one must name it.
      linkProjectId={projects !== null && projects.length > 1 ? decision.workspaceId : requested}
    />
  </>;
}
