import "server-only";
import Stripe from "stripe";

/**
 * Stripe SDK singleton. Keys are env-gated; when unset (dev/preview
 * before secrets land), `stripe` is null and consumer code should
 * surface a friendly "Stripe not configured" error rather than
 * crashing on import.
 */

const SECRET = process.env.STRIPE_SECRET_KEY;

export const stripe: Stripe | null = SECRET
  ? new Stripe(SECRET, {
      apiVersion: "2026-04-22.dahlia",
      typescript: true,
    })
  : null;

export const stripeConfigured = Boolean(SECRET);

/** Public price-id table. Each tier maps to a Stripe Price minted in
 *  the dashboard. Production sets these via env; dev defaults to the
 *  template values from `.env.example`.
 *
 *  Studio (Phase 4) is the operator-tier — $14.95/mo, unlimited
 *  workspaces the user owns as sole admin. The Stripe subscription
 *  is at the user level; entitlement rows for Studio carry
 *  `workspaceId = NULL` so `getEffectiveTier` resolves it across all
 *  owned workspaces in one read. */
export const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  team: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? "",
  studio: process.env.STRIPE_PRICE_STUDIO_MONTHLY ?? "",
  wedding: process.env.STRIPE_PRICE_WEDDING_ONETIME ?? "",
} as const;

export type PaidTier = keyof typeof PRICE_IDS;

export function priceIdFor(tier: PaidTier): string | null {
  const id = PRICE_IDS[tier];
  return id || null;
}

export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
