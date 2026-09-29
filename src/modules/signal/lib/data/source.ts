/**
 * data/source.ts, Bridge from external data systems → WorkRead.
 *
 * Cycle 6.1 shipped the read() contract.
 * Cycle 6.2 added listForUser() against mockSource.
 * Cycle 6.3 implements `tasksDbSource` against the real Signal Tasks
 *   Turso DB (read-only token). The active `dataSource` const switches
 *   on TASKS_DATABASE_URL presence, prod uses the real source; dev
 *   without env vars falls back to mock so the marketing build still
 *   runs offline.
 */

import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { effectiveColumnKey, isTaskDone, WAITING_COLUMN_KEY } from "@/lib/board-columns";
import type { ColumnConfig } from "@/lib/board-config";
import { readWorkspaceColumnConfigs } from "../../server/analytics/providers/column-config";
import { storedDeadline } from "./deadline";
import type { TasksDb } from "../../server/tasks-db/signal-tasks-db-client";
import type { WorkRead, TaskRead, ProjectRead, Status, KnownPriority } from "./types";
import { getTasksDb, tasksDbConfigured } from "@/modules/signal/server/tasks-db/signal-tasks-db-client";
import {
  tasks as tasksTable,
  workspaces as workspacesTable,
  users as usersTable,
  workspaceMembers as workspaceMembersTable,
  activities as activitiesTable,
} from "@/modules/signal/server/tasks-db/signal-tasks-db-schema";

export interface WorkspaceCandidate {
  workspaceId: string;
  name: string;
  role: "owner" | "member";
}

export interface UserIdentity {
  /** Clerk user id (`user_2abc…`). Always present from auth(). */
  clerkId: string;
  /** Primary email for display only; never an authorization key. */
  email: string | null;
}

export type WorkspaceOnboarding = {
  primaryUseCase: string | null;
  activeDomain: string | null;
};

export interface DataSource {
  read(workspaceId: string): Promise<WorkRead>;
  readMany?(workspaceIds: string[]): Promise<WorkRead[]>;
  getWorkspaceOnboarding?(workspaceId: string): Promise<WorkspaceOnboarding | null>;
  /**
   * Workspaces this user can brief (owner or member).
   *
   * Resolution uses only the immutable suite subject stored in `clerk_id`.
   * Returns [] when the subject is not linked. Never throws to the page —
   * try/catch wraps DB reads.
   */
  listForUser(identity: UserIdentity): Promise<WorkspaceCandidate[]>;
}

// ── Mock source (dev fallback + tests) ─────────────────────────────

export function mockSourceWith(opts: {
  workspaces: WorkspaceCandidate[];
  onboarding?: WorkspaceOnboarding;
}): DataSource {
  return {
    async read(workspaceId: string): Promise<WorkRead> {
      return {
        workspaceId,
        snapshotAt: new Date().toISOString(),
        projects: [],
        tasks: [],
        events: [],
      };
    },
    async listForUser(): Promise<WorkspaceCandidate[]> {
      return opts.workspaces;
    },
    async readMany(workspaceIds: string[]): Promise<WorkRead[]> {
      return Promise.all(workspaceIds.map((workspaceId) => this.read(workspaceId)));
    },
    async getWorkspaceOnboarding(): Promise<WorkspaceOnboarding | null> {
      return opts.onboarding ?? null;
    },
  };
}

export const mockSource: DataSource = mockSourceWith({
  workspaces: [
    { workspaceId: "ws_demo", name: "Demo workspace", role: "owner" },
  ],
});

// ── Real Tasks DB source (Cycle 6.3 + 6.4 lane canonicalization) ───

/**
 * Tasks lane → Analytics Status mapping table. Locked in Cycle 6.4.
 *
 * Tasks's canonical lane vocabulary is `"todo" | "doing" | "review" | "done"`
 * (tasks/src/lib/data.ts). Analytics's Status enum is the trigger-facing
 * read contract Analytics owns. The translation is one-way and lives here
 *, triggers never see Tasks's vocabulary.
 *
 * Derivation rules:
 *  - Terminal state uses the workspace's configured effective column.
 *    Review remains review even when dependency identifiers are present.
 *  - `refused` does not materialize from Tasks's data, Tasks has no
 *    rejected/cancelled state. Triggers must not assume it appears in
 *    real WorkRead snapshots from tasksDbSource.
 *  - Other nonterminal effective columns remain in flight.
 *
 * Documented in PRODUCT.md §6.
 */
