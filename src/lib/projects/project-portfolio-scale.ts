/**
 * One time scale for every Timeline surface (v3 redesign, 24 Sep 2026).
 *
 * All projects (one bar per Project) and a plan's strip (one diamond per
 * milestone) draw on the same grammar: the same day arithmetic, the same
 * ticks, the same today line and the same clustering of marks that would
 * otherwise overlap. Keeping that maths here, pure and tested, is what makes
 * the two pages feel like one tool.
 *
 * Every date is a plain calendar day (`YYYY-MM-DD`) and every calculation is
 * in whole UTC days, so a server render and the browser can never disagree
 * about where a bar starts. Month names come from a fixed table rather than
 * `Intl`: the en-GB and en-IE short month for September is "Sept", which
 * would make this axis spell a month differently from every other date in
 * the app.
 */

export type Zoom = "weeks" | "months" | "quarters";

export const ZOOMS: readonly Zoom[] = ["weeks", "months", "quarters"];

export const ZOOM_LABELS: Readonly<Record<Zoom, string>> = {
  weeks: "Weeks",
  months: "Months",
  quarters: "Quarters",
};

export function parseZoom(value: unknown): Zoom | null {
  return value === "weeks" || value === "months" || value === "quarters" ? value : null;
}

/** Pixels per day at each zoom. */
export const PX_PER_DAY: Readonly<Record<Zoom, number>> = {
  weeks: 20,
  months: 5,
  quarters: 1.6,
};

export function pxPerDay(zoom: Zoom): number {
  return PX_PER_DAY[zoom];
}

/** The widest range any view draws. Anything beyond it is marked, not drawn. */
export const MAX_RANGE_MONTHS = 36;

export const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const SHORT_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// ── Day arithmetic ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** True for a real `YYYY-MM-DD` calendar day (an ISO instant is accepted and truncated). */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return date.getUTCFullYear() === +match[1] && date.getUTCMonth() === +match[2] - 1 && date.getUTCDate() === +match[3];
}

/** Whole days since 1970-01-01 (UTC). */
export function dayNumber(iso: string): number {
  const match = ISO_DAY.exec(iso);
  if (!match) return Number.NaN;
  return Math.round(Date.UTC(+match[1], +match[2] - 1, +match[3]) / DAY_MS);
}

export function isoFromDayNumber(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return isoFromDayNumber(dayNumber(iso) + days);
}

