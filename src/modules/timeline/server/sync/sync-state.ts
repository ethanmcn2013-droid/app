import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/modules/timeline/server/db/timeline-client";
import {
  projects,
  suiteProjectBindings,
  timelineSourceSyncState,
  workspaces,
  type TimelineSourceSyncState,
} from "@/modules/timeline/server/db/timeline-schema";
import type { TasksProjectOwnership } from "@/modules/timeline/lib/tasks-project-ownership";
import { assertOwnershipCovers } from "@/modules/timeline/lib/tasks-project-ownership";

/**
 * Synchronization state, and the compare-and-set that makes a refresh safe.
 *
 * ── THE WINDOW THIS CLOSES ─────────────────────────────────────────────────
 * WP1 made a refresh unable to DELETE on bad evidence. It left a second
 * problem untouched: two refreshes racing. Open Project A, switch to B, come
 * back to A — three overlapping reads, and whichever finishes LAST wins,
 * regardless of which one read the source most recently. A slow A1 landing
 * after a fast A2 silently republishes the older snapshot, and the user's
 * Timeline goes backwards with no error anywhere.
 *
 * Plan §6.5: "a reconcile commits only when its generation/lease is still
 * current". So every refresh takes a generation before it reads, and the write
 * is refused unless that generation is still the current one when it commits.
 * The refusal is the point: an older refresh does not overwrite, and it does
 * not silently succeed either.
 *
 * ── WHY THE CAS RUNS FIRST INSIDE THE TRANSACTION ──────────────────────────
 * Nodes are written after the compare-and-set, in the same transaction. A CAS
 * that ran afterwards would report the race correctly and still have written
 * the stale rows.
 */

/** How long a refresh may hold its lease before another may assume it died. */
export const SYNC_LEASE_TTL_MS = 60_000;

// Sync can supply its guarded local transaction. Provisioning/direct callers
// retain the default client and the existing standalone transaction behavior.
type PreparationExecutor = Pick<typeof db, "select" | "insert" | "update">;

export type SyncLease = Readonly<{
  tasksWorkspaceId: string;
  timelineWorkspaceSlug: string;
  timelineSlug: string;
  generation: number;
  leaseToken: string;
  /**
   * The digest of the last snapshot that committed, read before this lease
   * took the generation.
   *
   * Plan §6.5: "unchanged digest updates freshness without rewriting nodes".
   * A Timeline whose source has not moved should cost a freshness update and
   * nothing else — no upsert of every row, no delete pass, and no cache
   * invalidation on a page that is already correct.
   */
  previousDigest: string | null;
}>;

export type SyncOutcome = Readonly<{
  status: "complete" | "empty" | "partial" | "error" | "unauthorized";
  sourceCount?: number | null;
  importedCount?: number | null;
  snapshotDigest?: string | null;
  errorCode?: string | null;
}>;

/**
 * How a caller is entitled to write the normalized binding.
 *
 * Deliberately the same two shapes as `ProjectBindingAuthority`, for the same
 * reason: establishing a binding is a Project owner's act, and propagating one
 * that the parent workspace already carries is not. The second is proved here,
 * against this database, rather than taken on the caller's word.
 */
export type SuiteBindingAuthority =
  | Readonly<{ kind: "project-owner"; ownership: TasksProjectOwnership }>
  | Readonly<{ kind: "inherits-workspace-binding" }>;

export type EnsureBindingResult =
  | Readonly<{ kind: "bound"; created: boolean }>
  /** Exact evidence was not present. Nothing was written, and nothing should
   *  be: this is a reconciliation case, not a sync case (plan §6.3). */
  | Readonly<{ kind: "not-exact"; reason: string }>;

/**
 * Record the normalized binding for a Timeline whose legacy mirrors already
 * prove it, and dual-write whichever mirror is missing.
 *
 * The mirrors are NOT replaced by this table. Plan §6.2 keeps and dual-writes
 * `workspaces.suite_workspace_id` and `projects.source_tasks_workspace_id` for
 * at least two stable releases so a rollback dual-read resolves the same exact
 * rows, and this wave does not clear or drop either of them.
 */
