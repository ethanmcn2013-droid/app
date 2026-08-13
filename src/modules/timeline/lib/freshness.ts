/**
 * How a Timeline says when it last heard from Tasks (plan §6.5).
 *
 * ── WHY THIS SENTENCE HAS TO EXIST ─────────────────────────────────────────
 * `syncMilestonesAction` has returned `complete: false` and `totalCount` since
 * WP1 and NO SURFACE READ EITHER. A Project with more than 200 milestones
 * therefore showed the first 201 and said nothing at all — the owner saw a
 * complete-looking plan that was silently missing work, which is the same
 * class of defect as the deletion WP1 fixed, one step quieter. Preserving the
 * rest of the snapshot instead of deleting it is only half the repair; the
 * other half is telling the person.
 *
 * Pure and separately tested: a date formatter that has to agree between a
 * server render and a client hydration is exactly the kind of thing that goes
 * wrong invisibly, so `now` is a parameter rather than a call to the clock.
 */

export type TimelineFreshnessStatus =
  | "never"
  | "syncing"
  | "complete"
  | "empty"
  | "partial"
  | "error"
  | "unauthorized";

/** The freshness facts a surface is allowed to speak from. Plain data: it
 *  crosses the server/client boundary. */
export type TimelineFreshnessView = Readonly<{
  status: TimelineFreshnessStatus;
  lastSuccessAtMs: number | null;
  sourceCount: number | null;
  importedCount: number | null;
  truncated: boolean;
  errorCode: string | null;
}>;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * `now` is passed in, never read, so the server render and the first client
 * render produce the same string. A hydration mismatch on a timestamp is
 * invisible in review and loud in production.
 */
export function formatLastRefreshed(
  lastSuccessAtMs: number | null,
  nowMs: number,
): string {
  if (lastSuccessAtMs === null) {
    // Never refreshed is a different fact from refreshed-and-found-nothing,
    // and saying "Last refreshed —" would blur them.
    return "Not refreshed from Tasks yet";
  }
  const elapsed = Math.max(0, nowMs - lastSuccessAtMs);
  if (elapsed < MINUTE) return "Last refreshed just now";
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `Last refreshed ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `Last refreshed ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const date = new Date(lastSuccessAtMs);
  return `Last refreshed on ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/**
 * The sentence a truncated snapshot owes the owner, or null when the snapshot
 * saw everything.
 *
 * Counts come from ONE consistent read (`COUNT(*) OVER ()` evaluated before
 * the row cap), so "201 of 250" is a fact about a single moment rather than
 * two queries that disagree.
 */
export function truncationNotice(
  freshness: Pick<TimelineFreshnessView, "truncated" | "sourceCount" | "importedCount">,
): string | null {
  if (!freshness.truncated) return null;
  const imported = freshness.importedCount;
  const source = freshness.sourceCount;
  if (imported === null || source === null || source <= imported) {
    return "Tasks returned more milestones than this refresh could read, so some are missing here.";
  }
  return `Showing the first ${imported} of ${source} milestones. Tasks has more than one refresh can read, and nothing here was deleted.`;
}

/** What the refresh state means for the reader, in the one word each. */
export function freshnessTone(
  status: TimelineFreshnessStatus,
): "ok" | "working" | "stale" {
  if (status === "syncing") return "working";
  if (status === "error" || status === "unauthorized" || status === "partial") {
    return "stale";
  }
  return "ok";
}
