/**
 * Two different questions, kept apart on purpose.
 *
 * `isBareArtifactPath` — is this the public bearer-link artifact? It governs
 * the proxy's unauthenticated fast path plus the no-store / noindex response
 * headers, and it keeps the Google tag off those pages client-side. Widening
 * it would hand an /app route the same auth bypass, so it stays exactly the
 * `/s` surface it has always described.
 *
 * `isBareChromePath` — should this screen render without the Studio Bar and
 * the product rail? Every bearer-link path qualifies, and so does the Timeline
 * owner preview, whose entire job is to show the page an audience receives
 * with none of the application around it. The preview is still an
 * authenticated /app route: it never takes the bypass above.
 *
 * The chrome answer is read from the live pathname, in SuiteChromeGate
 * (components/app/suite-chrome-gate.tsx), because a client navigation changes
 * the answer without producing a new request for a server layout to read. The
 * request header below is the same answer taken a second time, early enough to
 * keep the analytics tag and the suite preconnect hints out of the document
 * <head>, which is decided once and cannot be revised later.
 */

/** The request header the root layout reads before the document is built. */
export const BARE_CHROME_HEADER = "x-signal-bare-artifact";

/** `/app/timeline/<projectSlug>/preview`, and nothing else under /app. */
const TIMELINE_PREVIEW_PATH = /^\/app\/timeline\/[^/]+\/preview\/?$/;

export function isBareArtifactPath(pathname: string): boolean {
  return pathname === "/s" || pathname.startsWith("/s/");
}

export function isTimelinePreviewPath(pathname: string): boolean {
  return TIMELINE_PREVIEW_PATH.test(pathname);
}

export function isBareChromePath(pathname: string): boolean {
  return isBareArtifactPath(pathname) || isTimelinePreviewPath(pathname);
}
