export type CalendarDate = `${number}-${number}-${number}`;

export type TimeElapsed = Readonly<{
  elapsedDays: number;
  totalDays: number;
  percent: number;
  state: "before" | "current" | "complete";
}>;

export type MilestoneCompletion = Readonly<{
  completed: number;
  total: number;
}>;

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== "string") return false;
  const match = CALENDAR_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function assertCalendarDate(
  value: unknown,
  field = "date",
): asserts value is CalendarDate {
  if (!isCalendarDate(value)) {
    throw new Error(`${field} must be a real calendar date in YYYY-MM-DD form.`);
  }
}

export function assertIanaTimeZone(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length > 100 || value.length === 0) {
    throw new Error("timezone must be an IANA timezone.");
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
  } catch {
    throw new Error("timezone must be an IANA timezone.");
  }
}

function calendarOrdinal(value: CalendarDate): number {
  const [year, month, day] = value.split("-").map(Number);
  return Math.trunc(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Calendar-day distance. No elapsed-millisecond or DST arithmetic. */
export function calendarDaysBetween(
  from: CalendarDate,
  to: CalendarDate,
): number {
  assertCalendarDate(from, "from");
  assertCalendarDate(to, "to");
  return calendarOrdinal(to) - calendarOrdinal(from);
}

export function calendarDateInTimeZone(
  instant: Date,
  timeZone: string,
): CalendarDate {
  assertIanaTimeZone(timeZone);
  if (Number.isNaN(instant.getTime())) throw new Error("instant must be valid.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const value = `${read("year")}-${read("month")}-${read("day")}`;
  assertCalendarDate(value, "formatted date");
  return value;
}

export function daysUntil(
  target: CalendarDate,
  options: Readonly<{ now?: Date; timeZone: string }>,
): number {
  assertCalendarDate(target, "target");
  return calendarDaysBetween(
    calendarDateInTimeZone(options.now ?? new Date(), options.timeZone),
    target,
  );
}

export function timeElapsed(
  start: CalendarDate,
  end: CalendarDate,
  options: Readonly<{ today: CalendarDate }>,
): TimeElapsed {
  assertCalendarDate(start, "start");
  assertCalendarDate(end, "end");
  assertCalendarDate(options.today, "today");
  const span = calendarDaysBetween(start, end);
  if (span < 0) throw new Error("end must be on or after start.");
  const totalDays = span + 1;
  const elapsedDays = Math.min(
    totalDays,
    Math.max(0, calendarDaysBetween(start, options.today) + 1),
  );
  return {
    elapsedDays,
    totalDays,
    percent: Math.round((elapsedDays / totalDays) * 100),
    state:
      options.today < start
        ? "before"
        : options.today > end
          ? "complete"
          : "current",
  };
}

/** Kept deliberately independent from elapsed time. */
export function milestoneCompletion(
  completed: number,
  total: number,
): MilestoneCompletion {
  if (!Number.isSafeInteger(completed) || !Number.isSafeInteger(total)) {
    throw new Error("milestone counts must be whole numbers.");
  }
  if (completed < 0 || total < 0 || completed > total) {
    throw new Error("milestone counts are out of range.");
  }
  return { completed, total };
}

export function formatCalendarDate(
  value: CalendarDate,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  assertCalendarDate(value);
  const [year, month, day] = value.split("-").map(Number);
  // Midday UTC avoids locale timezone rollover while retaining a pure date.
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
