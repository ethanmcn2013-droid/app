import { and, eq, isNotNull, like } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { compCodes, entitlements, workspaces } from "./schema";
import {
  coupleAccessExpiryMs,
  extendedCoupleAccessExpiryMs,
  normaliseWeddingDateMs,
} from "@/lib/venue-access-term";

/**
 * R-015 · D-022 — the database seam for the couple access term.
 *
 * The arithmetic lives in `@/lib/venue-access-term` (pure, ported from
 * `studio/src/lib/venue-edition.ts`, held identical by a differential test).
 * This file is the thin layer that decides which rows the rule applies to and
 * writes the result. It deliberately does NOT import `server-only`, for the
 * same reason `account-erasure.ts` does not: the database handle is a
 * parameter, so the whole thing can be exercised against an in-memory libSQL
 * instance rather than only in production.
 *
 * ── What the app knows about a wedding date, stated plainly ────────────────
 * The app has no `wedding_date` column on `entitlements`, and this change does
 * not add one. The couple's date already has a home: `workspaces.primary_date`
 * (`schema.ts`), captured by the wedding branch of contextual onboarding. The
 * term is therefore computed from whatever date is on the couple's workspace
 * at the moment it is asked for, and recomputed when that date is written.
 *
 * **No wedding date reaches this code in production today, for three reasons,
 * and every sponsored couple therefore falls back to the 548-day floor:**
 *
 *  1. The capture is gated behind the `contextualOnboarding` flag, whose
 *     default is `NODE_ENV !== "production"` (`lib/planning/flags.ts`).
 *  2. Venue Edition redemption skips onboarding entirely. The result card
 *     deep-links to `/app/tasks?welcome=venue&v=<slug>`
 *     (`redeem-result-card.tsx`), so the sponsored couple is routed around the
 *     one screen that asks for the date. This is the larger blocker.
 *  3. `workspaces.primary_date` is written at workspace creation only. No
 *     action updates it afterwards, so the postponement case D-022 point 3
 *     describes cannot be triggered from the product yet, even though
 *     `extendCoupleAccessForWeddingDate` below implements it.
 *
 * The floor is exactly what shipped before this change, so nobody is worse off
 * and no term is ever shorter than the ratified one. The grace half of D-022
 * starts working the moment a wedding date exists, with no further change to
 * this file. Closing the three gaps above is product-flow work and a founder
 * decision, recorded in `tasks/R-015.md`.
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
  database: CoupleAccessDb,
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

export type WeddingDateExtension = {
  /** Entitlement rows whose expiry moved later. */
  extended: number;
  /** Rows inspected and left exactly as they were. */
  unchanged: number;
};

/**
 * D-022 point 3 — a wedding date arriving after redemption recomputes the
 * term, and **the term only ever moves later**.
 *
 * Matched on the user rather than the workspace on purpose. The entitlement is
 * bound to whichever workspace was active at redemption, and a couple who then
 * runs wedding onboarding creates a *different* workspace to hold the date. The
 * term belongs to the couple, not to a row in `workspaces`.
 *
 * Every write is `Math.max(current, recomputed)` via
 * `extendedCoupleAccessExpiryMs`, so:
 *   - a postponement extends access,
 *   - a correction that would pull the date earlier changes nothing,
 *   - an unparseable or absent date changes nothing,
 *   - an entitlement with no expiry at all keeps having none.
 * There is no branch in this function that can shorten a term.
 */
export async function extendCoupleAccessForWeddingDate(
  database: CoupleAccessDb,
  input: { userId: string; weddingDate: string | number | null | undefined },
): Promise<WeddingDateExtension> {
  const result: WeddingDateExtension = { extended: 0, unchanged: 0 };
  if (!input.userId) return result;
  const weddingDateMs = normaliseWeddingDateMs(input.weddingDate ?? null);
  if (weddingDateMs == null) return result;

  const rows = await database
    .select({
      id: entitlements.id,
      startedAt: entitlements.startedAt,
      expiresAt: entitlements.expiresAt,
      notes: entitlements.notes,
    })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, input.userId),
        eq(entitlements.tier, "wedding"),
        eq(entitlements.source, "comp"),
        isNotNull(entitlements.notes),
        like(entitlements.notes, "comp:%"),
      ),
    );

  for (const row of rows) {
    const code = (row.notes ?? "").replace(/^comp:/, "");
    if (!code) continue;
    const [comp] = await database
      .select({
        notes: compCodes.notes,
        durationDays: compCodes.durationDays,
      })
      .from(compCodes)
      .where(eq(compCodes.code, code))
      .limit(1);
    if (!comp || !isVenueEditionCompNotes(comp.notes)) continue;

    const currentMs = row.expiresAt ? row.expiresAt.getTime() : null;
    const nextMs = extendedCoupleAccessExpiryMs({
      currentExpiresAtMs: currentMs,
      redeemedAtMs: row.startedAt.getTime(),
      weddingDateMs,
      mintedDurationDays: comp.durationDays,
    });
    if (nextMs == null || currentMs == null || nextMs <= currentMs) {
      result.unchanged += 1;
      continue;
    }
    // Guarded on the expiry this decision was made against, so a concurrent
    // writer that already moved the row later cannot be overwritten with an
    // earlier value. Losing this race is a no-op, never a shortening.
    const moved = await database
      .update(entitlements)
      .set({ expiresAt: new Date(nextMs) })
      .where(
        and(
          eq(entitlements.id, row.id),
          eq(entitlements.expiresAt, row.expiresAt as Date),
        ),
      )
      .returning({ id: entitlements.id });
    if (moved.length > 0) result.extended += 1;
    else result.unchanged += 1;
  }
  return result;
}