function deriveStatus(row: typeof tasksTable.$inferSelect, blockedBy: string[], config: ColumnConfig | null): Status {
  if (isTaskDone(row, config)) return "shipped";
  const key = effectiveColumnKey(row);
  if (key === "review") return "review";
  if (key === WAITING_COLUMN_KEY || blockedBy.length > 0) return "blocked";
  return key === "todo" ? "next" : "in-flight";
}

function canonicalLane(row: typeof tasksTable.$inferSelect, config: ColumnConfig | null): "next" | "in-flight" | "review" | "shipped" {
  if (isTaskDone(row, config)) return "shipped";
  const key = effectiveColumnKey(row);
  return key === "todo" ? "next" : key === "review" ? "review" : "in-flight";
}

function knownPriority(value: unknown): KnownPriority | null {
  switch (value) {
    case "p0": return 0;
    case "p1": return 1;
    case "p2": return 2;
    case "p3": return 3;
    default: return null;
  }
}

function validCompletion(value: Date | null, now: number): string | null {
  const time = value?.getTime();
  return time !== undefined && Number.isFinite(time) && time >= 0 && time <= now
    ? new Date(time).toISOString() : null;
}

const MAX_COMPLETION_TRANSITIONS = 128;

type CompletionTransition = { id: string; workspaceId: string; taskId: string; kind: string; payload: string; createdAt: number; historyRank: number; latestAt: number };

/** Latest actual transition only; historical custom keys have no semantic snapshot. */
function completionFromHistory(rows: readonly CompletionTransition[], now: number): string | null {
  // Random event IDs break ties for transport only; they cannot establish
  // chronology. Every event in the latest timestamp group must agree.
  if (rows.length === 0 || rows.length > MAX_COMPLETION_TRANSITIONS) return null;
  for (const event of rows) {
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(event.payload) as Record<string, unknown>; } catch { return null; }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    // A same-lane move can clear a custom-column claim and really complete
    // work. Its historical effective state is absent, so never skip it.
    if (event.kind === "move" && payload.from === payload.to) return null;
    const at = validCompletion(new Date(event.createdAt * 1000), now);
    if (!at) return null;
    // These kinds record canonical done/open intent. A custom key cannot be
    // classified using today's config, and a newer reopen supersedes done.
    if (payload.to !== "done") return null;
    if (event.kind === "move" && !["todo", "doing", "review", "waiting", "open"].includes(String(payload.from))) return null;
  }
  return validCompletion(new Date(rows[0].createdAt * 1000), now);
}

async function readCompletionHistory(db: TasksDb, targets: readonly (typeof tasksTable.$inferSelect)[], now: number): Promise<Map<string, string | null>> {
  const completions = new Map<string, string | null>();
  // Bound bind parameters as well as evidence per task. This is one query per
  // 500 unstamped terminal tasks, rather than one remote query per task.
  for (let offset = 0; offset < targets.length; offset += 500) {
    const chunk = targets.slice(offset, offset + 500);
    const byWorkspace = new Map<string, string[]>();
    for (const target of chunk) {
      const bucket = byWorkspace.get(target.workspaceId!) ?? [];
      bucket.push(target.id); byWorkspace.set(target.workspaceId!, bucket);
    }
    const predicate = or(...Array.from(byWorkspace, ([id, taskIds]) => and(eq(activitiesTable.workspaceId, id), inArray(activitiesTable.taskId, taskIds))));
    const rows = await db.all<CompletionTransition>(sql`
      WITH ranked AS (
        SELECT id, workspace_id AS workspaceId, task_id AS taskId, kind, payload,
          created_at AS createdAt,
          ROW_NUMBER() OVER (PARTITION BY workspace_id, task_id ORDER BY created_at DESC, id DESC) AS historyRank,
          MAX(created_at) OVER (PARTITION BY workspace_id, task_id) AS latestAt
        FROM activities
        WHERE ${predicate} AND kind IN ('move', 'toggleComplete')
      )
      SELECT * FROM ranked WHERE createdAt = latestAt AND historyRank <= ${MAX_COMPLETION_TRANSITIONS + 1}
      ORDER BY workspaceId, taskId, historyRank
    `);
    const grouped = new Map<string, CompletionTransition[]>();
    for (const row of rows) {
      const bucket = grouped.get(row.taskId) ?? []; bucket.push(row); grouped.set(row.taskId, bucket);
    }
    for (const target of chunk) completions.set(target.id, completionFromHistory(grouped.get(target.id) ?? [], now));
  }
  return completions;
}

