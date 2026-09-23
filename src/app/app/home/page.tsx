import { notFound, redirect } from "next/navigation";
import { isDemoMode } from "@/lib/access-mode";
import { requireAppAccessTasks } from "@/server/app-access";
import { parseBriefingReadScopeHint, planningPeriodsEnabled, requireSignalUser } from "@/modules/signal/home";
import { HomeNewUser, HomeProjectUnavailable, HomeView } from "@/components/app/home/home-view";
import { ActiveProjectRouteSync } from "@/components/app/active-project-route-sync";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import type { RouteProjectDecision } from "@/server/projects/route-authz";
import { loadHomeData } from "./home-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home · Signal Studio" };

/**
 * /app/home — the authenticated front door (Signal → Home
 * consolidation, D1). Today's Signal is the dominant module; the Full
 * Briefing sits one level deeper at /app/home/briefing.
 */
export default async function HomePage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  await requireAppAccessTasks();

  const demo = isDemoMode();
  const userId = demo ? null : await requireSignalUser();
  if (!demo && !userId) redirect("/sign-in");

  const params = await searchParams ?? {};
  const hint = parseBriefingReadScopeHint(params, planningPeriodsEnabled());
  if (hint.kind === "invalid") notFound();
  let data = await loadHomeData({
    clerkId: userId ?? "demo-user",
    ...(hint.kind === "scope" ? { scope: hint.scope } : {}),
  });
  // A new Tasks account need not have a Signal preference yet. For a bare
  // entry only, use Tasks' own authorized Project fallback, then let Signal
  // independently authorize the exact workspace before reading its signals.
  // A contextual link never falls back to another Project or writes a cookie.
  let fallbackProject: RouteProjectDecision | null = null;
  if (data.kind === "new-user" && hint.kind === "absent") {
    fallbackProject = await resolveProjectForRoute();
    if (fallbackProject.kind === "ready") {
      data = await loadHomeData({
        clerkId: userId ?? "demo-user",
        scope: { kind: "workspace", workspaceId: fallbackProject.workspaceId },
      });
    }
  }
  if (data.kind === "new-user") {
    if (hint.kind === "scope") notFound();
    if (fallbackProject?.kind === "ready") return <>
      <ActiveProjectRouteSync project={fallbackProject.project} requestedProjectId={null} />
      <HomeProjectUnavailable project={fallbackProject.project} />
    </>;
    return <>
      <ActiveProjectRouteSync project={null} requestedProjectId={null} />
      <HomeNewUser />
    </>;
  }
  // The Home read may use a saved Signal scope that differs from the Tasks
  // cookie. Only its actual authorized workspace can name the chrome. An
  // aggregate planning-period read has no single Project to publish.
  const project = data.scope.kind === "workspace"
    ? await resolveProjectForRoute(data.scope.workspaceId)
    : null;
  return <>
    <ActiveProjectRouteSync
      project={project?.kind === "ready" || project?.kind === "archived" ? project.project : null}
      requestedProjectId={typeof params.workspaceId === "string" ? params.workspaceId : null}
    />
    <HomeView data={data} />
  </>;
}
