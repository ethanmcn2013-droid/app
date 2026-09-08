/**
 * R-015 · D-022 — the couple access term, in the repository that actually runs
 * the redemption.
 *
 * ── Why this is a port and not a shared module ─────────────────────────────
 * The rule was already implemented, correctly, at
 * `studio/src/lib/venue-edition.ts`. It could not be reached from here.
 * `app` and `studio` are separate git repositories with separate Vercel
 * projects and separate build roots; nothing in a `studio/` path exists on
 * disk when this repository is built. The only sharing mechanism that works
 * across them today is a published npm package (`ds-foundation` is the one
 * precedent), and publishing a package for one arithmetic rule, twenty-nine
 * days before release, buys a release-blocking dependency instead of a fix.
 *
 * So the rule is ported, and the drift that a port invites is answered
 * directly rather than hoped away: `venue-access-term.test.ts` imports the
 * studio module whenever a studio checkout sits beside this one and runs both
 * implementations over the same case matrix, asserting identical answers. It
 * also pins the behaviour with explicit vectors that hold with no studio
 * checkout at all, so CI is not silently weaker than a workstation. If the two
 * rules ever diverge, the test that catches it is in this repository.
 *
 * This mirrors the existing cross-repository lock in
 * `src/server/invitation-code-security.test.ts`, which holds the comp-code
 * alphabet identical to studio's by the same method.
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 * Access ends at `max(redemption + 548 days, wedding date + 90 days)`, and it
 * only ever moves later. Irish venues book twelve to twenty-four months out. A
 * couple who signs in March 2027 for a September 2028 wedding and redeems on
 * the day they sign would, under a flat 548-day term, lose the product before
 * the wedding it was bought for, in public, at the venue that gifted it.
 *
 * Everything here is pure and client-safe. The database callers are
 * `src/server/db/couple-access-term.ts` and, through it,
 * `src/server/actions/comp.ts`.
 */

/** The ratified commercial term. 548 days is the FLOOR, not the answer. */
export const VENUE_EDITION_COUPLE_ACCESS_DAYS = 548;

/** D-010: three months past the wedding date. */
export const VENUE_EDITION_WEDDING_GRACE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A wedding date is a calendar day, so it is carried as UTC midnight. */
const WEDDING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a wedding date into the UTC-midnight instant that starts that day.
 * Accepts `YYYY-MM-DD` or an epoch already on a UTC day boundary. Returns null
 * for anything unparseable — a bad date must never silently become "today",
 * because "today" is the one value that shortens access.
 */
export function normaliseWeddingDateMs(
  input: string | number | null | undefined,
): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.floor(input / DAY_MS) * DAY_MS;
  }
  const raw = input.trim();
  if (!WEDDING_DATE_PATTERN.test(raw)) return null;
  const ms = Date.parse(`${raw}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return null;
  // Date.parse accepts 2026-02-31 and rolls it forward; reject the roll.
  if (new Date(ms).toISOString().slice(0, 10) !== raw) return null;
  return ms;
}

/** The UTC calendar day of an instant, as `YYYY-MM-DD`. */
export function weddingDateLabel(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * D-022 point 2. Access ends at
 *   `max(redemption + 548 days, wedding date + 90 days)`.
 *
 * There is no upper cap: a couple booking three years out gets three years
 * plus the grace period. At roughly EUR 0.10 per live workspace per month the
 * marginal cost is a few euro, against the certainty of the worst failure this
 * product can produce.
 *
 * With no wedding date the floor applies unchanged, which is exactly what
 * shipped before this change — so an unknown date is never worse than the
 * status quo, and can never be shorter than it.
 */
export function coupleAccessExpiryMs(input: {
  redeemedAtMs: number;
  weddingDateMs?: number | null;
  /**
   * The duration the code was minted with, when it is longer than the 548-day
   * floor. A venue that already knew a long-lead wedding date at mint time
   * chose that term deliberately, and a couple who then declines to enter a
   * date must not silently lose it.
   */
  mintedDurationDays?: number | null;
}): number {
  const floorDays = Math.max(
    VENUE_EDITION_COUPLE_ACCESS_DAYS,
    input.mintedDurationDays != null && Number.isFinite(input.mintedDurationDays)
      ? input.mintedDurationDays
      : 0,
  );
  const floor = input.redeemedAtMs + floorDays * DAY_MS;
  const wedding = normaliseWeddingDateMs(input.weddingDateMs ?? null);
  if (wedding == null) return floor;
  return Math.max(floor, wedding + VENUE_EDITION_WEDDING_GRACE_DAYS * DAY_MS);
}

/**
 * The same rule expressed as a mint-time duration, for the case where the
 * wedding date is known before the code is handed over. Always at least the
 * 548-day floor, so a mint can never encode a shorter term than the ratified
 * one.
 */
export function coupleAccessDurationDays(input: {
  issuedAtMs: number;
  weddingDateMs?: number | null;
}): number {
  const expiry = coupleAccessExpiryMs({
    redeemedAtMs: input.issuedAtMs,
    weddingDateMs: input.weddingDateMs,
  });
  return Math.max(
    VENUE_EDITION_COUPLE_ACCESS_DAYS,
    Math.ceil((expiry - input.issuedAtMs) / DAY_MS),
  );
}

/**
 * D-022 point 3. A wedding-date change recomputes expiry, and **access only
 * ever moves later**. A postponement extends it; a correction that would pull
 * it back leaves it where it is.
 *
 * The deliberate consequence: a couple who mistypes 2028 and fixes it to 2027
 * keeps the longer access. Granting a few extra months of a product the venue
 * has already paid for is a far cheaper error than taking access away from
 * someone who has started planning inside it.
 *
 * A null current expiry means the row has no expiry at all. It stays null —
 * this rule extends access, it never introduces an end date that was absent.
 */
export function extendedCoupleAccessExpiryMs(input: {
  currentExpiresAtMs: number | null;
  redeemedAtMs: number;
  weddingDateMs?: number | null;
  mintedDurationDays?: number | null;
}): number | null {
  if (input.currentExpiresAtMs == null) return null;
  const recomputed = coupleAccessExpiryMs({
    redeemedAtMs: input.redeemedAtMs,
    weddingDateMs: input.weddingDateMs,
    mintedDurationDays: input.mintedDurationDays,
  });
  return Math.max(input.currentExpiresAtMs, recomputed);
}

/**
 * The couple-facing sentence for the term, held next to the arithmetic so the
 * two cannot drift. Ratified wording (D-022, brand voice: no em dashes, no
 * exclamation marks, sentence case).
 */
export const COUPLE_ACCESS_TERM_SENTENCE =
  "Eighteen months from the day you redeem, or three months past your wedding, whichever is later.";
