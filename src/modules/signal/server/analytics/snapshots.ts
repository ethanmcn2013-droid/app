import "server-only";

import { and, asc, desc, eq, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type {
  AnalyticsMetricBundle,
  AnalyticsQuery,
  AnalyticsSnapshot,
  MetricKey,
  TrendPoint,
} from "../../lib/analytics/contracts";
import { asProjectId, PROGRAM_AXIS_NOT_CARRIED } from "../../lib/analytics/contracts";
import { calculateMetrics, SIGNAL_METRIC_VERSION } from "../../lib/analytics/metrics";
import { signalAnalyticsDb as db } from "../db/signal-analytics-client";
import {
  analyticsMetricSnapshots,
  analyticsSnapshotRuns,
  analyticsUsers,
} from "../db/signal-analytics-schema";
import { combineCoverage, providerCoverage } from "./providers/coverage";
import { TimelineAnalyticsProvider } from "./providers/timeline";
import { labelsFromTasks, TasksAnalyticsProvider } from "./providers/tasks";
import {
  scalarSnapshotAggregate,
  SNAPSHOT_RUN_STALE_MS,
  snapshotRetentionCutoff,
  snapshotRunBlocksCapture,
  snapshotMetricNumber,
  stableSnapshotId,
  type SnapshotWorkspaceCandidate,
} from "./snapshot-utils";

/**
 * `analytics_metric_snapshots.project_id` is misnamed (D-010).
 *
 * It never held a Project. It held a slugified Tasks tag, written by the
 * removed per-tag capture fan-out, so a row keyed `project_id` described a
 * Label. Nothing writes it any more: `captureWorkspaceSnapshots` — the only
 * writer — captures exactly one scope per Project and passes null.
 *
 * The column is NOT dropped or renamed here, because the blast radius is
 * unmeasured and cannot be measured from this repository. Run this against
 * the Signal analytics database before any migration:
 *
 *   SELECT count(*) AS total,
 *          count(project_id) AS tag_keyed_rows,
 *          count(DISTINCT workspace_id) AS workspaces,
 *          min(snapshot_at) AS oldest,
 *          max(snapshot_at) AS newest
 *   FROM analytics_metric_snapshots;
 *
 * `captureWorkspaceSnapshots` has zero callers and no cron declares it
 * (`vercel.json` schedules only the digest), so `tag_keyed_rows` is expected
 * to be 0 and the migration is expected to be schema-only. That is a
 * prediction, not a measurement: if it returns non-zero, those rows are
 * Label-keyed history and the rename must carry them across rather than a
 * DROP. Every read below pins the column to NULL so a stale tag-keyed row
 * can never be served as if it were Project history.
 */
const LEGACY_PROJECT_COLUMN_IS_NULL = isNull(analyticsMetricSnapshots.projectId);

const DAY_MS = 86_400_000;
const MAX_HISTORY_ROWS = 400;
const MAX_ELIGIBLE_WORKSPACES = 5_000;
const MAX_DAILY_RUN_RECEIPTS = 10_000;
export { SNAPSHOT_RETENTION_DAYS } from "./snapshot-utils";
const SNAPSHOT_METRICS: MetricKey[] = [
  "work_completed",
  "open_work",
  "open_overdue_work",
  "open_work_age",
  "stalled_work",
  "blocked_work",
  "unowned_work",
  "completion_pace_change",
  "milestone_movement",
  "workload_distribution",
  "cross_product_milestone_risk",
];

export interface SnapshotHistoryResult {
  points: TrendPoint[];
  status: "ready" | "insufficient_history" | "unavailable";
  issues: string[];
}

/** A linked Signal workspace is the explicit eligibility boundary for derived history. */
export async function listEligibleSnapshotWorkspaces(): Promise<SnapshotWorkspaceCandidate[]> {
  const rows = await db
    .select({
      workspaceId: analyticsUsers.linkedWorkspaceId,
      clerkId: analyticsUsers.clerkId,
      timezone: analyticsUsers.timezone,
    })
    .from(analyticsUsers)
    .where(isNotNull(analyticsUsers.linkedWorkspaceId))
    .orderBy(asc(analyticsUsers.linkedWorkspaceId), asc(analyticsUsers.clerkId))
    .limit(MAX_ELIGIBLE_WORKSPACES);
  const workspaces = new Map<string, SnapshotWorkspaceCandidate>();
  for (const row of rows) {
    if (!row.workspaceId) continue;
    const existing = workspaces.get(row.workspaceId);
    if (existing) {
      workspaces.set(row.workspaceId, {
        ...existing,
        linkedClerkIds: [...new Set([...(existing.linkedClerkIds ?? []), row.clerkId])],
      });
    } else {
      workspaces.set(row.workspaceId, {
        workspaceId: row.workspaceId,
        timezone: validTimezone(row.timezone) ? row.timezone : "UTC",
        linkedClerkIds: [row.clerkId],
      });
    }
  }
  return Array.from(workspaces.values());
}

/** Latest successful capture per workspace, used only to order fair continuation. */
export async function lastCompletedSnapshotWorkspaceTimes(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      workspaceId: analyticsSnapshotRuns.workspaceId,
      startedAt: analyticsSnapshotRuns.startedAt,
    })
    .from(analyticsSnapshotRuns)
    .where(eq(analyticsSnapshotRuns.status, "completed"))
    .orderBy(desc(analyticsSnapshotRuns.startedAt))
    .limit(MAX_DAILY_RUN_RECEIPTS);
  const latest = new Map<string, number>();
  for (const row of rows) {
    if (!latest.has(row.workspaceId)) {
      latest.set(row.workspaceId, row.startedAt.getTime());
    }
  }
  return latest;
}

