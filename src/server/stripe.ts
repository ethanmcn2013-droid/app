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
 *  Studio is the operator tier, unlimited workspaces the user
 *  owns as sole admin; not sold on the public /pricing surface.
 *  The Stripe subscription
 *  is at the user level; entitlement rows for Studio carry
 *  `workspaceId = NULL` so `getEffectiveTier` resolves it across all
 *  owned workspaces in one read. */
/** Stripe price IDs keyed by canonical tier name. One canonical env
 *  name per tier since the 2026-07-31 reset (the historical _PRO_
 *  alias is retired). */
export const PRICE_IDS = {
  workspace: process.env.STRIPE_PRICE_WORKSPACE_MONTHLY ?? "",
  studio: process.env.STRIPE_PRICE_STUDIO_MONTHLY ?? "",
  wedding: process.env.STRIPE_PRICE_WEDDING_ONETIME ?? "",
  event: process.env.STRIPE_PRICE_EVENT_ONETIME ?? "",
} as const;

export type PaidTier = keyof typeof PRICE_IDS;

export type BillingInterval = "monthly" | "annual";

export class MissingStripePriceError extends Error {
  constructor(
    readonly tier: PaidTier,
    readonly interval: BillingInterval,
  ) {
    super(`No Stripe ${interval} price id for tier "${tier}".`);
    this.name = "MissingStripePriceError";
  }
}

/**
 * Annual prices are sparse, only Workspace has one today (€120/yr,
 * ratified 2026-05-16, Studio decision venue-editions-paid-tier). Set
 * STRIPE_PRICE_WORKSPACE_ANNUAL once the Stripe Price object exists.
 * Until then `priceIdFor(tier, "annual")` returns null. Checkout fails
 * explicitly; an annual buyer must never receive a monthly plan.
 */
const ANNUAL_PRICE_IDS: Partial<Record<PaidTier, string>> = {
  workspace: process.env.STRIPE_PRICE_WORKSPACE_ANNUAL ?? "",
};

export function priceIdFor(
  tier: PaidTier,
  interval: BillingInterval = "monthly",
): string | null {
  if (interval === "annual") {
    const annual = ANNUAL_PRICE_IDS[tier];
    return annual || null;
  }
  const id = PRICE_IDS[tier];
  return id || null;
}

/**
 * `undefined` when the env var is not set. Callers must null-guard
 * before passing to `stripe.webhooks.constructEvent`, an empty string
 * default would hide the missing-secret bug from TypeScript and produce
 * a runtime signature-verification failure instead of a clear error.
 */
export const WEBHOOK_SECRET: string | undefined =
  process.env.STRIPE_WEBHOOK_SECRET || undefined;
