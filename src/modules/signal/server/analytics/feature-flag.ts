import "server-only";

/**
 * Two gates, not one (D-011).
 *
 * `SIGNAL_ANALYTICS_V1_ENABLED` reads like an "analytics view" switch and is
 * not one. Its only consumers are `signal-brief-page.tsx` — which chooses
 * *which briefing engine renders* at `/app/home/briefing` — and the analytics
 * authorization gate below. Turning it on therefore replaces a shipped,
 * operator-visible surface as a side effect of enabling a data domain.
 *
 * So the engine switch keeps its name and its meaning, and a dedicated
 * `SIGNAL_HOME_ANALYTICS_ENABLED` gates the new Home view. The analytics
 * domain accepts either, because the briefing engine genuinely needs the
 * domain; the Home view can be opened without touching the shipped briefing.
 *
 * Every environment is closed by default, and an explicit false always wins
 * over an absent value. Neither flag hides UI alone: `isAnalyticsDomainEnabled`
 * is the first thing `authorizeAnalyticsRequest` checks, so with both off the
 * domain 404s before authentication, before any provider read, and before any
 * persistence or export path can be reached.
 */

function readFlag(value: string | undefined): boolean | null {
  const configured = value?.trim().toLowerCase();
  if (configured === "true" || configured === "1") return true;
  if (configured === "false" || configured === "0") return false;
  return null;
}

/**
 * The briefing-engine switch. Chooses the progressive engine over the shipped
 * Full Briefing at `/app/home/briefing`. Leave off unless replacing that page
 * is the intent.
 */
export function isSignalAnalyticsEnabled(): boolean {
  return readFlag(process.env.SIGNAL_ANALYTICS_V1_ENABLED) ?? false;
}

/**
 * The Home Analytics view switch. Default off. Gates only the new local view;
 * it never changes which briefing renders.
 */
export function isHomeAnalyticsEnabled(): boolean {
  return readFlag(process.env.SIGNAL_HOME_ANALYTICS_ENABLED) ?? false;
}

/**
 * The analytics data domain: routes, providers, persistence, exports and jobs.
 * Open when either consumer is enabled, closed when both are off.
 */
export function isAnalyticsDomainEnabled(): boolean {
  return isSignalAnalyticsEnabled() || isHomeAnalyticsEnabled();
}
