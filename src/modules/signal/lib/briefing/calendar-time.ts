const DAY = 86_400_000;

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
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY);
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

/** Parse a canonical date-only field at UTC noon so local DST offsets never change its day. */
export function dateOnlyToTimestamp(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day, 12);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return timestamp;
}
