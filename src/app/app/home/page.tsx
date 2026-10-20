import { requireAppAccessTasks } from "@/server/app-access";
import { HomeBentoUnavailable, HomeBentoView } from "@/components/app/home/bento/home-bento-view";
import { ActiveProjectRouteSync } from "@/components/app/active-project-route-sync";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { loadHomeBento } from "@/server/home/home-bento-read";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home · Signal Studio" };

/**
 * /app/home — the authenticated front door (20 October 2026).
 *
 * The launch countdown, done this week, a year of activity and four start
 * cards, across every Project the reader can open (`loadHomeBento`). The
 * Full Briefing was retired the same day; its old addresses redirect here.
 *
 * The chrome still names the reader's current Project: the same authorized
 * route decision every other page uses, never a guess from Home's figures.
 */
export default async function HomePage({ searchParams }: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppAccessTasks();

  const params = (await searchParams) ?? {};
  const requested = typeof params.workspaceId === "string" ? params.workspaceId : null;
  const [model, route] = await Promise.all([loadHomeBento(), resolveProjectForRoute(requested)]);
  const project = route.kind === "ready" || route.kind === "archived" ? route.project : null;

  return (
    <>
      <ActiveProjectRouteSync project={project} requestedProjectId={requested} />
      {model ? <HomeBentoView model={model} /> : <HomeBentoUnavailable />}
    </>
  );
}
