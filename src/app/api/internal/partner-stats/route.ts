import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { compCodes, entitlements } from "@/server/db/schema";
import { sql, and, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tasks-owned partner-stats read. Replaces Studio's direct libSQL read
 * of Tasks's `comp_codes` + `entitlements` tables, Studio now fetches
 * this endpoint over HTTP. Schema changes here become a versioned API
 * contract instead of a silent cross-repo break.
 *
 * Auth: bearer `PARTNER_STATS_SECRET` (shared between Studio + Tasks).
 *
 * Query: `?sponsor=<slug>`, sponsor slug as written into
 * `comp_codes.notes` JSON `{ sponsor_slug }` by Studio's issue-codes
 * script.
 *
 * Returns:
 *   {
 *     codesRedeemed:           number,  // codes with redeemed > 0
 *     redeemed30d:             number,  // entitlements.started_at within 30d
 *     reachedBoard:            number,  // entitlements.reached_board_at IS NOT NULL
 *     mostRecentRedemptionAt:  number | null,  // ms epoch
 *   }
 *
 * R-027 — READ THIS BEFORE MAKING THIS ENDPOINT VENUE-FACING.
 *
 * `reachedBoard` is a behavioural count: how many sponsored couples opened
 * their board. D-011 ratified a suppression floor of 3 eligible sponsored
 * workspaces for behavioural counts, and WP-07 made that floor two-sided in
 * studio's `src/lib/account/instrumentation/suppression.ts`. This endpoint
 * applies no floor at all: a venue with two sponsored couples would be told
 * exactly how many of them opened the product.
 *
 * That is not a disclosure today because this route is NOT venue-facing. Its
 * only consumer is studio's `/hq/marketing`, which sums across every sponsor
 * and sits behind the founder-only HQ password. It becomes a disclosure the
 * moment D-027 point 4's "aggregate adoption evidence" is turned on per venue
 * after 1 September.
 *
 * Adding a per-venue caller without first applying the D-011 floor to
 * `reachedBoard` (and to any other behavioural count added here) reproduces
 * R-027 on a surface the suppression fix never reached.
 * Pinned by partner-stats-boundary.test.mjs.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.PARTNER_STATS_SECRET ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    auth.length !== expected.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sponsor = url.searchParams.get("sponsor")?.trim() ?? "";
  if (!sponsor) {
    return NextResponse.json({ ok: false, error: "missing_sponsor" }, { status: 400 });
  }

  // comp_codes.notes carries the sponsor_slug JSON written by Studio's
  // issue-codes script. Use json_extract to read it without a join.
  const compCodeRows = await db
    .select({ code: compCodes.code, redeemed: compCodes.redeemed })
    .from(compCodes)
    .where(sql`${compCodes.notes} IS NOT NULL AND json_extract(${compCodes.notes}, '$.sponsor_slug') = ${sponsor}`);

  let codesRedeemed = 0;
  const sponsorCodes: string[] = [];
  for (const row of compCodeRows) {
    sponsorCodes.push(row.code);
    if ((row.redeemed ?? 0) > 0) codesRedeemed += 1;
  }

  if (sponsorCodes.length === 0) {
    return NextResponse.json({
      codesRedeemed: 0,
      redeemed30d: 0,
      reachedBoard: 0,
      mostRecentRedemptionAt: null,
    });
  }

  const notesValues = sponsorCodes.map((c) => `comp:${c}`);
  const cutoff = new Date(Date.now() - 30 * DAY_MS);

  // isolation-ok: sponsor-scoped, not workspace-scoped, and the scope is
  // a value set rather than a column the guard can name. `notesValues` is
  // derived above from comp_codes that carry THIS sponsor's slug, so the
  // read can only reach entitlements minted from this sponsor's own
  // codes. The projection is two timestamps; no workspace handle, no
  // user id, no couple content leaves this query. That is what keeps the
  // venue axis from becoming a route into a couple's workspace.
  const entitlementRows = await db
    .select({
      startedAt: entitlements.startedAt,
      reachedBoardAt: entitlements.reachedBoardAt,
    })
    .from(entitlements)
    .where(
      and(eq(entitlements.source, "comp"), inArray(entitlements.notes, notesValues)),
    );

  let redeemed30d = 0;
  let reachedBoard = 0;
  let mostRecentRedemptionAt: number | null = null;
  for (const row of entitlementRows) {
    const startedAt = row.startedAt instanceof Date ? row.startedAt.getTime() : 0;
    if (!startedAt) continue;
    if (mostRecentRedemptionAt === null || startedAt > mostRecentRedemptionAt) {
      mostRecentRedemptionAt = startedAt;
    }
    if (startedAt >= cutoff.getTime()) redeemed30d += 1;
    if (row.reachedBoardAt != null) reachedBoard += 1;
  }

  return NextResponse.json({
    codesRedeemed,
    redeemed30d,
    reachedBoard,
    mostRecentRedemptionAt,
  });
}
