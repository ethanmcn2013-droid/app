/**
 * The couple's access term, and where it ends up.
 *
 * The commercial position, ratified in D-010 point 2 and fixed in code by
 * D-022:
 *
 *   access ends at max(redemption + 548 days, wedding date + 90 days)
 *
 * Never a flat eighteen months. The second half of that rule is the one that
 * matters: Irish venues book twelve to twenty-four months out, so a couple who
 * redeems the day they sign and marries at month twenty would otherwise lose
 * the product before their wedding, in public, at the venue that gifted it.
 *
 * After that date the workspace does not disappear and does not lock the
 * couple out. It becomes a Keepsake: free, read-only, readable for as long as
 * the service runs, with an export the couple owns. That last part is what
 * makes the promise honest (D-010 point 3), because there is deliberately no
 * storage guarantee attached to it.
 *
 * This module is pure. It holds no database access and no clock of its own, so
 * every rule in it can be tested at any date without fixtures.
 */

/** D-022 point 2, first term. The ratified commercial planning window. */
export const PLANNING_DAYS_FROM_REDEMPTION = 548;

/** D-022 point 2, second term. The grace that fixes the long-lead booking. */
export const GRACE_DAYS_AFTER_WEDDING = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type KeepsakePhase =
  /** The wedding has not happened. Everything is open. */
  | "planning"
  /** The wedding has happened and the term has not ended. Still open. */
  | "after-the-day"
  /** The term has ended. Read-only, free, exportable. */
  | "keepsake";

/** Which half of the max() actually decided the date. */
export type AccessBasis =
  | "redemption"
  | "wedding-date"
  | "held-open"
  | "wedding-date-unknown";

export type CoupleAccessInput = {
  /** The instant being asked about. */
  now: Date;
  /** When the couple redeemed the venue's code. */
  redeemedAt: Date;
  /**
   * The wedding day as a calendar date (YYYY-MM-DD), never an instant.
   * Null when the couple has not told us yet.
   */
  weddingDate?: string | null;
  /**
   * A term already computed and communicated to the couple. Access can move
   * later and never earlier (D-022 point 3), so a postponement extends and a
   * correction backwards is ignored.
   */
  previouslyEndsAt?: Date | null;
};

export type CoupleAccess = {
  phase: KeepsakePhase;
  /** The end of the active planning term. */
  endsAt: Date;
  basis: AccessBasis;
  /** Whole days from `now` to `endsAt`. Negative once the term has ended. */
  daysRemaining: number;
  /** True while the couple may still change the plan. */
  editable: boolean;
  /**
   * Always true. The export is what the couple owns, so it is available in
   * every phase and not only at the end. An export a couple can only take
   * once the door is closing is not a right, it is a fire drill.
   */
  exportAvailable: true;
  weddingDate: string | null;
};

/**
 * Parse a calendar date to the instant at the end of that day in UTC.
 * A wedding date is a day, not a moment, and a couple is not "after the day"
 * at one minute past midnight on their wedding morning.
 */
function endOfCalendarDay(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

export function resolveCoupleAccess(input: CoupleAccessInput): CoupleAccess {
  const { now, redeemedAt, weddingDate = null, previouslyEndsAt = null } = input;

  const fromRedemption = addDays(redeemedAt, PLANNING_DAYS_FROM_REDEMPTION);
  const weddingEnd = weddingDate ? endOfCalendarDay(weddingDate) : null;
  const fromWedding = weddingEnd ? addDays(weddingEnd, GRACE_DAYS_AFTER_WEDDING) : null;

  let endsAt = fromRedemption;
  let basis: AccessBasis = weddingEnd ? "redemption" : "wedding-date-unknown";

  if (fromWedding && fromWedding.getTime() > endsAt.getTime()) {
    endsAt = fromWedding;
    basis = "wedding-date";
  }

  // Access moves later, never earlier.
  if (previouslyEndsAt && previouslyEndsAt.getTime() > endsAt.getTime()) {
    endsAt = previouslyEndsAt;
    basis = "held-open";
  }

  const ended = now.getTime() >= endsAt.getTime();
  const married = weddingEnd !== null && now.getTime() > weddingEnd.getTime();

  const phase: KeepsakePhase = ended ? "keepsake" : married ? "after-the-day" : "planning";

  return {
    phase,
    endsAt,
    basis,
    daysRemaining: Math.floor((endsAt.getTime() - now.getTime()) / DAY_MS),
    editable: phase !== "keepsake",
    exportAvailable: true,
    weddingDate,
  };
}

/**
 * What a workspace in Keepsake will not accept. Read-only means read-only:
 * the couple can still read every word, open every milestone, and take a copy.
 */
export type KeepsakeWriteIntent =
  | "create-task"
  | "edit-task"
  | "delete-task"
  | "move-task"
  | "comment"
  | "upload-attachment"
  | "publish"
  | "unpublish"
  | "edit-milestone"
  | "invite-collaborator"
  | "delete-workspace"
  | "export";

/**
 * Three intents survive Keepsake, and each for a stated reason.
 *
 *  export           - the couple owns their content in every phase.
 *  unpublish        - taking a public page down is never blocked by a term
 *                     ending. Locking a couple out of retracting their own
 *                     wedding page would be the worst rule in this file.
 *  delete-workspace - so is locking them out of erasing it.
 */
const ALLOWED_IN_KEEPSAKE: ReadonlySet<KeepsakeWriteIntent> = new Set([
  "export",
  "unpublish",
  "delete-workspace",
]);

export function isPermittedInKeepsake(intent: KeepsakeWriteIntent): boolean {
  return ALLOWED_IN_KEEPSAKE.has(intent);
}

/**
 * Couple-facing wording for each phase. Kept here so there is one place to
 * read every sentence a couple sees about their term.
 *
 * Constraints these strings are written against, all ratified:
 *  - never "forever", "for life" or "in perpetuity" (D-009 point 3, R-008)
 *  - never a flat eighteen months (D-022)
 *  - no storage guarantee (D-010 point 3)
 *  - nothing that states or implies legal approval (D-016)
 */
export function keepsakeCopy(access: CoupleAccess, formatDate: (date: Date) => string): {
  heading: string;
  body: string;
  action: string;
} {
  if (access.phase === "keepsake") {
    return {
      heading: "This is a keepsake now",
      body:
        "Your plan is closed to edits. You can still read every milestone and every note, "
        + "and you can download a copy to keep. It stays readable here for as long as Signal "
        + "Studio runs, so take the download if you want it independent of us.",
      action: "Download your keepsake",
    };
  }

  const ends = formatDate(access.endsAt);

  if (access.phase === "after-the-day") {
    return {
      heading: "Congratulations",
      body:
        `Your plan stays open for edits until ${ends}. After that it becomes a keepsake you `
        + "can read and download, at no cost.",
      action: "Download a copy",
    };
  }

  if (access.basis === "wedding-date-unknown") {
    return {
      heading: "Your plan is open",
      body:
        `Your plan is open for edits until ${ends}. Tell us your wedding date and we will `
        + "extend that to three months past the day if it falls later.",
      action: "Download a copy",
    };
  }

  // Only claim the date is wedding-derived when the wedding half of the max()
  // is the half that actually won. Saying "three months past your wedding day"
  // over a redemption-derived date would be a false statement about the term.
  const reason = access.basis === "wedding-date"
    ? ", which is three months past your wedding day"
    : "";

  return {
    heading: "Your plan is open",
    body:
      `Your plan is open for edits until ${ends}${reason}. After that it becomes a keepsake `
      + "you can read and download, at no cost.",
    action: "Download a copy",
  };
}
