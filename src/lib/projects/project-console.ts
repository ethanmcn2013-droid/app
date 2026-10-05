/**
 * The Projects console's presentation model (v3 redesign, 3 Oct 2026).
 *
 * `/app/project` opens on the Console: every Project the caller can open as
 * one measured row, under a few figures that say what matters this week. This
 * module turns the hub's authorized rows into those rows, tabs and figures.
 *
 * Every figure has a real source, stated once:
 *   - how a Project is doing: the status its owner set, plus whether its
 *     target date has passed (`targetDatePassed`, the overview's own rule);
 *   - done of total and the late count: the hub's task counts (the open
 *     Project uses its overview figures);
 *   - next big date: the earliest unfinished task marked as a big date, else
 *     the target date;
 *   - lead: the Project's owner;
 *   - this week: tasks finished in the last seven days, in the reader's time
 *     zone, the same rolling week Analytics draws.
 *
 * Nothing here is forecast or guessed. A figure with no source is absent, and
 * the summary card that would need it is dropped.
 *
 * Pure and client-safe: no clock, database or network. The reads live in
 * `src/server/projects/project-hub.ts`.
 */

import type { ProjectRole } from "@/lib/projects/project-ref";
import { targetDatePassed, type ProjectCardStats } from "@/lib/projects/project-hub";

// ── Views and tabs (in the address, so a link can name one) ────────────────

export type ConsoleView = "console" | "cards";

export function parseConsoleView(raw: unknown): ConsoleView {
  return raw === "cards" ? "cards" : "console";
}

export type ConsoleFilter = "all" | "attention" | "mine" | "wrapped";

export const CONSOLE_FILTERS: readonly ConsoleFilter[] = ["all", "attention", "mine", "wrapped"];

export const CONSOLE_FILTER_LABEL: Readonly<Record<ConsoleFilter, string>> = {
  all: "All",
  attention: "Needs a look",
  mine: "Led by you",
  wrapped: "Wrapped",
};

/** The `?show=` value for each tab. All is the bare address. */
export const CONSOLE_FILTER_PARAM: Readonly<Record<ConsoleFilter, string | null>> = {
  all: null,
  attention: "needs-a-look",
  mine: "yours",
  wrapped: "wrapped",
};

export function parseConsoleFilter(raw: unknown): ConsoleFilter {
  return CONSOLE_FILTERS.find((filter) => CONSOLE_FILTER_PARAM[filter] === raw) ?? "all";
}

// ── What the server reads beyond the card stats ────────────────────────────

export type ConsoleFacts = Readonly<{
  /** The Project's owner. Null when the owner could not be read. */
  lead: Readonly<{ name: string; initials: string }> | null;
  /** Earliest unfinished task marked as a big date. `date` is `YYYY-MM-DD`. */
  nextDate: Readonly<{ title: string; date: string }> | null;
  /** The unfinished task furthest past its date. */
  oldestLate: Readonly<{ id: string; title: string; dueDate: string }> | null;
  /** The oldest late task someone else is assigned to, for a reminder. */
  nudge: Readonly<{ taskId: string; title: string; who: string }> | null;
  /** Tasks finished per day, oldest first, ending today. Fourteen entries. */
  doneByDay: readonly number[];
}>;

export const CONSOLE_DAYS = 14;

export type ConsoleHubFacts = Readonly<{
  /** Today in the reader's time zone, `YYYY-MM-DD`. */
  today: string;
  byProject: Readonly<Record<string, ConsoleFacts>>;
}>;

// ── Input and output ───────────────────────────────────────────────────────

export type ConsoleProjectInput = Readonly<{
  id: string;
  name: string;
  role: ProjectRole;
  /** False for a Project whose name could not be made unique. */
  selectable: boolean;
  blockedReason: string | null;
  /** The chooser's open count, used only when stats could not be read. */
  openCount: number;
  stats: ProjectCardStats | null;
  facts: ConsoleFacts | null;
}>;

export type ConsoleStanding = "attention" | "on_track" | "paused" | "unset" | "wrapped";
export type ConsoleMark = "past_date" | "at_risk" | "on_track" | "paused" | "unset" | "wrapped";
export type ConsoleTone = "late" | "risk" | "calm" | "quiet";

