/**
 * Date helpers in house style: "Fri 25 Sep", "3 Oct", "in 8 days".
 * Day precision in UTC, so the server and the browser always agree and
 * nothing depends on the viewer's clock or time zone. Server-safe.
 */

import { DEMO_NOW, DEMO_TODAY } from "../world";

import type { ClockTime, IsoDate } from "./types";

export const TODAY: IsoDate = DEMO_TODAY;
export const NOW: ClockTime = DEMO_NOW;

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function toTime(iso: IsoDate): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function toIso(time: number): IsoDate {
  const d = new Date(time);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  return toIso(toTime(iso) + n * DAY_MS);
}

/** Whole days from `from` to `to`: positive when `to` is later. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS);
}

/** Whole days from today: 0 today, 1 tomorrow, -1 yesterday. */
export function daysFromToday(iso: IsoDate): number {
  return daysBetween(TODAY, iso);
}

/** Monday 0 … Sunday 6. */
export function weekdayIndex(iso: IsoDate): number {
  return (new Date(toTime(iso)).getUTCDay() + 6) % 7;
}

/** The Monday of the week holding `iso`. */
export function mondayOf(iso: IsoDate): IsoDate {
  return addDays(iso, -weekdayIndex(iso));
}

/** Monday 21 Sep 2026: the week the demo lives in. */
export const WEEK_START: IsoDate = mondayOf(TODAY);
/** Mon 21 to Sun 27 Sep, as ISO dates. */
export const WEEK_DAYS: readonly IsoDate[] = Array.from({ length: 7 }, (_, i) => addDays(WEEK_START, i));

/** "Fri". */
export function fmtWeekday(iso: IsoDate): string {
  return WEEKDAYS[new Date(toTime(iso)).getUTCDay()];
}

/** "Friday". */
export function fmtWeekdayLong(iso: IsoDate): string {
  return WEEKDAYS_LONG[new Date(toTime(iso)).getUTCDay()];
}

/** "3 Oct", or "14 Mar 2027" outside 2026. */
export function fmtDate(iso: IsoDate): string {
  const d = new Date(toTime(iso));
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === 2026 ? base : `${base} ${d.getUTCFullYear()}`;
}

/** "Fri 25 Sep". */
export function fmtDay(iso: IsoDate): string {
  return `${fmtWeekday(iso)} ${fmtDate(iso)}`;
}

/** "Friday 25 September". */
export function fmtDayLong(iso: IsoDate): string {
  const d = new Date(toTime(iso));
  const base = `${fmtWeekdayLong(iso)} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === 2026 ? base : `${base} ${d.getUTCFullYear()}`;
}

/**
 * "today", "tomorrow", "yesterday", "in 8 days", "3 days ago". Always days,
 * never weeks: "in 17 days", not "in 2 weeks". Lower case for mid-sentence use.
 */
export function fmtRelative(iso: IsoDate, from: IsoDate = TODAY): string {
  const n = daysBetween(from, iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/** "Today", "Tomorrow", "Tue" within the next six days, otherwise "9 Oct". For dense rows. */
export function fmtShortDue(iso: IsoDate): string {
  const n = daysFromToday(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1 && n < 7) return fmtWeekday(iso);
  return fmtDate(iso);
}

/** "1 day", "3 days". */
export function fmtDays(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? "day" : "days"}`;
}

/* ── Clock ──────────────────────────────────────────────────────────── */

/** "09:15" to 555. */
export function toMinutes(time: ClockTime): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 555 to "09:15". */
export function toClock(minutes: number): ClockTime {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 90 to "1h 30m", 60 to "1h", 15 to "15m". */
export function fmtDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

/* ── Money ──────────────────────────────────────────────────────────── */

const EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** "€1,180". */
export function fmtEuro(n: number): string {
  return EUR.format(n);
}
