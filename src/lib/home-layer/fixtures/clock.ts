/**
 * Home fixture universe · the frozen clock.
 *
 * ONE clock, recorded as an explicit constant, shared with the rest of the
 * estate. `Date.now()`, `new Date()` with no argument, `Math.random()` and
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` are prohibited anywhere
 * under `src/lib/home-layer/fixtures/**` and that prohibition is asserted by
 * `determinism.test.ts`.
 *
 * WHY IT EQUALS THE PROJECT-TRUTH CLOCK. `PROJECT_TRUTH_TODAY`,
 * `REVIEW_SUITE_FIXTURE.reviewToday` and `PINNED_REVIEW_CALENDAR_FRAME.today`
 * are already pinned to the same day by drift tests in
 * `src/lib/project-truth-fixture.test.ts` and
 * `src/modules/timeline/lib/owner-artifact.test.ts`. A Home fixture on a
 * different day would render every merged Project as overdue against the day
 * the rest of the suite draws. So Home joins that clock rather than starting
 * a fourth one.
 */

import {
  calendarDateInTimeZone,
  calendarDaysBetween,
  type CalendarDate,
} from "@/lib/planning/dates";
import { PROJECT_TRUTH_TODAY } from "@/lib/project-truth-fixture";

// ── The one clock ───────────────────────────────────────────────────────────

/** IANA zone every Home date in this universe is grouped in. */
export const HOME_FIXTURE_TIME_ZONE = "Europe/London";

/** The one locale. en-GB, because the product and its founder are Irish. */
export const HOME_FIXTURE_LOCALE = "en-GB";

/**
 * Today, in `HOME_FIXTURE_TIME_ZONE`. Equal to `PROJECT_TRUTH_TODAY` by
 * construction, not by copy: the import is the drift guard.
 */
export const HOME_FIXTURE_TODAY: CalendarDate =
  PROJECT_TRUTH_TODAY as CalendarDate;

/**
 * The pinned `asOf` instant. Every trigger, relative date, idle-day count,
 * greeting hour and date line in this universe is computed from this one
 * value (TODAY_RANKING §8 ST2).
 *
 * 2026-07-16T07:40:00Z is 08:40 BST — a morning read on a working Thursday,
 * inside British Summer Time, so the ordinary owner scenarios exercise a
 * non-zero UTC offset rather than accidentally passing under UTC.
 */
export const HOME_FIXTURE_NOW_ISO = "2026-07-16T07:40:00.000Z";
export const HOME_FIXTURE_NOW = Date.parse(HOME_FIXTURE_NOW_ISO);

// ── Calendar arithmetic ─────────────────────────────────────────────────────

/**
 * Calendar-day arithmetic, DST-immune by construction. MY_WORK_PROJECTION §5.2
 * seals the prohibition this exists to honour: `+ 7 * 24 * 60 * 60 * 1000` is
 * 167 or 169 hours across a transition and silently moves a row between Next
 * and Later on exactly two days a year.
 */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  const iso = shifted.toISOString().slice(0, 10);
  return iso as CalendarDate;
}

/** The calendar date an instant falls on, in this universe's zone. */
export function fixtureCalendarDate(instantIso: string): CalendarDate {
  return calendarDateInTimeZone(new Date(instantIso), HOME_FIXTURE_TIME_ZONE);
}

/** Signed calendar-day distance from today. Negative is the past. */
export function daysFromFixtureToday(date: CalendarDate): number {
  return calendarDaysBetween(HOME_FIXTURE_TODAY, date);
}

/**
 * An ISO instant `days` calendar days from today at a given local wall time.
 * Used to author due dates that land on an exact intended calendar date in
 * `HOME_FIXTURE_TIME_ZONE` rather than on whichever date a fixed millisecond
 * offset happens to produce.
 */