export const CONSOLE_GROUPS: ReadonlyArray<Readonly<{ id: ConsoleStanding; label: string }>> = [
  { id: "attention", label: "Needs a look" },
  { id: "on_track", label: "On track" },
  { id: "paused", label: "Paused" },
  { id: "unset", label: "No status yet" },
  { id: "wrapped", label: "Wrapped" },
];

export const CONSOLE_MARK_LABEL: Readonly<Record<ConsoleMark, string>> = {
  past_date: "Past its target date",
  at_risk: "At risk",
  on_track: "On track",
  paused: "Paused",
  unset: "No status yet",
  wrapped: "Wrapped",
};

export type ConsoleCell = Readonly<{
  value: string;
  /** A value that is an absence ("None"), drawn quietly. */
  quiet: boolean;
  caption: string;
  /** 0 to 1. */
  bar: number;
  /** What the bar says, for a screen reader. Empty when the bar is empty. */
  barLabel: string;
  tone?: "late" | "risk";
}>;

export type ConsoleRow = Readonly<{
  id: string;
  name: string;
  standing: ConsoleStanding;
  mark: ConsoleMark;
  markLabel: string;
  /** The line under the name: how it is doing, and its target date. */
  sub: string;
  ledByYou: boolean;
  selectable: boolean;
  blockedReason: string | null;
  open: number;
  late: number;
  done: ConsoleCell;
  next: ConsoleCell;
  lateCell: ConsoleCell;
  lead: Readonly<{ initials: string | null; name: string; caption: string }>;
  /** The date the row sorts by, or null. */
  nextDate: string | null;
  nudge: ConsoleFacts["nudge"];
  oldestLateTaskId: string | null;
}>;

export type ConsoleSegment = Readonly<{ key: string; tone: ConsoleTone; weight: number; title: string }>;

export type ConsoleCards = Readonly<{
  attention: Readonly<{
    count: number;
    active: number;
    segments: readonly ConsoleSegment[];
    segmentsLabel: string;
    caption: Readonly<{ strong: string; rest: string }> | null;
  }>;
  /** Null when no active Project has a date ahead. */
  nextDate: Readonly<{
    projectId: string;
    projectName: string;
    days: number;
    title: string;
    dateLabel: string;
    complete: number;
    total: number;
  }> | null;
  /** Null when some Project's task counts could not be read. */
  late: Readonly<{
    total: number;
    projects: number;
    segments: readonly ConsoleSegment[];
    segmentsLabel: string;
    oldest: Readonly<{ projectId: string; taskId: string; title: string; age: string }> | null;
  }> | null;
  /** Null when some Project's finished work could not be read. */
  week: Readonly<{
    total: number;
    previous: number;
    rangeLabel: string;
    days: ReadonlyArray<Readonly<{ date: string; done: number; share: number; isToday: boolean; title: string }>>;
    daysLabel: string;
    busiest: Readonly<{ name: string; done: number }> | null;
  }> | null;
}>;

export type ConsoleModel = Readonly<{
  today: string;
  rows: readonly ConsoleRow[];
  counts: Readonly<Record<ConsoleFilter, number>>;
  /** The line under the title, in parts so each can carry its own colour. */
  summary: ReadonlyArray<Readonly<{ text: string; tone?: "late" | "risk" }>>;
  cards: ConsoleCards;
}>;

// ── Dates and words ────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function toUtc(isoDate: string): number {
  return Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = toUtc(from);
  const b = toUtc(to);
  return Number.isNaN(a) || Number.isNaN(b) ? 0 : Math.round((b - a) / DAY_MS);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(toUtc(isoDate) + days * DAY_MS).toISOString().slice(0, 10);
}

// Month and weekday names are spelled here, not asked of `Intl`: runtimes
// disagree ("Sep" in one, "Sept" in another), and the server and the browser
// must print the same string or the page fails hydration.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayName(ms: number): string {
  return WEEKDAYS[new Date(ms).getUTCDay()]!;
}

