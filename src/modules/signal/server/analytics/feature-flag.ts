import "server-only";

/**
 * One reversible gate for the progressive analytics surface.
 *
 * Every environment is closed by default. A staging/operator environment must
 * opt in explicitly with `SIGNAL_ANALYTICS_V1_ENABLED=true`; an explicit false
 * always wins. Keeping this decision here prevents route and component checks
 * from drifting.
 */
export function isSignalAnalyticsEnabled(): boolean {
  const configured = process.env.SIGNAL_ANALYTICS_V1_ENABLED?.trim().toLowerCase();
  if (configured === "true" || configured === "1") return true;
  if (configured === "false" || configured === "0") return false;
  return false;
}
