import "server-only";

/**
 * The two request-scoped entry points, bound to the app database.
 *
 * Kept apart from `catalog.ts` and `resolve.ts` for one reason: those two hold
 * the rules, and rules should be provable against a fresh in-memory database
 * without importing the process-wide libSQL singleton. Everything here is
 * wiring.
 *
 * `cache()` is React's **per-request** memoization: one render pass, then
 * gone. It is not a data cache and must never become one — personalized
 * membership in a persistent cache is a cross-tenant leak waiting for a cache
 * key collision (plan §3.4, "do not use persistent caching for personalized
 * membership").
 *
 * ── Why the cached functions take primitives ───────────────────────────────
 *
 * `cache()` keys on **argument identity**, comparing each argument with
 * `Object.is`. The first version cached a function whose single argument was a
 * `ResolveActiveProjectInput` object, and every call site builds that object
 * literal fresh — so every call was a miss and the memoization was inert while
 * looking, in a diff, exactly like memoization. Since several product routes
 * per render will resolve the same request, that is the difference between one
 * membership query and one per Server Component.
 *
 * So the cached layer takes primitives, and the exported wrapper does the
 * object-to-primitive flattening. `requestedWorkspaceId` is classified into
 * two primitives before it crosses the boundary, because the *decision* it
 * drives has only three outcomes and an array argument would never key.
 */

import { cache } from "react";
import { db } from "@/server/db";
import { parseProjectId } from "@/lib/projects/project-ref";
import {
  buildProjectCatalog,
  listProjectCatalogPage,
  listProjectCatalogRows,
  type ProjectCatalog,
} from "@/server/projects/catalog";
import {
  resolveActiveProjectForRouteWith,
  type ProjectRouteResolution,
  type ResolveActiveProjectInput,
} from "@/server/projects/resolve";

export const getProjectCatalog = cache(
  async (actorUserId: string): Promise<ProjectCatalog> => {
    const page = await listProjectCatalogPage(db, actorUserId);
    return buildProjectCatalog(page.rows, actorUserId, {
      truncated: page.truncated,
    });
  },
);

/** `absent` and `malformed` are distinct outcomes, so they are distinct keys. */
type ExplicitClass = "absent" | "malformed" | "explicit";

function classifyRequested(
  value: string | readonly string[] | null | undefined,
): { kind: ExplicitClass; id: string | null } {
  const present = value !== undefined && value !== null && value !== "";
  if (!present) return { kind: "absent", id: null };
  const parsed = parseProjectId(value);
  return parsed === null
    ? { kind: "malformed", id: null }
    : { kind: "explicit", id: parsed };
}

const resolveCached = cache(
  async (
    actorUserId: string,
    explicitKind: ExplicitClass,
    explicitId: string | null,
    cookieWorkspaceId: string | null,
    legacyCookieWorkspaceId: string | null,
  ): Promise<ProjectRouteResolution> =>
    resolveActiveProjectForRouteWith(
      db,
      {
        actorUserId,
        // `malformed` is carried as a sentinel the resolver will reject on
        // shape, so the classification stays in one place rather than being
        // re-derived on the far side of the cache boundary.
        requestedWorkspaceId:
          explicitKind === "absent"
            ? undefined
            : explicitKind === "malformed"
              ? MALFORMED_SENTINEL
              : explicitId,
        cookieWorkspaceId,
        legacyCookieWorkspaceId,
      },
      listProjectCatalogRows,
    ),
);

/**
 * A value guaranteed to fail `parseProjectId`, so a malformed explicit Project
 * stays malformed across the memoization boundary. A space is enough: the
 * shape gate has never allowed one.
 */
const MALFORMED_SENTINEL = " malformed ";

export async function resolveActiveProjectForRoute(
  input: ResolveActiveProjectInput,
): Promise<ProjectRouteResolution> {
  const explicit = classifyRequested(input.requestedWorkspaceId);
  return resolveCached(
    input.actorUserId,
    explicit.kind,
    explicit.id,
    input.cookieWorkspaceId ?? null,
    input.legacyCookieWorkspaceId ?? null,
  );
}
