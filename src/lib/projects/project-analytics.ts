import { PRIORITY_LABEL, type Priority } from "@/lib/data";
import type { CalendarDate } from "@/lib/planning/dates";

/**
 * Project analytics: pure arithmetic over one Project's tasks.
 *
 * The server loader reads the rows (or the review fixture) and hands them here
 * already reduced to `AnalyticsTask`; nothing in this module touches a
 * database, a clock or the network, so every figure on the page is
 * reproducible from its inputs and pinned by `project-analytics.test.ts`.
 *
 * Counting rules, stated once:
 * - "Finished" is a task in a done-meaning column (the Project's own column
 *   config) with a recorded completion instant. A finished task that was later
 *   archived still counts toward history; it was finished.
 * - "Open" is a task in any other column that is not archived. Archived work
 *   is hidden from every board view, so it is not open work here either.
 * - Weeks are rolling seven-day windows that end today, in the reader's time
 *   zone, so every bar is a whole week and the latest one is never partial.
 * - A date-only due date is late only once its calendar day has passed.
 */

const DAY_MS = 86_400_000;

export type AnalyticsRangeKey = "4w" | "12w" | "26w";

export const ANALYTICS_RANGES: ReadonlyArray<Readonly<{ key: AnalyticsRangeKey; weeks: number; label: string; phrase: string }>> = [
  { key: "4w", weeks: 4, label: "4 weeks", phrase: "4 weeks" },
  { key: "12w", weeks: 12, label: "12 weeks", phrase: "12 weeks" },
  { key: "26w", weeks: 26, label: "6 months", phrase: "6 months" },
];

export const DEFAULT_ANALYTICS_RANGE: AnalyticsRangeKey = "12w";

export function parseAnalyticsRange(raw: unknown): AnalyticsRangeKey {
  return ANALYTICS_RANGES.some((range) => range.key === raw) ? (raw as AnalyticsRangeKey) : DEFAULT_ANALYTICS_RANGE;
}

/** A board column's colour, reduced to what it means on a chart. */
export type ColumnTone = "neutral" | "progress" | "review" | "done" | "alert" | "accent";

export type AnalyticsTask = Readonly<{
  id: string;
  title: string;
  /** Effective board column: the custom claim, else the lane. */
  columnKey: string;
  /** Resolved through the Project's done columns, like the board. */
  done: boolean;
  archived: boolean;
  priority: Priority;
  assigneeIds: readonly string[];
  /** Epoch milliseconds. Null when the source cannot say. */
  createdAt: number | null;
  completedAt: number | null;
  dueAt: number | null;
}>;

export type AnalyticsColumn = Readonly<{ key: string; name: string; isDone: boolean; tone: ColumnTone }>;
export type AnalyticsPerson = Readonly<{ id: string; name: string }>;

export type AnalyticsInput = Readonly<{
  tasks: readonly AnalyticsTask[];
  columns: readonly AnalyticsColumn[];
  people: readonly AnalyticsPerson[];
  /** Epoch milliseconds for "now". */
  now: number;
  timeZone: string;
  range: AnalyticsRangeKey;
  /** The loader hit its row cap; the page says so rather than guessing. */
  truncated?: boolean;
  /** The column config could not be read, so the default Done applied. */
  columnsUnreadable?: boolean;
}>;

export type WeekBucket = Readonly<{ start: CalendarDate; end: CalendarDate; finished: number; added: number }>;
export type StatusRow = Readonly<{ key: string; name: string; count: number; share: number; isDone: boolean; tone: ColumnTone }>;
export type PersonLoad = Readonly<{
  /** Null is the "No one assigned" row. */
  id: string | null;
  name: string;
  open: number;
  overdue: number;
  /** Due today or in the six days after. */
  dueSoon: number;
  /** Finished in the selected period while assigned to this person. */
  finished: number;
}>;
export type DueDay = Readonly<{ date: CalendarDate; count: number; weekday: number; isToday: boolean }>;
export type PriorityRow = Readonly<{ priority: Priority; label: string; open: number; overdue: number }>;
export type DurationBucket = Readonly<{ key: string; label: string; shortLabel: string; count: number; holdsMedian: boolean }>;
export type ChangeTone = "good" | "bad" | "neutral";
export type ChangeLine = Readonly<{
  tone: ChangeTone;
  text: string;
  /** Optional task named at the end of the line, rendered as a link. */
  task?: Readonly<{ id: string; title: string; after: string }>;
}>;