/** Completed or recently running daily receipts must not be captured again. */
export async function activeSnapshotWorkspaceIds(now: Date): Promise<Set<string>> {
  const dayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  const rows = await db
    .select({
      workspaceId: analyticsSnapshotRuns.workspaceId,
      status: analyticsSnapshotRuns.status,
      startedAt: analyticsSnapshotRuns.startedAt,
    })
    .from(analyticsSnapshotRuns)
    .where(gte(analyticsSnapshotRuns.startedAt, dayStart))
    .limit(MAX_DAILY_RUN_RECEIPTS);
  return new Set(
    rows
      .filter((row) => snapshotRunBlocksCapture(row.status, row.startedAt, now))
      .map((row) => row.workspaceId),
  );
}

/** Global pruning also reaches workspaces that were deleted or are no longer eligible. */
export async function pruneExpiredAnalyticsHistory(now: Date): Promise<Date> {
  const cutoff = snapshotRetentionCutoff(now);
  await Promise.all([
    db.delete(analyticsMetricSnapshots).where(lt(analyticsMetricSnapshots.snapshotAt, cutoff)),
    db.delete(analyticsSnapshotRuns).where(lt(analyticsSnapshotRuns.startedAt, cutoff)),
  ]);
  return cutoff;
}

/** Read forward-captured aggregates only; no source content is persisted. */
export async function readMetricSnapshotHistory(
  query: AnalyticsQuery,
  metricKey: MetricKey,
): Promise<SnapshotHistoryResult> {
  if (
    query.scope.type === "user" ||
    (query.filters?.ownerIds?.length ?? 0) > 0 ||
    (query.filters?.statuses?.length ?? 0) > 0
  ) {
    return {
      points: [],
      status: "insufficient_history",
      issues: ["filtered_snapshot_history_not_captured"],
    };
  }
  try {
    const rows = await db
      .select({
        id: analyticsMetricSnapshots.id,
        snapshotAt: analyticsMetricSnapshots.snapshotAt,
        numericValue: analyticsMetricSnapshots.numericValue,
      })
      .from(analyticsMetricSnapshots)
      .where(
        and(
          eq(analyticsMetricSnapshots.workspaceId, query.scope.workspaceId),
          LEGACY_PROJECT_COLUMN_IS_NULL,
          eq(analyticsMetricSnapshots.metricKey, metricKey),
          gte(analyticsMetricSnapshots.snapshotAt, new Date(query.period.start)),
          lt(analyticsMetricSnapshots.snapshotAt, new Date(query.period.end)),
        ),
      )
      .orderBy(analyticsMetricSnapshots.snapshotAt)
      .limit(MAX_HISTORY_ROWS);
    const points = rows.flatMap((row): TrendPoint[] => {
      if (row.numericValue === null) return [];
      const start = row.snapshotAt.toISOString();
      return [{
        start,
        end: new Date(row.snapshotAt.getTime() + DAY_MS).toISOString(),
        value: row.numericValue,
        label: new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          timeZone: query.period.timezone,
        }).format(row.snapshotAt),
        sourceIds: [],
        evidenceId: `snapshot:${metricKey}:${row.id}`,
      }];
    });
    return {
      points,
      status: points.length >= 2 ? "ready" : "insufficient_history",
      issues: points.length >= 2 ? [] : ["not_enough_forward_snapshots"],
    };
  } catch (error) {
    console.warn("[signal-analytics] snapshot history unavailable", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { points: [], status: "unavailable", issues: ["snapshot_history_unavailable"] };
  }
}

