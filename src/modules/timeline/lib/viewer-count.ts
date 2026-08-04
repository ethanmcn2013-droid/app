/**
 * Viewer counts on a shared Timeline, suppressed at the value.
 *
 * The shipped surface rendered `qualifiedViewCount` and `lastQualifiedViewAt`
 * side by side with no floor. At a count of one that pair is not an aggregate:
 * the owner knows exactly who they sent the link to, so "1 view, 3 Aug 2026"
 * names a person and the hour they read it. This module removes the ability to
 * render either value straight.
 *
 * Two things are suppressed, not one:
 *   1. the count, below the floor;
 *   2. the last-viewed time, always coarsened to a month, and only shown at all
 *      once the count clears the same floor.
 *
 * The threshold is a property of the value, not of the caller (R-028's defect
 * was a floor that lived in a projector nobody called). Callers receive
 * pre-rendered strings and never a raw integer, so no formatter downstream can
 * reconstruct a count.
 *
 * Below the floor the surface says nothing about the data. It never renders a
 * bound such as "fewer than five", because a bound is itself a disclosure
 * (R-027's own mitigation says so).
 */

/**
 * Founder-settable. NOT D-011's venue-cohort thresholds of 3 and 5 — those
 * count sponsored workspaces across a venue and were ratified for a different
 * population. This floor counts wedding guests who opened one couple's link.
 *
 * Five is chosen because a couple typically shares the link with a handful of
 * people at once, and a count of three inside that handful is still resolvable
 * to individuals by the person who sent it. Recorded in the E06.07 task spec
 * and raised for founder ratification.
 */
export const VIEWER_COUNT_FLOOR = 5;

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export type ViewerCountPresentation =
  | Readonly<{
      state: "withheld";
      reason: "below_floor";
      /** Explains the rule, never the value. Carries no number. */
      note: string;
    }>
  | Readonly<{
      state: "shown";
      label: string;
      /** Pre-rendered. Callers never receive the integer. */
      countLabel: string;
      /** Coarsened to a month. Null when nothing has been recorded. */
      lastViewedLabel: string | null;
    }>;

const WITHHELD_NOTE =
  "Views appear here once enough people have opened the link. Below that, a count would point at one person.";

function coarseMonth(value: Date | null): string | null {
  if (!value) return null;
  const time = value.getTime();
  if (!Number.isFinite(time)) return null;
  return MONTH_FORMAT.format(value);
}

/**
 * The only supported way to render a Timeline view count.
 *
 * @throws TypeError when the count is not a non-negative safe integer. A bad
 * count is a bug in the aggregate, and rendering it would be worse than failing.
 */
export function presentViewerCount(input: {
  count: number;
  lastViewedAt: Date | null;
  floor?: number;
}): ViewerCountPresentation {
  const floor = input.floor ?? VIEWER_COUNT_FLOOR;
  if (!Number.isSafeInteger(floor) || floor < 1) {
    throw new TypeError("Viewer count floor must be a positive integer");
  }
  if (!Number.isSafeInteger(input.count) || input.count < 0) {
    throw new TypeError("Viewer count must be a non-negative integer");
  }

  if (input.count < floor) {
    return { state: "withheld", reason: "below_floor", note: WITHHELD_NOTE };
  }

  return {
    state: "shown",
    label: "Views",
    countLabel: input.count.toLocaleString("en-GB"),
    lastViewedLabel: coarseMonth(input.lastViewedAt),
  };
}

/**
 * One-line summary for dense list rows. Same floor, same silence below it, so a
 * list cannot become the leak the detail page closed.
 */
export function viewerCountSummary(input: {
  count: number;
  lastViewedAt?: Date | null;
  floor?: number;
}): string | null {
  const presentation = presentViewerCount({
    count: input.count,
    lastViewedAt: input.lastViewedAt ?? null,
    floor: input.floor,
  });
  if (presentation.state === "withheld") return null;
  return `${presentation.countLabel} views`;
}
