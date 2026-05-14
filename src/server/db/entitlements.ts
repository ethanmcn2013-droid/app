import "server-only";
import { and, eq, gt, isNull, or, desc } from "drizzle-orm";
import { db } from "./index";
import { entitlements } from "./schema";
import type { EntitlementTier } from "@/lib/data";
import { resolveEntitlement } from "@/lib/entitlements-shared/reads";

const TIER_RANK: Record<EntitlementTier, number> = {
  free: 0,
  event: 1,
  wedding: 2,
  workspace: 3,
  studio: 4,
};

/**
 * Resolve the highest active tier a user holds. As of E-3.1
 * (2026-05-14) reads come from the shared signal-entitlements DB
 * first, with a fallback to the local Tasks-only entitlements table
 * to keep things working during the cutover.
 *
 * Stripe webhook writes still land in the local table; E-3.2 swaps
 * the writer to the shared DB and decommissions this fallback.
 *
 * `workspaceId` is accepted for signature compatibility with all
 * existing callers, but the shared resolver is user-level — the
 * argument is only used by the local-fallback path.
 *
 * Returns "free" on any DB error. Tier reads MUST NOT crash a page.
 */
export async function getEffectiveTier(
  userId: string,
  workspaceId: string,
): Promise<EntitlementTier> {
  try {
    const shared = await resolveEntitlement(userId);
    if (shared.tier !== "free") return shared.tier;
  } catch {
    // fall through to local
  }
  return getEffectiveTierLocal(userId, workspaceId);
}

async function getEffectiveTierLocal(
  userId: string,
  workspaceId: string,
): Promise<EntitlementTier> {
  const now = new Date();
  const rows = await db
    .select({ tier: entitlements.tier, expiresAt: entitlements.expiresAt })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        or(
          eq(entitlements.workspaceId, workspaceId),
          isNull(entitlements.workspaceId),
        ),
        or(
          isNull(entitlements.expiresAt),
          gt(entitlements.expiresAt, now),
        ),
      ),
    )
    .orderBy(desc(entitlements.startedAt));

  if (rows.length === 0) return "free";
  let best: EntitlementTier = "free";
  for (const r of rows) {
    if (TIER_RANK[r.tier] > TIER_RANK[best]) best = r.tier;
  }
  return best;
}

/** Tier-rank comparator for `<RequireTier>`. True when `actual` is
 *  at least `minimum`. */
export function tierMeetsMinimum(
  actual: EntitlementTier,
  minimum: EntitlementTier,
): boolean {
  return TIER_RANK[actual] >= TIER_RANK[minimum];
}
