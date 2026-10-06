/**
 * The week view's client-safe kit: the shapes the page draws, the day and
 * word helpers, the figures counted from the tasks on screen, and the lane
 * packing. Pure, with no imports beyond types, so the browser loads only
 * this and not the server-side model that builds a `River`
 * (`overview-river.ts`).
 */

import type { ConsoleMark } from "@/lib/projects/project-console";
import { knownTagName } from "@/lib/tags";

/** "1 day", "3 days". */
function formatDayCount(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

// ── What the page draws ────────────────────────────────────────────────────

export type RiverLensId = "areas" | "people" | "status" | "projects";

export type RiverItem = Readonly<{
  id: string;
  projectId: string;
  title: string;
  href: string;
  kind: "task" | "big";
  /** Whole days from today to the due date; null with no date. */
  day: number | null;
  /** Whole days from today to the day it was finished (zero or less). */
  doneDay: number | null;
  done: boolean;
  late: boolean;
  /** The board column it sits in, by name. */
  statusName: string;
  waiting: boolean;
  owner: Readonly<{ id: string; name: string; initials: string; hue: string }> | null;
  /** Lane id under each view. */
  lanes: Readonly<Record<RiverLensId, string>>;
  recurring: boolean;
}>;

export type RiverLane = Readonly<{
  id: string;
  name: string;
  /** A CSS colour from the v3 project hues. */
  hue: string;
  initials?: string;
}>;

export type RiverLaneStats = Readonly<{
  open: number;
  late: number;
  done: number;
  /** "Next: Menu tasting, 25 Sep", or null. */
  next: string | null;
}>;

export type RiverCounts = Readonly<{ open: number; late: number; undated: number; doneLastWeek: number }>;

export type RiverLens = Readonly<{ id: RiverLensId; label: string; lanes: readonly RiverLane[] }>;

export type RiverWeek = Readonly<{ start: number; due: number; done: number }>;

export type River = Readonly<{
  /** Today in the reader's time zone, `YYYY-MM-DD`. Day 0. */
  today: string;
  single: boolean;
  projectId: string | null;
  name: string;
  hue: string;
  mark: ConsoleMark | null;
  markLabel: string | null;
  /** "8 days to the target date, Sat 3 Oct." */
  lead: string;
  /** The Project's own date, as the flag the river runs to. */
  destination: Readonly<{ day: number; title: string; meta: string }> | null;
  items: readonly RiverItem[];
  lenses: readonly RiverLens[];
  r0: number;
  r1: number;
  tasksHref: string;
  timelineHref: string;
  canAct: boolean;
  truncated: boolean;
}>;

// ── Days and words ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function utc(today: string, day: number): Date {
  return new Date(Date.parse(`${today}T00:00:00Z`) + day * DAY_MS);
}

/** `YYYY-MM-DD` for a day offset from today. */
export function riverIso(today: string, day: number): string {
  return utc(today, day).toISOString().slice(0, 10);
}