export async function ensureSuiteProjectBinding(input: {
  tasksWorkspaceId: string;
  timelineWorkspaceSlug: string;
  primaryTimelineSlug: string;
  authority: SuiteBindingAuthority;
}, executor?: PreparationExecutor): Promise<EnsureBindingResult> {
  // ── FAIL SOFT, DELIBERATELY ──────────────────────────────────────────────
  // Code ships before a migration runs, always. Until 0001 is applied the
  // binding table does not exist, and every caller of this function is on a
  // path whose failure mode is the production incident this whole area exists
  // to prevent: a couple reaching Timeline and finding nothing. The normalized
  // binding is additive — the legacy mirrors remain authoritative for two
  // stable releases — so its absence must degrade to "not recorded", never to
  // "provisioning threw".
  //
  // The refusals BELOW are different and are not caught: they are evidence
  // saying no, and they return `not-exact` on purpose. So is the ownership
  // assertion, which runs OUTSIDE the guard — a proof for the wrong Project is
  // a programming error and must stay loud.
  if (input.authority.kind === "project-owner") {
    assertOwnershipCovers(
      input.authority.ownership,
      { tasksWorkspaceId: input.tasksWorkspaceId },
      "ensureSuiteProjectBinding",
    );
  }
  try {
    return await ensureSuiteProjectBindingUnguarded(input, executor);
  } catch (error) {
    console.error("[sync-state] binding not recorded:", String(error));
    return { kind: "not-exact", reason: "binding-unavailable" };
  }
}

async function ensureSuiteProjectBindingUnguarded(input: {
  tasksWorkspaceId: string;
  timelineWorkspaceSlug: string;
  primaryTimelineSlug: string;
  authority: SuiteBindingAuthority;
}, executor?: PreparationExecutor): Promise<EnsureBindingResult> {
  const { tasksWorkspaceId, timelineWorkspaceSlug, primaryTimelineSlug, authority } = input;
  const reader = executor ?? db;

  const [existing] = await reader
    .select()
    .from(suiteProjectBindings)
    .where(eq(suiteProjectBindings.tasksWorkspaceId, tasksWorkspaceId))
    .limit(1);
  if (existing) {
    // Never re-point an existing binding. A Project that already names a
    // Timeline keeps it; changing it is a reviewed lifecycle act, not a
    // side effect of somebody pressing refresh.
    return existing.timelineWorkspaceSlug === timelineWorkspaceSlug
      ? { kind: "bound", created: false }
      : { kind: "not-exact", reason: "claimed-elsewhere" };
  }

  const [workspace] = await reader
    .select({ suiteWorkspaceId: workspaces.suiteWorkspaceId })
    .from(workspaces)
    .where(eq(workspaces.slug, timelineWorkspaceSlug))
    .limit(1);
  if (!workspace) return { kind: "not-exact", reason: "workspace-missing" };

  if (authority.kind === "inherits-workspace-binding") {
    // The proof, read here rather than accepted from the caller: the parent
    // mirror already names exactly this Project. A caller that merely believes
    // it does cannot make it so.
    if (workspace.suiteWorkspaceId !== tasksWorkspaceId) {
      return { kind: "not-exact", reason: "parent-mirror-disagrees" };
    }
  } else if (workspace.suiteWorkspaceId && workspace.suiteWorkspaceId !== tasksWorkspaceId) {
    return { kind: "not-exact", reason: "parent-mirror-disagrees" };
  }

  const [child] = await reader
    .select({ sourceTasksWorkspaceId: projects.sourceTasksWorkspaceId })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceSlug, timelineWorkspaceSlug),
        eq(projects.slug, primaryTimelineSlug),
      ),
    )
    .limit(1);
  if (!child) return { kind: "not-exact", reason: "primary-timeline-missing" };
  if (child.sourceTasksWorkspaceId && child.sourceTasksWorkspaceId !== tasksWorkspaceId) {
    return { kind: "not-exact", reason: "child-mirror-disagrees" };
  }

  try {
    const writeBinding = async (tx: PreparationExecutor) => {
      await tx.insert(suiteProjectBindings).values({
        tasksWorkspaceId,
        timelineWorkspaceSlug,
        primaryTimelineSlug,
        state: "active",
        provenance: authority.kind === "project-owner" ? "provisioned" : "legacy_exact",
      });
      // Compare-and-set on both mirrors: only an unclaimed column is filled,
      // so A is never overwritten with B (plan §6.4 step 6).
      if (!workspace.suiteWorkspaceId) {
        await tx
          .update(workspaces)
          .set({ suiteWorkspaceId: tasksWorkspaceId })
          .where(and(eq(workspaces.slug, timelineWorkspaceSlug), isNull(workspaces.suiteWorkspaceId)));
      }
      if (!child.sourceTasksWorkspaceId) {
        await tx
          .update(projects)
          .set({ sourceTasksWorkspaceId: tasksWorkspaceId })
          .where(
            and(
              eq(projects.workspaceSlug, timelineWorkspaceSlug),
              eq(projects.slug, primaryTimelineSlug),
              isNull(projects.sourceTasksWorkspaceId),
            ),
          );
      }
    };
    if (executor) await writeBinding(executor);
    else await db.transaction(writeBinding);
  } catch {
    // A lost race is not a licence to rewrite the winner. Re-read it: if the
    // committed row is ours the caller is bound either way, and if it is not,
    // this is a reconciliation case.
    const [winner] = await reader
      .select({ timelineWorkspaceSlug: suiteProjectBindings.timelineWorkspaceSlug })
      .from(suiteProjectBindings)
      .where(eq(suiteProjectBindings.tasksWorkspaceId, tasksWorkspaceId))
      .limit(1);
    if (winner?.timelineWorkspaceSlug === timelineWorkspaceSlug) {
      return { kind: "bound", created: false };
    }
    return { kind: "not-exact", reason: "binding-race-lost" };
  }
  return { kind: "bound", created: true };
}

