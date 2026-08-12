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
 */

import { cache } from "react";
import { db } from "@/server/db";
import {
  buildProjectCatalog,
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
    const rows = await listProjectCatalogRows(db, actorUserId);
    return buildProjectCatalog(rows, actorUserId);
  },
);

export const resolveActiveProjectForRoute = cache(
  async (input: ResolveActiveProjectInput): Promise<ProjectRouteResolution> =>
    resolveActiveProjectForRouteWith(db, input, listProjectCatalogRows),
);
