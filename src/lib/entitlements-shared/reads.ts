import "server-only";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { entitlementsDb } from "./client";
import { entitlements, type EntitlementTier } from "./schema";
import { TIER_RANK } from "./tiers";

export type ResolvedEntitlement = {
  tier: EntitlementTier;
  source: string | null;
  sourceRef: string | null;
  expiresAt: number | null;
  stripeCustomerId: string | null;
};

const FREE_DEFAULT: ResolvedEntitlement = {
  tier: "free",
  source: null,
  sourceRef: null,
  expiresAt: null,
  stripeCustomerId: null,
};

/**
 * Resolve the highest active tier a Clerk user holds across the
 * suite. Reads from the shared signal-entitlements DB.
 *
 * Failure mode: returns `free` on any DB error. Entitlements MUST
 * NOT take a product down. Callers that need to distinguish "user is
 * on free" from "DB unreachable" should call resolveEntitlementOrThrow.
 */
export async function resolveEntitlement(
  clerkId: string,
): Promise<ResolvedEntitlement> {
  if (!clerkId) return FREE_DEFAULT;
  try {
    return await resolveEntitlementOrThrow(clerkId);
  } catch {
    return FREE_DEFAULT;
  }
}

export async function resolveEntitlementOrThrow(
  clerkId: string,
): Promise<ResolvedEntitlement> {
  if (!clerkId) return FREE_DEFAULT;
  const now = Date.now();
  const db = entitlementsDb();
  const rows = await db
    .select({
      tier: entitlements.tier,
      source: entitlements.source,
      sourceRef: entitlements.sourceRef,
      expiresAt: entitlements.expiresAt,
      stripeCustomerId: entitlements.stripeCustomerId,
    })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userClerkId, clerkId),
        eq(entitlements.status, "active"),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now)),
      ),
    );

  if (rows.length === 0) return FREE_DEFAULT;

  let best = rows[0];
  let bestRank = TIER_RANK[best.tier as EntitlementTier] ?? -1;
  for (let i = 1; i < rows.length; i++) {
    const rank = TIER_RANK[rows[i].tier as EntitlementTier] ?? -1;
    if (rank > bestRank) {
      best = rows[i];
      bestRank = rank;
    }
  }
  return {
    tier: best.tier as EntitlementTier,
    source: best.source,
    sourceRef: best.sourceRef,
    expiresAt: best.expiresAt,
    stripeCustomerId: best.stripeCustomerId,
  };
}

/**
 * Fetch the full active-entitlement list for a user. Used by HQ
 * dashboards, settings/plan pages, admin tooling. Read-only.
 */
export async function listEntitlements(clerkId: string) {
  if (!clerkId) return [];
  const now = Date.now();
  const db = entitlementsDb();
  return db
    .select()
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userClerkId, clerkId),
        eq(entitlements.status, "active"),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now)),
      ),
    );
}
