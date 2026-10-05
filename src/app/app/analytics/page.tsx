import { requireAppAccessTasks } from "@/server/app-access";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { loadProjectAnalytics } from "@/server/projects/project-analytics";
import { ActiveProjectRouteSync } from "@/components/app/active-project-route-sync";
import { AnalyticsUnavailable, AnalyticsView } from "@/components/app/analytics/analytics-view";
import { parseAnalyticsRange } from "@/lib/projects/project-analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics · Signal Studio" };

/**
 * /app/analytics: how work is moving in the active Project. The Project comes
 * from the same route boundary as Tasks and Files, so a stale cookie or a
 * Project the reader cannot open is one quiet "unavailable" answer, and the
 * figures are read only after that proof.
 */
export default async function AnalyticsPage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  await requireAppAccessTasks();
  const params = await searchParams ?? {};
  const requested = typeof params.workspaceId === "string" ? params.workspaceId : null;
  const range = parseAnalyticsRange(typeof params.range === "string" ? params.range : null);
  const decision = await resolveProjectForRoute(requested);
  if (decision.kind === "unavailable" || decision.kind === "empty") {
    return <>
      <ActiveProjectRouteSync project={null} requestedProjectId={requested} />
      <AnalyticsUnavailable />
    </>;
  }
  const analytics = await loadProjectAnalytics(decision.workspaceId, range);
  return <>
    <ActiveProjectRouteSync project={decision.project} requestedProjectId={requested} />
    <AnalyticsView projectName={decision.name} analytics={analytics} requestedProjectId={requested} />
  </>;
}
