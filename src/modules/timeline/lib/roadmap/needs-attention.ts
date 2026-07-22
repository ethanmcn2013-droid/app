/**
 * Tier 3 "Quiet Intelligence", derived attention signal.
 *
 * Surfaces tasks that have drifted: idle too long in an active state,
 * or overdue against their target date. Read-only computation, no
 * DB write, no UI side-effect. Owner surfaces use the count to render
 * a calm "Needs attention" pill; public surfaces never see this signal.
 *
 * The brief's restraint principle: "Needs Attention" is *derived*, not
 * a manual fifth status. Adding a fifth lane would touch board drag,
 * templates, exports, and CSVs across four repos for a state every
 * product can compute from the data it already stores.
 *
 * Pure module, no Date.now() default at the call site, callers pass a
 * deterministic `now` so unit tests and server-rendered timestamps are
 * stable. Render-tier consumers pass `Date.now()` explicitly.
 */
import type { Task } from "@/modules/timeline/server/db/timeline-schema";

/** A day in milliseconds. Single constant, no repetition across files. */
const DAY_MS = 1000 * 60 * 60 * 24;

/** Idle threshold for active-state tasks. Matches the existing
 *  blocker-card "two weeks" dwell badge, same cadence across surfaces. */
export const IDLE_DAYS_THRESHOLD = 14;

export type AttentionReason = "idle" | "overdue";

/**
 * Returns the reason a task needs attention, or null if it's calm.
 *
 * - "overdue": targetDate is in the past AND status is not a settled state
 *   (shipped, refused). Past-date "next" / "in-flight" / "waiting" all qualify.
 * - "idle":   status is "in-flight" or "waiting" AND updatedAt is older than
 *   IDLE_DAYS_THRESHOLD. A task sitting in "Doing" for two weeks without an
 *   update is the canonical drift signal.
 *
 * Overdue takes precedence over idle when both apply, the date miss is the
 * more concrete signal and the one the owner needs to act on first.
 */
export function attentionReason(
  task: Pick<Task, "status" | "targetDate" | "updatedAt">,
  now: number,
): AttentionReason | null {
  const settled = task.status === "shipped" || task.status === "refused";

  if (!settled && task.targetDate) {
    const target = parseTargetDate(task.targetDate);
    if (target !== null && target < startOfDay(now)) return "overdue";
  }

  const isActiveState =
    task.status === "in-flight" || task.status === "waiting";
  if (isActiveState) {
    const updatedAtMs =
      task.updatedAt instanceof Date
        ? task.updatedAt.getTime()
        : Number(task.updatedAt);
    if (Number.isFinite(updatedAtMs)) {
      const idleDays = (now - updatedAtMs) / DAY_MS;
      if (idleDays >= IDLE_DAYS_THRESHOLD) return "idle";
    }
  }

  return null;
}

/** Boolean convenience for filter() use sites. */
export function needsAttention(
  task: Pick<Task, "status" | "targetDate" | "updatedAt">,
  now: number,
): boolean {
  return attentionReason(task, now) !== null;
}

/** Count tasks that need attention in a list. */
export function countNeedsAttention(
  tasks: Array<Pick<Task, "status" | "targetDate" | "updatedAt">>,
  now: number,
): number {
  let n = 0;
  for (const t of tasks) if (needsAttention(t, now)) n++;
  return n;
}

/** Parse an ISO YYYY-MM-DD targetDate at UTC start-of-day. Returns null on
 *  malformed input, drift signal should not crash the workspace render. */
function parseTargetDate(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const ms = Date.parse(iso + "T00:00:00Z");
  return Number.isFinite(ms) ? ms : null;
}

/** UTC start of the day containing `now`. Anchors "overdue" to the calendar
 *  day, not the millisecond, a task due today is not overdue at noon. */
function startOfDay(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
