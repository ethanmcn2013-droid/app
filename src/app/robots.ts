import type { MetadataRoute } from "next";

/**
 * This host serves no marketing pages.
 *
 * Estate consolidation (2026-08-12): every marketing surface that used to
 * live here now 308s to signalstudio.ie, so the allow-list this file used
 * to carry (`/pricing`, `/about`, `/students`, `/changelog`) pointed at
 * routes that no longer exist. What remains on app.signalstudio.ie is the
 * signed-in product plus a small set of deliberately published artifacts.
 *
 * The sitemap declaration went with them. It was built from
 * TASKS_PUBLIC_ORIGIN and therefore advertised thirty-five URLs on
 * tasks.signalstudio.ie — a hostname whose root already redirected away.
 * Search Console was being handed a map of a retired domain. Do not
 * reintroduce a sitemap here; signalstudio.ie owns the indexed estate.
 *
 * `/p` stays disallowed under D-033 (which ratified R-031 option B). A
 * published workspace renders task titles and tags; on a wedding workspace
 * those carry guests' and suppliers' names. The page stays public and stays
 * linkable — that is the point of the keepsake — it is simply not offered
 * to crawlers by default.
 *
 * KNOWN INTERACTION, recorded rather than hidden. A Disallow stops an
 * obedient crawler fetching the page, which also stops it reading a
 * per-page `noindex`. So a URL discovered from an external link can still
 * be listed URL-only. Closing that residual needs an `X-Robots-Tag`
 * response header, which cannot be set per workspace in next.config and is
 * written up in the E06.05 evidence as the follow-on. Both controls are
 * needed; this one alone is not enough.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // The published-artifact surfaces a person may deliberately share.
        allow: ["/the-wedding", "/embed"],
        disallow: [
          "/",
          "/app",
          "/p",
          "/s",
          "/share",
          "/redeem",
          "/invite",
          "/welcome",
          "/settings",
          "/api",
        ],
      },
    ],
  };
}
