import "server-only";
import { and, eq, gt, isNull, or, desc } from "drizzle-orm";
import { db } from "./index";
import { entitlements } from "./schema";
import type { EntitlementTier } from "@/lib/data";
import { resolveEntitlement } from "@/lib/entitlements-shared/reads";
import { TIER_RANK, tierAtLeast } from "@/lib/entitlements-shared/tiers";

/**
 * Resolve the highest active tier a user holds. As of E-3.1
 * (2026-05-14) reads consult the shared signal-entitlements DB AND
 * the local Tasks-only entitlements table, and return whichever
 * grants MORE access.
 *
 * Why max-of-both, not shared-first: Stripe webhook writes still
 * land in the LOCAL table until E-3.2 swaps the writer. A
 * shared-first short-circuit (`if shared.tier !== "free" return it`)
 * would silently DOWNGRADE a customer whose paid entitlement lives
 * only in the local table the moment the shared DB returned any
 * lesser non-free tier. Taking the rank-max is downgrade-proof
 * regardless of which store a given entitlement currently lives in;
 * it collapses back to a plain shared read for free once E-3.2
 * makes the local table empty.
 *
 * `workspaceId` is accepted for signature compatibility with all
 * existing callers; the shared resolver is user-level — the
 * argument only scopes the local-fallback path.
 *
 * Returns "free" on any DB error. Tier reads MUST NOT crash a page.
 */
export async function getEffectiveTier(
  userId: string,
  workspaceId: string,
): Promise<EntitlementTier> {
  let shared: EntitlementTier = "free";
  try {
    shared = (await resolveEntitlement(userId)).tier;
  } catch {
    // Shared DB unreachable — local read below still stands.
  }

  let local: EntitlementTier = "free";
  try {
    local = await getEffectiveTierLocal(userId, workspaceId);
  } catch {
    // Local read failed — fall back to whatever shared resolved to.
  }

  return TIER_RANK[shared] >= TIER_RANK[local] ? shared : local;
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
  return tierAtLeast(actual, minimum);
}
