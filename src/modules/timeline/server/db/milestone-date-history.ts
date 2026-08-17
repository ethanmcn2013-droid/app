import { randomUUID } from "node:crypto";
import { activity } from "./timeline-schema";
import type { TimelineWriteExecutor } from "./timeline-queries";

/**
 * Milestone date history — the writer the analytics read has been waiting for.
 *
 * The analytics Timeline provider reads the `activity` table for rows with
 * `entity_kind = 'task'`, an action containing "date", and a payload carrying
 * `{from, to}` (providers/timeline.ts). Until 2026-08-17 nothing anywhere
 * wrote such rows, so `milestone_date_history` could never be declared and
 * `milestone_movement` resolved unsupported forever (ANALYTICS_TRUTH.md R4).
 * History cannot be backfilled — there is no archive to reconstruct from —
 * which is why this writer ships ahead of the interface that consumes it
 * (D-026, founder-authorized G2, 17 Aug 2026).
 *
 * Two mutation sites feed it, and only two (established by trace, 17 Aug):
 *
 *   1. `writeRoadmapNodes` — the Tasks→Timeline sync upsert, the only
 *      statement that overwrites `tasks.target_date`.
 *   2. `upsertNodeOverlay` — the curation overlay, the gesture an owner
 *      actually performs to move a date. The recorded change is the change
 *      to the node's EFFECTIVE date (override ?? synced), because that is
 *      the date the owner saw move.
 *
 * Rules the rows obey:
 *
 *   - A change is recorded only when both sides exist and differ. A date
 *     appearing on an undated milestone is creation, not movement; a date
 *     being cleared has no `to` for the reader to plot. The reader requires
 *     both, so rows without both would be dead weight in the events feed.
 *   - Tenant scope: every row carries `workspace_slug`
 *     (src/server/tenant-scope-rules.mjs lists `activity` under the timeline
 *     surface).
 *   - The action verb is "date-change", satisfying the provider's
 *     `action.includes("date")` test and the schema's documented free-form
 *     verb convention (timeline-schema.ts).
 *
 * Flag: SIGNAL_MILESTONE_DATE_HISTORY_ENABLED, default off, same idiom as
 * audienceTimelineEnabled — but deliberately NOT or-ed with demo mode: a
 * writer must never gain a path in demo that it lacks in production. Both
 * call sites sit behind their callers' existing demo short-circuits anyway.
 */
export function milestoneDateHistoryEnabled(): boolean {
  return process.env.SIGNAL_MILESTONE_DATE_HISTORY_ENABLED === "true";
}

export type MilestoneDateChange = Readonly<{
  /** The node whose date moved — `tasks.id`, i.e. the ms-* synced id. */
  entityId: string;
  /** YYYY-MM-DD, the date the owner saw before. */
  from: string;
  /** YYYY-MM-DD, the date the owner sees now. */
  to: string;
}>;

/**
 * Diff a set of incoming milestone dates against the rows they are about to
 * overwrite. Pure. A change exists only when both sides are present and
 * differ — see the file header for why the one-sided cases are excluded.
 */
export function diffMilestoneDates(
  previous: ReadonlyMap<string, string | null>,
  incoming: ReadonlyArray<{ id: string; targetDate?: string | null }>,
): MilestoneDateChange[] {
  const changes: MilestoneDateChange[] = [];
  for (const m of incoming) {
    const from = previous.get(m.id) ?? null;
    const to = m.targetDate ?? null;
    if (from && to && from !== to) changes.push({ entityId: m.id, from, to });
  }
  return changes;
}

/**
 * Insert one activity row per recorded change. No-op when the flag is off or
 * there is nothing to record. Uses the caller's executor: at the sync site
 * that is the refresh transaction, so history commits atomically with the
 * dates it describes. `created_at` comes from the column's unixepoch default.
 */
export async function recordMilestoneDateChanges(
  executor: Pick<TimelineWriteExecutor, "insert">,
  workspaceSlug: string,
  changes: readonly MilestoneDateChange[],
): Promise<void> {
  if (!milestoneDateHistoryEnabled() || !changes.length) return;
  await executor.insert(activity).values(
    changes.map((change) => ({
      id: randomUUID(),
      workspaceSlug,
      entityKind: "task",
      entityId: change.entityId,
      action: "date-change",
      payload: JSON.stringify({ from: change.from, to: change.to }),
    })),
  );
}