export type ProjectAnalytics = Readonly<{
  timeZone: string;
  today: CalendarDate;
  range: Readonly<{ key: AnalyticsRangeKey; weeks: number; label: string; phrase: string; start: CalendarDate; end: CalendarDate }>;
  /** False only for a Project that has never had a task. */
  hasTasks: boolean;
  open: Readonly<{ count: number; unassigned: number }>;
  finished: Readonly<{ count: number; previous: number }>;
  added: Readonly<{ count: number; previous: number }>;
  overdue: Readonly<{ count: number; oldestDays: number; oldest: Readonly<{ id: string; title: string }> | null }>;
  /** Median whole-task duration, created to finished, in days. */
  timeToFinish: Readonly<{ medianDays: number | null; previousMedianDays: number | null; sample: number }>;
  onTime: Readonly<{ onTime: number; dated: number; rate: number | null; previousRate: number | null }>;
  weeks: readonly WeekBucket[];
  weeklyAverage: number;
  status: readonly StatusRow[];
  people: readonly PersonLoad[];
  upcoming: Readonly<{ overdue: number; total: number; days: readonly DueDay[] }>;
  priorities: readonly PriorityRow[];
  durations: readonly DurationBucket[];
  changes: readonly ChangeLine[];
  coverage: Readonly<{ finishedWithoutDate: number; truncated: boolean; columnsUnreadable: boolean }>;
}>;

// ── Calendar arithmetic ────────────────────────────────────────────────────

/** A day number (days since 1970-01-01) for an instant, in a time zone. */
function dayOrdinalFactory(timeZone: string): (ms: number) => number {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return (ms: number) => {
    const parts = format.formatToParts(new Date(ms));
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    return Math.round(Date.UTC(read("year"), read("month") - 1, read("day")) / DAY_MS);
  };
}

export function ordinalToDate(ordinal: number): CalendarDate {
  return new Date(ordinal * DAY_MS).toISOString().slice(0, 10) as CalendarDate;
}

function ordinalWeekday(ordinal: number): number {
  return new Date(ordinal * DAY_MS).getUTCDay();
}

/** "8 Sep" for a calendar date. The date is already local; format in UTC. */
export function formatDay(date: CalendarDate, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
}

/** "8–14 Sep", or "29 Aug – 4 Sep" across a month. */
export function formatDayRange(start: CalendarDate, end: CalendarDate): string {
  if (start === end) return formatDay(start);
  if (start.slice(0, 7) === end.slice(0, 7)) {
    return `${formatDay(start, { day: "numeric" })}–${formatDay(end)}`;
  }
  return `${formatDay(start)} – ${formatDay(end)}`;
}

// ── Small helpers ──────────────────────────────────────────────────────────

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}

