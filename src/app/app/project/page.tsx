import Link from "next/link";
import { redirect } from "next/navigation";
import { getProjectOverviewData } from "@/server/actions/project-overview";
import { ProjectOverview } from "@/components/app/project/project-overview";
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
 * ── The interim verification, and why it is here ───────────────────────────
 *
 * `getProjectOverviewData()` still takes no argument, and it lives in
 * `src/server/actions/**`, which another lane owns — an interface request to
 * give it an explicit `projectId` parameter is filed rather than reached for
 * here. Until it lands, this page cannot *direct* that read; what it can do is
 * refuse to render a mismatch. The payload carries its own `workspaceId`, so
 * the authorized Project is compared against the Project the data actually
 * describes, and a disagreement renders the neutral unavailable state instead
 * of silently showing Project A's members and budget under a URL that says B.
 *
 * That is ADR 0001 §2's invariant enforced at the last point this lane
 * controls. It becomes a no-op the moment the parameter exists.
 */
function canonicalProjectUrl(workspaceId: ProjectId): string {
  // The shared contextual-link builder. An earlier draft built this query
  // locally to avoid the helper's silent fragment drop; #132 fixed the helper,
  // so there is no longer a reason for this route to have its own builder.
  return withActiveProject(PROJECT_APP_PATH, workspaceId);
}

function Unavailable() {
  return (
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
  if (project.kind === "empty") return <Unavailable />;

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

  const data = await getProjectOverviewData();

  // See the docblock. Refuse rather than render another Project's overview.
  if (data.workspaceId !== authorized) return <Unavailable />;

  return <ProjectOverview data={data} />;
}