export function fixtureInstantAt(
  days: number,
  localHour: number,
  localMinute = 0,
): string {
  const date = addCalendarDays(HOME_FIXTURE_TODAY, days);
  const [year, month, day] = date.split("-").map(Number);
  // July and October 2026 are both BST (UTC+1); January is GMT. Resolve the
  // offset by probing rather than assuming, so an authored date in either
  // half of the year lands on the calendar date it names.
  const guess = Date.UTC(year, month - 1, day, localHour, localMinute);
  for (const offsetMinutes of [0, -60, 60]) {
    const candidate = guess + offsetMinutes * 60_000;
    const iso = new Date(candidate).toISOString();
    if (
      fixtureCalendarDate(iso) === date &&
      localWallHour(iso) === localHour &&
      localWallMinute(iso) === localMinute
    ) {
      return iso;
    }
  }
  throw new Error(
    `home-fixtures/clock: ${date} ${localHour}:${localMinute} has no instant in ${HOME_FIXTURE_TIME_ZONE}`,
  );
}

function localPart(iso: string, type: "hour" | "minute"): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HOME_FIXTURE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  return Number(parts.find((part) => part.type === type)?.value ?? NaN);
}

export const localWallHour = (iso: string) => localPart(iso, "hour");
export const localWallMinute = (iso: string) => localPart(iso, "minute");

// ── The clock change ────────────────────────────────────────────────────────

/**
 * Europe/London's two irregular days, expressed as instants so the
 * `dst_boundary` scenario argues from measured facts rather than from a
 * belief about what the zone does.
 *
 * Both values below were measured with `Intl.DateTimeFormat` at authoring
 * time and are re-measured by `dst.test.ts` on every run, so a tzdata update
 * that moved either transition fails the suite instead of silently changing
 * what the scenario proves.
 */
export const HOME_FIXTURE_DST = {
  /**
   * Autumn 2026. The clock goes back at 02:00 BST on 25 October, so the local
   * wall time 01:30 happens TWICE. INBOX_EVENT §10.3 rule 2: an ambiguous
   * local time resolves to the EARLIER occurrence.
   */
  autumn: {
    calendarDate: "2026-10-25" as CalendarDate,
    ambiguousLocal: { hour: 1, minute: 30 },
    /** 01:30 BST — the earlier of the two. What a snooze must resolve to. */
    earlierInstantIso: "2026-10-25T00:30:00.000Z",
    /** 01:30 GMT — the later. Choosing this is the defect. */
    laterInstantIso: "2026-10-25T01:30:00.000Z",
  },
  /**
   * Spring 2027. The clock goes forward at 01:00 GMT on 28 March, so the local
   * wall time 01:30 DOES NOT EXIST. INBOX_EVENT §10.3 rule 1: a non-existent
   * local time resolves FORWARD to the first real instant.
   */
  spring: {
    calendarDate: "2027-03-28" as CalendarDate,
    gapLocal: { hour: 1, minute: 30 },
    /** The first real instant after the gap: 02:00 BST. */
    forwardInstantIso: "2027-03-28T01:00:00.000Z",
    /** The last instant before it: 00:59 GMT. */
    beforeGapInstantIso: "2027-03-28T00:59:00.000Z",
  },
} as const;

/**
 * The `dst_boundary` scenario reads from its own pinned instant, on the
 * evening before the autumn change, so "tomorrow morning" crosses the
 * transition and date grouping spans a 25-hour local day.
 */
export const HOME_FIXTURE_DST_NOW_ISO = "2026-10-24T20:15:00.000Z";
export const HOME_FIXTURE_DST_NOW = Date.parse(HOME_FIXTURE_DST_NOW_ISO);
/** 24 October 2026 in Europe/London — the day before the clocks change. */
export const HOME_FIXTURE_DST_TODAY: CalendarDate = "2026-10-24";

// ── Seeded identity ─────────────────────────────────────────────────────────

/**
 * A deterministic 32-bit hash. The ONLY source of pseudo-variation in this
 * universe: avatar tints, ordering salts and generated scale rows derive from
 * it, so the same input always produces the same output on every machine and
 * `Math.random()` never appears.
 */
export function seededHash(input: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/**
 * A deterministic avatar for a person id. Initials plus one of twelve tints,
 * chosen by hash. No image is fetched, no gravatar is derived from an email,
 * and no network request exists anywhere in this universe.
 */
export function seededAvatar(
  personId: string,
  displayName: string,
): Readonly<{ initials: string; tintIndex: number }> {
  const initials = displayName
    .split(/[\s&]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0]?.toLocaleUpperCase(HOME_FIXTURE_LOCALE) ?? "")
    .join("");
  return Object.freeze({
    initials: initials || "?",
    tintIndex: seededHash(personId) % 12,
  });
}
