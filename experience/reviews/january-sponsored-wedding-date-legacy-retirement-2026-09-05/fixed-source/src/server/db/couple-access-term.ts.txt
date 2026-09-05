import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { workspaces } from "./schema";
import {
  coupleAccessExpiryMs,
  normaliseWeddingDateMs,
} from "@/lib/venue-access-term";

/**
 * D-022 — redemption term arithmetic and the canonical Project date reader.
 *
 * New Projects store their own date in workspaces.primary_date. Redemption
 * reads that Project's date here; creation does not change existing grants.
 * Existing sponsored Projects update the same field through
 * server/actions/sponsored-wedding-date.ts and its Project-scoped transaction.
 *
 * The pure arithmetic lives in @/lib/venue-access-term and is held equal to
 * Studio's approved rule by a differential test. This reader takes its database
 * handle explicitly so it can be exercised against isolated SQLite.
 */

export type CoupleAccessDb = LibSQLDatabase<typeof schema>;

const DAY_MS = 24 * 60 * 60 * 1000;

type CompNotes = {
  sponsor_slug?: string;
  sponsor_name?: string;
  source_type?: string;
};

/**
 * A comp code is a Venue Edition couple licence when its notes carry the
 * sponsor JSON that `studio/scripts/issue-codes.ts` writes. Same predicate
 * `venue-welcome.ts` uses to resolve the sponsor, restated here as a pure
 * function so the term decision does not need a database round trip or a
 * `server-only` import.
 */
export function isVenueEditionCompNotes(notes: string | null): boolean {
  if (!notes) return false;
  let parsed: CompNotes;
  try {
    parsed = JSON.parse(notes) as CompNotes;
  } catch {
    return false;
  }
  return (
    typeof parsed.sponsor_slug === "string" &&
    parsed.sponsor_slug.length > 0 &&
    typeof parsed.sponsor_name === "string" &&
    parsed.sponsor_name.length > 0 &&
    parsed.source_type === "venue_edition"
  );
}

/**
 * The one place a comp redemption's expiry is decided.
 *
 * What this replaces, and why it was the most serious open defect in the
 * programme: `redeemCompCodeImpl` computed
 * `new Date(Date.now() + row.durationDays * 24 * 60 * 60 * 1000)` for every
 * code, Venue Edition included. That is a flat term. D-022 ratified
 * `max(redemption + 548 days, wedding date + 90 days)` and it was implemented
 * only in the repository that does not run the redemption.
 *
 * Non-Venue-Edition codes (the student code, ordinary gifts) keep the flat
 * duration they have always had. Nothing about them changes.
 */
export function compRedemptionExpiresAtMs(input: {
  venueEdition: boolean;
  durationDays: number;
  redeemedAtMs: number;
  weddingDateMs: number | null;
}): number {
  if (input.venueEdition) {
    return coupleAccessExpiryMs({
      redeemedAtMs: input.redeemedAtMs,
      weddingDateMs: input.weddingDateMs,
      mintedDurationDays: input.durationDays,
    });
  }
  return input.redeemedAtMs + input.durationDays * DAY_MS;
}

/**
 * The wedding date recorded on a workspace, or null.
 *
 * `primary_date` is a general-purpose field: on a student workspace it is an
 * exam, on a project it is a launch. It is read as a wedding date ONLY on a
 * wedding workspace, so an unrelated date can never reach the term
 * calculation. Returning null is always safe: the term falls back to the
 * 548-day floor.
 */
export async function weddingDateMsForWorkspace(
  database: Pick<CoupleAccessDb, "select">,
  workspaceId: string,
): Promise<number | null> {
  if (!workspaceId) return null;
  const [row] = await database
    .select({
      primaryDate: workspaces.primaryDate,
      contextType: workspaces.contextType,
      activeDomain: workspaces.activeDomain,
    })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!row?.primaryDate) return null;
  const isWedding =
    row.contextType === "wedding" || row.activeDomain === "wedding";
  if (!isWedding) return null;
  return normaliseWeddingDateMs(row.primaryDate);
}
