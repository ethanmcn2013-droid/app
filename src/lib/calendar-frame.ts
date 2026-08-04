import {
  assertCalendarDate,
  assertIanaTimeZone,
  calendarDateInTimeZone,
  type CalendarDate,
} from "@/lib/planning/dates";

export type CalendarFrameSource = "server" | "demo" | "review";

export type CalendarPlanningPeriod = Readonly<{
  id: string;
  name: string;
  startDate: CalendarDate | null;
  endDate: CalendarDate | null;
}>;

/**
 * Serializable time context for Tasks. Client views must consume this frame
 * instead of reading the browser clock, so SSR and hydration agree about
 * "today" and review captures can be deliberately pinned.
 */
export type CalendarFrame = Readonly<{
  nowIso: string;
  today: CalendarDate;
  locale: string;
  timeZone: string;
  source: CalendarFrameSource;
  planningPeriod: CalendarPlanningPeriod | null;
}>;

type CalendarFrameInput = Readonly<{
  now: Date;
  locale?: string;
  timeZone: string;
  source?: CalendarFrameSource;
  planningPeriod?: CalendarPlanningPeriod | null;
}>;

function validatePlanningPeriod(
  period: CalendarPlanningPeriod | null | undefined,
): CalendarPlanningPeriod | null {
  if (!period) return null;
  if (period.startDate) assertCalendarDate(period.startDate, "planning period start");
  if (period.endDate) assertCalendarDate(period.endDate, "planning period end");
  if (
    period.startDate &&
    period.endDate &&
    period.endDate < period.startDate
  ) {
    throw new Error("planning period end must be on or after its start.");
  }
  return period;
}

export function createCalendarFrame(input: CalendarFrameInput): CalendarFrame {
  if (Number.isNaN(input.now.getTime())) throw new Error("now must be valid.");
  assertIanaTimeZone(input.timeZone);
  return {
    nowIso: input.now.toISOString(),
    today: calendarDateInTimeZone(input.now, input.timeZone),
    locale: input.locale ?? "en-GB",
    timeZone: input.timeZone,
    source: input.source ?? "server",
    planningPeriod: validatePlanningPeriod(input.planningPeriod),
  };
}

/**
 * Review-only deterministic injection. Production receives a frame from the
 * server request and never imports a frozen "today" constant.
 */
export const PINNED_REVIEW_CALENDAR_FRAME: CalendarFrame = Object.freeze({
  nowIso: "2026-07-16T08:00:00.000Z",
  today: "2026-07-16",
  locale: "en-GB",
  timeZone: "Europe/Dublin",
  source: "review",
  planningPeriod: Object.freeze({
    id: "review-wedding-season",
    name: "Wedding season",
    startDate: "2026-07-06",
    // A week past the wedding day (2026-10-03): the season a venue plans
    // runs THROUGH the day, not out three weeks before it. The old
    // 2026-09-12 end closed the period before the wedding it exists to
    // plan — and 12 Sep is the retired wedding date, which must not
    // reappear anywhere in the story.
    endDate: "2026-10-10",
  }),
});
