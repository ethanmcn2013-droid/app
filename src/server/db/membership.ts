import "server-only";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "./index";
import { entitlements, workspaceMembers, workspaces } from "./schema";
import type { EntitlementTier } from "@/lib/data";

const TIER_RANK: Record<EntitlementTier, number> = {
  free: 0,
  event: 1,
  wedding: 2,
  workspace: 3,
  studio: 4,
};

/**
 * The Free / Pro member cap. The shape: 1 owner + 3 invited editors
 * = 4 total. The number is calibrated — a study group, a couple
 * plus the maid of honor, two roommates and a dog-walker, a
 * freelancer plus the client point-of-contact. Beyond three
 * invitees, it's a team, and Team is $9.95/workspace flat.
 *
 * The /pricing FAQ "Why three?" entry is the public commitment;
 * this constant is the structural enforcement.
 */
export const FREE_WORKSPACE_MEMBER_CAP = 4;

/**
 * The workspace's tier — the highest non-expired entitlement on this
 * workspace across any user. "Workspace tier" answers who's paying
 * for the workspace; distinct from per-user `getEffectiveTier`,
 * which answers what a given user has access to. Owner-on-Pro
 * doesn't make the workspace a Team workspace; only a Team or
 * Wedding entitlement against the workspace itself does.
 *
 * Studio resolution (Phase 4): if the workspace's owner holds a
 * user-level Studio entitlement, the workspace inherits Team-rank
 * capacity (unlimited members) without a per-workspace row. The
 * Studio user gets Team-equivalent across every workspace they own
 * via this single layered query.
 */
export async function getWorkspaceTier(
  workspaceId: string,
): Promise<EntitlementTier> {
  const now = new Date();
  const [perWorkspaceRows, ownerStudio] = await Promise.all([
    db
      .select({ tier: entitlements.tier })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.workspaceId, workspaceId),
          or(
            isNull(entitlements.expiresAt),
            gt(entitlements.expiresAt, now),
          ),
        ),
      ),
    // Look up the workspace's owner, then check for an active
    // user-level Studio entitlement. Returns at most one row.
    db
      .select({ tier: entitlements.tier })
      .from(entitlements)
      .innerJoin(
        workspaces,
        eq(workspaces.ownerUserId, entitlements.userId),
      )
      .where(
        and(
          eq(workspaces.id, workspaceId),
          isNull(entitlements.workspaceId),
          eq(entitlements.tier, "studio"),
          or(
            isNull(entitlements.expiresAt),
            gt(entitlements.expiresAt, now),
          ),
        ),
      ),
  ]);

  let best: EntitlementTier = "free";
  for (const r of [...perWorkspaceRows, ...ownerStudio]) {
    if (TIER_RANK[r.tier] > TIER_RANK[best]) best = r.tier;
  }
  return best;
}

export type MemberCapacity = {
  current: number;
  /** `null` means unlimited. */
  max: number | null;
  tier: EntitlementTier;
};

/**
 * Resolve the workspace's member capacity. Free is the only tier with
 * the 4-member cap; Event, Wedding, Workspace, Studio are all
 * unlimited (matches signalstudio.ie/pricing — Event sells "Unlimited
 * guests" for one event). Returns the current count and the cap so
 * the caller can render "X of N" UI in one read.
 */
export async function getMemberCapacity(
  workspaceId: string,
): Promise<MemberCapacity> {
  const [tier, rows] = await Promise.all([
    getWorkspaceTier(workspaceId),
    db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId)),
  ]);
  const isUnlimited =
    tier === "workspace" ||
    tier === "studio" ||
    tier === "wedding" ||
    tier === "event";
  return {
    current: rows.length,
    max: isUnlimited ? null : FREE_WORKSPACE_MEMBER_CAP,
    tier,
  };
}

/** Predicate: is there room for one more member? Used to gate the
 *  invite path before any external-side-effect work. */
export async function canAddMember(workspaceId: string): Promise<boolean> {
  const { current, max } = await getMemberCapacity(workspaceId);
  if (max === null) return true;
  return current < max;
}
