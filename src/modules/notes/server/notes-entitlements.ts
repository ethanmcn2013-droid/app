import "server-only";
import { resolveEntitlement } from "@/lib/entitlements-shared/reads";
import { tierAtLeast } from "@/lib/entitlements-shared/tiers";
import type { EntitlementTier } from "@/lib/entitlements-shared/schema";

/**
 * Notes tier policy (E-6, 2026-05-14).
 *
 * Notes ships no Pro-worthy gate at v1, the deliberate
 * three-second-capture promise applies equally to every user. This
 * module is a deliberate forward-compat anchor: when a Pro feature
 * lands (email-to-capture in N-1, FTS5 in N-2, >500-note caps later)
 * the gate calls go here and inherit canonical tier semantics.
 *
 * Call sites: capture-by-email allocation + slug rotation
 * (server/actions/capture-email.ts) and inbound delivery
 * (app/api/capture/email/route.ts). New gates flow through
 * requireTier() or a feature predicate exported below, never via
 * inline resolveEntitlement calls scattered across server actions.
 */
export async function getNotesTier(
  userClerkId: string,
): Promise<EntitlementTier> {
  const resolved = await resolveEntitlement(userClerkId);
  return resolved.tier;
}

/**
 * Forward-compat predicate. When Pro features land in Notes they
 * call this, not resolveEntitlement directly, so the gate axis
 * stays unified across surfaces.
 */
export async function notesProEnabled(userClerkId: string): Promise<boolean> {
  const tier = await getNotesTier(userClerkId);
  return tierAtLeast(tier, "workspace");
}
