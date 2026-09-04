import "server-only";
import { getPersonalFeatureTier, type EntitlementReadDependencies } from "@/server/db/entitlements";
import { tierAtLeast } from "@/lib/entitlements-shared/tiers";
import type { EntitlementTier } from "@/lib/entitlements-shared/schema";

/**
 * Notes tier policy (E-6, 2026-05-14).
 *
 * Notes ships no Pro-worthy gate at v1, the deliberate
 * three-second-capture promise applies equally to every user. This
 * Personal Pro gates go through the canonical App reader so a local purchase
 * revocation takes effect even while its shared mirror is pending. Preserve
 * the existing personal benefit of a valid Pro grant without using it as
 * authority for any other project's storage, membership or content.
 *
 * Call sites: capture-by-email allocation + slug rotation
 * (server/actions/capture-email.ts) and inbound delivery
 * (app/api/capture/email/route.ts). New gates flow through
 * requireTier() or a feature predicate exported below, never via
 * inline resolveEntitlement calls scattered across server actions.
 */
export async function getNotesTier(
  userClerkId: string,
  dependencies?: EntitlementReadDependencies,
): Promise<EntitlementTier> {
  return getPersonalFeatureTier(userClerkId, dependencies);
}

/**
 * Forward-compat predicate. When Pro features land in Notes they
 * call this, not resolveEntitlement directly, so the gate axis
 * stays unified across surfaces.
 */
export async function notesProEnabled(userClerkId: string, dependencies?: EntitlementReadDependencies): Promise<boolean> {
  const tier = await getNotesTier(userClerkId, dependencies);
  return tierAtLeast(tier, "workspace");
}
