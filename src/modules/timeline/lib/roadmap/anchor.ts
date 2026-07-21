/**
 * The anchor, the one dated day a whole plan is pointed at, and the
 * countdown to it.
 *
 * A plan of this shape, a wedding, a go-live, a launch, is built toward a
 * single day. That day is the anchor. It is NOT the same as the "next
 * milestone" (the soonest thing ahead): the next milestone is a waypoint,
 * the anchor is the destination. A wedding plan has a menu tasting next
 * week and the wedding in seven weeks, the countdown a couple wants to
 * feel is the second one.
 *
 * Nothing here is persisted. The anchor is DERIVED from the milestone
 * flags Tasks already owns (schema.ts is derived from Tasks and must not
 * gain a Roadmap-only field), so there is no new column, migration, or
 * query, only a reading of data the workspace already has.
 *
 * Two registers of output share one calculation:
 *   - countdownToken, the mono operator readout   ("T-47" · "Today" · "−3d")
 *   - countdownPhrase, the plain-English recipient line ("47 days from now")
 *
 * `now` is injectable on every function so ISR-rendered output and tests
 * are deterministic, the same contract as current-state.ts and
 * needs-attention.ts.
 */
import type { Status } from "@/modules/timeline/server/db/timeline-schema";

/**
 * The milestone fields the anchor logic reads. `isLaunch` is optional so
 * both a full `Task` (which carries it) and a curation `EffectiveNode`
 * (which does not) satisfy the type without a cast.
 */
export type AnchorCandidate = {
  status: Status;
  targetDate: string | null;
  isLaunch?: boolean;
};

/**
 * The anchor milestone, or null when a plan has no day left to count to
 * (everything shipped, or nothing dated).
 *
 * Selection, in order:
 *   1. the furthest-out dated launch beat (isLaunch), if any exist, the
 *      launch is the destination even when later cleanup milestones trail it;
 *   2. otherwise the furthest-out dated, unsettled milestone.
 *
 * "Furthest out" because a plan builds toward its final date; nearer
 * milestones are the road, not the arrival. Shipped and refused
 * milestones are settled and never anchor.
 */
export function anchorMilestone<T extends AnchorCandidate>(
  milestones: readonly T[],
): T | null {
  const open = milestones.filter(
    (m) => m.targetDate && m.status !== "shipped" && m.status !== "refused",
  );
  if (open.length === 0) return null;

  const launches = open.filter((m) => m.isLaunch);
  const pool = launches.length > 0 ? launches : open;

  return pool.reduce((furthest, m) =>
    // Non-null asserted: `open` already dropped null targetDates, and ISO
    // YYYY-MM-DD strings compare correctly lexicographically.
    m.targetDate! > furthest.targetDate! ? m : furthest,
  );
}

export type Countdown =
  | { kind: "future"; days: number }
  | { kind: "today" }
  | { kind: "past"; days: number };

/**
 * Signed calendar-day delta from `now` to the target, both floored to UTC
 * midnight so a countdown ticks over at the day boundary, never on a
 * fractional-hour edge. Matches the daysUntil grammar already used by the
 * milestone card and the workspace hero.
 */
function daysUntil(iso: string, now: number): number {
  const target = new Date(iso + "T00:00:00Z").getTime();
  const n = new Date(now);
  const todayUTC = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.round((target - todayUTC) / (1000 * 60 * 60 * 24));
}

/** Days-granularity only, deliberately. A ticking clock is urgency theatre;
 *  the brand counts in days and never exclaims. */
export function countdown(iso: string, now: number = Date.now()): Countdown {
  const d = daysUntil(iso, now);
  if (d > 0) return { kind: "future", days: d };
  if (d < 0) return { kind: "past", days: -d };
  return { kind: "today" };
}

/**
 * The operator register, a compact mono token. Overdue stays quiet in ink
 * (never status-red on a content surface); only the live T-N earns the
 * accent, applied by the caller. Identical output to the milestone card's
 * long-standing chip so the T-N grammar reads the same everywhere.
 */
export function countdownToken(c: Countdown): string {
  if (c.kind === "today") return "Today";
  if (c.kind === "past") return `−${c.days}d`;
  return `T-${c.days}`;
}

/**
 * The recipient register, plain English (voice rule 7, "numbers speak
 * plainly"). For a couple reading their own plan, "47 days from now",
 * never "T-47".
 */
export function countdownPhrase(c: Countdown): string {
  if (c.kind === "today") return "today";
  const unit = c.days === 1 ? "day" : "days";
  return c.kind === "past" ? `${c.days} ${unit} ago` : `${c.days} ${unit} from now`;
}
