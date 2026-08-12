import "server-only";

/**
 * One membership-first Project Catalog — plan §5.
 *
 * Replaces the divergent projections (sidebar tree, Your Work, suite ingress,
 * Timeline choices, Notes internal catalog) with a single one. Two halves:
 *
 *  - `buildProjectCatalog`, a pure projection over already-authorized rows.
 *    Grouping, ordering, merging, deduplication and disambiguation all live
 *    here so they can be proved without a database;
 *  - `listProjectCatalogRows` / `getProjectCatalog`, the bounded query.
 *
 * ── Why the projection is a partition, not three lists ─────────────────────
 *
 * The shipped catalog at `src/server/planning/queries.ts:143-171` splits rows
 * into `grouped` / `unassigned` / `shared` and then rebuilds the output from a
 * *separately queried* list of owned periods. That shape loses Projects twice:
 *
 *   1. `else if (row.role === "member" || row.periodOwnerUserId !== actor)`
 *      is reached with `periodOwnerUserId === null` for every periodless
 *      Project, so `null !== actor` is true and the `unassigned` branch is
 *      unreachable — a Project the caller owns is filed under
 *      "Shared with you";
 *   2. `grouped` is keyed by period id, but the emitted groups come from a
 *      `.limit(200)` period query. A Project in an owned period past that
 *      limit is in `grouped` and in no emitted group: it disappears from the
 *      catalog entirely.
 *
 * This projection assigns every row exactly one group key and then emits the
 * groups it actually built. Period metadata rides on the membership row, so
 * there is no second list to fall out of sync with. Totality is structural,
 * not something a later reader has to re-derive.
 */

