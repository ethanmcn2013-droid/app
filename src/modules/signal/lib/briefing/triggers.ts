import type { TaskSignal, TriggerKind } from "./types";
import { calendarDayDifference } from "./calendar-time";

const DAY = 86_400_000;

/**
 * v1 triggers. Six, intentionally. The old Plan 6 spec'd ten —
 * overbuilt for an engine no user has stressed yet. Ship six, see
 * which land, expand only what works.
 */

export type Triggered = {
  task: TaskSignal;
  trigger: TriggerKind;
  reasons: string[];
  severity: number; // higher = more attention
};

/** Stuck work: open task, idle ≥ 3 days, not blocked by something
 *  else (otherwise it's a blocker problem not a stuck-work problem). */
export function detectStuckWork(signals: TaskSignal[]): Triggered[] {
  return signals
    .filter(
      (s) =>
        s.lane !== "shipped" &&
        s.idleDays >= 3 &&
        s.blockedBy.length === 0,
    )
    .map((task) => ({
      task,
      trigger: "stuck-work" as const,
      reasons: [
        `No status update in ${task.idleDays} days.`,
        task.priority <= 1
          ? "High-priority item, threshold crossed for attention."
          : "Threshold crossed → surfaced for attention.",
      ],
      severity: Math.min(100, task.idleDays * 4 + (3 - task.priority) * 6),
    }));
}

/** Due soon: open task with a due date in ≤ 2 days, OR already overdue. */
export function detectDueSoon(
  signals: TaskSignal[],
  now: number = Date.now(),
  timezone = "UTC",
): Triggered[] {
  return signals
    .filter((s) => s.lane !== "shipped" && s.dueAt != null)
    .map((task): Triggered | null => {
      const dueAt = task.dueAt!;
      const daysOut = calendarDayDifference(dueAt, now, timezone);
      if (daysOut > 2) return null;
      const isOverdue = daysOut < 0;
      const overdueDays = Math.round(Math.abs(daysOut));
      return {
        task,
        trigger: "due-soon",
        reasons: isOverdue
          ? [
              `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue.`,
              task.priority <= 1
                ? "High priority + past due → flagged."
                : "Past due → flagged.",
            ]
          : [
              daysOut < 1 ? "Due today." : `Due within ${Math.ceil(daysOut)} days.`,
              "Surfaced because the date is near.",
            ],
        severity: isOverdue
          ? 80 + Math.min(20, overdueDays * 2)
          : 60 + Math.max(0, (2 - daysOut) * 8),
      };
    })
    .filter((x): x is Triggered => x !== null);
}

/** Just shipped: task moved to shipped in last 24h. */
export function detectJustShipped(
  signals: TaskSignal[],
  now: number = Date.now(),
): Triggered[] {
  return signals
    .filter(
      (s) =>
        s.lane === "shipped" &&
        s.movedToShippedAt != null &&
        now - s.movedToShippedAt <= DAY,
    )
    .map((task) => ({
      task,
      trigger: "just-shipped" as const,
      reasons: [
        "Moved to shipped in the last 24h.",
        "Calibrates the noise of what's wrong.",
      ],
      severity: 40 + (3 - task.priority) * 5,
    }));
}

/** Crowded week: ≥ 3 open tasks due within the same 7-day window.
 *  Emits a single synthetic trigger representing the week, not one
 *  per task, the signal is the cluster, not the items.
 *
 *  This pairs with due-soon (which fires per-task on ≤2-day items)
 *  by surfacing the broader 7-day pressure earlier in the planning
 *  horizon. Wedding-planner archetype: "three things due this
 *  Friday" is exactly the alert they need before the day arrives. */
export function detectCrowdedWeek(
  signals: TaskSignal[],
  now: number = Date.now(),
  timezone = "UTC",
): Triggered[] {
  const upcoming = signals.filter(
    (s) =>
      s.lane !== "shipped" &&
      s.dueAt != null &&
      calendarDayDifference(s.dueAt, now, timezone) > 0 &&
      calendarDayDifference(s.dueAt, now, timezone) <= 7,
  );
  if (upcoming.length < 3) return [];

  const synthetic: TaskSignal = {
    id: "synthetic:crowded-week",
    title: `${upcoming.length} items due this week`,
    lane: "in-flight",
    priority: 1,
    dueAt: null,
    idleDays: 0,
    commentCount: 0,
    blockedBy: [],
    sourceLabel: upcoming[0]?.sourceLabel ?? "Tasks",
    movedToShippedAt: null,
  };
  return [
    {
      task: synthetic,
      trigger: "crowded-week",
      reasons: [
        `${upcoming.length} items have due dates inside the next seven days.`,
        "Cluster threshold crossed → surfaced before the crunch.",
      ],
      severity: 55 + Math.min(30, upcoming.length * 4),
    },
  ];
}

/** Blocked too long: open task with blockedBy.length > 0 AND
 *  idleDays ≥ 5. The stuck-work trigger deliberately excludes
 *  blocked tasks (a blocker is a different problem); this trigger
 *  closes that gap. Persistent blockers deserve visibility, not
 *  silence. */
export function detectBlockedTooLong(signals: TaskSignal[]): Triggered[] {
  return signals
    .filter(
      (s) =>
        s.lane !== "shipped" &&
        s.blockedBy.length > 0 &&
        s.idleDays >= 5,
    )
    .map((task) => ({
      task,
      trigger: "blocked-too-long" as const,
      reasons: [
        `Waiting for ${task.idleDays} days, the blocker is outlasting reasonable waiting.`,
        task.blockedBy.length === 1
          ? "One upstream dependency hasn't cleared."
          : `${task.blockedBy.length} upstream dependencies haven't cleared.`,
      ],
      severity: Math.min(90, 30 + task.idleDays * 3 + task.blockedBy.length * 4),
    }));
}

/** Overload: > 5 in-flight tasks for the user. The triggered
 *  signal isn't a task, it's the situation itself. We return a
 *  pseudo-task representing the overload state. */
export function detectOverload(signals: TaskSignal[]): Triggered[] {
  const inFlight = signals.filter(
    (s) => s.lane === "in-flight" || s.lane === "review",
  );
  if (inFlight.length <= 5) return [];

  const synthetic: TaskSignal = {
    id: "synthetic:overload",
    title: `${inFlight.length} items in flight at once`,
    lane: "in-flight",
    priority: 1,
    dueAt: null,
    idleDays: 0,
    commentCount: 0,
    blockedBy: [],
    sourceLabel: inFlight[0]?.sourceLabel ?? "Tasks",
    movedToShippedAt: null,
  };
  return [
    {
      task: synthetic,
      trigger: "overload",
      reasons: [
        `${inFlight.length} items are open in flight at the same time.`,
        "Capacity threshold (5) crossed → flagged as cognitive load.",
      ],
      severity: 50 + (inFlight.length - 5) * 4,
    },
  ];
}