/**
 * Take the next generation and a lease, before the source is read.
 *
 * The generation is bumped on ACQUIRE rather than on commit, which is what
 * makes a later refresh able to invalidate an earlier one that is still in
 * flight. An expired lease is assumed dead and is taken over; the previous
 * holder then fails its compare-and-set, which is the correct outcome — its
 * snapshot is older than the one now in progress.
 */
export async function acquireSyncLease(input: {
  tasksWorkspaceId: string;
  timelineWorkspaceSlug: string;
  timelineSlug: string;
  now?: number;
  ttlMs?: number;
}, executor: PreparationExecutor = db): Promise<SyncLease | null> {
  const now = input.now ?? Date.now();
  const expiresAt = new Date(now + (input.ttlMs ?? SYNC_LEASE_TTL_MS));
  const leaseToken = randomUUID();

  // Same reason as the binding: before 0001 is applied this table does not
  // exist, and a refresh that cannot record its generation must still refresh.
  // Returning null means "no lease", and the caller then behaves exactly as it
  // did before WP4 — safe, just without the newer-wins guarantee.
  try {
    return await acquireSyncLeaseUnguarded({ ...input, now, expiresAt, leaseToken }, executor);
  } catch (error) {
    console.error("[sync-state] lease not acquired:", String(error));
    return null;
  }
}

async function acquireSyncLeaseUnguarded(input: {
  tasksWorkspaceId: string;
  timelineWorkspaceSlug: string;
  timelineSlug: string;
  now: number;
  expiresAt: Date;
  leaseToken: string;
}, executor: PreparationExecutor): Promise<SyncLease | null> {
  const { now, expiresAt, leaseToken } = input;
  // Read the digest BEFORE the upsert overwrites nothing and the generation
  // moves. `RETURNING` gives post-update values, so the previous one has to be
  // read on its own statement; it is one indexed primary-key lookup, and it
  // buys skipping a full node rewrite on every unchanged refresh.
  const [previous] = await executor
    .select({ snapshotDigest: timelineSourceSyncState.snapshotDigest })
    .from(timelineSourceSyncState)
    .where(eq(timelineSourceSyncState.tasksWorkspaceId, input.tasksWorkspaceId))
    .limit(1);

  const rows = await executor
    .insert(timelineSourceSyncState)
    .values({
      tasksWorkspaceId: input.tasksWorkspaceId,
      timelineWorkspaceSlug: input.timelineWorkspaceSlug,
      timelineSlug: input.timelineSlug,
      status: "syncing",
      generation: 1,
      leaseToken,
      leaseExpiresAt: expiresAt,
      lastAttemptAt: new Date(now),
    })
    .onConflictDoUpdate({
      target: timelineSourceSyncState.tasksWorkspaceId,
      set: {
        status: "syncing",
        generation: sql`${timelineSourceSyncState.generation} + 1`,
        leaseToken,
        leaseExpiresAt: expiresAt,
        lastAttemptAt: new Date(now),
      },
    })
    .returning({
      generation: timelineSourceSyncState.generation,
      leaseToken: timelineSourceSyncState.leaseToken,
    });

  const row = rows[0];
  // Zero rows is not "nothing to do" — it is a write that did not happen, and
  // the caller must not proceed as if it had (D-018).
  if (!row || row.leaseToken !== leaseToken) return null;
  return {
    tasksWorkspaceId: input.tasksWorkspaceId,
    timelineWorkspaceSlug: input.timelineWorkspaceSlug,
    timelineSlug: input.timelineSlug,
    generation: row.generation,
    leaseToken,
    previousDigest: previous?.snapshotDigest ?? null,
  };
}