type DependencyState = Pick<typeof tasksTable.$inferSelect, "id" | "workspaceId" | "lane" | "boardColumnKey">;
type DependencyRead = { open: Map<string, string[]>; unknown: Set<string>; hasCompleted: Set<string> };

/** Positive comment creation evidence can advance the existing activity proxy.
 * Absence never proves inactivity: the general activity recorder is best effort.
 */
async function readCommentActivity(db: TasksDb, rows: readonly (typeof tasksTable.$inferSelect)[], now: number): Promise<Map<string, string>> {
  const activity = new Map<string, string>();
  const targets = rows.filter(row => validCompletion(row.updatedAt, now) !== null && validCompletion(row.createdAt, now) !== null);
  for (let offset = 0; offset < targets.length; offset += 500) {
    const chunk = targets.slice(offset, offset + 500), grouped = new Map<string, string[]>();
    for (const row of chunk) {
      const bucket = grouped.get(row.workspaceId!) ?? []; bucket.push(row.id); grouped.set(row.workspaceId!, bucket);
    }
    const predicate = or(...Array.from(grouped, ([id, taskIds]) => and(eq(activitiesTable.workspaceId, id), inArray(activitiesTable.taskId, taskIds))));
    // Validate before MAX so an invalid newest row cannot hide earlier evidence.
    // Grouping bounds returned rows; it does not bound the matching history scan.
    const evidence = await db.all<{ workspaceId: string; taskId: string; createdAt: number }>(sql`
      SELECT a.workspace_id AS workspaceId, a.task_id AS taskId, MAX(a.created_at) AS createdAt
      FROM activities AS a JOIN tasks AS t ON t.id = a.task_id AND t.workspace_id = a.workspace_id
      WHERE a.id IN (SELECT id FROM activities WHERE ${predicate})
        AND a.kind = 'commentAdd'
        AND CASE WHEN json_valid(a.payload) THEN
          json_type(a.payload, '$.kind') = 'text' AND json_extract(a.payload, '$.kind') = 'commentAdd'
          AND json_type(a.payload, '$.commentId') = 'text' AND length(trim(json_extract(a.payload, '$.commentId'))) > 0
          ELSE 0 END
        AND typeof(a.created_at) IN ('integer', 'real')
        AND a.created_at >= 0 AND a.created_at <= ${now / 1000} AND a.created_at >= t.created_at
      GROUP BY a.workspace_id, a.task_id
    `);
    const byTask = new Map(evidence.map(row => [row.taskId, row]));
    for (const row of chunk) {
      const event = byTask.get(row.id);
      if (!event || event.workspaceId !== row.workspaceId) continue;
      const at = validCompletion(new Date(event.createdAt * 1000), now);
      if (at && Date.parse(at) > row.updatedAt.getTime()) activity.set(row.id, at);
    }
  }
  return activity;
}