/** "Under a day", "1 day", "2.5 days", "12 days". */
export function formatDays(days: number): string {
  if (days < 1) return "Under a day";
  const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

/** Axis ticks: zero, then up to four even steps that cover the maximum. */
export function niceTicks(max: number, maxTicks = 4): number[] {
  const top = Math.max(max, 1);
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const step = steps.find((candidate) => Math.ceil(top / candidate) <= maxTicks) ?? Math.ceil(top / maxTicks);
  const count = Math.max(Math.ceil(top / step), 1);
  return Array.from({ length: count + 1 }, (_, index) => index * step);
}

const DURATION_BUCKETS: ReadonlyArray<Readonly<{ key: string; label: string; shortLabel: string; below: number }>> = [
  { key: "day", label: "Under a day", shortLabel: "<1d", below: 1 },
  { key: "3d", label: "1 to 3 days", shortLabel: "1–3d", below: 3 },
  { key: "week", label: "3 to 7 days", shortLabel: "3–7d", below: 7 },
  { key: "2w", label: "1 to 2 weeks", shortLabel: "1–2w", below: 14 },
  { key: "4w", label: "2 to 4 weeks", shortLabel: "2–4w", below: 28 },
  { key: "more", label: "Over 4 weeks", shortLabel: "4w+", below: Number.POSITIVE_INFINITY },
];

const PRIORITY_ORDER: readonly Priority[] = ["p0", "p1", "p2", "p3"];

function humaniseKey(key: string): string {
  const spaced = key.replace(/[-_]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Other";
}

// ── The calculation ────────────────────────────────────────────────────────

export function computeProjectAnalytics(input: AnalyticsInput): ProjectAnalytics {
  const rangeSpec = ANALYTICS_RANGES.find((range) => range.key === input.range) ?? ANALYTICS_RANGES[1]!;
  const weeks = rangeSpec.weeks;
  const dayOf = dayOrdinalFactory(input.timeZone);
  const today = dayOf(input.now);

  /** Whole weeks back from today: 0 is the last seven days. */
  const weeksAgo = (ms: number | null): number | null => {
    if (ms == null) return null;
    const diff = today - dayOf(ms);
    return diff < 0 ? null : Math.floor(diff / 7);
  };
  const inPeriod = (ago: number | null) => ago != null && ago < weeks;
  const inPrevious = (ago: number | null) => ago != null && ago >= weeks && ago < weeks * 2;

  const finishedWeek = new Map<string, number | null>();
  for (const task of input.tasks) {
    finishedWeek.set(task.id, task.done && task.completedAt != null ? weeksAgo(task.completedAt) : null);
  }
  const finishedIn = (predicate: (ago: number | null) => boolean) =>
    input.tasks.filter((task) => task.done && task.completedAt != null && predicate(finishedWeek.get(task.id) ?? null));

  const periodFinished = finishedIn(inPeriod);
  const previousFinished = finishedIn(inPrevious);
  const open = input.tasks.filter((task) => !task.done && !task.archived);

  const dueDay = (task: AnalyticsTask) => (task.dueAt == null ? null : dayOf(task.dueAt));
  const isOverdue = (task: AnalyticsTask) => {
    const due = dueDay(task);
    return due != null && due < today;
  };

  // Weekly buckets, oldest first.
  const buckets = Array.from({ length: weeks }, (_, index) => {
    const ago = weeks - 1 - index;
    const end = today - ago * 7;
    return { start: ordinalToDate(end - 6), end: ordinalToDate(end), ago, finished: 0, added: 0 };
  });
  const bucketByAgo = new Map(buckets.map((bucket) => [bucket.ago, bucket]));
  let addedCount = 0;
  let addedPrevious = 0;
  for (const task of input.tasks) {
    const createdAgo = weeksAgo(task.createdAt);
    if (inPeriod(createdAgo)) {
      addedCount += 1;
      bucketByAgo.get(createdAgo!)!.added += 1;
    } else if (inPrevious(createdAgo)) {
      addedPrevious += 1;
    }
  }
  for (const task of periodFinished) bucketByAgo.get(finishedWeek.get(task.id)!)!.finished += 1;

  // Time to finish.
  const durationOf = (task: AnalyticsTask) =>
    task.createdAt != null && task.completedAt != null ? Math.max(0, (task.completedAt - task.createdAt) / DAY_MS) : null;
  const periodDurations = periodFinished.map(durationOf).filter((value): value is number => value != null);
  const previousDurations = previousFinished.map(durationOf).filter((value): value is number => value != null);
  const medianDays = median(periodDurations);
  const durations = DURATION_BUCKETS.map((bucket, index) => {
    const floor = index === 0 ? 0 : DURATION_BUCKETS[index - 1]!.below;
    return {
      key: bucket.key,
      label: bucket.label,
      shortLabel: bucket.shortLabel,
      count: periodDurations.filter((days) => days >= floor && days < bucket.below).length,
      holdsMedian: medianDays != null && medianDays >= floor && medianDays < bucket.below,
    };
  });

  // On time: finished on or before the due date's calendar day.
  const onTimeOf = (tasks: readonly AnalyticsTask[]) => {
    const dated = tasks.filter((task) => task.dueAt != null);
    const onTime = dated.filter((task) => dayOf(task.completedAt!) <= dueDay(task)!).length;
    return { onTime, dated: dated.length, rate: dated.length > 0 ? onTime / dated.length : null };
  };
  const onTimeNow = onTimeOf(periodFinished);
  const onTimePrevious = onTimeOf(previousFinished);

  // Overdue.
  const overdueTasks = open.filter(isOverdue).sort((a, b) => a.dueAt! - b.dueAt!);
  const oldest = overdueTasks[0] ?? null;

  // Where tasks are: every live task, per column, in the board's order.
  const active = input.tasks.filter((task) => !task.archived);
  const countByColumn = new Map<string, number>();
  for (const task of active) countByColumn.set(task.columnKey, (countByColumn.get(task.columnKey) ?? 0) + 1);
  const knownKeys = new Set(input.columns.map((column) => column.key));
  const orphanKeys = [...countByColumn.keys()].filter((key) => !knownKeys.has(key)).sort();
  const status: StatusRow[] = [
    ...input.columns.map((column) => ({ ...column, count: countByColumn.get(column.key) ?? 0 })),
    ...orphanKeys.map((key) => ({
      key,
      name: humaniseKey(key),
      isDone: false,
      tone: "neutral" as const,
      count: countByColumn.get(key) ?? 0,
    })),
  ].map((row) => ({ ...row, share: active.length > 0 ? row.count / active.length : 0 }));

  // Who has what.
  const names = new Map(input.people.map((person) => [person.id, person.name]));
  const loads = new Map<string | null, { open: number; overdue: number; dueSoon: number; finished: number }>();
  const loadFor = (id: string | null) => {
    let load = loads.get(id);
    if (!load) {
      load = { open: 0, overdue: 0, dueSoon: 0, finished: 0 };
      loads.set(id, load);
    }
    return load;
  };
  for (const task of open) {
    const due = dueDay(task);
    const owners = task.assigneeIds.length > 0 ? task.assigneeIds : [null];
    for (const owner of owners) {
      const load = loadFor(owner);
      load.open += 1;
      if (due != null && due < today) load.overdue += 1;
      else if (due != null && due - today < 7) load.dueSoon += 1;
    }
  }
  for (const task of periodFinished) {
    for (const owner of task.assigneeIds) loadFor(owner).finished += 1;
  }
  const people: PersonLoad[] = [...loads.entries()]
    .map(([id, load]) => ({
      id,
      name: id == null ? "No one assigned" : names.get(id) ?? "Former member",
      ...load,
    }))
    .filter((person) => person.open > 0 || person.finished > 0)
    .sort((a, b) => {
      if ((a.id == null) !== (b.id == null)) return a.id == null ? 1 : -1;
      return b.open - a.open || b.finished - a.finished || a.name.localeCompare(b.name);
    });

  // Due in the next fourteen days.
  const dueCounts = new Array<number>(14).fill(0);
  for (const task of open) {
    const due = dueDay(task);
    if (due != null && due >= today && due - today < 14) dueCounts[due - today] += 1;
  }
  const days: DueDay[] = dueCounts.map((count, offset) => ({
    date: ordinalToDate(today + offset),
    count,
    weekday: ordinalWeekday(today + offset),
    isToday: offset === 0,
  }));

  const priorities: PriorityRow[] = PRIORITY_ORDER.map((priority) => ({
    priority,
    label: PRIORITY_LABEL[priority].label,
    open: open.filter((task) => task.priority === priority).length,
    overdue: open.filter((task) => task.priority === priority && isOverdue(task)).length,
  }));

  const analytics: Omit<ProjectAnalytics, "changes"> = {
    timeZone: input.timeZone,
    today: ordinalToDate(today),
    range: {
      key: rangeSpec.key,
      weeks,
      label: rangeSpec.label,
      phrase: rangeSpec.phrase,
      start: ordinalToDate(today - weeks * 7 + 1),
      end: ordinalToDate(today),
    },
    hasTasks: input.tasks.length > 0,
    open: { count: open.length, unassigned: open.filter((task) => task.assigneeIds.length === 0).length },
    finished: { count: periodFinished.length, previous: previousFinished.length },
    added: { count: addedCount, previous: addedPrevious },
    overdue: {
      count: overdueTasks.length,
      oldestDays: oldest ? today - dueDay(oldest)! : 0,
      oldest: oldest ? { id: oldest.id, title: oldest.title } : null,
    },
    timeToFinish: { medianDays, previousMedianDays: median(previousDurations), sample: periodDurations.length },
    onTime: { ...onTimeNow, previousRate: onTimePrevious.rate },
    weeks: buckets.map(({ start, end, finished, added }) => ({ start, end, finished, added })),
    weeklyAverage: periodFinished.length / weeks,
    status,
    people,
    upcoming: {
      overdue: overdueTasks.length,
      total: days.reduce((sum, day) => sum + day.count, 0),
      days,
    },
    priorities,
    durations,
    coverage: {
      finishedWithoutDate: input.tasks.filter((task) => task.done && task.completedAt == null).length,
      truncated: input.truncated ?? false,
      columnsUnreadable: input.columnsUnreadable ?? false,
    },
  };

  return { ...analytics, changes: describeChanges(input, analytics, { today, dayOf, open, finishedWeek }) };
}

/**
 * "What changed this week", as plain sentences. Always the last seven days
 * against the seven before, whatever range the charts show, and only lines
 * the numbers can carry: nothing is inferred about why.
 */
function describeChanges(
  input: AnalyticsInput,
  analytics: Omit<ProjectAnalytics, "changes">,
  context: {
    today: number;
    dayOf: (ms: number) => number;
    open: readonly AnalyticsTask[];
    finishedWeek: ReadonlyMap<string, number | null>;
  },
): ChangeLine[] {
  if (!analytics.hasTasks) return [];
  const lines: ChangeLine[] = [];
  const { today, dayOf, open, finishedWeek } = context;
  const createdAgo = (task: AnalyticsTask) => {
    if (task.createdAt == null) return null;
    const diff = today - dayOf(task.createdAt);
    return diff < 0 ? null : Math.floor(diff / 7);
  };
  const finishedThis = input.tasks.filter((task) => finishedWeek.get(task.id) === 0).length;
  const finishedBefore = input.tasks.filter((task) => finishedWeek.get(task.id) === 1).length;
  const addedThis = input.tasks.filter((task) => createdAgo(task) === 0).length;

  if (finishedThis === 0 && finishedBefore === 0) {
    lines.push({ tone: "neutral", text: "Nothing was finished in the last two weeks." });
  } else {
    const lead = `${finishedThis} ${plural(finishedThis, "task")} finished in the last 7 days`;
    const diff = finishedThis - finishedBefore;
    lines.push(
      diff > 0
        ? { tone: "good", text: `${lead}, ${diff} more than the week before.` }
        : diff < 0
          ? { tone: finishedThis === 0 ? "bad" : "neutral", text: `${lead}, ${-diff} fewer than the week before.` }
          : { tone: "neutral", text: `${lead}, the same as the week before.` },
    );
  }

  if (addedThis > 0 || finishedThis > 0) {
    if (addedThis < finishedThis) {
      lines.push({ tone: "good", text: `Finishing outpaced new work: ${addedThis} added against ${finishedThis} finished.` });
    } else if (addedThis > finishedThis) {
      lines.push({ tone: "bad", text: `New work outpaced finishing: ${addedThis} added against ${finishedThis} finished.` });
    } else {
      lines.push({ tone: "neutral", text: `New work and finishing kept pace, ${addedThis} each.` });
    }
  }

  const { overdue } = analytics;
  if (overdue.count > 0 && overdue.oldest) {
    const lateBy = `${overdue.oldestDays} ${plural(overdue.oldestDays, "day")} late`;
    lines.push({
      tone: "bad",
      text:
        overdue.count === 1
          ? "1 task is past its date: "
          : `${overdue.count} tasks are past their date. The oldest is `,
      task: { ...overdue.oldest, after: `, ${lateBy}.` },
    });
  } else if (open.some((task) => task.dueAt != null)) {
    lines.push({ tone: "good", text: "Nothing open is past its date." });
  }

  const nextWeek = analytics.upcoming.days.slice(0, 7);
  const dueNextWeek = nextWeek.reduce((sum, day) => sum + day.count, 0);
  if (dueNextWeek > 0) {
    const busiest = nextWeek.reduce((best, day) => (day.count > best.count ? day : best), nextWeek[0]!);
    const when =
      dueNextWeek >= 3 && busiest.count >= 2
        ? `, most ${busiest.isToday ? "of them today" : `on ${formatDay(busiest.date, { weekday: "long" })}`}.`
        : ".";
    lines.push({
      tone: "neutral",
      text: `${dueNextWeek} ${plural(dueNextWeek, "task is", "tasks are")} due in the next 7 days${when}`,
    });
  } else if (open.length > 0) {
    lines.push({ tone: "neutral", text: "Nothing is due in the next 7 days." });
  }

  if (analytics.open.unassigned > 0) {
    const count = analytics.open.unassigned;
    lines.push({ tone: "bad", text: `${count} open ${plural(count, "task has", "tasks have")} no one assigned.` });
  }

  const named = analytics.people.filter((person) => person.id != null && person.open > 0);
  const top = named[0];
  if (top && named.length >= 2 && analytics.open.count >= 5 && top.open / analytics.open.count >= 0.6) {
    lines.push({ tone: "neutral", text: `${top.name} holds ${top.open} of the ${analytics.open.count} open tasks.` });
  }

  return lines.slice(0, 5);
}
