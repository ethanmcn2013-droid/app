import "server-only";

/**
 * Exact route resolver — ADR 0001 §4, plan §3.2.
 *
 * One rule above all others: **never substitute**. If the URL names a Project
 * and that Project is missing, forbidden or deleted, the answer is a neutral
 * `unavailable` — not the caller's first workspace, not the cookie's, and
 * never `LEGACY_WORKSPACE_ID`.
 *
 * ── The third fallback (DECISIONS D-005) ───────────────────────────────────
 *
 * `getActiveWorkspace()` at `src/server/auth.ts:176-179` returns a hard-coded
 * `LEGACY_WORKSPACE_ID` when the caller has no membership at all. Reproduced
 * against a fresh schema-baseline database: a user in zero workspaces resolves
 * to `ws-legacy`, a workspace that exists, holds tasks, and for which the
 * caller has produced no membership proof whatsoever. Any of the 95 ambient
 * call sites can receive it.
 *
 * This resolver's step 4 returns `{ kind: "empty" }` instead. It is the
 * product-specific empty/onboarding state, and it is the only correct answer:
 * a caller who belongs to nothing has no Project.
 *
 * ── Reason codes are server-only ───────────────────────────────────────────
 *
 * `missing`, `forbidden` and `deleted` collapse into one client-visible
 * `unavailable`. The distinction is real and useful in a server log; telling
 * the client which one it was is an existence leak, and an existence leak is a
 * privacy defect (ADR 0001 §4).
 */

