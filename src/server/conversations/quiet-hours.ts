export type QuietHoursInput = Readonly<{
  timeZone: string;
  startMinute: number | null;
  endMinute: number | null;
  nowMs: number;
}>;

export type DeliveryEligibility = Readonly<
  | { ok: true; eligible: true; nextEligibleAtMs: null }
  | { ok: true; eligible: false; nextEligibleAtMs: number }
  | { ok: false; code: "invalid_time_zone" | "invalid_quiet_hours" | "invalid_instant" }
>;

type LocalClock = Readonly<{
  year: number;
  month: number;
  day: number;
  minute: number;
}>;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function localClock(formatter: Intl.DateTimeFormat, instantMs: number): LocalClock | null {
  try {
    const values = new Map(
      formatter
        .formatToParts(new Date(instantMs))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const year = values.get("year");
    const month = values.get("month");
    const day = values.get("day");
    const hour = values.get("hour");
    const minute = values.get("minute");
    if (![year, month, day, hour, minute].every(Number.isInteger)) return null;
    return { year: year!, month: month!, day: day!, minute: hour! * 60 + minute! };
  } catch {
    return null;
  }
}

function quietAt(minute: number, startMinute: number, endMinute: number): boolean {
  if (startMinute === endMinute) return false;
  return startMinute < endMinute
    ? minute >= startMinute && minute < endMinute
    : minute >= startMinute || minute < endMinute;
}

function addLocalDays(clock: LocalClock, days: number): Omit<LocalClock, "minute"> {
  const value = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function sameLocalMinute(left: LocalClock, right: LocalClock): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.minute === right.minute;
}

/**
 * Resolve every UTC instant representing one local wall-clock minute. Most
 * minutes have one result, a repeated DST minute has two, and a skipped minute
 * has none. Sampling offsets avoids assuming a fixed offset for the zone.
 */
function wallClockInstants(formatter: Intl.DateTimeFormat, target: LocalClock): number[] {
  const hour = Math.floor(target.minute / 60);
  const minute = target.minute % 60;
  const nominalUtc = Date.UTC(target.year, target.month - 1, target.day, hour, minute);
  const offsets = new Set<number>();
  for (let distance = -36; distance <= 36; distance += 3) {
    const sample = nominalUtc + distance * HOUR_MS;
    const local = localClock(formatter, sample);
    if (!local) continue;
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      Math.floor(local.minute / 60),
      local.minute % 60,
    );
    offsets.add(localAsUtc - sample);
  }
  return [...offsets]
    .map((offset) => nominalUtc - offset)
    .filter((candidate) => {
      const local = localClock(formatter, candidate);
      return local !== null && sameLocalMinute(local, target);
    })
    .sort((left, right) => left - right);
}

/**
 * Decide whether an external delivery may run now and, when quiet, return the
 * first eligible absolute instant. The caller must supply an explicit IANA
 * zone. Quiet bounds use local minutes and the half-open interval [start,end).
 * Null/null and equal bounds disable quiet hours.
 */
export function resolveDeliveryEligibility(input: QuietHoursInput): DeliveryEligibility {
  if (typeof input.timeZone !== "string" || input.timeZone.length === 0) {
    return { ok: false, code: "invalid_time_zone" };
  }
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: input.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return { ok: false, code: "invalid_time_zone" };
  }

  if (!Number.isFinite(input.nowMs) || !localClock(formatter, input.nowMs)) {
    return { ok: false, code: "invalid_instant" };
  }
  const bothDisabled = input.startMinute === null && input.endMinute === null;
  if (bothDisabled) return { ok: true, eligible: true, nextEligibleAtMs: null };
  if (!Number.isInteger(input.startMinute) || !Number.isInteger(input.endMinute) ||
      input.startMinute! < 0 || input.startMinute! >= 1_440 ||
      input.endMinute! < 0 || input.endMinute! >= 1_440) {
    return { ok: false, code: "invalid_quiet_hours" };
  }

  const startMinute = input.startMinute!;
  const endMinute = input.endMinute!;
  if (startMinute === endMinute) return { ok: true, eligible: true, nextEligibleAtMs: null };
  const now = localClock(formatter, input.nowMs)!;
  if (!quietAt(now.minute, startMinute, endMinute)) {
    return { ok: true, eligible: true, nextEligibleAtMs: null };
  }

  const endDayOffset = startMinute > endMinute && now.minute >= startMinute ? 1 : 0;
  const endDate = addLocalDays(now, endDayOffset);
  const target: LocalClock = { ...endDate, minute: endMinute };
  const exact = wallClockInstants(formatter, target).find((candidate) => candidate > input.nowMs);
  if (exact !== undefined) return { ok: true, eligible: false, nextEligibleAtMs: exact };

  // A DST jump can skip the configured end minute. In that uncommon case,
  // walk UTC minute boundaries until the local quiet predicate first clears.
  const firstBoundary = Math.floor(input.nowMs / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
  for (let candidate = firstBoundary; candidate <= input.nowMs + 72 * HOUR_MS; candidate += MINUTE_MS) {
    const local = localClock(formatter, candidate);
    if (local && !quietAt(local.minute, startMinute, endMinute)) {
      return { ok: true, eligible: false, nextEligibleAtMs: candidate };
    }
  }
  return { ok: false, code: "invalid_instant" };
}