import { asc, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { planningPeriods, workspaceMembers, workspaces } from "@/server/db/schema";
import type {
  ProjectId,
  ProjectSummary,
} from "@/lib/projects/project-ref";
import { assertProjectId } from "@/lib/projects/project-ref";
import type { PlanningPeriodContext } from "@/lib/planning/context";
import { projectCapabilities, resolveProjectRole } from "@/server/projects/capabilities";

type CatalogQueryExecutor = Pick<LibSQLDatabase<typeof schema>, "select">;

/** One authorized membership row, joined to its Project and its period. */
export type ProjectCatalogRow = Readonly<{
  id: string;
  slug: string;
  name: string;
  membershipRole: "owner" | "member";
  workspaceOwnerUserId: string | null;
  planningPeriodId: string | null;
  planningPeriodName: string | null;
  planningPeriodOwnerUserId: string | null;
  planningPeriodStartDate: string | null;
  planningPeriodEndDate: string | null;
  planningPeriodContextType: PlanningPeriodContext | null;
  position: number;
  revision: number;
  archivedAt: number | null;
  createdAt: number;
  activeRootTaskCount: number;
}>;

export type ProjectCatalogGroupKind =
  | "planning-period"
  | "loose"
  | "shared"
  | "archived";

export type ProjectCatalogGroup = Readonly<{
  kind: ProjectCatalogGroupKind;
  /**
   * Namespaced group id: `period:<planning-period-id>` for a Planning Period,
   * and a reserved literal for the other three.
   *
   * Namespaced because a Planning Period id is user-controlled enough to
   * collide with a literal: a period whose id was `shared` used to emit a
   * group with the same id as the `Shared with you` bucket, and a UI keyed on
   * group id would have merged or dropped one of them.
   */
  id: string;
  /** The raw Planning Period id, when this group is one. Never a literal. */
  planningPeriodId: string | null;
  name: string;
  /** Only ever populated for a Planning Period the caller owns. */
  startDate: string | null;
  endDate: string | null;
  /** Archived is presented collapsed and read-only (ADR 0001 §5). */
  collapsed: boolean;
  readOnly: boolean;
  projects: readonly ProjectSummary[];
}>;

export type ProjectCatalog = Readonly<{
  groups: readonly ProjectCatalogGroup[];
  /** Every Project, exactly once, in group-then-position order. */
  allProjects: readonly ProjectSummary[];
  /**
   * Projects whose visible name could not be made unique without exposing
   * private or internal data. Selection must be blocked for these; a raw id is
   * never offered as a tiebreaker (plan §5).
   */
  ambiguousProjectIds: readonly ProjectId[];
  /**
   * True when the caller has more memberships than the query will return.
   *
   * Surfaced rather than swallowed: past the row cap, "which Projects you can
   * see" would otherwise become a silent, planner-dependent subset. Plan §6.5
   * requires exactly this treatment for the Timeline 200-row cap, and D-016 R10
   * records the unordered-read class of defect this belongs to.
   */
  truncated: boolean;
}>;

export const PLANNING_PERIOD_GROUP_PREFIX = "period:";
export const LOOSE_GROUP_ID = "loose";
export const SHARED_GROUP_ID = "shared";
export const ARCHIVED_GROUP_ID = "archived";

/** The membership row cap. Exported so the resolver and its tests share it. */
export const PROJECT_CATALOG_ROW_LIMIT = 2000;

const LOOSE_GROUP_NAME = "Active work";
const SHARED_GROUP_NAME = "Shared with you";
const ARCHIVED_GROUP_NAME = "Archived";

type GroupKey =
  | { kind: "planning-period"; periodId: string }
  | { kind: "loose" }
  | { kind: "shared" }
  | { kind: "archived" };

/**
 * Assign one group, ownership first and period second.
 *
 * Order matters here and the earlier version had it backwards. It asked "does
 * this row have a period id?" before "is this Project mine?", so a Project the
 * caller owns whose period row failed to join — a dangling
 * `planning_period_id` — was filed under `Shared with you` while its own
 * `role` read `primary-owner`. Dangling rows are not hypothetical: foreign
 * keys are not enforced per request in this database (see the note at
 * `src/server/account-erasure.ts:44-48`), which makes the schema's
 * `ON DELETE SET NULL` decorative rather than load-bearing.
 *
 * So: a row only reaches `Shared with you` because the caller is a member, or
 * because it genuinely sits inside a Planning Period that genuinely belongs to
 * somebody else. A period id that resolves to nothing tells us nothing, and is
 * treated as no period at all.
 */
function groupKeyOf(row: ProjectCatalogRow, actorUserId: string): GroupKey {
  if (row.archivedAt !== null) return { kind: "archived" };

  if (ownsPeriod(row, actorUserId)) {
    return { kind: "planning-period", periodId: row.planningPeriodId as string };
  }

  if (row.membershipRole === "member") return { kind: "shared" };

  // Owner-side. The only remaining way out of the caller's own buckets is a
  // period that actually joined and is actually somebody else's.
  const periodJoined = row.planningPeriodOwnerUserId !== null;
  if (row.planningPeriodId !== null && periodJoined) return { kind: "shared" };

  // Includes the periodless case, which the shipped catalog got wrong: a
  // periodless Project has `planningPeriodOwnerUserId === null`, which is
  // `!== actorUserId`, so its `else if` filed every Project the caller owns
  // under "Shared with you".
  return { kind: "loose" };
}

function serialiseGroupKey(key: GroupKey): string {
  return key.kind === "planning-period"
    ? `${PLANNING_PERIOD_GROUP_PREFIX}${key.periodId}`
    : key.kind;
}

function ownsPeriod(row: ProjectCatalogRow, actorUserId: string): boolean {
  return (
    row.planningPeriodId !== null &&
    row.planningPeriodOwnerUserId !== null &&
    row.planningPeriodOwnerUserId === actorUserId
  );
}

/** NFKC + case fold, so "Wedding" and "wedding" collide the way a reader does. */
function nameKey(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase("en");
}

function monthYear(createdAtSeconds: number): string {
  const date = new Date(createdAtSeconds * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function roleLabel(row: ProjectCatalogRow, actorUserId: string): string {
  const role = resolveProjectRole({
    membershipRole: row.membershipRole,
    workspaceOwnerUserId: row.workspaceOwnerUserId,
    actorUserId,
  });
  if (role === "primary-owner") return "Yours";
  if (role === "owner") return "Co-owner";
  return SHARED_GROUP_NAME;
}

/**
 * The caller-visible group a row will appear in, as a label.
 *
 * This is the first disambiguation column, and it is deliberately the *group*
 * rather than the Planning Period name. Using the period name alone left a row
 * with no owned period holding an empty value, and an empty value used to sink
 * the whole column — so three Projects called "Fifth year", two in named
 * periods and one loose, disambiguated to `["2026 school year", "2027 school
 * year", ""]`, failed the non-empty check at every depth, and all three came
 * back unselectable. A user looking at that list would have said "the one in
 * Active work" without hesitating.
 *
 * Permission-safe by construction: it is the name of a bucket the caller is
 * already being shown, never another owner's period name.
 */
function groupLabel(row: ProjectCatalogRow, actorUserId: string): string {
  if (ownsPeriod(row, actorUserId) && row.planningPeriodName) {
    return row.planningPeriodName;
  }
  if (row.membershipRole === "member") return SHARED_GROUP_NAME;
  const periodJoined = row.planningPeriodOwnerUserId !== null;
  if (row.planningPeriodId !== null && periodJoined) return SHARED_GROUP_NAME;
  return LOOSE_GROUP_NAME;
}

/**
 * Permission-safe disambiguation, plan §5.
 *
 * Escalates through authorized group → owner/role label → archive state →
 * creation month and year, and stops as soon as the whole bucket is unique.
 * If the deepest level still collides, the rows are reported as ambiguous and
 * carry no disambiguator: an authorized rename is the fix. Raw or internal ids
 * are never offered, at any level.
 *
 * Every column yields a value for every row — no column is ever blank — so a
 * column is included exactly when it *varies* across the bucket, and excluded
 * when it would repeat the same word beside every option.
 */
function assignDisambiguators(
  rows: readonly ProjectCatalogRow[],
  actorUserId: string,
): { byId: Map<string, string | null>; ambiguous: Set<string> } {
  const byId = new Map<string, string | null>();
  const ambiguous = new Set<string>();

  const buckets = new Map<string, ProjectCatalogRow[]>();
  for (const row of rows) {
    const key = nameKey(row.name);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  for (const bucket of buckets.values()) {
    if (bucket.length === 1) {
      byId.set(bucket[0].id, null);
      continue;
    }

    /**
     * Four columns, in escalation order, each always populated. A column is
     * included once its level is reached *and* it varies across the bucket —
     * repeating "Yours" beside both of two Projects you own distinguishes
     * nothing and reads as noise.
     */
    const COLUMN_COUNT = 4;
    const columns = (
      row: ProjectCatalogRow,
    ): [string, string, string, string] => [
      groupLabel(row, actorUserId),
      roleLabel(row, actorUserId),
      // Archive state earns a level of its own: an owner with a live Project
      // and its archived predecessor under the same name is the ordinary way
      // this collision happens, and "Archived" is the word they would use.
      row.archivedAt !== null ? "Archived" : "Active",
      monthYear(row.createdAt),
    ];

    const table = bucket.map(columns);

    let resolved = false;
    for (let depth = 1; depth <= COLUMN_COUNT && !resolved; depth += 1) {
      const useColumn = Array.from({ length: COLUMN_COUNT }, (_, index) => {
        if (index >= depth) return false;
        const values = table.map((columnValues) => columnValues[index]);
        return new Set(values).size > 1;
      });
      const candidates = table.map((columnValues) =>
        columnValues
          .filter((value, index) => useColumn[index] && value.length > 0)
          .join(" · "),
      );
      if (
        new Set(candidates).size === bucket.length &&
        candidates.every((candidate) => candidate.length > 0)
      ) {
        bucket.forEach((row, index) => byId.set(row.id, candidates[index]));
        resolved = true;
      }
    }

    if (!resolved) {
      for (const row of bucket) {
        byId.set(row.id, null);
        ambiguous.add(row.id);
      }
    }
  }

  return { byId, ambiguous };
}

function toSummary(
  row: ProjectCatalogRow,
  actorUserId: string,
  disambiguator: string | null,
): ProjectSummary {
  const role = resolveProjectRole({
    membershipRole: row.membershipRole,
    workspaceOwnerUserId: row.workspaceOwnerUserId,
    actorUserId,
  });
  const owns = ownsPeriod(row, actorUserId);
  return Object.freeze({
    id: assertProjectId(row.id),
    slug: row.slug,
    name: row.name,
    role,
    capabilities: projectCapabilities({
      role,
      archived: row.archivedAt !== null,
      ownsPlanningPeriod: owns,
    }),
    planningPeriod:
      owns && row.planningPeriodId && row.planningPeriodName
        ? Object.freeze({
            id: row.planningPeriodId,
            name: row.planningPeriodName,
            startDate: row.planningPeriodStartDate,
            endDate: row.planningPeriodEndDate,
            contextType: row.planningPeriodContextType ?? "general",
          })
        : null,
    position: row.position,
    revision: row.revision,
    archivedAt: row.archivedAt,
    activeRootTaskCount: row.activeRootTaskCount,
    disambiguator,
  });
}

/** Deterministic, total order inside a group. Never depends on query order. */
function compareProjects(a: ProjectSummary, b: ProjectSummary): number {
  if (a.position !== b.position) return a.position - b.position;
  const byName = a.name.localeCompare(b.name, "en");
  if (byName !== 0) return byName;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function compareGroups(a: ProjectCatalogGroup, b: ProjectCatalogGroup): number {
  const rank: Record<ProjectCatalogGroupKind, number> = {
    "planning-period": 0,
    loose: 1,
    shared: 2,
    archived: 3,
  };
  if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
  if (a.kind !== "planning-period") return 0;
  const aStart = a.startDate ?? "";
  const bStart = b.startDate ?? "";
  if (aStart !== bStart) return aStart < bStart ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Project the authorized rows into the catalog.
 *
 * Every input row lands in exactly one group and appears exactly once in
 * `allProjects`; duplicate rows for the same Project id (a shape the query
 * cannot currently produce, but a join added later could) collapse to the
 * first, rather than showing the same Project twice in the chooser.
 */
export function buildProjectCatalog(
  rows: readonly ProjectCatalogRow[],
  actorUserId: string,
  options: Readonly<{ truncated?: boolean }> = {},
): ProjectCatalog {
  const deduped: ProjectCatalogRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    deduped.push(row);
  }

  const { byId, ambiguous } = assignDisambiguators(deduped, actorUserId);

  const buckets = new Map<
    string,
    { key: GroupKey; row: ProjectCatalogRow; projects: ProjectSummary[] }
  >();

  for (const row of deduped) {
    const key = groupKeyOf(row, actorUserId);
    const serialised = serialiseGroupKey(key);
    const summary = toSummary(row, actorUserId, byId.get(row.id) ?? null);
    const bucket = buckets.get(serialised);
    if (bucket) bucket.projects.push(summary);
    else buckets.set(serialised, { key, row, projects: [summary] });
  }

  const groups: ProjectCatalogGroup[] = [];
  for (const bucket of buckets.values()) {
    const projects = [...bucket.projects].sort(compareProjects);
    switch (bucket.key.kind) {
      case "planning-period":
        groups.push({
          kind: "planning-period",
          id: serialiseGroupKey(bucket.key),
          planningPeriodId: bucket.key.periodId,
          name: bucket.row.planningPeriodName ?? LOOSE_GROUP_NAME,
          startDate: bucket.row.planningPeriodStartDate,
          endDate: bucket.row.planningPeriodEndDate,
          collapsed: false,
          readOnly: false,
          projects,
        });
        break;
      case "loose":
        groups.push({
          kind: "loose",
          id: LOOSE_GROUP_ID,
          planningPeriodId: null,
          name: LOOSE_GROUP_NAME,
          startDate: null,
          endDate: null,
          collapsed: false,
          readOnly: false,
          projects,
        });
        break;
      case "shared":
        groups.push({
          kind: "shared",
          id: SHARED_GROUP_ID,
          planningPeriodId: null,
          name: SHARED_GROUP_NAME,
          startDate: null,
          endDate: null,
          collapsed: false,
          readOnly: false,
          projects,
        });
        break;
      case "archived":
        groups.push({
          kind: "archived",
          id: ARCHIVED_GROUP_ID,
          planningPeriodId: null,
          name: ARCHIVED_GROUP_NAME,
          startDate: null,
          endDate: null,
          collapsed: true,
          readOnly: true,
          projects,
        });
        break;
    }
  }

  groups.sort(compareGroups);

  return Object.freeze({
    groups: Object.freeze(groups),
    allProjects: Object.freeze(groups.flatMap((group) => group.projects)),
    ambiguousProjectIds: Object.freeze(
      [...ambiguous].map((id) => assertProjectId(id)),
    ),
    truncated: options.truncated === true,
  });
}

/**
 * One bounded query, membership-first. It starts at `workspace_members`, so
 * owning a Planning Period never widens access to a Project the caller is not
 * currently a member of, and the period is left-joined onto the membership row
 * rather than fetched as a second list that the projection could fall out of
 * sync with.
 *
 * **Ordered, and truncation-aware.** The first version had a bare
 * `.limit(2000)` with no `ORDER BY` — strictly less deterministic than the
 * `planning/queries.ts` code it replaced, which did order. Past the cap, which
 * Projects survived was planner-dependent and could differ between two calls
 * in the same request. The `ORDER BY` matches `compareProjects`, so the SQL
 * prefix and the projection agree about which rows are "first", and the query
 * asks for one row more than the cap purely to detect that the cap was hit.
 */
export async function listProjectCatalogRows(
  database: CatalogQueryExecutor,
  actorUserId: string,
): Promise<readonly ProjectCatalogRow[]> {
  return (await listProjectCatalogPage(database, actorUserId)).rows;
}

export async function listProjectCatalogPage(
  database: CatalogQueryExecutor,
  actorUserId: string,
): Promise<{ rows: readonly ProjectCatalogRow[]; truncated: boolean }> {
  const rows = await database
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
    .leftJoin(
      planningPeriods,
      eq(planningPeriods.id, workspaces.planningPeriodId),
    )
    .where(eq(workspaceMembers.userId, actorUserId))
    // Same key as `compareProjects`, so the rows the cap keeps are the rows the
    // projection would have put first.
    .orderBy(asc(workspaces.position), asc(workspaces.name), asc(workspaces.id))
    .limit(PROJECT_CATALOG_ROW_LIMIT + 1);

  const truncated = rows.length > PROJECT_CATALOG_ROW_LIMIT;
  const page = truncated ? rows.slice(0, PROJECT_CATALOG_ROW_LIMIT) : rows;

  return {
    truncated,
    rows: page.map((row) => ({
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
    })),
  };
}