type Executor = Pick<typeof db, "update">;

/**
 * The compare-and-set. Returns false when a newer refresh has already taken
 * the generation, and writes nothing in that case.
 *
 * Call it INSIDE the transaction that writes the nodes, and before that write.
 */
export async function commitSyncGeneration(
  executor: Executor,
  lease: SyncLease,
  outcome: SyncOutcome,
  now: number = Date.now(),
): Promise<boolean> {
  const succeeded = outcome.status === "complete" || outcome.status === "empty" || outcome.status === "partial";
  const rows = await executor
    .update(timelineSourceSyncState)
    .set({
      status: outcome.status,
      leaseToken: null,
      leaseExpiresAt: null,
      sourceCount: outcome.sourceCount ?? null,
      importedCount: outcome.importedCount ?? null,
      snapshotDigest: outcome.snapshotDigest ?? null,
      errorCode: outcome.errorCode ?? null,
      ...(succeeded ? { lastSuccessAt: new Date(now) } : {}),
    })
    .where(
      and(
        eq(timelineSourceSyncState.tasksWorkspaceId, lease.tasksWorkspaceId),
        eq(timelineSourceSyncState.generation, lease.generation),
        eq(timelineSourceSyncState.leaseToken, lease.leaseToken),
      ),
    )
    .returning({ generation: timelineSourceSyncState.generation });
  return rows.length === 1;
}

/** Release a lease without claiming a result. Used when the read failed. */
export async function releaseSyncLease(
  lease: SyncLease,
  outcome: SyncOutcome,
  now: number = Date.now(),
): Promise<boolean> {
  return commitSyncGeneration(db, lease, outcome, now);
}

export type SyncFreshness = Readonly<{
  status: TimelineSourceSyncState["status"];
  lastSuccessAt: Date | null;
  lastAttemptAt: Date | null;
  sourceCount: number | null;
  importedCount: number | null;
  errorCode: string | null;
  /** True when the last successful read did not see the whole Project. */
  truncated: boolean;
}>;

/**
 * What the loader needs in order to say "Last refreshed …" honestly.
 *
 * Read by both View and Edit. A Timeline with no row has simply never
 * refreshed, which is a different sentence from "refreshed and found nothing".
 */
export async function readSyncFreshness(input: {
  timelineWorkspaceSlug: string;
  timelineSlug: string;
}): Promise<SyncFreshness | null> {
  try {
    return await readSyncFreshnessUnguarded(input);
  } catch {
    // This runs in a page loader. Before 0001 is applied the table is not
    // there, and a Timeline must not fail to render because it cannot say how
    // fresh it is. Null reads as "never refreshed", which is what the surface
    // shows anyway when there is no row. No log line: this is a READ on a hot
    // path, and one per page load would be noise, not signal.
    return null;
  }
}

async function readSyncFreshnessUnguarded(input: {
  timelineWorkspaceSlug: string;
  timelineSlug: string;
}): Promise<SyncFreshness | null> {
  const [row] = await db
    .select()
    .from(timelineSourceSyncState)
    .where(
      and(
        eq(timelineSourceSyncState.timelineWorkspaceSlug, input.timelineWorkspaceSlug),
        eq(timelineSourceSyncState.timelineSlug, input.timelineSlug),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    status: row.status,
    lastSuccessAt: row.lastSuccessAt,
    lastAttemptAt: row.lastAttemptAt,
    sourceCount: row.sourceCount,
    importedCount: row.importedCount,
    errorCode: row.errorCode,
    truncated:
      row.status === "partial" ||
      (row.sourceCount !== null &&
        row.importedCount !== null &&
        row.importedCount < row.sourceCount),
  };
}

/** Only used by the tests and the operator tooling; never on a request path. */
export async function readSyncStateRow(tasksWorkspaceId: string) {
  const [row] = await db
    .select()
    .from(timelineSourceSyncState)
    .where(eq(timelineSourceSyncState.tasksWorkspaceId, tasksWorkspaceId))
    .limit(1);
  return row ?? null;
}
