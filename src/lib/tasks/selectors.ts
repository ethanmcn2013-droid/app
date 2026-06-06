import { LANE_ORDER, type LaneId, type Task, type UserId } from "@/lib/data";
import type { TasksState } from "./tasks-reducer";

export function tasksByLane(
  state: TasksState,
  lane: LaneId,
): Task[] {
  return state.tasks.filter((t) => t.lane === lane);
}

/**
 * Return tasks for a board column identified by `columnKey`.
 *
 * System column (todo/doing/review/done):
 *   Tasks whose `lane === columnKey` AND whose `boardColumnKey` is null/empty.
 *   Rationale: a task with a non-null `boardColumnKey` is "claimed" by its
 *   custom column — it should not double-appear in the system lane column on
 *   the board even though `lane` still carries its canonical semantic value.
 *
 * Custom column (key starts with "col-"):
 *   Tasks whose `boardColumnKey === columnKey`.
 *   The task's `lane` is ignored for board rendering; it stays canonical for
 *   List/Timeline/Calendar/export/print/SSE (those views never read boardColumnKey).
 *
 * This is the single place that encodes the COALESCE(boardColumnKey, lane)
 * logic for the board — board-app.tsx delegates entirely to this function.
 */
export function tasksByColumn(
  state: TasksState,
  columnKey: string,
): Task[] {
  const isSystemLane = (LANE_ORDER as string[]).includes(columnKey);
  if (isSystemLane) {
    // System lane: include only tasks that are NOT assigned to a custom column.
    return state.tasks.filter(
      (t) => t.lane === (columnKey as LaneId) && !t.boardColumnKey,
    );
  }
  // Custom column: tasks explicitly assigned here via boardColumnKey.
  return state.tasks.filter((t) => t.boardColumnKey === columnKey);
}

export function groupTasksByLane(tasks: Task[]): Record<LaneId, Task[]> {
  const groups: Record<LaneId, Task[]> = {
    todo: [],
    doing: [],
    review: [],
    done: [],
  };
  for (const t of tasks) groups[t.lane].push(t);
  return groups;
}

export function groupByLane(state: TasksState): Record<LaneId, Task[]> {
  return groupTasksByLane(state.tasks);
}

/** Tasks NOT in done. Convenience for sidebar inbox-style badges.
 *  Pass `{ user }` to scope to tasks where the given user is an
 *  assignee (used by the "My tasks" badge). */
export function openTaskCount(
  state: TasksState,
  opts?: { user?: UserId },
): number {
  const user = opts?.user;
  return state.tasks.reduce((n, t) => {
    if (t.lane === "done") return n;
    if (user && !t.assignees.includes(user)) return n;
    return n + 1;
  }, 0);
}

export function tasksSortedByStartDay(state: TasksState): Task[] {
  return [...state.tasks].sort(
    (a, b) => (a.startDay ?? 0) - (b.startDay ?? 0),
  );
}

export function laneOrder(): LaneId[] {
  return LANE_ORDER;
}

/**
 * My Week buckets — the calm editorial briefing for `/app/my-tasks`.
 *
 * Each of the caller's open + recently-done tasks lands in exactly one
 * bucket. Priority order (first match wins) keeps the surface from
 * showing the same task twice:
 *
 *   1. `today`       lane in todo/doing AND (overdue OR due today)
 *   2. `needsAttention`   lane === doing AND idle ≥ 4 days
 *   3. `waiting`     lane === review  (something else is gating it)
 *   4. `thisWeek`    lane in todo/doing AND due within (today, today+7d]
 *   5. `doneRecently`     lane === done AND updatedAt within last 7 days
 *
 * Open tasks without a due date and without idle-attention pressure
 * simply don't appear — that's the spec's restraint. They live on the
 * board and the list; My Week is the briefing, not the inbox.
 */
export type MyWeekBuckets = {
  today: Task[];
  needsAttention: Task[];
  waiting: Task[];
  thisWeek: Task[];
  doneRecently: Task[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTENTION_IDLE_DAYS = 4;

function idleDays(t: Task, now: Date): number {
  if (typeof t.idleDays === "number") return t.idleDays;
  return Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY_MS);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function bucketMyWeek(
  tasks: Task[],
  currentUser: UserId,
  now: Date = new Date(),
): MyWeekBuckets {
  const buckets: MyWeekBuckets = {
    today: [],
    needsAttention: [],
    waiting: [],
    thisWeek: [],
    doneRecently: [],
  };

  const mine = tasks.filter((t) => t.assignees.includes(currentUser));
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const weekEnd = new Date(todayStart.getTime() + 7 * DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  for (const t of mine) {
    // 5 — Done recently
    if (t.lane === "done") {
      if (t.updatedAt.getTime() >= sevenDaysAgo.getTime()) {
        buckets.doneRecently.push(t);
      }
      continue;
    }

    // Open tasks (todo/doing/review) below.
    const due = t.dueAt;

    // 1 — Today: overdue or due today (open only)
    if (
      (t.lane === "todo" || t.lane === "doing") &&
      due &&
      due.getTime() < tomorrowStart.getTime()
    ) {
      buckets.today.push(t);
      continue;
    }

    // 2 — Needs attention: idle Moving lane work
    if (t.lane === "doing" && idleDays(t, now) >= ATTENTION_IDLE_DAYS) {
      buckets.needsAttention.push(t);
      continue;
    }

    // 3 — Waiting: lane === review, regardless of date
    if (t.lane === "review") {
      buckets.waiting.push(t);
      continue;
    }

    // 4 — This week: due in (today, today+7d]
    if (
      (t.lane === "todo" || t.lane === "doing") &&
      due &&
      due.getTime() >= tomorrowStart.getTime() &&
      due.getTime() < weekEnd.getTime()
    ) {
      buckets.thisWeek.push(t);
      continue;
    }
  }

  // Sort each bucket so the calm-briefing read is consistent.
  buckets.today.sort(byDueThenPriority);
  buckets.thisWeek.sort(byDueThenPriority);
  buckets.needsAttention.sort((a, b) => idleDays(b, now) - idleDays(a, now));
  buckets.waiting.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  buckets.doneRecently.sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
  return buckets;
}

const PRIORITY_RANK: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };

function byDueThenPriority(a: Task, b: Task): number {
  const ad = a.dueAt?.getTime() ?? Infinity;
  const bd = b.dueAt?.getTime() ?? Infinity;
  if (ad !== bd) return ad - bd;
  return (
    (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
  );
}
