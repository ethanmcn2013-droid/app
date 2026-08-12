import "server-only";

/**
 * Route-boundary Project authorization — WP3 route half, ADR 0001 §4 and §9.
 *
 * Wave 2 built the resolver. This is the thin request-scoped wrapper the
 * *routes* use: it authenticates, reads the two migration cookies, and hands
 * the resolver an explicit Project when the route has one. It adds no rules of
 * its own, and it deliberately returns a **workspace id and a neutral state**
 * rather than a rich summary, because that is all any route in WP3's scope
 * actually needs — the pages that render a Project's name already read it
 * themselves, and a wrapper that returned more would tempt a caller to paint
 * something it had not authorized.
 *
 * ── Why the explicit branch, always ────────────────────────────────────────
 *
 * `resolveActiveProjectForRoute` has two branches. The explicit branch
 * (`requestedWorkspaceId` present) runs `loadAuthorizedProjectRow`, a **fresh
 * membership query** against `workspace_members`. The implicit branch falls
 * back through the catalog, which `listProjectCatalogRows` truncates at
 * `.limit(2000)` with no `ORDER BY` — so catalog presence is not proof of
 * access, and a cookie naming a truncated-out Project silently becomes
 * `first-active`. Every authorization in this module therefore goes through
 * the **explicit** branch. Catalog membership is never treated as proof.
 *
 * ── Authorization is not a row filter ──────────────────────────────────────
 *
 * The pattern this module exists to replace is `WHERE workspace_id = <ambient>`
 * bolted onto the data query, which collapses "you may not read this" and
 * "there is nothing here" into the same empty result. Here the proof is its own
 * step and it happens *before* the data query. A caller that receives
 * `unavailable` must refuse; a caller that receives `ready` and then reads zero
 * rows is looking at a genuinely empty Project and may render it as such.
 *
 * ── Reason codes stay here ─────────────────────────────────────────────────
 *
 * `ProjectRouteResolution.reason` distinguishes `missing-or-forbidden` from
 * `malformed`. That distinction is useful in a server log and is an existence
 * leak anywhere a client can observe it (ADR 0001 §4). This module never
 * returns it, so a route cannot forward it by accident.
 */

import { isDemoMode } from "@/lib/access-mode";
import {
  assertProjectId,
  parseProjectId,
  type ProjectId,
} from "@/lib/projects/project-ref";
import { getCurrentUser } from "@/server/auth";
import { readActiveProjectCookies } from "@/server/projects/active-project-cookie";
import { resolveActiveProjectForRoute } from "@/server/projects/request-scope";
import { DEMO_WORKSPACE_ID } from "@/server/demo/tasks-demo";

/**
 * What a route may know. `unavailable` deliberately collapses missing,
 * forbidden, deleted and malformed — the four are one answer to a client.
 */
export type RouteProjectDecision =
  | Readonly<{
      kind: "ready";
      workspaceId: ProjectId;
      /** `url` when the route named it; `fallback` on genuine bare entry. */
      source: "url" | "fallback";
      /**
       * Non-null only on the fallback branch: the caller should
       * replace-redirect to a canonical URL now carrying `workspaceId`
       * (ADR 0001 §4 step 3).
       */
      canonicalRedirectTo: ProjectId | null;
    }>
  | Readonly<{ kind: "archived"; workspaceId: ProjectId }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "empty" }>;

/**
 * Demo and Review never touch a database (`access-mode.ts` safety invariant),
 * so they cannot run a membership query. The demo workspace is the only
 * Project that exists in that mode, and it is fully authorized by definition.
 */
function demoDecision(): RouteProjectDecision {
  return {
    kind: "ready",
    workspaceId: assertProjectId(DEMO_WORKSPACE_ID),
    source: "url",
    canonicalRedirectTo: null,
  };
}

function toDecision(
  resolution: Awaited<ReturnType<typeof resolveActiveProjectForRoute>>,
): RouteProjectDecision {
  switch (resolution.state.kind) {
    case "ready":
      return {
        kind: "ready",
        workspaceId: resolution.state.project.id,
        source: resolution.state.source,
        canonicalRedirectTo: resolution.redirectTo,
      };
    case "archived":
      return { kind: "archived", workspaceId: resolution.state.project.id };
    case "unavailable":
      return { kind: "unavailable" };
    case "empty":
      return { kind: "empty" };
  }
}

/**
 * Resolve the Project for a route that may or may not name one.
 *
 * Pass the raw `searchParams.workspaceId`. When it is present and well formed,
 * the answer is that exact Project or `unavailable` — never a substitute. When
 * it is absent, ADR 0001 §4 step 3 runs: cookie, then legacy cookie, then the
 * first accessible active Project, each with a canonical redirect target. When
 * the caller belongs to nothing, the answer is `empty` — never
 * `LEGACY_WORKSPACE_ID` (DECISIONS D-005).
 */
export async function resolveProjectForRoute(
  requestedWorkspaceId?: string | readonly string[] | null,
): Promise<RouteProjectDecision> {
  if (isDemoMode()) return demoDecision();

  const actorUserId = await getCurrentUser();
  const { unified, legacy } = await readActiveProjectCookies();

  return toDecision(
    await resolveActiveProjectForRoute({
      actorUserId,
      requestedWorkspaceId,
      cookieWorkspaceId: unified,
      legacyCookieWorkspaceId: legacy,
    }),
  );
}

/**
 * ADR 0001 §9, the object-operation pattern: the object carries its own
 * Project, so authorize **that** Project rather than comparing it to an
 * ambient one.
 *
 * The difference is not cosmetic. `object.workspaceId !== ambient` refuses a
 * caller who is a fully authorized member of the object's Project but whose
 * cookie happens to point elsewhere — the exact defect behind the task
 * deep-link and the attachment download. This proves membership of the
 * object's Project and ignores the cookie entirely.
 *
 * Never falls back: an object names exactly one Project, so an unauthorized or
 * malformed one is `unavailable` and nothing else.
 */
export async function authorizeObjectProject(
  storedWorkspaceId: string | null | undefined,
): Promise<RouteProjectDecision> {
  if (isDemoMode()) return demoDecision();

  // Shape-gate before the query so a null or malformed stored value can never
  // reach the resolver's implicit branch and be answered with a fallback.
  const projectId = parseProjectId(storedWorkspaceId);
  if (projectId === null) return { kind: "unavailable" };

  const actorUserId = await getCurrentUser();
  const decision = toDecision(
    await resolveActiveProjectForRoute({
      actorUserId,
      requestedWorkspaceId: projectId,
    }),
  );

  // Defence in depth. The explicit branch cannot return a different Project
  // than the one asked for, but this route class is the one where a silent
  // substitution would hand out another tenant's object, so the invariant is
  // asserted rather than assumed.
  if (decision.kind === "ready" && decision.workspaceId !== projectId) {
    return { kind: "unavailable" };
  }
  return decision;
}
