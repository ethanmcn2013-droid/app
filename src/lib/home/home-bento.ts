/**
 * Home (20 October 2026): the launch countdown, done this week, a year of
 * activity and four ways to start something.
 *
 * Pure: every figure on Home is computed here from plain facts the server
 * read (`src/server/home/home-bento-read.ts`), so one model decides every
 * number and no two sections can disagree. Days are calendar days in the
 * reader's own time zone; weeks start on Monday.
 */

import { dayOrdinalIn, ordinalToIsoDate } from "@/lib/projects/project-console";
import { formatLongDay, greetingForHour, hourIn } from "@/lib/home/home-words";

export const ACTIVITY_WEEKS = 53;
/** The hour grid covers 08:00 to 21:59, one column per hour. */
export const HOUR_FIRST = 8;
export const HOUR_COUNT = 14;
/** The hour grid reads the last eight weeks. */
export const HOUR_WINDOW_DAYS = 56;
/** At most this many launches are offered in the countdown. */
export const LAUNCH_LIMIT = 5;
/** Behind plan once the gap is a whole task or more. */
const BEHIND_AT = 1;

// ── Input ─────────────────────────────────────────────────────────────────

export type HomeMilestoneFact = Readonly<{ title: string; date: string; done: boolean }>;

export type HomeLaunchFact = Readonly<{
  id: string;
  name: string;
  /** Opens the Project's plan. */
  href: string;
  /** Opens the Project's tasks. */
  tasksHref: string;
  /** `YYYY-MM-DD` when the work began. */
  start: string;
  /** `YYYY-MM-DD` target date. */
  target: string;
  total: number;
  complete: number;
  /** Finish instants (ms) of this Project's done tasks. */
  completions: readonly number[];
  milestones: readonly HomeMilestoneFact[];
  /** Open tasks due between Monday and Sunday of this week. */
  dueThisWeek: number;
}>;

export type HomeMessagesFact = Readonly<{
  /** Chat is switched on for this reader. */
  available: boolean;
  /** Mentions and replies the reader has not opened. */
  unread: number;
  /** Conversations those sit in. */
  conversations: number;
}>;

export type HomeBentoInput = Readonly<{
  now: number;
  timeZone: string;
  /** Review pins its greeting to the morning. */
  greetingHour?: number;
  firstName: string | null;
  /** False when the reader has no Project yet. */
  hasProjects: boolean;
  launches: readonly HomeLaunchFact[];
  /** Finish instants (ms) across every Project the reader can open, last year or more. Null when unread. */
  completions: readonly number[] | null;
  /** Open tasks due this week across every Project, not only those with a target date. Null when unread. */
  dueThisWeek: number | null;
  /** Null when its read failed: the figure is left out, never guessed. */
  openTasks: number | null;
  activeProjects: number | null;
  finishedProjects: number | null;
  filesThisMonth: number | null;
  messages: HomeMessagesFact | null;
}>;

// ── Output ────────────────────────────────────────────────────────────────

export type StageState = "done" | "next" | "late" | "later";

export type LaunchStage = Readonly<{ title: string; date: string; x: number; state: StageState }>;

export type LaunchView = Readonly<{
  id: string;
  name: string;
  href: string;
  tasksHref: string;
  daysLeft: number;
  target: string;
  start: string;
  total: number;
  done: number;
  /** Tasks the straight-line plan expects done by today. */
  plan: number;
  /** done − plan, in tasks. */
  diff: number;
  behind: boolean;
  dueThisWeek: number;
  /** Today on the chart, 0–100. */
  todayX: number;
  /** Done-so-far line, x and y on 0–100 (y = 100 at zero, 0 at all done). */
  series: readonly (readonly [number, number])[];
  stages: readonly LaunchStage[];
  nextStage: LaunchStage | null;
}>;

export type WeekDay = Readonly<{ label: string; long: string; thisWeek: number | null; lastWeek: number }>;

export type WeekView = Readonly<{
  days: readonly WeekDay[];
  todayIndex: number;
  thisSum: number;
  lastBy: number;
  lastTotal: number;
  tone: "fresh" | "ahead" | "level" | "behind";
}>;

export type ActivityCell = Readonly<{ date: string; count: number; future: boolean; today: boolean }>;

export type ActivityView = Readonly<{
  /** 53 weeks × 7 days, Monday first, ending this week. */
  cells: readonly ActivityCell[];
  weeks: readonly number[];
  currentWeek: number;
  yearTotal: number;
  streakWeeks: number;
  streakFrom: string | null;
  bestRun: number;
  bestWeek: number | null;
  busiest: Readonly<{ date: string; count: number }> | null;
  /** [weekday 0–6][hour 0–13] finished in the last eight weeks. */
  hours: readonly (readonly number[])[];
  hourTotal: number;
  peak: Readonly<{ day: number; hour: number }> | null;
}>;

export type StartFigure = Readonly<{ value: number; caption: string }> | null;