/** Resolve current dependency state without widening the visible task set. */
async function readOpenDependencies(
  db: TasksDb,
  rows: readonly (typeof tasksTable.$inferSelect)[],
  configurations: ReadonlyMap<string, { config: ColumnConfig | null }>,
): Promise<DependencyRead> {
  const byWorkspace = new Map<string, Map<string, DependencyState>>();
  for (const row of rows) {
    const bucket = byWorkspace.get(row.workspaceId!) ?? new Map<string, DependencyState>();
    bucket.set(row.id, row); byWorkspace.set(row.workspaceId!, bucket);
  }
  const targets: Array<{ workspaceId: string; id: string }> = [];
  const requested = new Map<string, Set<string>>();
  const validId = (id: unknown): id is string => typeof id === "string" && id.trim().length > 0;
  for (const row of rows) {
    const seen = requested.get(row.workspaceId!) ?? new Set<string>();
    for (const id of Array.isArray(row.blockedBy) ? row.blockedBy : []) {
      if (!validId(id) || byWorkspace.get(row.workspaceId!)?.has(id) || seen.has(id)) continue;
      seen.add(id); targets.push({ workspaceId: row.workspaceId!, id });
    }
    requested.set(row.workspaceId!, seen);
  }
  // Bound parameters and returned terminal evidence; never select dependency
  // titles or assume a reference outside its exact workspace has completed.
  for (let offset = 0; offset < targets.length; offset += 500) {
    const chunk = targets.slice(offset, offset + 500), grouped = new Map<string, string[]>();
    for (const target of chunk) {
      const bucket = grouped.get(target.workspaceId) ?? []; bucket.push(target.id); grouped.set(target.workspaceId, bucket);
    }
    const dependencies = await db.select({ id: tasksTable.id, workspaceId: tasksTable.workspaceId, lane: tasksTable.lane, boardColumnKey: tasksTable.boardColumnKey })
      .from(tasksTable)
      .where(or(...Array.from(grouped, ([workspaceId, ids]) => and(eq(tasksTable.workspaceId, workspaceId), inArray(tasksTable.id, ids)))));
    for (const dependency of dependencies) byWorkspace.get(dependency.workspaceId!)!.set(dependency.id, dependency);
  }
  const edges = new Map<string, string[]>();
  const unknown = new Set<string>();
  const hasCompleted = new Set<string>();
  for (const row of rows) {
    const config = configurations.get(row.workspaceId!)!.config;
    if (row.blockedBy !== null && !Array.isArray(row.blockedBy)) unknown.add(row.id);
    const blockedBy = Array.isArray(row.blockedBy) ? row.blockedBy : [];
    const seen = new Set<string>();
    edges.set(row.id, blockedBy.filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      const dependency = validId(id) ? byWorkspace.get(row.workspaceId!)?.get(id) : undefined;
      // A missing, malformed or foreign reference is neither cleared nor a
      // confirmed blocker; retain the task and mark this predicate unknown.
      if (!dependency) { unknown.add(row.id); return false; }
      if (isTaskDone(dependency, config)) { hasCompleted.add(row.id); return false; }
      return true;
    }));
  }
  return { open: edges, unknown, hasCompleted };
}

/**
 * Title-case a tag for human display.
 *   "claire-wedding" → "Claire Wedding"
 *   "oak_rd_renovation" → "Oak Rd Renovation"
 *   "signalstudio" → "Signalstudio"
 *
 * Briefing prose templates can override this with a friendlier name
 * via the prose library (Cycle 6.4); this is the default fallback.
 */
function titleCaseTag(tag: string): string {
  return tag
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Testable DB-injected helper ───────────────────────────────────────────────
//
// Exported so unit tests can call it with an in-memory libSQL/Drizzle db
// without mocking module-level state. `tasksDbSource.listForUser` delegates
// here. This is the only export test code should import from this file.
//
// `db` type: the concrete drizzle-orm/libsql LibSQLDatabase (same schema
// used by the mirror schema module). We use `Parameters<typeof tasksDb.select>`
// trick would require tasksDb non-null; instead, accept `unknown` and cast —
// Drizzle's API is identical regardless of the underlying client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function _listForUserFromDb(db: any, identity: UserIdentity): Promise<WorkspaceCandidate[]> {
  const { clerkId } = identity;
  const candidates: Array<{ id: string; clerkId: string | null; email: string | null }> = await db
    .select({ id: usersTable.id, clerkId: usersTable.clerkId, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId));

  if (candidates.length === 0) return [];
  const userId = candidates[0]?.id;
  if (!userId) return [];

  const owned: Array<{ id: string; name: string }> = await db
    .select({ id: workspacesTable.id, name: workspacesTable.name })
    .from(workspacesTable)
    .where(eq(workspacesTable.ownerUserId, userId));

  const member: Array<{ id: string; name: string }> = await db
    .select({ id: workspacesTable.id, name: workspacesTable.name })
    .from(workspacesTable)
    .innerJoin(
      workspaceMembersTable,
      eq(workspacesTable.id, workspaceMembersTable.workspaceId),
    )
    .where(eq(workspaceMembersTable.userId, userId));

  const seen = new Set<string>();
  const out: WorkspaceCandidate[] = [];
  for (const w of owned) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    out.push({ workspaceId: w.id, name: w.name, role: "owner" });
  }
  for (const w of member) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    out.push({ workspaceId: w.id, name: w.name, role: "member" });
  }
  return out;
}

