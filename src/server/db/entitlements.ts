import "server-only";
import { and, eq, gt, isNull, or, desc } from "drizzle-orm";
import { db } from "./index";
import { entitlements } from "./schema";
import type { EntitlementTier } from "@/lib/data";

const TIER_RANK: Record<EntitlementTier, number> = {
  free: 0,
  pro: 1,
  // Studio ranks equal to Team — same feature set, different scope.
  // The tier-meets-minimum check unlocks the same gates for either.
  team: 2,
  studio: 2,
  wedding: 3,
};

/**
 * Resolve the highest-tier non-expired entitlement a user holds in a
 * workspace. Stacks across sources — a `purchase` Pro overrides a
 * `comp` Pro, but a `comp` Team beats them both.
 *
 * Layered Studio resolution: Studio entitlements are user-level
 * (workspaceId IS NULL), so the query unions per-workspace and
 * user-level rows. If the user holds Studio AND owns the workspace,
 * the rank check picks Studio over a free-tier fall-through.
 *
 * Returns `"free"` when no row matches.
 */
export async function getEffectiveTier(
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
        // Per-workspace entitlements (the existing Pro/Team/Wedding
        // case) OR user-level Studio (workspaceId IS NULL).
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

/** Tier-rank comparator for `<RequireTier>`. Returns true when
 *  `actual` is at least `minimum` (transitive Pro → Team works). */
export function tierMeetsMinimum(
  actual: EntitlementTier,
  minimum: EntitlementTier,
): boolean {
  return TIER_RANK[actual] >= TIER_RANK[minimum];
}
