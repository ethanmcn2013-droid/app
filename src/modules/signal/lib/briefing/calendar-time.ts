const DAY = 86_400_000;
import type { Deadline } from "../data/deadline";
import type { TaskSignal } from "./types";

export function signalDeadline(signal: TaskSignal): Deadline {
  if (signal.deadline !== undefined) return signal.deadline;
  return signal.dueAt == null ? null : { kind: "instant", at: signal.dueAt };
}

type CalendarParts = { year: number; month: number; day: number };

function partsAt(timestamp: number, timezone: string): CalendarParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(timestamp));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const result = { year: read("year"), month: read("month"), day: read("day") };
  if (!result.year || !result.month || !result.day) throw new RangeError("Invalid calendar date");
  return result;
}

function ordinal(parts: CalendarParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return Math.floor(date.getTime() / DAY);
}

/** A stored calendar date has no time of day and no timezone conversion. */
export function dateOrdinal(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError("Invalid calendar date");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  const timestamp = date.getTime();
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError("Invalid calendar date");
  }
  return Math.floor(timestamp / DAY);
}

export function deadlineDayDifference(deadline: Deadline, origin: number, timezone: string): number | null {
  if (!deadline || deadline.kind === "unknown") return null;
  return deadline.kind === "date-only"
    ? dateOrdinal(deadline.date) - ordinal(partsAt(origin, timezone))
    : calendarDayDifference(deadline.at, origin, timezone);
}

/** Timed deadlines expire at their instant; calendar dates expire after their local day. */
export function deadlineIsOverdue(deadline: Deadline, now: number, timezone: string): boolean {
  if (!deadline || deadline.kind === "unknown") return false;
  return deadline.kind === "instant"
    ? deadline.at < now
    : deadlineDayDifference(deadline, now, timezone)! < 0;
}

export function compareDeadlines(a: Deadline, b: Deadline, timezone: string, now?: number): number {
  const day = (deadline: Deadline) => {
    if (!deadline || deadline.kind === "unknown") return Number.POSITIVE_INFINITY;
    return deadline.kind === "date-only"
      ? dateOrdinal(deadline.date)
      : ordinal(partsAt(deadline.at, timezone));
  };
  const aDay = day(a), bDay = day(b);
  if (aDay !== bDay) return aDay - bDay;
  if (now !== undefined) {
    const expired = Number(deadlineIsOverdue(b, now, timezone)) - Number(deadlineIsOverdue(a, now, timezone));
    if (expired !== 0) return expired;
  }
  // An unexpired calendar date has no clock time. Keep the input's stable
  // order beside timed entries on the same day rather than invent midnight.
  if (a?.kind === "date-only" || b?.kind === "date-only") return 0;
  if (a?.kind === "instant" && b?.kind === "instant") return a.at - b.at;
  return 0;
}

export function deadlineWeekday(deadline: Deadline, timezone: string): string | null {
  if (!deadline || deadline.kind === "unknown") return null;
  if (deadline.kind === "instant") return localWeekday(deadline.at, timezone);
  return new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", weekday: "long" })
    .format(new Date(`${deadline.date}T00:00:00.000Z`));
}

export function deadlineShortDate(deadline: Deadline, timezone: string): string | null {
  if (!deadline || deadline.kind === "unknown") return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: deadline.kind === "date-only" ? "UTC" : timezone,
    day: "numeric", month: "short",
  }).format(new Date(deadline.kind === "date-only" ? `${deadline.date}T00:00:00.000Z` : deadline.at));
}

/** Calendar-day difference in an explicit IANA zone, immune to 23/25h DST days. */
export function calendarDayDifference(
  targetTimestamp: number,
  originTimestamp: number,
  timezone: string,
): number {
  return ordinal(partsAt(targetTimestamp, timezone)) - ordinal(partsAt(originTimestamp, timezone));
}

export function localHour(timestamp: number, timezone: string): number {
  const value = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
  return Number(value);
}

export function localWeekday(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    timeZone: timezone,
    weekday: "long",
  }).format(new Date(timestamp));
}

/**
 * Produce the briefing's compact timestamp in an explicit reader timezone.
 * Joining named parts avoids runtime-specific Intl punctuation while keeping
 * the calendar conversion DST-aware.
 */
export function briefingTimestampLabel(timestamp: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-IE", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const weekday = read("weekday");
  const hour = read("hour");
  const minute = read("minute");
  if (!weekday || !hour || !minute) throw new RangeError("Invalid briefing timestamp");
  return `${weekday} ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}