export async function readSnapshotEvidence(
  query: AnalyticsQuery,
  metricKey: MetricKey,
  id: string,
): Promise<{ value: number; snapshotAt: string } | null> {
  try {
    const [row] = await db
      .select({
        id: analyticsMetricSnapshots.id,
        value: analyticsMetricSnapshots.numericValue,
        snapshotAt: analyticsMetricSnapshots.snapshotAt,
      })
      .from(analyticsMetricSnapshots)
      .where(
        and(
          eq(analyticsMetricSnapshots.id, id),
          eq(analyticsMetricSnapshots.workspaceId, query.scope.workspaceId),
          LEGACY_PROJECT_COLUMN_IS_NULL,
          eq(analyticsMetricSnapshots.metricKey, metricKey),
          gte(analyticsMetricSnapshots.snapshotAt, new Date(query.period.start)),
          lt(analyticsMetricSnapshots.snapshotAt, new Date(query.period.end)),
        ),
      )
      .limit(1);
    return row && row.value !== null
      ? { value: row.value, snapshotAt: row.snapshotAt.toISOString() }
      : null;
  } catch {
    return null;
  }
}

/** Capture one workspace once per UTC day; retries only a failed receipt. */
export async function captureWorkspaceSnapshots(input: {
  workspaceId: string;
  timezone: string;
  now?: Date;
}): Promise<{ runId: string; status: "completed" | "skipped"; snapshotCount: number }> {
  const now = input.now ?? new Date();
  const day = now.toISOString().slice(0, 10);
  const runId = stableSnapshotId("run", input.workspaceId, day, SIGNAL_METRIC_VERSION);
  const inserted = await db
    .insert(analyticsSnapshotRuns)
    .values({
      id: runId,
      workspaceId: input.workspaceId,
      status: "running",
      startedAt: now,
      coverage: {},
      schemaVersion: 1,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: analyticsSnapshotRuns.id });
  if (!inserted.length) {
    const staleBefore = new Date(now.getTime() - SNAPSHOT_RUN_STALE_MS);
    const retried = await db
      .update(analyticsSnapshotRuns)
      .set({ status: "running", startedAt: now, completedAt: null, errorCode: null })
      .where(
        and(
          eq(analyticsSnapshotRuns.id, runId),
          or(
            eq(analyticsSnapshotRuns.status, "failed"),
            and(
              eq(analyticsSnapshotRuns.status, "running"),
              lt(analyticsSnapshotRuns.startedAt, staleBefore),
            ),
          ),
        ),
      )
      .returning({ id: analyticsSnapshotRuns.id });
    if (!retried.length) return { runId, status: "skipped", snapshotCount: 0 };
  }

  try {
    const periodEnd = now.toISOString();
    const query: AnalyticsQuery = {
      scope: {
        type: "workspace",
        id: input.workspaceId,
        workspaceId: asProjectId(input.workspaceId),
      },
      program: PROGRAM_AXIS_NOT_CARRIED,
      period: {
        start: new Date(now.getTime() - 28 * DAY_MS).toISOString(),
        end: periodEnd,
        timezone: input.timezone,
        preset: "four_weeks",
      },
    };
    const [tasks, timeline] = await Promise.all([
      new TasksAnalyticsProvider().read(query),
      new TimelineAnalyticsProvider().read(query),
    ]);
    const labels = labelsFromTasks(tasks.tasks, query);
    const labelsCoverage = providerCoverage({
      provider: "labels",
      status: tasks.coverage.status,
      capabilities: ["label_read"],
      count: labels.length,
      calculatedAt: periodEnd,
      issues: tasks.coverage.issues,
    });
    const notesCoverage = providerCoverage({
      provider: "notes",
      status: "unsupported",
      calculatedAt: periodEnd,
      issues: ["notes_not_read_by_background_snapshot"],
    });
    const snapshot: AnalyticsSnapshot = {
      scope: query.scope,
      capturedAt: periodEnd,
      labels,
      tasks: tasks.tasks,
      notes: [],
      milestones: timeline.milestones,
      timelineDependencies: timeline.dependencies ?? [],
      events: [...tasks.events, ...timeline.events],
      coverage: combineCoverage(
        { tasks: tasks.coverage, timeline: timeline.coverage, notes: notesCoverage, labels: labelsCoverage },
        periodEnd,
      ),
    };
    // One capture per Project. The previous fan-out also captured a scope
    // per slugified tag and stored it in `project_id`, so a row named for a
    // Project was keyed by a Label. Per-Label history is deferred until that
    // column is renamed (see LEGACY_PROJECT_COLUMN_IS_NULL) rather than
    // continuing to accumulate under a name that misdescribes it.
    const rows = snapshotRows(snapshot, query, calculateMetrics(snapshot, query), now);
    if (rows.length) {
      await db
        .insert(analyticsMetricSnapshots)
        .values(rows)
        .onConflictDoUpdate({
          target: analyticsMetricSnapshots.id,
          set: {
            numericValue: sql`excluded.numeric_value`,
            aggregateValue: sql`excluded.aggregate_value`,
            coverage: sql`excluded.coverage`,
            metricVersion: sql`excluded.metric_version`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
    await db
      .update(analyticsSnapshotRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        sourceWatermark: snapshot.capturedAt,
        coverage: safeCoverage(snapshot),
        errorCode: null,
      })
      .where(eq(analyticsSnapshotRuns.id, runId));
    const retentionCutoff = snapshotRetentionCutoff(now);
    await Promise.all([
      db
        .delete(analyticsMetricSnapshots)
        .where(
          and(
            eq(analyticsMetricSnapshots.workspaceId, input.workspaceId),
            lt(analyticsMetricSnapshots.snapshotAt, retentionCutoff),
          ),
        ),
      db
        .delete(analyticsSnapshotRuns)
        .where(
          and(
            eq(analyticsSnapshotRuns.workspaceId, input.workspaceId),
            lt(analyticsSnapshotRuns.startedAt, retentionCutoff),
          ),
        ),
    ]);
    return { runId, status: "completed", snapshotCount: rows.length };
  } catch (error) {
    await db
      .update(analyticsSnapshotRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorCode: error instanceof Error ? error.name.slice(0, 64) : "UnknownError",
      })
      .where(eq(analyticsSnapshotRuns.id, runId));
    throw error;
  }
}

export async function analyticsTimezoneForOwner(clerkId: string | null): Promise<string> {
  if (!clerkId) return "UTC";
  try {
    const [row] = await db
      .select({ timezone: analyticsUsers.timezone })
      .from(analyticsUsers)
      .where(eq(analyticsUsers.clerkId, clerkId))
      .limit(1);
    if (row?.timezone) {
      new Intl.DateTimeFormat("en", { timeZone: row.timezone }).format();
      return row.timezone;
    }
  } catch {
    // UTC is the documented fallback when the owner has no saved timezone.
  }
  return "UTC";
}

function validTimezone(value: string | null): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function snapshotRows(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  metrics: AnalyticsMetricBundle,
  now: Date,
) {
  const coverage = safeCoverage(snapshot);
  return SNAPSHOT_METRICS.flatMap((metricKey) => {
    const metric = metrics[metricKey];
    if (metric.status === "unsupported") return [];
    const numericValue = snapshotMetricNumber(metricKey, metric.value);
    if (numericValue === null) return [];
    return [{
      id: stableSnapshotId("metric", query.scope.workspaceId, "workspace", metricKey, now.toISOString().slice(0, 10), metric.metricVersion),
      workspaceId: query.scope.workspaceId,
      // Always null now. See LEGACY_PROJECT_COLUMN_IS_NULL.
      projectId: null,
      metricKey,
      snapshotAt: now,
      numericValue,
      aggregateValue: scalarSnapshotAggregate(metric.value),
      coverage,
      metricVersion: metric.metricVersion,
      createdAt: now,
      updatedAt: now,
    }];
  });
}

function safeCoverage(snapshot: AnalyticsSnapshot): Record<string, string | number | boolean | null> {
  return {
    status: snapshot.coverage.status,
    tasksStatus: snapshot.coverage.providers.tasks?.status ?? null,
    tasksCount: snapshot.coverage.providers.tasks?.sourceRecordCount ?? 0,
    timelineStatus: snapshot.coverage.providers.timeline?.status ?? null,
    timelineCount: snapshot.coverage.providers.timeline?.sourceRecordCount ?? 0,
    schemaVersion: 1,
  };
}
