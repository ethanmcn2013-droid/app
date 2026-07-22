import "server-only";

import { isProductionMode } from "@/lib/access-mode";

/**
 * One reversible gate for the progressive analytics surface.
 *
 * Production is closed by default. Staging/operator environments opt in with
 * `SIGNAL_ANALYTICS_V1_ENABLED=true`; an explicit false always wins. Keeping
 * this decision here prevents route and component checks from drifting.
 */
export function isSignalAnalyticsEnabled(): boolean {
  const configured = process.env.SIGNAL_ANALYTICS_V1_ENABLED?.trim().toLowerCase();
  if (configured === "true" || configured === "1") return true;
  if (configured === "false" || configured === "0") return false;
  return !isProductionMode();
}