function buildWorkRead(
  workspaceId: string,
  rows: Array<typeof tasksTable.$inferSelect>,
  config: ColumnConfig | null = null,
  completions: ReadonlyMap<string, string | null> = new Map(),
  dependencies: DependencyRead = { open: new Map(), unknown: new Set(), hasCompleted: new Set() },
  activity: ReadonlyMap<string, string> = new Map(),
): WorkRead {
    const taskReads: TaskRead[] = rows.map((t) => {
      const tags = Array.isArray(t.tags) ? t.tags : [];
      const assignees = Array.isArray(t.assignees) ? t.assignees : [];
      const blockedBy = dependencies.open.get(t.id) ?? [];
      const deadline = storedDeadline(t.due, t.dueAt);
      const dueDate = deadline?.kind === "date-only" ? deadline.date
        : deadline?.kind === "instant" ? new Date(deadline.at).toISOString() : null;

      return {
        id: t.id,
        projectSlugs: tags,
        title: t.title,
        assignee: assignees[0] ? { id: assignees[0] } : null,
        status: deriveStatus(t, blockedBy, config),
        canonicalLane: canonicalLane(t, config),
        priority: knownPriority(t.priority),
        completedAt: completions.get(t.id) ?? null,
        deadline,
        dueDate,
        blockedBy,
        dependencyCoverage: dependencies.unknown.has(t.id) ? "partial" : "complete",
        hasCompletedListedPrerequisite: dependencies.hasCompleted.has(t.id),
        // No separate status-change timestamp in Tasks's schema;
        // updatedAt is the closest proxy. Cycle 6.4 may revisit if
        // any trigger needs strict status-change semantics.
        lastStatusChangeAt: t.updatedAt.toISOString(),
        lastActivityAt: activity.get(t.id) ?? t.updatedAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
      };
    });

    // Synthesize ProjectRead per unique tag (PRODUCT.md §6 mapping).
    const tagBuckets = new Map<string, TaskRead[]>();
    for (const tr of taskReads) {
      for (const slug of tr.projectSlugs) {
        const bucket = tagBuckets.get(slug);
        if (bucket) {
          bucket.push(tr);
        } else {
          tagBuckets.set(slug, [tr]);
        }
      }
    }

    const projects: ProjectRead[] = [];
    for (const [slug, bucket] of tagBuckets) {
      const memberIds = new Set<string>();
      let lastActivityAt = bucket[0].lastActivityAt;
      let createdAt = bucket[0].createdAt;
      for (const tr of bucket) {
        if (tr.assignee) memberIds.add(tr.assignee.id);
        if (tr.lastActivityAt > lastActivityAt) lastActivityAt = tr.lastActivityAt;
        if (tr.createdAt < createdAt) createdAt = tr.createdAt;
      }
      projects.push({
        slug,
        name: titleCaseTag(slug),
        members: Array.from(memberIds).map((id) => ({ id })),
        deadline: null,
        lastActivityAt,
        createdAt,
      });
    }

    return {
      workspaceId,
      snapshotAt: new Date().toISOString(),
      projects,
      tasks: taskReads,
      coverage: {
        activity: "partial",
        dependencies: taskReads.some(task => task.dependencyCoverage === "partial") ? "partial" : "complete",
        dates: taskReads.some(task => task.deadline?.kind === "unknown") ? "partial" : "complete",
        priorities: taskReads.some(task => task.priority === null) ? "partial" : "complete",
      },
      // Activities deferred, v1 trigger set keys off task fields.
      // Cycle 6.4 will populate this if any trigger needs the event log.
      events: [],
    };
}

