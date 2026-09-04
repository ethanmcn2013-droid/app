import type { PaidTier } from "@/server/stripe";
import commercialTerms from "./commercial-terms.v2.json";

/** The Event card's selfServe switch also guards both checkout entry points.
 * Reopen only after docs/execution/january-2027/EVENT-ACCESS-CLOSURE.md is met.
 * This governs new sessions, never settlement, refunds or existing grants.
 */
export const EVENT_SELF_SERVE_AVAILABLE = commercialTerms.plans.event.newSalesAvailable;

export const EVENT_UNAVAILABLE_MESSAGE =
  "New Event purchases are currently unavailable.";

export function checkoutAvailable(tier: PaidTier): boolean {
  return tier !== "event" || EVENT_SELF_SERVE_AVAILABLE;
}
