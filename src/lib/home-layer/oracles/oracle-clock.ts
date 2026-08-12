/**
 * Golden oracles · the independent clock.
 *
 * WHY THIS EXISTS AT ALL. The fixture universe computes its calendar
 * arithmetic through `@/lib/planning/dates` (`calendarDateInTimeZone`,
 * `calendarDaysBetween`) and its own `src/lib/home-layer/fixtures/clock.ts`.
 * An oracle that imported either of those would be checking a derivation
 * against itself: if `calendarDaysBetween` were off by one across the October
 * clock change, every "expected" value the oracle produced would be off by
 * one too and the suite would go green on a wrong answer.
 *
 * So this module reimplements the three operations Home actually depends on —
 * "what calendar date is this instant, in this zone", "how many calendar days
 * apart are two dates", "what date is N days after this one" — from first
 * principles, using `Intl` for the zone lookup and integer day ordinals for
 * the arithmetic. It never divides elapsed milliseconds by 86,400,000, which
 * is the exact defect `MY_WORK_PROJECTION.md` §5.2 seals against: a fixed
 * offset is 167 or 169 hours across a Europe/London transition.
 *
 * NOTHING HERE READS A CLOCK. Every function takes its instant as an
 * argument. `Date.now()` and `Math.random()` do not appear.
 */

/** `YYYY-MM-DD`, as a local calendar date in some named zone. */
export type OracleDate = string;

export const ORACLE_ZONE = "Europe/London";
export const ORACLE_LOCALE = "en-GB";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const held = formatters.get(timeZone);
  if (held) return held;
  const made = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  formatters.set(timeZone, made);
  return made;
}

function partsOf(
  instantIso: string,
  timeZone: string,
): Readonly<{ year: number; month: number; day: number; hour: number; minute: number }> {
  const at = new Date(instantIso);
  if (Number.isNaN(at.getTime())) {
    throw new Error(`oracle-clock: "${instantIso}" is not an instant`);
  }
  const parts = formatterFor(timeZone).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (!found) throw new Error(`oracle-clock: no ${type} in ${instantIso}`);
    return Number(found.value);
  };
  return Object.freeze({
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  });
}

/** The local calendar date an instant falls on, in the named zone. */
export function zonedCalendarDate(instantIso: string, timeZone: string): OracleDate {
  const { year, month, day } = partsOf(instantIso, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The local wall-clock reading of an instant, in the named zone. */
export function zonedWallClock(
  instantIso: string,
  timeZone: string,
): Readonly<{ hour: number; minute: number }> {
  const { hour, minute } = partsOf(instantIso, timeZone);
  return Object.freeze({ hour, minute });
}

/**
 * A calendar date's integer day ordinal. Computed through `Date.UTC`, which
 * has no daylight saving, so the difference of two ordinals is an exact
 * calendar-day count on every day of the year including the two irregular
 * ones.
 */
export function dayOrdinal(date: OracleDate): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(date);
  if (!match) throw new Error(`oracle-clock: "${date}" is not a calendar date`);
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Math.round(utc / 86_400_000);
}

/** Signed calendar-day distance. Negative means `to` is in the past. */
export function daysBetween(from: OracleDate, to: OracleDate): number {
  return dayOrdinal(to) - dayOrdinal(from);
}

/** The calendar date `days` days after `date`. Never a millisecond offset. */
export function addDays(date: OracleDate, days: number): OracleDate {
  const shifted = new Date((dayOrdinal(date) + days) * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** Whole hours between two instants. Used only for the 24-hour ship window. */
export function hoursBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 3_600_000;
}

// ── Local wall time to instant ──────────────────────────────────────────────

export type WallTimeResolution = Readonly<{
  iso: string;
  /** Which of `INBOX_EVENT.md` §10.3's three rules the resolution needed. */
  adjustment: "none" | "earlier-of-ambiguous" | "forward-from-gap";
}>;

/**
 * The instant at which a named local wall time occurs in a named zone,
 * resolved by `INBOX_EVENT.md` §10.3:
 *
 *   rule 1 — a local time that DOES NOT EXIST resolves FORWARD to the first
 *            real instant (spring, the clocks go forward);
 *   rule 2 — a local time that happens TWICE resolves to the EARLIER
 *            occurrence (autumn, the clocks go back).
 *
 * Both are decided by measurement here: the candidate instants are probed and
 * read back through `Intl`, never assumed from an offset table. That is the
 * whole reason this is an oracle and not a lookup.
 */
export function instantAtLocalWallTime(
  date: OracleDate,
  hour: number,
  minute: number,
  timeZone: string,
): WallTimeResolution {
  const [year, month, day] = date.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const wanted = hour * 60 + minute;

  // Rules 1 and 2 both need every instant whose local reading is the one
  // asked for, so collect them all rather than stopping at the first.
  const matches: number[] = [];
  for (const offsetMinutes of [-120, -60, 0, 60, 120]) {
    const candidate = naive - offsetMinutes * 60_000;
    const iso = new Date(candidate).toISOString();
    const wall = zonedWallClock(iso, timeZone);
    if (
      zonedCalendarDate(iso, timeZone) === date &&
      wall.hour === hour &&
      wall.minute === minute
    ) {
      matches.push(candidate);
    }
  }

  if (matches.length === 1) {
    return Object.freeze({
      iso: new Date(matches[0]).toISOString(),
      adjustment: "none",
    });
  }
  if (matches.length > 1) {
    // Rule 2. The earlier occurrence, chosen by measurement.
    return Object.freeze({
      iso: new Date(Math.min(...matches)).toISOString(),
      adjustment: "earlier-of-ambiguous",
    });
  }

  // Rule 1. The local time never happens, so walk forward minute by minute to
  // the first real instant on that local date at or after the wall time asked
  // for. A scan, not an offset guess, so a tzdata change cannot fool it.
  const from = naive - 3 * 3_600_000;
  for (let step = 0; step <= 32 * 60; step += 1) {
    const candidate = from + step * 60_000;
    const iso = new Date(candidate).toISOString();
    if (zonedCalendarDate(iso, timeZone) !== date) continue;
    const wall = zonedWallClock(iso, timeZone);
    if (wall.hour * 60 + wall.minute >= wanted) {
      return Object.freeze({ iso, adjustment: "forward-from-gap" });
    }
  }
  throw new Error(
    `oracle-clock: ${date} ${hour}:${minute} has no instant in ${timeZone}`,
  );
}
