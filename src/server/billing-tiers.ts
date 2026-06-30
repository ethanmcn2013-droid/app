import type { EntitlementTier } from "@/lib/data";
import type { BillingInterval, PaidTier } from "@/server/stripe";

export function isOneTimePaidTier(tier: PaidTier): boolean {
  return tier === "event" || tier === "wedding";
}

export function paidTierDurationDays(
  tier: PaidTier | EntitlementTier,
  interval: BillingInterval = "monthly",
): number | null {
  if (tier === "wedding") return null;
  if (tier === "event") return 548; // 18 months.
  if (interval === "annual") return 365;
  return 30;
}