import { and, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { planningPeriods, workspaceMembers, workspaces } from "@/server/db/schema";
import {
  parseProjectId,
  type ProjectId,
  type ProjectRouteState,
  type ProjectSummary,
} from "@/lib/projects/project-ref";
import { buildProjectCatalog, type ProjectCatalogRow } from "@/server/projects/catalog";

type ResolverQueryExecutor = Pick<LibSQLDatabase<typeof schema>, "select">;

/**
 * Server-side outcome. `state` is the only half that may cross to the client;
 * `reason` and `redirectTo` stay here.
 */
export type ProjectRouteResolution = Readonly<{
  state: ProjectRouteState;
  /** Server-only diagnostics. Never serialize this to a client component. */
  reason:
    | "exact"
    | "exact-archived"
    | "malformed"
    | "missing-or-forbidden"
    | "cookie"
    | "legacy-cookie"
    | "first-active"
    | "no-accessible-project";
  /**
   * Set only on the implicit branch. The caller replace-redirects to a
   * canonical URL that now carries `workspaceId` (ADR 0001 §4 step 3).
   */
  redirectTo: ProjectId | null;
}>;

export type ResolveActiveProjectInput = Readonly<{
  actorUserId: string;
  /** Raw `searchParams.workspaceId`. Untrusted; shape-validated here. */
  requestedWorkspaceId: string | readonly string[] | null | undefined;
  /** The unified V3 cookie value, if any. Untrusted. */
  cookieWorkspaceId?: string | null;
  /** The legacy `tasks_active_ws` cookie, honoured during migration. */
  legacyCookieWorkspaceId?: string | null;
}>;

/**
 * Load exactly one Project, membership-first. The membership row is the join
 * root, so a Project the caller is not a member of produces no row at all —
 * "not found" and "not permitted" are the same query result on purpose.
 */
async function loadAuthorizedProjectRow(
  database: ResolverQueryExecutor,
  actorUserId: string,
  projectId: ProjectId,
): Promise<ProjectCatalogRow | null> {
  const [row] = await database
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      membershipRole: workspaceMembers.role,
      workspaceOwnerUserId: workspaces.ownerUserId,
      planningPeriodId: workspaces.planningPeriodId,
      planningPeriodName: planningPeriods.name,
      planningPeriodOwnerUserId: planningPeriods.ownerUserId,
      planningPeriodStartDate: planningPeriods.startDate,
      planningPeriodEndDate: planningPeriods.endDate,
      planningPeriodContextType: planningPeriods.contextType,
      position: workspaces.position,
      revision: workspaces.revision,
      archivedAt: sql<number | null>`${workspaces.archivedAt}`,
      createdAt: sql<number>`${workspaces.createdAt}`,
      activeRootTaskCount: sql<number>`(
        SELECT COUNT(*) FROM tasks counted
        WHERE counted.workspace_id = ${workspaces.id}
          AND counted.parent_task_id IS NULL
          AND counted.lane <> 'done'
      )`,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .leftJoin(planningPeriods, eq(planningPeriods.id, workspaces.planningPeriodId))
    .where(
      and(
        eq(workspaceMembers.userId, actorUserId),
        eq(workspaceMembers.workspaceId, projectId),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    membershipRole: row.membershipRole === "owner" ? "owner" : "member",
    workspaceOwnerUserId: row.workspaceOwnerUserId ?? null,
    planningPeriodId: row.planningPeriodId ?? null,
    planningPeriodName: row.planningPeriodName ?? null,
    planningPeriodOwnerUserId: row.planningPeriodOwnerUserId ?? null,
    planningPeriodStartDate: row.planningPeriodStartDate ?? null,
    planningPeriodEndDate: row.planningPeriodEndDate ?? null,
    planningPeriodContextType: row.planningPeriodContextType ?? null,
    position: Number(row.position),
    revision: Number(row.revision),
    archivedAt: row.archivedAt === null ? null : Number(row.archivedAt),
    createdAt: Number(row.createdAt),
    activeRootTaskCount: Number(row.activeRootTaskCount),
  };
}

/**
 * Summarize one authorized row. Runs the row through the same projection the
 * catalog uses, so a Project's capabilities and period visibility cannot
 * differ between the chooser and the page it opens.
 */
function summarise(row: ProjectCatalogRow, actorUserId: string): ProjectSummary {
  return buildProjectCatalog([row], actorUserId).allProjects[0];
}

/**
 * Deterministic bare-entry default: the first accessible **active** Project in
 * catalog order. Archived Projects are skipped — if the last-active Project
 * became archived, the next valid active Project becomes the default
 * (ADR 0001 §5).
 */
async function firstAccessibleActiveProject(
  database: ResolverQueryExecutor,
  actorUserId: string,
  rows: readonly ProjectCatalogRow[],
): Promise<ProjectSummary | null> {
  void database;
  const catalog = buildProjectCatalog(rows, actorUserId);
  return catalog.allProjects.find((project) => project.archivedAt === null) ?? null;
}

/**
 * ADR 0001 §4 resolution precedence, in order and without shortcuts.
 *
 * Authentication is the caller's job: `actorUserId` is already proved. Passing
 * an unauthenticated identity here would resolve a real Project for nobody.
 */
export async function resolveActiveProjectForRouteWith(
  database: ResolverQueryExecutor,
  input: ResolveActiveProjectInput,
  listRows: (
    database: ResolverQueryExecutor,
    actorUserId: string,
  ) => Promise<readonly ProjectCatalogRow[]>,
): Promise<ProjectRouteResolution> {
  const { actorUserId } = input;

  // ── Step 2. Explicit `workspaceId` present ───────────────────────────────
  const explicitPresent =
    input.requestedWorkspaceId !== undefined &&
    input.requestedWorkspaceId !== null &&
    input.requestedWorkspaceId !== "";

  if (explicitPresent) {
    const requested = parseProjectId(input.requestedWorkspaceId);
    if (requested === null) {
      // Malformed or repeated. Neutral, and emphatically not a substitution.
      return { state: { kind: "unavailable" }, reason: "malformed", redirectTo: null };
    }
    const row = await loadAuthorizedProjectRow(database, actorUserId, requested);
    if (!row) {
      return {
        state: { kind: "unavailable" },
        reason: "missing-or-forbidden",
        redirectTo: null,
      };
    }
    const project = summarise(row, actorUserId);
    if (project.archivedAt !== null) {
      return {
        state: { kind: "archived", project },
        reason: "exact-archived",
        redirectTo: null,
      };
    }
    return {
      state: { kind: "ready", project, source: "url" },
      reason: "exact",
      redirectTo: null,
    };
  }

  // ── Step 3. No explicit Project. Bare entry only. ────────────────────────
  const rows = await listRows(database, actorUserId);

  const cookieCandidates: Array<{
    value: string | null | undefined;
    reason: "cookie" | "legacy-cookie";
  }> = [
    { value: input.cookieWorkspaceId, reason: "cookie" },
    { value: input.legacyCookieWorkspaceId, reason: "legacy-cookie" },
  ];

  for (const candidate of cookieCandidates) {
    const parsed = parseProjectId(candidate.value);
    if (parsed === null) continue;
    const row = rows.find((entry) => entry.id === parsed);
    // A cookie is a preference, never authority. An unmembered, archived or
    // deleted cookie value is silently skipped rather than honoured or
    // reported — it names no Project the caller may bare-enter.
    if (!row || row.archivedAt !== null) continue;
    const project = summarise(row, actorUserId);
    return {
      state: { kind: "ready", project, source: "fallback" },
      reason: candidate.reason,
      redirectTo: project.id,
    };
  }

  const first = await firstAccessibleActiveProject(database, actorUserId, rows);
  if (first) {
    return {
      state: { kind: "ready", project: first, source: "fallback" },
      reason: "first-active",
      redirectTo: first.id,
    };
  }

  // ── Step 4. No accessible active Project ─────────────────────────────────
  //
  // This is the D-005 site. `getActiveWorkspace()` returns LEGACY_WORKSPACE_ID
  // here. This resolver returns the empty/onboarding state and no Project id
  // at all.
  return {
    state: { kind: "empty" },
    reason: "no-accessible-project",
    redirectTo: null,
  };
}

/** The client-safe half. Reason codes never leave the server. */
export function toClientRouteState(
  resolution: ProjectRouteResolution,
): ProjectRouteState {
  return resolution.state;
}
