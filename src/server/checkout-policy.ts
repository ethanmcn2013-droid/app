import type { PaidTier } from "./stripe";

export function isPaidTier(value: unknown): value is PaidTier {
  return value === "workspace" || value === "studio" || value === "wedding" || value === "event";
}

export function checkoutModeFor(tier: PaidTier): "payment" | "subscription" {
  return tier === "event" || tier === "wedding" ? "payment" : "subscription";
}

/** Event buys twelve calendar months. Clamp leap-day anniversaries. */
export function eventAccessExpiresAt(paidAt: Date): Date {
  const expiry = new Date(paidAt);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  if (expiry.getUTCMonth() !== paidAt.getUTCMonth()) expiry.setUTCDate(0);
  return expiry;
}
