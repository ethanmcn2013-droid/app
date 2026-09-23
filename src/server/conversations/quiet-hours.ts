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
const MAX_SEARCH_MINUTES = 72 * 60;

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

  // Walk absolute minute boundaries rather than jumping straight to the
  // configured wall-clock end. A DST transition can itself exit the predicate
  // before that end (for example when a repeated hour moves back before the
  // quiet start), and the contract requires the first eligible instant.
  const firstBoundary = Math.floor(input.nowMs / MINUTE_MS) * MINUTE_MS + MINUTE_MS;
  for (let offset = 0; offset < MAX_SEARCH_MINUTES; offset++) {
    const candidate = firstBoundary + offset * MINUTE_MS;
    const local = localClock(formatter, candidate);
    if (local && !quietAt(local.minute, startMinute, endMinute)) {
      return { ok: true, eligible: false, nextEligibleAtMs: candidate };
    }
  }
  return { ok: false, code: "invalid_instant" };
}