export const tasksDbSource: DataSource = {
  async read(workspaceId: string): Promise<WorkRead> {
    const reads = await this.readMany!([workspaceId]);
    return reads[0] ?? buildWorkRead(workspaceId, []);
  },

  async readMany(workspaceIds: string[]): Promise<WorkRead[]> {
    const tasksDb = getTasksDb();
    if (!tasksDb) {
      throw new Error(
        "tasksDbSource called without TASKS_DATABASE_URL configured",
      );
    }
    const ids = Array.from(new Set(workspaceIds.filter(Boolean)));
    if (ids.length === 0) return [];
    const reads: WorkRead[] = [];
    const now = Date.now();
    // Every requested workspace is read exactly once; a failed later batch
    // rejects the complete operation instead of returning a partial snapshot.
    for (let offset = 0; offset < ids.length; offset += 50) {
      const batch = ids.slice(offset, offset + 50);
      const rows = await tasksDb.select().from(tasksTable)
        .where(and(inArray(tasksTable.workspaceId, batch), isNull(tasksTable.archivedAt), isNull(tasksTable.parentTaskId)))
        .orderBy(asc(tasksTable.id));
      const configurations = await readWorkspaceColumnConfigs(tasksDb, batch);
      if (Array.from(configurations.values()).some(config => config.unreadable)) throw new Error("Signal workspace column configuration unavailable");
      const dependencies = await readOpenDependencies(tasksDb, rows, configurations);
      const activity = await readCommentActivity(tasksDb, rows, now);
      const completionTargets = rows.filter(row => {
        const config = configurations.get(row.workspaceId!)!.config;
        // A custom terminal move has no historical event; an older canonical
        // done event cannot prove when this current custom completion happened.
        // A present corrupt/future durable stamp is unknown, not permission
        // to resurrect a potentially superseded historical completion.
        return effectiveColumnKey(row) === "done" && isTaskDone(row, config) && row.completedAt === null;
      });
      const historicalCompletions = await readCompletionHistory(tasksDb, completionTargets, now);
      for (const workspaceId of batch) {
        const columnConfig = configurations.get(workspaceId)!;
        const workspaceRows = rows.filter(row => row.workspaceId === workspaceId);
        const completions = new Map<string, string | null>();
        for (const row of workspaceRows) {
          if (!isTaskDone(row, columnConfig.config)) { completions.set(row.id, null); continue; }
          const durable = validCompletion(row.completedAt, now);
          completions.set(row.id, durable ?? historicalCompletions.get(row.id) ?? null);
        }
        reads.push(buildWorkRead(workspaceId, workspaceRows, columnConfig.config, completions, dependencies, activity));
      }
    }
    return reads;
  },

  async listForUser(identity: UserIdentity): Promise<WorkspaceCandidate[]> {
    const tasksDb = getTasksDb();
    if (!tasksDb) {
      // tasksDb is null when TASKS_DATABASE_URL is unset (Preview / dev without env).
      // Return [] rather than throwing, the onboarding page handles empty gracefully.
      console.warn("[tasksDbSource] TASKS_DATABASE_URL not set, listForUser returning []");
      return [];
    }
    try {
      return await _listForUserFromDb(tasksDb, identity);
    } catch (err) {
      console.error("[tasksDbSource] listForUser error, returning []", err);
      return [];
    }
  },

  async getWorkspaceOnboarding(
    workspaceId: string,
  ): Promise<WorkspaceOnboarding | null> {
    const tasksDb = getTasksDb();
    if (!tasksDb) return null;
    try {
      const [row] = await tasksDb
        .select({
          primaryUseCase: workspacesTable.primaryUseCase,
          activeDomain: workspacesTable.activeDomain,
        })
        .from(workspacesTable)
        .where(eq(workspacesTable.id, workspaceId))
        .limit(1);
      if (!row) return null;
      return {
        primaryUseCase: row.primaryUseCase ?? null,
        activeDomain: row.activeDomain ?? null,
      };
    } catch (err) {
      console.error("[tasksDbSource] getWorkspaceOnboarding error", err);
      return null;
    }
  },
};

// ── Active source ──────────────────────────────────────────────────

/**
 * The data source bound at runtime. Switches on TASKS_DATABASE_URL
 * presence: prod uses the real Tasks DB; dev without env vars uses
 * mock so the marketing build still runs and the onboarding picker
 * is exercisable in dev.
 */
export const dataSource: DataSource = tasksDbConfigured
  ? tasksDbSource
  : mockSource;