export type HomeBento = Readonly<{
  greeting: string;
  dateLabel: string;
  hasProjects: boolean;
  launches: readonly LaunchView[];
  week: WeekView;
  activity: ActivityView;
  dueThisWeekTotal: number;
  /** False when the finish history could not be read: week and activity say so. */
  historyKnown: boolean;
  start: Readonly<{
    tasks: StartFigure;
    projects: StartFigure;
    files: StartFigure;
    chat: StartFigure;
    chatAvailable: boolean;
  }>;
}>;

// ── Helpers ───────────────────────────────────────────────────────────────

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Day 0 (1 January 1970) was a Thursday; Monday is 0. */
export function weekdayOfOrdinal(ordinal: number): number {
  return (((ordinal + 3) % 7) + 7) % 7;
}

function ordinalOfIso(iso: string): number {
  return Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── Launches ──────────────────────────────────────────────────────────────

function buildLaunch(fact: HomeLaunchFact, today: number, dayOf: (ms: number) => number): LaunchView | null {
  const start = ordinalOfIso(fact.start);
  const target = ordinalOfIso(fact.target);
  const span = target - start;
  if (!(span > 0) || target < today || fact.total <= 0) return null;
  const done = clamp(fact.complete, 0, fact.total);
  const tx = clamp((today - start) / span, 0, 1);
  const plan = fact.total * tx;
  const diff = done - plan;

  // Done-so-far, one point per week from the first day and one for today.
  // The history can lag the live count (a task finished without a recorded
  // moment), so it is capped at, and ends on, the live count.
  const finishDays = fact.completions.map(dayOf).sort((a, b) => a - b);
  const countBy = (day: number) => {
    let n = 0;
    for (const d of finishDays) if (d <= day) n++;
    return Math.min(n, done);
  };
  const series: [number, number][] = [];
  const toY = (n: number) => 100 - (n / fact.total) * 100;
  // Without a finish history only the two ends are known: none at the start, the live count today.
  const step = finishDays.length > 0 ? 7 : Number.POSITIVE_INFINITY;
  series.push([0, toY(Math.min(countBy(start), finishDays.length > 0 ? done : 0))]);
  for (let day = start + step; day < Math.min(today, target); day += step) {
    series.push([((day - start) / span) * 100, toY(countBy(day))]);
  }
  series.push([tx * 100, toY(done)]);

  let nextSet = false;
  const stages: LaunchStage[] = [...fact.milestones]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => {
      const day = ordinalOfIso(m.date);
      const late = !m.done && day < today;
      const state: StageState = m.done ? "done" : late ? "late" : !nextSet && (nextSet = true) ? "next" : "later";
      return { title: m.title, date: m.date.slice(0, 10), x: clamp(((day - start) / span) * 100, 0, 100), state };
    });

  return {
    id: fact.id,
    name: fact.name,
    href: fact.href,
    tasksHref: fact.tasksHref,
    daysLeft: target - today,
    target: fact.target.slice(0, 10),
    start: fact.start.slice(0, 10),
    total: fact.total,
    done,
    plan,
    diff,
    behind: diff <= -BEHIND_AT,
    dueThisWeek: fact.dueThisWeek,
    todayX: tx * 100,
    series,
    stages,
    nextStage: stages.find((s) => s.state === "late") ?? stages.find((s) => s.state === "next") ?? null,
  };
}

// ── Week and activity ─────────────────────────────────────────────────────

function buildWeek(byDay: ReadonlyMap<number, number>, today: number): WeekView {
  const todayIndex = weekdayOfOrdinal(today);
  const monday = today - todayIndex;
  const at = (ordinal: number) => byDay.get(ordinal) ?? 0;
  const days = WEEKDAY_SHORT.map((label, i) => ({
    label,
    long: WEEKDAY_LONG[i]!,
    thisWeek: i <= todayIndex ? at(monday + i) : null,
    lastWeek: at(monday - 7 + i),
  }));
  const thisSum = days.reduce((a, d) => a + (d.thisWeek ?? 0), 0);
  const lastBy = days.slice(0, todayIndex + 1).reduce((a, d) => a + d.lastWeek, 0);
  const lastTotal = days.reduce((a, d) => a + d.lastWeek, 0);
  // "New week" belongs to Monday; later in the week, nothing yet is simply behind (or level at zero).
  const tone = thisSum === 0 && todayIndex === 0 ? "fresh" : thisSum > lastBy ? "ahead" : thisSum === lastBy ? "level" : "behind";
  return { days, todayIndex, thisSum, lastBy, lastTotal, tone };
}

