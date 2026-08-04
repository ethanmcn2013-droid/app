import type { Lane, TaskSignal, TriggerKind } from "./types";
import { calendarDayDifference } from "./calendar-time";
import { capitalise, numberWord, plural } from "./prose";

const DAY = 86_400_000;

/**
 * v1 triggers. Six, intentionally. The old Plan 6 spec'd ten,
 * overbuilt for an engine no user has stressed yet. Ship six, see
 * which land, expand only what works.
 *
 * `reasons` is the "Why this" panel. The rule for every line in it: it
 * must carry a fact the row above did not already carry. A row reading
 * "Due today." under a reason reading "Surfaced because the date is
 * near" spends the reader's click on nothing. In practice that means
 * one line naming the rule that actually fired, and one line of
 * evidence the headline had no room for.
 */

export type Triggered = {
  task: TaskSignal;
  trigger: TriggerKind;
  reasons: string[];
  severity: number; // higher = more attention
};

/**
 * Where the work has actually got to, as a sentence. Lane names are
 * board vocabulary; "Still sitting in In flight" is not a thing anyone
 * says. This is the fact a date alone cannot give the reader: whether
 * the item has been started at all.
 */
function lanePosition(lane: Lane): string {
  switch (lane) {
    case "next":
      return "Not started yet.";
    case "in-flight":
      return "Started, and still open.";
    case "review":
      return "Sitting in review.";
    case "shipped":
      return "Already closed.";
  }
}

/** Plain phrase for a date this many calendar days out (always ≥ 0). */
function dueWhen(daysOut: number): string {
  if (daysOut < 1) return "today";
  if (daysOut < 2) return "tomorrow";
  return `in ${plural(Math.floor(daysOut), "day", "days")}`;
}

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
      // The row above already reads "Nothing has moved on it for eighteen
      // days", so a first bullet reading "Last update was eighteen days
      // ago" spent the reader's click restating it in different words.
      // Rule first, then the one fact the row has no room for: whether
      // the work has been started at all.
      reasons: [
        "Signal flags anything quiet for three days or more.",
        lanePosition(task.lane),
        ...(task.priority === 0 ? ["You marked this high priority."] : []),
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
      // The row already states the date position, so neither line here
      // repeats it. Line one names the rule that fired; line two is the
      // fact the date alone does not give you, which is whether anyone
      // has touched it and where it is sitting.
      const evidence =
        task.idleDays >= 1
          ? `No update on it in ${plural(task.idleDays, "day", "days")}.`
          : lanePosition(task.lane);
      return {
        task,
        trigger: "due-soon",
        reasons: [
          isOverdue
            ? "Signal flags anything past its date."
            : "Signal flags anything due inside two days.",
          evidence,
          // Gated at P0, not at P0-or-P1. At the old threshold the line
          // appeared on very nearly every row, so it discriminated
          // nothing and read as decoration.
          ...(task.priority === 0 ? ["You marked this high priority."] : []),
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
        "Signal keeps a closed item in the read for a day after it moves.",
        task.priority === 0
          ? "You had it marked high priority before it closed."
          : "Nothing is being asked of you here.",
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

  const soonest = Math.min(
    ...upcoming.map((s) => calendarDayDifference(s.dueAt!, now, timezone)),
  );

  const synthetic: TaskSignal = {
    id: "synthetic:crowded-week",
    // Words, not a numeral: this title renders as a row headline in
    // display type beside "Two things calling." and "One risk worth
    // watching." A "3" in that line was the only figure on the page.
    title: `${capitalise(numberWord(upcoming.length))} items due this week`,
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
        "Signal flags three or more dates landing in the same seven days.",
        `The closest is due ${dueWhen(soonest)}.`,
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
        "Signal flags blocked work after five days without movement.",
        lanePosition(task.lane),
        task.blockedBy.length === 1
          ? "One upstream item has not cleared."
          : `${capitalise(numberWord(task.blockedBy.length))} upstream items have not cleared.`,
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

  const inReview = inFlight.filter((s) => s.lane === "review").length;

  const synthetic: TaskSignal = {
    id: "synthetic:overload",
    /** Words, not a numeral, for the same reason as crowded-week. */
    title: `${capitalise(numberWord(inFlight.length))} items open at once`,
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
        "Signal flags anything over five open at once.",
        inReview > 0
          ? `${capitalise(numberWord(inReview))} of them ${inReview === 1 ? "is" : "are"} already in review.`
          : "None of them have reached review yet.",
      ],
      severity: 50 + (inFlight.length - 5) * 4,
    },
  ];
}