/** Day offset of a `YYYY-MM-DD` date from today. */
export function riverDayOf(today: string, isoDate: string): number {
  return Math.round((Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** "25 Sep", or "14 Mar 2027" in another year. */
export function riverShort(today: string, day: number): string {
  const date = utc(today, day);
  const year = date.getUTCFullYear();
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}${String(year) === today.slice(0, 4) ? "" : ` ${year}`}`;
}

/** "Fri 25 Sep" */
export function riverWithDay(today: string, day: number): string {
  return `${WEEKDAYS[utc(today, day).getUTCDay()]} ${riverShort(today, day)}`;
}

/** "25 September" */
export function riverLong(today: string, day: number): string {
  const date = utc(today, day);
  return `${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]}`;
}

export function riverWeekday(today: string, day: number): string {
  return WEEKDAYS[utc(today, day).getUTCDay()]!;
}

export function riverDate(today: string, day: number): { date: number; month: string; first: boolean } {
  const date = utc(today, day);
  return { date: date.getUTCDate(), month: MONTHS[date.getUTCMonth()]!, first: date.getUTCDate() <= 7 };
}

/**
 * The short label the board stores beside a due date, for a day offset from
 * today: "Today", "Tomorrow", a weekday inside the week, else "9 Oct". The
 * same rule as the task panel's calendar (`formatDueLabelOn` in
 * `detail-panel/due-calendar.tsx`), kept here so the week view does not pull
 * the whole calendar into its bundle. A test holds the two equal.
 */
export function riverDueLabel(today: string, day: number): string {
  if (day === 0) return "Today";
  if (day === 1) return "Tomorrow";
  const date = utc(today, day);
  if (day > 1 && day < 7) return WEEKDAYS[date.getUTCDay()]!;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** Monday of the week a day falls in, as a day offset. */
export function riverMonday(today: string, day: number): number {
  return day - ((utc(today, day).getUTCDay() + 6) % 7);
}

/** "today", "tomorrow", "in 3 days", "2 days ago". Always days. */
export function riverRelative(day: number): string {
  if (day === 0) return "today";
  if (day === 1) return "tomorrow";
  if (day === -1) return "yesterday";
  return day > 0 ? `in ${formatDayCount(day)}` : `${formatDayCount(-day)} ago`;
}

export function riverPlural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** A tag as an Area's name, in sentence case: "food-and-drink" reads "Food and drink". */
export function areaName(label: string): string {
  // A tag with a known name keeps it: "mara-finn" is "Mara & Finn" here as on Tasks.
  const known = knownTagName(label);
  if (known) return known;
  const words = label.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : label;
}

/** Sample-safe hues: never amber, orange or red, and never pink beside a red count. */
const HUES = [1, 2, 3, 4, 9];
export const hueAt = (index: number) => `var(--v3-project-${HUES[index % HUES.length]})`;

export function hash(text: string): number {
  let value = 0;
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0;
  return value;
}

export const RIVER_NO_LANE = "none";
// ── Figures, counted from the items so a change shows everywhere at once ───

export function riverCounts(items: readonly RiverItem[]): RiverCounts {
  const open = items.filter((item) => !item.done);
  return {
    open: open.length,
    late: open.filter((item) => item.late).length,
    undated: open.filter((item) => item.day === null).length,
    // The last seven days, ending today.
    doneLastWeek: items.filter((item) => item.done && item.doneDay !== null && item.doneDay > -7).length,
  };
}

export function riverLaneStats(items: readonly RiverItem[], lens: RiverLensId, laneId: string, today: string): RiverLaneStats {
  const list = items.filter((item) => item.lanes[lens] === laneId);
  const ahead = list
    .filter((item) => !item.done && item.day !== null && item.day >= 0)
    .sort((a, b) => a.day! - b.day! || a.id.localeCompare(b.id))[0];
  return {
    open: list.filter((item) => !item.done).length,
    late: list.filter((item) => item.late).length,
    done: list.filter((item) => item.done).length,
    next: ahead ? `Next: ${ahead.title}, ${riverShort(today, ahead.day!)}` : null,
  };
}

export function riverWeeks(items: readonly RiverItem[], r0: number, r1: number): RiverWeek[] {
  const weeks: RiverWeek[] = [];
  for (let start = r0; start <= r1; start += 7) {
    weeks.push({
      start,
      due: items.filter((item) => !item.done && item.day !== null && item.day >= start && item.day < start + 7).length,
      done: items.filter((item) => item.done && item.doneDay !== null && item.doneDay >= start && item.doneDay < start + 7).length,
    });
  }
  return weeks;
}

/** One task after a change the server confirmed: finished, reopened, or given a date. */
export function riverWith(items: readonly RiverItem[], id: string, change: Readonly<{ done?: boolean; day?: number | null }>): RiverItem[] {
  return items.map((item) => {
    if (item.id !== id) return item;
    const done = change.done ?? item.done;
    const day = change.day === undefined ? item.day : change.day;
    return { ...item, done, day, doneDay: done ? (item.doneDay ?? 0) : null, late: !done && day !== null && day < 0 };
  });
}

// ── Packing a lane ─────────────────────────────────────────────────────────

/** Approximate text width, for packing labels without measuring the DOM. */
export function textWidth(text: string, size = 12): number {
  let width = 0;
  for (const ch of text) {
    if (ch === " ") width += 0.28;
    else if ("iljtf.,'’".includes(ch)) width += 0.3;
    else if ("mwMW".includes(ch)) width += 0.82;
    else if (ch >= "A" && ch <= "Z") width += 0.66;
    else width += 0.54;
  }
  return Math.ceil(width * size);
}

export type RiverPlaced = Readonly<{
  item: RiverItem;
  row: number;
  /** Left edge of the mark, in canvas pixels. */
  x: number;
  /** Width the label may take; zero means the mark stands alone. */
  label: number;
  badge: string | null;
}>;

export const RIVER_MARK_W = 12;
const GAP = 8;
const AVATAR_W = 22;

/**
 * Pack one lane's dated work into rows. Each mark sits on its day with its
 * label to the right; a label gives up words before any work loses its row,
 * and work that still finds no room keeps its mark and says its name on hover
 * and to a screen reader.
 */
export function packRiverLane(
  list: readonly RiverItem[],
  xOf: (day: number) => number,
  options: Readonly<{ rows: number; avatars: boolean; maxX: number }>,
): { placed: RiverPlaced[]; rows: number } {
  const taken: Array<Array<[number, number]>> = [];
  const placed: RiverPlaced[] = [];
  const fits = (row: Array<[number, number]>, a: number, b: number) => row.every(([s, e]) => b + GAP <= s || a >= e + GAP);
  const sorted = [...list].filter((item) => item.day !== null).sort((a, b) => a.day! - b.day! || a.id.localeCompare(b.id));
  for (const item of sorted) {
    const x = xOf(item.day!);
    const badge = item.late ? `${formatDayCount(-item.day!)} late` : item.day === 0 ? "Due today" : null;
    const badgeW = badge ? textWidth(badge, 11) + 18 : 0;
    const lead = RIVER_MARK_W + 6 + (options.avatars && item.owner ? AVATAR_W : 0);
    const full = textWidth(item.title, 12.5) + 6;
    const room = Math.max(0, options.maxX - (x + lead + badgeW));
    let done = false;
    for (const label of [Math.min(full, room), Math.min(full, 150, room), Math.min(full, 84, room), 0]) {
      if (label > 0 && label < 40) continue;
      const end = x + lead + label + (label > 0 || badge ? badgeW : 0);
      let row = taken.findIndex((candidate) => fits(candidate, x, end));
      if (row < 0 && taken.length < options.rows) {
        taken.push([]);
        row = taken.length - 1;
      }
      if (row < 0) continue;
      taken[row]!.push([x, end]);
      placed.push({ item, row, x, label, badge });
      done = true;
      break;
    }
    if (!done) {
      // No room anywhere: the mark still takes its day, on the least crowded row.
      let best = 0;
      let bestHit = Infinity;
      taken.forEach((row, index) => {
        const hit = row.reduce((sum, [s, e]) => sum + Math.max(0, Math.min(e, x + RIVER_MARK_W) - Math.max(s, x)), 0);
        if (hit < bestHit) {
          bestHit = hit;
          best = index;
        }
      });
      taken[best]?.push([x, x + RIVER_MARK_W]);
      placed.push({ item, row: best, x, label: 0, badge: null });
    }
  }
  return { placed, rows: Math.max(1, taken.length) };
}
