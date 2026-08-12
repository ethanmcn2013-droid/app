import "server-only";

/**
 * The Project gate every print route shares — WP3 defect 3.
 *
 * ── What they did before ───────────────────────────────────────────────────
 *
 * `layout.tsx:13` and all four pages called `getActiveWorkspace`. **No print
 * route accepted `searchParams` at all**, so there was no way to ask for a
 * particular Project's artefact: whichever Project the cookie last pointed at
 * was the one that printed. Worse, `getActiveWorkspace`'s third fallback
 * returns `LEGACY_WORKSPACE_ID` for a caller with no membership at all, so a
 * print job could render a workspace nobody had proved access to.
 *
 * A print route is where a wrong-Project artefact leaves the building — a PDF
 * handed to a client, a board pinned to a wall. It is the one surface where
 * the mistake is not recoverable by clicking back.
 *
 * ── What they do now ───────────────────────────────────────────────────────
 *
 * Every page takes `searchParams`, resolves `workspaceId` explicitly, and
 * proves membership before any task is read. The layout no longer resolves a
 * Project at all — a layout cannot receive `searchParams` in Next.js (see
 * `layout.tsx` for the citation), so it had no way to gate the *requested*
 * Project and could only ever have gated the cookie's.
 *
 * ── An empty board and a refused one are different artefacts ───────────────
 *
 * This is the distinction the gate exists to preserve. An authorized Project
 * with no tasks prints an empty board — correct, and useful. An unauthorized
 * or unresolvable Project must print a **refusal**, never an empty board:
 * a blank artefact is indistinguishable from a real one that happens to have
 * nothing in it, and it carries the workspace name and the generated date as
 * if it were evidence. "You may not read this" and "there is nothing here"
 * must not produce the same page.
 */

import { redirect } from "next/navigation";
import { isFirstRun } from "@/server/db/queries";
import { resolveProjectForRoute } from "@/server/projects/route-authz";
import { withActiveProject } from "@/lib/projects/project-url";
import type { ProjectId } from "@/lib/projects/project-ref";

export type PrintSearchParams = Promise<{ workspaceId?: string | string[] }>;

export type PrintProjectGate =
  | Readonly<{ kind: "ready"; workspaceId: ProjectId }>
  | Readonly<{ kind: "refused" }>;

/**
 * Resolve and prove the Project for one print route.
 *
 * `printPath` is the route's own path, used to build the canonical URL when
 * the caller arrived without naming a Project. Canonicalising matters more
 * here than elsewhere: a print URL gets bookmarked, mailed, and re-opened
 * months later, and one that names its Project explicitly still produces the
 * same artefact then.
 */
export async function gatePrintProject(
  printPath: string,
  searchParams: PrintSearchParams,
): Promise<PrintProjectGate> {
  const { workspaceId } = await searchParams;
  const project = await resolveProjectForRoute(workspaceId);

  if (project.kind === "unavailable" || project.kind === "empty") {
    return { kind: "refused" };
  }

  if (project.kind === "ready" && project.canonicalRedirectTo !== null) {
    // Outside any try/catch: `redirect` throws Next's control-flow exception.
    redirect(withActiveProject(printPath, project.canonicalRedirectTo));
  }

  // The first-run gate, previously in the layout against the cookie's Project
  // and now against the one actually requested. An uninitialized Project must
  // pick a starter before any view — including print — is meaningful.
  if (await isFirstRun(project.workspaceId)) {
    redirect("/welcome");
  }

  return { kind: "ready", workspaceId: project.workspaceId };
}

/**
 * The refusal artefact. Deliberately plain, deliberately not a board: someone
 * holding this page must be able to tell at a glance that nothing was printed,
 * rather than believing they are looking at an empty project.
 */
export function PrintRefusal() {
  return (
    <div className="print-view">
      {/* The same doc-header every print artefact carries, so the refusal is
          unmistakably a page from this app — but with no workspace name and
          no generated date, because naming either would be asserting
          something that was never authorized. */}
      <div className="print-doc-header">
        <span className="print-doc-workspace">Nothing to print</span>
      </div>
      <p style={{ maxWidth: "42ch", fontSize: "0.875rem", lineHeight: 1.6 }}>
        This link does not name a project you can open. It may have been
        deleted, or the link is stale.
      </p>
    </div>
  );
}