function dayMonth(ms: number): string {
  const date = new Date(ms);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "3 Oct" in the reader's own year, "3 Oct 2027" in another. */
export function formatConsoleDate(isoDate: string, today: string): string {
  const ms = toUtc(isoDate);
  if (Number.isNaN(ms)) return isoDate;
  return isoDate.slice(0, 4) === today.slice(0, 4) ? dayMonth(ms) : `${dayMonth(ms)} ${new Date(ms).getUTCFullYear()}`;
}

/** "Sat 3 Oct" in the reader's own year, "3 Oct 2027" in another. */
export function formatConsoleDay(isoDate: string, today: string): string {
  const ms = toUtc(isoDate);
  if (Number.isNaN(ms)) return isoDate;
  return isoDate.slice(0, 4) === today.slice(0, 4) ? `${weekdayName(ms).slice(0, 3)} ${dayMonth(ms)}` : formatConsoleDate(isoDate, today);
}

export function formatDayCount(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

/** "Today", "Tomorrow", "in 5 days", "7 days late". */
export function formatCountdown(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return days > 0 ? `in ${formatDayCount(days)}` : `${formatDayCount(-days)} late`;
}

function taskCount(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}

/** Two initials for a person's name: "Orla Byrne" → "OB". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.map((word) => [...word][0] ?? "").filter((ch) => /\p{L}|\p{N}/u.test(ch));
  const picked = letters.length > 1 ? [letters[0], letters[letters.length - 1]] : letters;
  return picked.join("").toUpperCase();
}

// ── One row ────────────────────────────────────────────────────────────────

/** How near a date is, as a bar: empty a month out, full on the day. */
const NEAR_WINDOW_DAYS = 30;

function roleCaption(role: ProjectRole): string {
  if (role === "primary-owner") return "You own this";
  return role === "owner" ? "You co-own this" : "You’re a member";
}

function buildRow(input: ConsoleProjectInput, today: string): ConsoleRow {
  const { stats, facts } = input;
  const status = stats?.status ?? null;
  const wrapped = status === "complete";
  const targetDate = stats?.targetDate?.slice(0, 10) ?? null;
  const pastDate = targetDatePassed(targetDate, status, today);

  const mark: ConsoleMark = wrapped
    ? "wrapped"
    : pastDate
      ? "past_date"
      : status === "at-risk"
        ? "at_risk"
        : status === "on-track"
          ? "on_track"
          : status === "paused"
            ? "paused"
            : "unset";
  const standing: ConsoleStanding =
    mark === "past_date" || mark === "at_risk" ? "attention" : mark === "wrapped" ? "wrapped" : mark;

  // Under the name: the owner's word for it, then the date they set. Once the
  // date has passed the line leads with that, so it never reads "On track"
  // beside a red mark; the owner's word stays only where it adds something
  // (at risk, paused).
  const statusWord = wrapped
    ? "Wrapped"
    : status === "at-risk"
      ? "At risk"
      : status === "on-track"
        ? "On track"
        : status === "paused"
          ? "Paused"
          : "No status yet";
  const dateLabel = targetDate ? formatConsoleDate(targetDate, today) : null;
  const ownLine = pastDate
    ? status === "at-risk" || status === "paused"
      ? `${statusWord} · past its date, was due ${dateLabel}`
      : `Past its date · was due ${dateLabel}`
    : [statusWord, dateLabel ? `target ${dateLabel}` : null].filter(Boolean).join(" · ");
  const sub = !input.selectable && input.blockedReason ? input.blockedReason : ownLine;

  // Done.
  const total = stats?.total ?? 0;
  const complete = stats?.complete ?? 0;
  const open = stats ? Math.max(0, total - complete) : input.openCount;
  const late = stats?.overdue ?? 0;
  const done: ConsoleCell = !stats
    ? {
        value: open === 0 ? "Nothing open" : `${open} open`,
        quiet: open === 0,
        caption: "The rest shows once it’s open",
        bar: 0,
        barLabel: "",
      }
    : {
        value: `${complete} of ${total}`,
        quiet: false,
        caption: wrapped
          ? "Wrapped"
          : total === 0
            ? "No tasks yet"
            : open === 0
              ? "All done"
              : `${open} still open`,
        bar: total === 0 ? 0 : complete / total,
        barLabel: `${complete} of ${taskCount(total)} done`,
      };

  // Next big date: a task marked as one, else the target date.
  const nextSource =
    facts?.nextDate ?? (targetDate && !wrapped ? { title: "Target date", date: targetDate } : null);
  let next: ConsoleCell;
  if (wrapped || !nextSource) {
    next = {
      value: "None",
      quiet: true,
      caption: wrapped ? "Nothing left ahead" : "No big date set",
      bar: 0,
      barLabel: "",
    };
  } else {
    const days = daysBetween(today, nextSource.date);
    const isLate = days < 0;
    next = {
      value: formatCountdown(days),
      quiet: false,
      caption: `${nextSource.title} · ${formatConsoleDay(nextSource.date, today)}`,
      bar: isLate ? 1 : Math.max(0.04, Math.min(1, 1 - days / NEAR_WINDOW_DAYS)),
      barLabel: isLate
        ? `${nextSource.title} is ${formatDayCount(-days)} late`
        : `${nextSource.title} is ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${formatDayCount(days)}`}`,
      tone: isLate ? "late" : undefined,
    };
  }

  // Late.
  const oldest = facts?.oldestLate ?? null;
  const lateCell: ConsoleCell =
    late === 0
      ? { value: "None", quiet: true, caption: stats ? "Nothing late" : "", bar: 0, barLabel: "" }
      : {
          value: taskCount(late),
          quiet: false,
          caption: oldest
            ? `Oldest: ${oldest.title} · ${formatDayCount(Math.max(1, daysBetween(oldest.dueDate, today)))}`
            : late === 1
              ? "Past its date"
              : "Past their dates",
          bar: open > 0 ? Math.max(0.08, Math.min(1, late / open)) : 1,
          barLabel: `${late} of ${open} open ${open === 1 ? "task is" : "tasks are"} late`,
          tone: "late",
        };

  // Lead.
  const ledByYou = input.role === "primary-owner";
  const leadName = ledByYou ? "You" : facts?.lead?.name ?? "Owner not shown";
  const lead = {
    initials: facts?.lead?.initials || null,
    name: leadName,
    caption: roleCaption(input.role),
  };

  return {
    id: input.id,
    name: input.name,
    standing,
    mark,
    markLabel: CONSOLE_MARK_LABEL[mark],
    sub,
    ledByYou,
    selectable: input.selectable,
    blockedReason: input.blockedReason,
    open,
    late,
    done,
    next,
    lateCell,
    lead,
    nextDate: wrapped ? null : nextSource?.date ?? null,
    nudge: wrapped ? null : facts?.nudge ?? null,
    oldestLateTaskId: oldest?.id ?? null,
  };
}

// ── The whole console ──────────────────────────────────────────────────────

const MARK_ORDER: Readonly<Record<ConsoleMark, number>> = {
  past_date: 0,
  at_risk: 1,
  on_track: 2,
  paused: 3,
  unset: 4,
  wrapped: 5,
};

function compareRows(a: ConsoleRow, b: ConsoleRow): number {
  if (a.mark !== b.mark) return MARK_ORDER[a.mark] - MARK_ORDER[b.mark];
  // Soonest date first; a Project with no date goes after those with one.
  if (a.nextDate !== b.nextDate) {
    if (a.nextDate === null) return 1;
    if (b.nextDate === null) return -1;
    return a.nextDate.localeCompare(b.nextDate);
  }
  return a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id);
}

const SEGMENT_TONE: Readonly<Record<ConsoleMark, ConsoleTone>> = {
  past_date: "late",
  at_risk: "risk",
  on_track: "calm",
  paused: "quiet",
  unset: "quiet",
  wrapped: "quiet",
};

export function buildConsole(projects: readonly ConsoleProjectInput[], today: string): ConsoleModel {
  const rows = projects.map((project) => buildRow(project, today)).sort(compareRows);
  const active = rows.filter((row) => row.standing !== "wrapped");
  const looks = active.filter((row) => row.standing === "attention");
  const inputById = new Map(projects.map((project) => [project.id, project]));
  const activeInputs = active.map((row) => inputById.get(row.id)!);

  const counts: Record<ConsoleFilter, number> = {
    all: active.length,
    attention: looks.length,
    mine: active.filter((row) => row.ledByYou).length,
    wrapped: rows.length - active.length,
  };

  const openTotal = active.reduce((sum, row) => sum + row.open, 0);
  const lateTotal = active.reduce((sum, row) => sum + row.late, 0);
  const summary: Array<{ text: string; tone?: "late" | "risk" }> = [{ text: `${active.length} active` }];
  if (looks.length > 0) summary.push({ text: `${looks.length} ${looks.length === 1 ? "needs" : "need"} a look`, tone: "risk" });
  summary.push({ text: openTotal === 1 ? "1 open task" : `${openTotal} open tasks` });
  if (lateTotal > 0) summary.push({ text: `${lateTotal} late`, tone: "late" });

  // Needs a look.
  const pastCount = looks.filter((row) => row.mark === "past_date").length;
  const riskCount = looks.length - pastCount;
  const firstLook = looks[0];
  const attention: ConsoleCards["attention"] = {
    count: looks.length,
    active: active.length,
    segments: active.map((row) => ({ key: row.id, tone: SEGMENT_TONE[row.mark], weight: 1, title: `${row.name}: ${row.markLabel.toLowerCase()}` })),
    segmentsLabel:
      active.length === 0
        ? "No active projects"
        : `${pastCount} past ${pastCount === 1 ? "its" : "their"} target date, ${riskCount} at risk, ${active.length - looks.length} not flagged`,
    caption: firstLook ? { strong: firstLook.name, rest: `first · ${firstLook.markLabel.toLowerCase()}` } : null,
  };

  // Next big date: the nearest one still ahead.
  const ahead = active
    .filter((row) => row.nextDate !== null && row.nextDate >= today)
    .sort((a, b) => a.nextDate!.localeCompare(b.nextDate!) || a.name.localeCompare(b.name, "en"))[0];
  let nextDate: ConsoleCards["nextDate"] = null;
  if (ahead) {
    const input = inputById.get(ahead.id)!;
    nextDate = {
      projectId: ahead.id,
      projectName: ahead.name,
      days: daysBetween(today, ahead.nextDate!),
      title: input.facts?.nextDate?.title ?? "Target date",
      dateLabel: formatConsoleDay(ahead.nextDate!, today),
      complete: input.stats?.complete ?? 0,
      total: input.stats?.total ?? 0,
    };
  }

  // Late across your projects.
  let late: ConsoleCards["late"] = null;
  if (activeInputs.every((input) => input.stats !== null)) {
    const withLate = active.filter((row) => row.late > 0).sort((a, b) => b.late - a.late || a.name.localeCompare(b.name, "en"));
    const oldest = withLate
      .map((row) => ({ row, task: inputById.get(row.id)!.facts?.oldestLate ?? null }))
      .filter((entry): entry is { row: ConsoleRow; task: NonNullable<ConsoleFacts["oldestLate"]> } => entry.task !== null)
      .sort((a, b) => a.task.dueDate.localeCompare(b.task.dueDate) || a.task.id.localeCompare(b.task.id))[0];
    late = {
      total: lateTotal,
      projects: withLate.length,
      segments: withLate.map((row) => ({ key: row.id, tone: "late", weight: row.late, title: `${row.name}: ${row.late} late` })),
      segmentsLabel: withLate.map((row) => `${row.name} ${row.late}`).join(", ") || "Nothing late",
      oldest: oldest
        ? {
            projectId: oldest.row.id,
            taskId: oldest.task.id,
            title: oldest.task.title,
            age: formatDayCount(Math.max(1, daysBetween(oldest.task.dueDate, today))),
          }
        : null,
    };
  }

  // This week: the last seven days, ending today.
  let week: ConsoleCards["week"] = null;
  if (activeInputs.length > 0 && projects.every((project) => project.facts !== null && project.facts.doneByDay.length === CONSOLE_DAYS)) {
    const perDay = Array.from({ length: CONSOLE_DAYS }, (_, index) =>
      projects.reduce((sum, project) => sum + (project.facts!.doneByDay[index] ?? 0), 0),
    );
    const thisWeek = perDay.slice(7);
    const top = Math.max(1, ...thisWeek);
    const days = thisWeek.map((done, index) => {
      const date = addDays(today, index - 6);
      const isToday = index === 6;
      return {
        date,
        done,
        share: done / top,
        isToday,
        title: `${isToday ? "Today" : weekdayName(toUtc(date))}: ${done} done`,
      };
    });
    const busiest = projects
      .map((project) => ({ name: project.name, done: project.facts!.doneByDay.slice(7).reduce((sum, n) => sum + n, 0) }))
      .sort((a, b) => b.done - a.done || a.name.localeCompare(b.name, "en"))[0];
    week = {
      total: thisWeek.reduce((sum, n) => sum + n, 0),
      previous: perDay.slice(0, 7).reduce((sum, n) => sum + n, 0),
      rangeLabel: `${dayMonth(toUtc(days[0]!.date))} to ${dayMonth(toUtc(today))}`,
      days,
      daysLabel: days.map((day) => `${day.isToday ? "Today" : weekdayName(toUtc(day.date)).slice(0, 3)} ${day.done}`).join(", "),
      busiest: busiest && busiest.done > 0 && projects.length > 1 ? busiest : null,
    };
  }

  return { today, rows, counts, summary, cards: { attention, nextDate, late, week } };
}

// ── What a tab shows ───────────────────────────────────────────────────────

export type ConsoleGroup = Readonly<{ id: ConsoleStanding; label: string; rows: readonly ConsoleRow[] }>;

export function consoleGroups(model: ConsoleModel, filter: ConsoleFilter, query = ""): ConsoleGroup[] {
  const needle = query.trim().toLowerCase();
  const picked = model.rows.filter((row) => {
    if (needle && !row.name.toLowerCase().includes(needle)) return false;
    if (filter === "wrapped") return row.standing === "wrapped";
    if (row.standing === "wrapped") return false;
    if (filter === "attention") return row.standing === "attention";
    if (filter === "mine") return row.ledByYou;
    return true;
  });
  return CONSOLE_GROUPS.map((group) => ({ ...group, rows: picked.filter((row) => row.standing === group.id) })).filter(
    (group) => group.rows.length > 0,
  );
}

/** What an empty tab says: a plain line, then what would fill it. */
export function consoleEmptyWords(filter: ConsoleFilter, query: string): Readonly<{ title: string; text: string; calm: boolean }> {
  const needle = query.trim();
  if (needle) {
    return { title: `No project called “${needle}” here.`, text: "Check the spelling, or look across every project.", calm: false };
  }
  switch (filter) {
    case "attention":
      return {
        title: "Nothing needs a look.",
        text: "No project is marked at risk or past its target date. When one is, it shows up here first.",
        calm: true,
      };
    case "mine":
      return { title: "You do not lead any projects right now.", text: "Projects you own show up here.", calm: false };
    case "wrapped":
      return { title: "Nothing wrapped yet.", text: "A project marked complete rests here.", calm: false };
    default:
      return { title: "No active projects.", text: "Start one with New project.", calm: false };
  }
}

// ── Finished work, per day (shared by the database read and the review source) ──

/** A day number (days since 1970-01-01) for an instant, in a time zone. */
export function dayOrdinalIn(timeZone: string): (ms: number) => number {
  const format = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  return (ms: number) => {
    const parts = format.formatToParts(new Date(ms));
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    return Math.round(Date.UTC(read("year"), read("month") - 1, read("day")) / DAY_MS);
  };
}

export function ordinalToIsoDate(ordinal: number): string {
  return new Date(ordinal * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Finish instants → fourteen daily counts ending today, in the reader's time
 * zone. Day 13 is today; days 7 to 13 are the same rolling week Analytics
 * calls its latest, days 0 to 6 the week before.
 */
export function doneByDay(completedAt: readonly number[], now: number, timeZone: string): number[] {
  const dayOf = dayOrdinalIn(timeZone);
  const today = dayOf(now);
  const out = Array.from({ length: CONSOLE_DAYS }, () => 0);
  for (const ms of completedAt) {
    const ago = today - dayOf(ms);
    if (ago >= 0 && ago < CONSOLE_DAYS) out[CONSOLE_DAYS - 1 - ago]! += 1;
  }
  return out;
}
