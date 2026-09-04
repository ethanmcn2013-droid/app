"use server";

import { getActiveWorkspaceOrNull, getCurrentUser } from "@/server/auth";
import { authorizeProjectCandidate } from "@/server/actions/project-authz";
import {
  MissingStripePriceError,
  priceIdFor,
  stripe,
  type BillingInterval,
  type PaidTier,
} from "@/server/stripe";
import { isDemoMode } from "@/lib/access-mode";
import { checkoutModeFor, isPaidTier } from "@/server/checkout-policy";

const FALLBACK_BASE = "http://localhost:3001";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? FALLBACK_BASE;
}

/**
 * Mint a Stripe Checkout session for the chosen tier. Returns the
 * redirect URL the client should `window.location` to.
 *
 * Tier-scoping note (Phase 4):
 *   - `studio` is a user-level subscription, the entitlement row
 *     gets `workspaceId = NULL` so it applies across every workspace
 *     the user owns.
 *   - Workspace, Wedding and Event remain project-scoped.
 *
 * Missing Stripe configuration always fails closed. Internal rehearsals use
 * provider test mode or the database-free review path; a click never grants access.
 */
export async function createCheckoutSessionAction(
  tier: PaidTier,
  interval: BillingInterval = "monthly",
): Promise<{ url: string }> {
  if (!isPaidTier(tier) || (interval !== "monthly" && interval !== "annual")) {
    throw new Error("That checkout option isn’t available.");
  }
  if (isDemoMode()) {
    return { url: `${siteUrl()}/app/tasks?checkout=review&tier=${tier}` };
  }
  const me = await getCurrentUser();
  // The entitlement this checkout grants is scoped to a Project, so the
  // Project has to be proved before Stripe is told which one to bill for.
  // Previously an ambient cookie chose it, and its LEGACY_WORKSPACE_ID
  // fallback could have attached a paid entitlement to a workspace the caller
  // had proved no membership of (D-005).
  const ambient = await getActiveWorkspaceOrNull();
  const grant = await authorizeProjectCandidate({
    candidateProjectId: ambient,
    capability: "createOrEditTasks",
    actorUserId: me,
  });
  if (!grant.ok) throw new Error("That project isn’t available.");
  const ws = grant.projectId;

  // Studio is the only tier that's user-level rather than workspace-
  // level. Carry NULL through metadata + grant so downstream code
  // sees the right scope.
  const scopedWorkspaceId: string | null = tier === "studio" ? null : ws;

  const configuredPriceId = priceIdFor(tier, interval);
  if (interval === "annual" && !configuredPriceId) {
    throw new MissingStripePriceError(tier, interval);
  }

  if (!stripe) {
    throw new Error("Billing isn't connected yet. Try again later.");
  }

  const priceId = configuredPriceId;
  if (!priceId) {
    throw new MissingStripePriceError(tier, interval);
  }

  // Stripe metadata must be string-valued; we encode user-level
  // scoping with the literal "*" sentinel and decode it server-side
  // in the webhook. Keeps the type contract honest.
  const metadataWorkspaceId = scopedWorkspaceId ?? "*";

  const session = await stripe.checkout.sessions.create({
    mode: checkoutModeFor(tier),
    integration_identifier: "signal-january-qvhtmrcs",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl()}/app/tasks?upgrade=ok&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/pricing?upgrade=cancel`,
    client_reference_id: `${me}::${metadataWorkspaceId}`,
    metadata: { userId: me, workspaceId: metadataWorkspaceId, tier },
    subscription_data:
      checkoutModeFor(tier) === "payment"
        ? undefined
        : {
            metadata: { userId: me, workspaceId: metadataWorkspaceId, tier },
          },
  });

  if (!session.url) {
    throw new Error("Stripe returned a session without a URL");
  }
  return { url: session.url };
}