function buildActivity(
  completions: readonly number[],
  today: number,
  dayOf: (ms: number) => number,
  timeZone: string,
): ActivityView {
  const byDay = new Map<number, number>();
  for (const ms of completions) {
    const d = dayOf(ms);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const first = today - weekdayOfOrdinal(today) - (ACTIVITY_WEEKS - 1) * 7;
  const cells: ActivityCell[] = [];
  for (let i = 0; i < ACTIVITY_WEEKS * 7; i++) {
    const ordinal = first + i;
    cells.push({
      date: ordinalToIsoDate(ordinal),
      count: ordinal > today ? 0 : byDay.get(ordinal) ?? 0,
      future: ordinal > today,
      today: ordinal === today,
    });
  }
  const weeks = Array.from({ length: ACTIVITY_WEEKS }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7).reduce((a, c) => a + c.count, 0),
  );
  const currentWeek = ACTIVITY_WEEKS - 1;
  const yearTotal = weeks.reduce((a, b) => a + b, 0);

  let streakWeeks = 0;
  const from = weeks[currentWeek]! > 0 ? currentWeek : currentWeek - 1;
  for (let w = from; w >= 0 && weeks[w]! > 0; w--) streakWeeks++;
  const streakFrom = streakWeeks > 0 ? cells[(from - streakWeeks + 1) * 7]!.date : null;
  let bestRun = 0;
  let run = 0;
  for (const s of weeks) {
    run = s > 0 ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }
  let bestWeek: number | null = null;
  weeks.slice(0, currentWeek).forEach((s, i) => {
    if (s > 0 && (bestWeek === null || s > weeks[bestWeek]!)) bestWeek = i;
  });
  let busiest: { date: string; count: number } | null = null;
  for (const c of cells) if (!c.future && c.count > 0 && (!busiest || c.count > busiest.count)) busiest = { date: c.date, count: c.count };

  const hours = Array.from({ length: 7 }, () => Array.from({ length: HOUR_COUNT }, () => 0));
  let hourTotal = 0;
  for (const ms of completions) {
    const d = dayOf(ms);
    if (today - d < 0 || today - d >= HOUR_WINDOW_DAYS) continue;
    const h = clamp(hourIn(timeZone, ms) - HOUR_FIRST, 0, HOUR_COUNT - 1);
    hours[weekdayOfOrdinal(d)]![h]! += 1;
    hourTotal++;
  }
  let peak: { day: number; hour: number } | null = null;
  let peakN = 0;
  hours.forEach((row, day) =>
    row.forEach((_, h) => {
      if (h >= HOUR_COUNT - 1) return;
      const n = row[h]! + row[h + 1]!;
      if (n > peakN) {
        peakN = n;
        peak = { day, hour: h };
      }
    }),
  );

  return { cells, weeks, currentWeek, yearTotal, streakWeeks, streakFrom, bestRun, bestWeek, busiest, hours, hourTotal, peak };
}

// ── The model ─────────────────────────────────────────────────────────────

export function buildHomeBento(input: HomeBentoInput): HomeBento {
  const dayOf = dayOrdinalIn(input.timeZone);
  const today = dayOf(input.now);
  const hour = input.greetingHour ?? hourIn(input.timeZone, input.now);
  const greeting = input.firstName ? `${greetingForHour(hour)}, ${input.firstName}` : greetingForHour(hour);

  const launches = input.launches
    .map((fact) => buildLaunch(fact, today, dayOf))
    .filter((l): l is LaunchView => l !== null)
    .sort((a, b) => a.target.localeCompare(b.target) || a.name.localeCompare(b.name))
    .slice(0, LAUNCH_LIMIT);

  const byDay = new Map<number, number>();
  const history = input.completions ?? [];
  for (const ms of history) {
    const d = dayOf(ms);
    byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }

  const m = input.messages;
  return {
    greeting,
    dateLabel: formatLongDay(ordinalToIsoDate(today)),
    hasProjects: input.hasProjects,
    launches,
    week: buildWeek(byDay, today),
    activity: buildActivity(history, today, dayOf, input.timeZone),
    historyKnown: input.completions !== null,
    dueThisWeekTotal: input.dueThisWeek ?? 0,
    start: {
      tasks: input.openTasks === null ? null : { value: input.openTasks, caption: input.activeProjects ? `open across ${plural(input.activeProjects, "project")}` : "open" },
      projects:
        input.activeProjects === null
          ? null
          : { value: input.activeProjects, caption: input.finishedProjects ? `active, ${input.finishedProjects} finished` : "active" },
      files: input.filesThisMonth === null ? null : { value: input.filesThisMonth, caption: "added in the last 30 days" },
      chat:
        !m || !m.available
          ? null
          : { value: m.unread, caption: m.unread === 0 ? "nothing waiting for you" : `new ${m.unread === 1 ? "mention or reply" : "mentions and replies"} in ${plural(m.conversations, "chat")}` },
      chatAvailable: !!m?.available,
    },
  };
}

// ── Words the view shares ─────────────────────────────────────────────────

export function launchStatus(l: Pick<LaunchView, "behind" | "diff">): string {
  const ahead = Math.round(l.diff);
  if (l.behind) return `${plural(Math.round(-l.diff), "task")} behind plan`;
  if (ahead >= 1) return `On track · ${plural(ahead, "task")} ahead`;
  return "On track";
}

export function launchAction(l: Pick<LaunchView, "behind" | "dueThisWeek" | "total" | "done">): string {
  if (l.behind) return l.dueThisWeek ? `Catch up: ${l.dueThisWeek} due this week` : `See the ${l.total - l.done} tasks left`;
  if (l.dueThisWeek) return `Up next: ${l.dueThisWeek} due this week`;
  return `See the ${l.total - l.done} tasks left`;
}

export { WEEKDAY_LONG, WEEKDAY_SHORT, weekdayOfOrdinal as weekdayIndexOf };
