/**
 * R-015 (found while fixing the couple-facing term) — what a redeemed code is
 * allowed to say to the couple.
 *
 * `comp_codes.notes` is two things at once. On a hand-minted gift code it is a
 * short human line an operator wrote. On a Venue Edition code it is machine
 * metadata: `studio/scripts/issue-codes.ts` writes
 * `{"sponsor_slug":…,"sponsor_name":…,"source_type":"venue_edition",…}` into
 * the same column, because that JSON is how the app resolves the sponsor at
 * redemption.
 *
 * `RedeemResultCard` rendered that column verbatim, so the first screen a
 * sponsored couple saw after redeeming carried a line of JSON. The idempotent
 * re-hit path was the same shape with the entitlement's own note, `comp:<CODE>`.
 *
 * Neither is a message to a couple. This is the filter: prose passes, machine
 * strings are dropped and the card renders nothing rather than something the
 * couple has to ignore.
 */

/** Internal `prefix:value` notes the product writes for its own bookkeeping. */
const MACHINE_PREFIXES = ["comp:", "student:", "license:", "sponsor:"];

/**
 * The note to show a couple, or null.
 *
 * Dropped: anything that parses as JSON or an array, anything carrying a known
 * internal prefix, and anything that still looks like serialised data. Kept:
 * ordinary sentences, trimmed.
 */
export function coupleVisibleCompNotes(
  notes: string | null | undefined,
): string | null {
  if (!notes) return null;
  const trimmed = notes.trim();
  if (!trimmed) return null;

  // Serialised data, in the two shapes this column actually holds.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return null;
  try {
    // Catches a bare quoted string or a number that was JSON-encoded too.
    JSON.parse(trimmed);
    return null;
  } catch {
    // Not JSON. Good — that is the case we want.
  }

  const lower = trimmed.toLowerCase();
  if (MACHINE_PREFIXES.some((prefix) => lower.startsWith(prefix))) return null;

  return trimmed;
}
