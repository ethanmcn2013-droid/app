"use server";

/**
 * The chooser's catalog read — WP6 Lane A.
 *
 * Deliberately separate from `active-project.ts`: that file owns the one
 * guarded *write*, and the reasoning in its docblock is about cookies,
 * redirects and ordering. This is a read, and mixing them would put a
 * membership query inside the file whose whole claim is that it writes nothing
 * it has not first proved.
 *
 * ── Why an action, and why on demand ───────────────────────────────────────
 *
 * The catalog is a membership query, and `ActiveProjectProvider`'s contract is
 * that the `/app` shell renders chrome **without** running one — the bootstrap
 * is a validated cookie and nothing more. Loading every membership eagerly in
 * the layout to populate a menu nobody has opened would break that on every
 * signed-in page view, which is the most-rendered path in the product.
 *
 * So the catalog arrives when the chooser opens, and the trigger holds a
 * fixed-width skeleton until it does. That is the same shape the provider
 * already uses for an unverified route, so the chrome has one loading idiom
 * rather than two.
 *
 * Reachable by direct POST like every Server Function, so the flag gate and the
 * re-authentication both run unconditionally here rather than in the caller.
 */

import { getCurrentUser } from "@/server/auth";
import { isDemoMode } from "@/lib/access-mode";
import { isActiveProjectV3Enabled } from "@/lib/projects/flags";
import { getProjectCatalog } from "@/server/projects/request-scope";
import { demoProjectSummary } from "@/server/projects/route-authz";
import { LOOSE_GROUP_ID } from "@/server/projects/catalog";
import {
  buildChooserCatalog,
  type ChooserCatalog,
} from "@/lib/projects/project-chooser";

/**
 * The one-Project catalog the review boundary shows. Built from the same
 * summary `resolveProjectForRoute` hands the page, so the chooser cannot name
 * a Project the demo content does not have.
 */
function demoCatalog() {
  const project = demoProjectSummary();
  return Object.freeze({
    groups: [
      Object.freeze({
        kind: "loose" as const,
        id: LOOSE_GROUP_ID,
        planningPeriodId: null,
        name: "Active work",
        startDate: null,
        endDate: null,
        collapsed: false,
        readOnly: false,
        projects: [project],
      }),
    ],
    allProjects: [project],
    ambiguousProjectIds: [],
    truncated: false,
  });
}

export type LoadProjectCatalogResult =
  | Readonly<{ ok: true; catalog: ChooserCatalog }>
  /**
   * Coarse on purpose, matching `switchActiveProjectAction`: the chooser can
   * only ever say "we couldn't load your projects" and offer a retry, so a
   * finer taxonomy would leak more than it could ever be used for.
   */
  | Readonly<{ ok: false; reason: "disabled" | "unavailable" }>;

export async function loadProjectCatalogAction(): Promise<LoadProjectCatalogResult> {
  // Flag off: the action exists in the bundle and does nothing. Same inertness
  // contract as the switch action next door.
  if (!isActiveProjectV3Enabled()) return { ok: false, reason: "disabled" };

  // Demo and Review never touch a database (`access-mode.ts` safety
  // invariant), so a membership query would fail and the chooser would report
  // "we couldn't load your projects" on the one boundary whose whole job is to
  // be a faithful, deterministic picture of the product. The demo workspace is
  // the only Project that exists there — the same answer
  // `resolveProjectForRoute` gives, so chrome and content agree.
  if (isDemoMode()) {
    return { ok: true, catalog: buildChooserCatalog(demoCatalog()) };
  }

  try {
    // Never trust an identity carried in the payload — there isn't one, and
    // there must not be: the catalog is exactly "the Projects you are a member
    // of", so the actor is the only input and the server supplies it.
    const actorUserId = await getCurrentUser();
    const catalog = await getProjectCatalog(actorUserId);
    return { ok: true, catalog: buildChooserCatalog(catalog) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
