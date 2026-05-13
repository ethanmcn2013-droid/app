import "server-only";
import { and, desc, eq, gt, isNull, like, or } from "drizzle-orm";
import { db } from "./index";
import { compCodes, entitlements } from "./schema";

export type VenueWelcome = {
  /** The comp code that bridged the user in (e.g. "LAMBSHIL-MP93X"). */
  code: string;
  /** Display name to show in the welcome card. */
  sponsorName: string;
  /** Stable slug — used in the dismissal localStorage key + analytics. */
  sponsorSlug: string;
};

type CompNotes = {
  sponsor_slug?: string;
  sponsor_name?: string;
  source_type?: string;
};

/**
 * Detect whether the user redeemed a venue-edition wedding code on
 * their way into Tasks. Returns sponsor info if so, null otherwise.
 *
 * Tasks's `redeemCompCodeAction` inserts an `entitlements` row with
 * `source = "comp"` and `notes = "comp:<CODE>"`. The originating
 * `comp_codes` row carries sponsor identity as a JSON blob in its
 * own `notes` field (written by studio's `issue-codes.ts` script).
 * This helper joins the two via a second query (no SQL hackery) and
 * returns sponsor identity for the welcome card.
 *
 * Returns null for any user without an active wedding comp entitlement
 * or whose comp_code has no sponsor JSON (e.g. older non-venue comps).
 */
export async function detectVenueWelcome(
  userId: string,
): Promise<VenueWelcome | null> {
  const now = new Date();
  const [entitlementRow] = await db
    .select({ notes: entitlements.notes })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.tier, "wedding"),
        eq(entitlements.source, "comp"),
        or(
          isNull(entitlements.expiresAt),
          gt(entitlements.expiresAt, now),
        ),
        like(entitlements.notes, "comp:%"),
      ),
    )
    .orderBy(desc(entitlements.startedAt))
    .limit(1);

  if (!entitlementRow?.notes) return null;
  const code = entitlementRow.notes.replace(/^comp:/, "");
  if (!code) return null;

  const [compRow] = await db
    .select({ notes: compCodes.notes })
    .from(compCodes)
    .where(eq(compCodes.code, code))
    .limit(1);

  if (!compRow?.notes) return null;
  let parsed: CompNotes;
  try {
    parsed = JSON.parse(compRow.notes) as CompNotes;
  } catch {
    return null;
  }
  if (
    !parsed.sponsor_slug ||
    !parsed.sponsor_name ||
    parsed.source_type !== "venue_edition"
  ) {
    return null;
  }
  return {
    code,
    sponsorName: parsed.sponsor_name,
    sponsorSlug: parsed.sponsor_slug,
  };
}
