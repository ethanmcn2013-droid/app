import type {
  AnalyticsDate,
  AnalyticsPeriod,
  ISOInstant,
  LocalDate,
  PeriodPreset,
} from "./contracts";

export const DAY_MS = 86_400_000;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timezone: string): Intl.DateTimeFormat {
  const existing = formatters.get(timezone);
  if (existing) return existing;

  // Construction validates the IANA timezone. Cache the expensive formatter.
  const created = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatters.set(timezone, created);
  return created;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    formatter(timezone);
    return true;
  } catch {
    return false;
  }
}

export function parseInstant(value: ISOInstant): number {
  // Date-only values are forbidden here because their timezone is ambiguous.
  if (!value.includes("T") || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    throw new TypeError(`Expected an ISO instant with timezone: ${value}`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`Invalid ISO instant: ${value}`);
  }
  return timestamp;
}

export function parseLocalDate(value: LocalDate): ZonedParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new TypeError(`Invalid local date: ${value}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new TypeError(`Invalid local date: ${value}`);
  }
  return { year, month, day, hour: 0, minute: 0, second: 0 };
}

function partsAt(timestamp: number, timezone: string): ZonedParts {
  const parts = formatter(timezone).formatToParts(timestamp);
  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new TypeError(`Could not resolve ${type} in ${timezone}`);
    return Number(value);
  };
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function sameParts(left: ZonedParts, right: ZonedParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

/** Resolve a wall-clock time in an IANA timezone without a timezone dependency. */
function zonedPartsToInstant(parts: ZonedParts, timezone: string): number {
  const targetAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let guess = targetAsUtc;

  // Offset iteration converges in at most two passes for normal IANA transitions.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = partsAt(guess, timezone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const adjustment = targetAsUtc - actualAsUtc;
    if (adjustment === 0 && sameParts(actual, parts)) return guess;
    guess += adjustment;
  }

  if (!sameParts(partsAt(guess, timezone), parts)) {
    throw new RangeError(`Local time does not exist in ${timezone}`);
  }
  return guess;
}

function addCalendarDays(parts: ZonedParts, days: number): ZonedParts {
  const date = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day + days,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function addCalendarMonths(parts: ZonedParts, months: number): ZonedParts {
  const targetMonth = parts.month - 1 + months;
  const firstOfTarget = new Date(Date.UTC(parts.year, targetMonth, 1));
  const year = firstOfTarget.getUTCFullYear();
  const month = firstOfTarget.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    ...parts,
    year,
    month,
    day: Math.min(parts.day, lastDay),
  };
}

export function localDateStart(date: LocalDate, timezone: string): number {
  return zonedPartsToInstant(parseLocalDate(date), timezone);
}

export function localDateEndExclusive(date: LocalDate, timezone: string): number {
  return zonedPartsToInstant(addCalendarDays(parseLocalDate(date), 1), timezone);
}

/** The instant at which a due value first becomes overdue. */
export function dueExpiry(date: AnalyticsDate, timezone: string): number {
  return date.kind === "instant"
    ? parseInstant(date.value)
    : localDateEndExclusive(date.value, timezone);
}

export function analyticsDateInstant(
  date: AnalyticsDate,
  timezone: string,
): number {
  return date.kind === "instant"
    ? parseInstant(date.value)
    : localDateStart(date.value, timezone);
}

export function isInPeriod(timestamp: number, period: AnalyticsPeriod): boolean {
  return timestamp >= parseInstant(period.start) && timestamp < parseInstant(period.end);
}

export function validatePeriod(period: AnalyticsPeriod): AnalyticsPeriod {
  if (!isValidTimezone(period.timezone)) {
    throw new TypeError(`Invalid timezone: ${period.timezone}`);
  }
  const start = parseInstant(period.start);
  const end = parseInstant(period.end);
  if (start >= end) throw new RangeError("Analytics period end must be after start");
  return period;
}

/**
 * Build a rolling period that preserves local wall-clock time across DST.
 * The result ends at `now`, never in the future.
 */
export function resolvePeriod(
  preset: Exclude<PeriodPreset, "custom">,
  now: ISOInstant,
  timezone: string,
): AnalyticsPeriod {
  if (!isValidTimezone(timezone)) throw new TypeError(`Invalid timezone: ${timezone}`);
  const end = parseInstant(now);
  const localEnd = partsAt(end, timezone);
  const localStart =
    preset === "four_weeks"
      ? addCalendarDays(localEnd, -28)
      : preset === "twelve_weeks"
        ? addCalendarDays(localEnd, -84)
        : preset === "six_months"
          ? addCalendarMonths(localEnd, -6)
          : addCalendarMonths(localEnd, -12);
  return {
    start: new Date(zonedPartsToInstant(localStart, timezone)).toISOString(),
    end: new Date(end).toISOString(),
    timezone,
    preset,
  };
}

export function previousEqualPeriods(
  period: AnalyticsPeriod,
  count: number,
): AnalyticsPeriod[] {
  validatePeriod(period);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError("Period count must be a non-negative integer");
  }
  const start = parseInstant(period.start);
  const end = parseInstant(period.end);
  const duration = end - start;
  return Array.from({ length: count }, (_, index) => ({
    start: new Date(start - duration * (index + 1)).toISOString(),
    end: new Date(start - duration * index).toISOString(),
    timezone: period.timezone,
    preset: "custom" as const,
  }));
}

export function elapsedDays(from: ISOInstant, to: ISOInstant): number {
  return Math.max(0, (parseInstant(to) - parseInstant(from)) / DAY_MS);
}

export function signedDateDifferenceDays(
  from: AnalyticsDate,
  to: AnalyticsDate,
  timezone: string,
): number {
  return Math.round(
    (analyticsDateInstant(to, timezone) - analyticsDateInstant(from, timezone)) /
      DAY_MS,
  );
}