/** `b - a` in whole days. */
export function diffDays(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

function parts(iso: string): { y: number; m: number; d: number } {
  const match = ISO_DAY.exec(iso)!;
  return { y: +match[1], m: +match[2] - 1, d: +match[3] };
}

function isoOf(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parts(iso);
  // Clamp the day so 31 Jan + 1 month is 28/29 Feb, not 3 Mar.
  const last = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  return isoOf(y, m + months, Math.min(d, last));
}

export function startOfMonth(iso: string): string {
  const { y, m } = parts(iso);
  return isoOf(y, m, 1);
}

export function startOfQuarter(iso: string): string {
  const { y, m } = parts(iso);
  return isoOf(y, m - (m % 3), 1);
}

/** Monday on or before the day. */
export function startOfWeek(iso: string): string {
  const weekday = new Date(dayNumber(iso) * DAY_MS).getUTCDay(); // 0 Sunday
  return addDays(iso, -((weekday + 6) % 7));
}

export function weekdayOf(iso: string): number {
  return new Date(dayNumber(iso) * DAY_MS).getUTCDay();
}

// ── Date phrases (one voice for every Timeline surface) ────────────────────

/** `2026-10-03` → `3 Oct`, with the year when it differs from `todayIso`'s. */
export function formatShortDay(iso: string, todayIso?: string): string {
  if (!isIsoDay(iso)) return iso;
  const { y, m, d } = parts(iso);
  const withYear = todayIso && isIsoDay(todayIso) ? parts(todayIso).y !== y : false;
  return `${d} ${SHORT_MONTHS[m]}${withYear ? ` ${y}` : ""}`;
}

/** `2026-10-03` → `3 Oct 2026`. */
export function formatDayMonthYear(iso: string): string {
  if (!isIsoDay(iso)) return iso;
  const { y, m, d } = parts(iso);
  return `${d} ${SHORT_MONTHS[m]} ${y}`;
}

/** `2026-10-03` → `Sat 3 Oct 2026`. */
export function formatWeekdayDate(iso: string): string {
  if (!isIsoDay(iso)) return iso;
  return `${SHORT_WEEKDAYS[weekdayOf(iso)]} ${formatDayMonthYear(iso)}`;
}

/** `2026-10-03` → `3 October`: the long form, for accessible names. */
export function formatLongDay(iso: string, todayIso?: string): string {
  if (!isIsoDay(iso)) return iso;
  const { y, m, d } = parts(iso);
  const withYear = todayIso && isIsoDay(todayIso) ? parts(todayIso).y !== y : false;
  return `${d} ${LONG_MONTHS[m]}${withYear ? ` ${y}` : ""}`;
}

/** "today", "tomorrow", "in 16 days", "yesterday", "3 days ago". */
export function relativeDayPhrase(iso: string, todayIso: string): string {
  const delta = diffDays(todayIso, iso);
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "yesterday";
  if (delta > 0) return `in ${delta} days`;
  return `${-delta} days ago`;
}

// ── Range ──────────────────────────────────────────────────────────────────

export type TimeRange = Readonly<{
  /** First day drawn (inclusive). */
  start: string;
  /** Last day drawn (inclusive). */
  end: string;
  /** `end - start + 1`. */
  days: number;
  /** Some dated work falls before `start` and is not drawn. */
  clippedBefore: boolean;
  /** Some dated work falls after `end`; the latest such day, for the edge marker. */
  clippedAfter: string | null;
}>;

/** Breathing room either side of the work, in months, per zoom. */
const PADDING_MONTHS: Readonly<Record<Zoom, number>> = {
  weeks: 0.5,
  months: 1,
  quarters: 3,
};

function snapStart(iso: string, zoom: Zoom): string {
  if (zoom === "weeks") return startOfWeek(iso);
  if (zoom === "months") return startOfMonth(iso);
  return startOfQuarter(iso);
}

function snapEnd(iso: string, zoom: Zoom): string {
  if (zoom === "weeks") return addDays(startOfWeek(iso), 6);
  if (zoom === "months") return addDays(addMonths(startOfMonth(iso), 1), -1);
  return addDays(addMonths(startOfQuarter(iso), 3), -1);
}

function pad(iso: string, months: number): string {
  return addMonths(iso, Math.trunc(months));
}

/**
 * The range a view draws: every given date plus padding, always including
 * today, snapped to the zoom's own boundary (Monday, month or quarter) and
 * clamped to 36 months. When clamped, the window keeps today and as much of
 * the future as fits, and reports what it left out.
 */
export function timeRange(
  dates: ReadonlyArray<string | null | undefined>,
  todayIso: string,
  zoom: Zoom,
): TimeRange {
  const valid = dates.filter(isIsoDay).map((d) => d.slice(0, 10));
  const all = [...valid, todayIso];
  const days = all.map(dayNumber);
  const min = isoFromDayNumber(Math.min(...days));
  const max = isoFromDayNumber(Math.max(...days));
  const padding = PADDING_MONTHS[zoom];
  let start = snapStart(padding === 0.5 ? addDays(min, -14) : pad(min, -padding), zoom);
  let end = snapEnd(padding === 0.5 ? addDays(max, 14) : pad(max, padding), zoom);

  let clippedBefore = false;
  let clippedAfter: string | null = null;
  const limitEnd = (from: string) => addDays(addMonths(from, MAX_RANGE_MONTHS), -1);
  if (end > limitEnd(start)) {
    // Keep a year of history at most, so today and what comes next win.
    const earliest = snapStart(addMonths(todayIso, -12), zoom);
    if (start < earliest) {
      start = earliest;
      clippedBefore = min < start;
    }
    const cap = limitEnd(start);
    if (end > cap) {
      end = cap;
      clippedAfter = max > end ? max : null;
    }
  }

  return {
    start,
    end,
    days: diffDays(start, end) + 1,
    clippedBefore,
    clippedAfter,
  };
}

/** A range that fits a given width exactly (the plan strip has no zoom). */
export function fitPxPerDay(range: Pick<TimeRange, "days">, width: number): number {
  return range.days > 0 && width > 0 ? width / range.days : 1;
}

/** Left edge of a day. */
export function dayToX(iso: string, range: Pick<TimeRange, "start">, ppd: number): number {
  return diffDays(range.start, iso) * ppd;
}

/** The day under an x position, snapped to a whole day and kept inside the range. */
export function xToDay(x: number, range: Pick<TimeRange, "start" | "end">, ppd: number): string {
  const offset = Math.round(x / ppd);
  const clamped = Math.max(0, Math.min(diffDays(range.start, range.end), offset));
  return addDays(range.start, clamped);
}

/**
 * Where a canvas scrolls so a day (today) sits `align` of the way across the
 * visible width: 0.3 puts it 30% from the left. Clamped to the scrollable
 * range, so a short range never scrolls past its own end. Pure, so the server
 * can compute it for the first-paint script and the client can repeat it.
 */
export function initialScrollLeft(
  range: Pick<TimeRange, "start" | "days">,
  ppd: number,
  todayIso: string,
  width: number,
  align = 0.3,
): number {
  if (!(width > 0) || !(ppd > 0) || !isIsoDay(todayIso)) return 0;
  const max = Math.max(0, range.days * ppd - width);
  const target = dayToX(todayIso, range, ppd) + ppd / 2 - width * align;
  return Math.round(Math.max(0, Math.min(max, target)));
}

/** Total canvas width. */
export function rangeWidth(range: Pick<TimeRange, "days">, ppd: number): number {
  return range.days * ppd;
}

// ── Ticks ──────────────────────────────────────────────────────────────────

export type Tick = Readonly<{
  day: string;
  /** Month or quarter boundaries are major; week starts are minor. */
  kind: "major" | "minor";
  label: string;
  /** Set on the first tick and on each January: the year, shown above. */
  year: number | null;
}>;

/**
 * Axis ticks for a range. Weeks: a major tick per month and a minor tick per
 * Monday (labelled with the day of the month). Months: a tick per month.
 * Quarters: a tick per quarter, labelled "Jul–Sep".
 */
export function ticks(range: Pick<TimeRange, "start" | "end">, zoom: Zoom): Tick[] {
  const out: Tick[] = [];
  let lastYear: number | null = null;
  const yearFor = (iso: string) => {
    const y = parts(iso).y;
    if (y === lastYear) return null;
    lastYear = y;
    return y;
  };

  if (zoom === "quarters") {
    for (let day = startOfQuarter(range.start); day <= range.end; day = addMonths(day, 3)) {
      if (day < range.start) continue;
      const m = parts(day).m;
      out.push({ day, kind: "major", label: `${SHORT_MONTHS[m]}–${SHORT_MONTHS[m + 2]}`, year: yearFor(day) });
    }
    return out;
  }

  const months: string[] = [];
  for (let day = startOfMonth(range.start); day <= range.end; day = addMonths(day, 1)) {
    if (day >= range.start) months.push(day);
  }

  if (zoom === "months") {
    for (const day of months) {
      out.push({ day, kind: "major", label: SHORT_MONTHS[parts(day).m], year: yearFor(day) });
    }
    return out;
  }

  const monthSet = new Set(months);
  const all: string[] = [...months];
  for (let day = startOfWeek(range.start); day <= range.end; day = addDays(day, 7)) {
    if (day >= range.start && !monthSet.has(day)) all.push(day);
  }
  all.sort();
  for (const day of all) {
    const major = monthSet.has(day);
    const { m, d } = parts(day);
    out.push({
      day,
      kind: major ? "major" : "minor",
      label: major ? SHORT_MONTHS[m] : String(d),
      year: major ? yearFor(day) : null,
    });
  }
  return out;
}

/** Saturday–Sunday spans inside a range, for the Weeks zoom's shading. */
export function weekendSpans(range: Pick<TimeRange, "start" | "end">): { start: string; days: number }[] {
  const spans: { start: string; days: number }[] = [];
  let day = range.start;
  const weekday = weekdayOf(day);
  // First Saturday on or after the start (or a Sunday at the very start).
  if (weekday === 0) {
    spans.push({ start: day, days: 1 });
    day = addDays(day, 6);
  } else {
    day = addDays(day, 6 - weekday);
  }
  for (; day <= range.end; day = addDays(day, 7)) {
    spans.push({ start: day, days: day === range.end ? 1 : 2 });
  }
  return spans;
}

// ── Clustering ─────────────────────────────────────────────────────────────

export type Mark<T> = Readonly<{ x: number; item: T }>;

export type MarkGroup<T> =
  | Readonly<{ kind: "single"; x: number; item: T }>
  | Readonly<{ kind: "cluster"; x: number; from: number; to: number; items: readonly T[] }>;

/**
 * Merge marks that would draw on top of each other.
 *
 * Deterministic: marks are sorted by x (ties keep their input order), then
 * walked once; a mark joins the current group when it sits less than
 * `minGapPx` from the group's previous mark. A group of one stays a single;
 * a larger group becomes a cluster drawn at the mean of its members.
 */
export function clusterMarks<T>(marks: readonly Mark<T>[], minGapPx: number): MarkGroup<T>[] {
  const sorted = marks
    .map((mark, index) => ({ mark, index }))
    .sort((a, b) => a.mark.x - b.mark.x || a.index - b.index)
    .map((entry) => entry.mark);

  const groups: Mark<T>[][] = [];
  for (const mark of sorted) {
    const current = groups[groups.length - 1];
    if (current && mark.x - current[current.length - 1].x < minGapPx) current.push(mark);
    else groups.push([mark]);
  }

  return groups.map((group) => {
    if (group.length === 1) return { kind: "single", x: group[0].x, item: group[0].item };
    const xs = group.map((mark) => mark.x);
    return {
      kind: "cluster",
      x: xs.reduce((sum, x) => sum + x, 0) / xs.length,
      from: xs[0],
      to: xs[xs.length - 1],
      items: group.map((mark) => mark.item),
    };
  });
}

// ── Mini strip (phone) ───────────────────────────────────────────────────

export type StripWindow = Readonly<{ start: string; end: string; days: number }>;

/** Where a day sits in a window, as 0-100, clamped to the window. */
export function stripPct(day: string, w: StripWindow): number {
  return Math.max(0, Math.min(100, (diffDays(w.start, day) / (w.days - 1)) * 100));
}

export type StripExtent = Readonly<{
  /** The bar, clamped to the window, as 0-100. */
  barFrom: number;
  barTo: number;
  /** The done part, clamped to the window; null when it ends before the window. */
  doneTo: number | null;
  /** The bar began before the window: draw its left end square, not as a start. */
  clippedStart: boolean;
  /** The bar runs on past the window: draw its right end square. */
  clippedEnd: boolean;
}>;

/**
 * The fill is a share of the WHOLE bar, worked out on the real dates and only
 * then clamped to the window. Taking the share of the visible part instead
 * pushes the fill past today whenever a bar starts before the window.
 */
export function stripExtent(bar: Readonly<{ from: string; to: string; percent: number }>, w: StripWindow): StripExtent {
  const span = diffDays(bar.from, bar.to);
  const percent = Math.max(0, Math.min(100, bar.percent));
  const doneDay = addDays(bar.from, Math.round((span * percent) / 100));
  const barFrom = stripPct(bar.from, w);
  const barTo = stripPct(bar.to, w);
  return {
    barFrom,
    barTo,
    doneTo: percent <= 0 || doneDay < w.start ? null : stripPct(doneDay, w),
    clippedStart: bar.from < w.start,
    clippedEnd: bar.to > w.end,
  };
}
