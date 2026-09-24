import Link from "next/link";
import { redirect } from "next/navigation";
import { getProjectOverviewData } from "@/server/actions/project-overview";
import { ProjectsHub } from "@/components/app/project/projects-hub";
import { loadProjectHub } from "@/server/projects/project-hub";
import { TasksRuntimePageMount } from "@/components/app/tasks-runtime-mount";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { PROJECT_APP_PATH } from "@/lib/product-urls";
import { withActiveProject } from "@/lib/projects/project-url";
import type { ProjectId } from "@/lib/projects/project-ref";

// Inherited from the /app layout: force-dynamic
export const dynamic = "force-dynamic";

/**
 * /app/project — overview for one explicit Project (ADR 0001, D-011).
 *
 * ── What it did before ─────────────────────────────────────────────────────
 *
 * The page took no parameters and called `getProjectOverviewData()`, which
 * resolves `getActiveWorkspace` internally (`project-overview.ts:239`). Its
 * own docblock stated the assumption: "The active workspace is already scoped
 * by the layout … so this page always renders the workspace the user has in
 * view." That assumption is what ADR 0001 §4 retires — a URL naming a Project
 * was ignored, and the cookie decided what a shared or bookmarked
 * `/app/project` link rendered.
 *
 * ── What it does now ───────────────────────────────────────────────────────
 *
 * The URL is the current-tab truth. `workspaceId` is resolved and authorized
 * against a fresh membership query before any overview data is read. Absent,
 * ADR 0001 §4 step 3 runs and the page replace-redirects to a canonical URL
 * that now carries the Project.
 *
 * The overview read and its controls receive the authorized URL Project.
 * The payload check remains a final guard against mismatched content.
 */
function canonicalProjectUrl(workspaceId: ProjectId): string {
  // The shared contextual-link builder. An earlier draft built this query
  // locally to avoid the helper's silent fragment drop; the Wave 2 follow-up
  // (PR 132) fixed it, so this route has no reason to keep its own builder.
  return withActiveProject(PROJECT_APP_PATH, workspaceId);
}

/**
 * Renders inside the AMBIENT runtime mount — no `searchParams` — in both
 * flag states: the chrome around a refusal shows the Project the caller
 * actually has open, never the one the URL failed to name (D-022).
 */
function Unavailable() {
  return (
    <TasksRuntimePageMount>
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <div className="text-[16px] font-semibold text-ink">Project unavailable</div>
        <div className="max-w-[34ch] text-[13px] text-ink-soft">
          This project may have been deleted, or the link is stale.
        </div>
        <Link
          href="/app/home"
          className="mt-2 text-[12.5px] text-ink-quiet underline underline-offset-2 transition-colors hover:text-ink-soft"
        >
          Go to Home
        </Link>
      </div>
    </TasksRuntimePageMount>
  );
}

function EmptyProjects() {
  return (
    <main id="app-main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-[var(--paper)] px-8 text-center">
      <h1 className="text-[18px] font-semibold text-ink">Your projects start here</h1>
      <p className="max-w-[42ch] text-[13px] text-ink-soft">Set up your first project to keep its tasks and timeline together.</p>
      <Link href="/welcome" className="mt-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Set up a project</Link>
    </main>
  );
}

export default async function ProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string | string[] }>;
}) {
  const { workspaceId } = await searchParams;
  const project = await resolveProjectForRoute(workspaceId);

  // Missing, forbidden, deleted and malformed — one neutral answer. A caller
  // who names a Project they may not open learns nothing about whether it
  // exists (ADR 0001 §4).
  if (project.kind === "unavailable") return <Unavailable />;

  // Belongs to no Project at all. Never LEGACY_WORKSPACE_ID (D-005).
  if (project.kind === "empty") return <EmptyProjects />;

  // Archived Projects open read-only through an explicit link (ADR 0001 §5);
  // the overview is a read, so it renders.
  const authorized = project.workspaceId;

  // Bare entry resolved through the cookie or the first accessible Project.
  // Canonicalise so reload, history and a copied link all name it explicitly.
  // `redirect` throws Next's control-flow exception and must stay outside any
  // try/catch — there is none here, deliberately.
  if (project.kind === "ready" && project.canonicalRedirectTo !== null) {
    redirect(canonicalProjectUrl(project.canonicalRedirectTo));
  }

  // The index of every Project the caller can open reads the same authorized
  // membership catalog as the chooser (null with Active Project V3 off, which
  // leaves the overview as the whole page). Read alongside the overview.
  const [data, hub] = await Promise.all([
    getProjectOverviewData(authorized),
    loadProjectHub(authorized),
  ]);

  // See the docblock. Refuse rather than render another Project's overview.
  if (data.workspaceId !== authorized) return <Unavailable />;

  // The overview verified above that its data names the URL's Project, so
  // chrome and content follow the URL together when the flag-on page mount
  // consumes it (D-022).
  return (
    <TasksRuntimePageMount searchParams={searchParams}>
      <ProjectsHub key={authorized} hub={hub} data={data} />
    </TasksRuntimePageMount>
  );
}
