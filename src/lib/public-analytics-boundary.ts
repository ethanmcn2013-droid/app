/**
 * The couple-facing public surfaces, where no third-party analytics runs.
 *
 * R-032, decided as Option A in D-033: `/p`, `/s`, `/share` and `/embed` are
 * excluded from GA4 entirely and unconditionally. These pages carry other
 * people's names. The person being measured on them is a wedding guest or a
 * supplier who followed a link from a couple, has no relationship with Signal
 * Studio, and whose presence on the page is itself information about the
 * couple's wedding.
 *
 * Deliberately separate from `isBareArtifactPath`, which answers a different
 * question (does this route get the stripped bearer-link runtime) and governs
 * the proxy. Folding the two together would silently change `/p`'s runtime.
 */
const ANALYTICS_EXCLUDED_ROOTS = ["/p", "/s", "/share", "/embed"] as const;

export const PUBLIC_ANALYTICS_EXCLUDED_ROUTES: readonly string[] =
  ANALYTICS_EXCLUDED_ROOTS;

export function isAnalyticsExcludedPath(pathname: string): boolean {
  return ANALYTICS_EXCLUDED_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}
