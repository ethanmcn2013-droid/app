import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { entitlements } from "./schema";
import type { EntitlementTier } from "@/lib/data";
import {
  grantAppliesToWorkspace, isPurchaseMirror, listEntitlements, sharedGrantScope,
} from "@/lib/entitlements-shared/reads";
import { TIER_RANK, tierAtLeast } from "@/lib/entitlements-shared/tiers";

export type EntitlementReadDependencies = {
  database?: typeof db;
  sharedDatabase?: Parameters<typeof listEntitlements>[1];
};

/**
 * Project gates honour explicit scope in both stores. Null requests account
 * grants only; local legacy null-scope rows remain account grants. Rank only
 * eligible grants, after checking local purchase expiry/revocation by reference.
 * This is paid-feature eligibility, not project membership or read authority.
 */
export async function getEffectiveTier(
  userId: string,
  workspaceId: string | null,
  dependencies: EntitlementReadDependencies = {},
): Promise<EntitlementTier> {
  return resolveTier(userId, { workspaceId }, dependencies);
}

/**
 * Existing personal Notes gates and Timeline's workspace-creation allowance.
 * January Studio v2 (f1967f2) retains Pro's unlimited workspace count. Preserve
 * those personal benefits for a valid Pro grant, including a project-bound one;
 * the count allowance does not grant another project's paid storage/features.
 * The legacy Event/Wedding results remain available for cap messaging; only
 * Workspace/Studio ranks enable the Pro benefit. Existing account-bound venue,
 * comp, review and education grants retain their stored tier and expiry.
 * Never use this result to authorise access to a particular project.
 */
export async function getPersonalFeatureTier(
  userId: string,
  dependencies: EntitlementReadDependencies = {},
): Promise<EntitlementTier> {
  return resolveTier(userId, "personal", dependencies);
}

async function resolveTier(
  userId: string,
  target: { workspaceId: string | null } | "personal",
  dependencies: EntitlementReadDependencies,
): Promise<EntitlementTier> {
  if (!userId) return "free";
  const now = Date.now();
  const [localResult, sharedResult] = await Promise.allSettled([
    // Include expired rows and every project: epoch-zero purchase tombstones
    // must veto a stale mirror even if that mirror carries a different scope.
    (dependencies.database ?? db).select().from(entitlements).where(eq(entitlements.userId, userId)),
    listEntitlements(userId, dependencies.sharedDatabase),
  ]);
  const local = localResult.status === "fulfilled" ? localResult.value : [];
  const shared = sharedResult.status === "fulfilled" ? sharedResult.value : [];
  const purchases = new Map<string, typeof local>();
  for (const row of local) {
    if (row.source === "purchase" && row.notes) {
      const matches = purchases.get(row.notes) ?? [];
      matches.push(row);
      purchases.set(row.notes, matches);
    }
  }
  const isExpired = (row: (typeof local)[number]) =>
    row.expiresAt !== null && row.expiresAt.getTime() <= now;
  let best: EntitlementTier = "free";
  const consider = (tier: string) => {
    if (Object.hasOwn(TIER_RANK, tier) && TIER_RANK[tier as EntitlementTier] > TIER_RANK[best]) {
      best = tier as EntitlementTier;
    }
  };
  for (const row of local) {
    if (isExpired(row)) continue;
    // A duplicate active purchase cannot resurrect its revoked reference.
    if (row.source === "purchase" && row.notes && purchases.get(row.notes)?.some(isExpired)) continue;
    if (target === "personal" || row.workspaceId === null || row.workspaceId === target.workspaceId) {
      consider(row.tier);
    }
  }
  for (const row of shared) {
    const scope = sharedGrantScope(row);
    if (scope.kind === "unknown" ||
        (target !== "personal" && !grantAppliesToWorkspace(scope, target.workspaceId))) continue;
    // If local state cannot be read, purchase mirrors cannot prove that the
    // reference is still live. Independent Studio/venue grants remain usable.
    if (localResult.status === "rejected" && isPurchaseMirror(row)) continue;
    const matches = row.sourceRef ? purchases.get(row.sourceRef) : undefined;
    if (matches?.length) {
      if (matches.length !== 1 || matches.some(isExpired)) continue;
      const purchase = matches[0];
      const mirroredWorkspace = scope.kind === "workspace" ? scope.workspaceId : null;
      if (purchase.workspaceId !== mirroredWorkspace || purchase.tier !== row.tier) continue;
    }
    consider(row.tier);
  }
  // Shared outage retains valid local access. Both unavailable resolves free.
  return best;
}

/** Tier-rank comparator for `<RequireTier>`. */
export function tierMeetsMinimum(actual: EntitlementTier, minimum: EntitlementTier): boolean {
  return tierAtLeast(actual, minimum);
}
