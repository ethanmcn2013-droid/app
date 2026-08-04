import type { MetadataRoute } from "next";
import { TASKS_PUBLIC_ORIGIN } from "@/lib/product-urls";

const BASE_URL = TASKS_PUBLIC_ORIGIN;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/about", "/students", "/changelog"],
        // Auth-stub workspace + per-token guest links shouldn't be
        // crawled. /api is server-only.
        //
        // `/p` was added 2026-08-03 under D-033, which ratified R-031 option
        // B. A published workspace renders task titles and tags; on a wedding
        // workspace those carry guests' and suppliers' names. The page stays
        // public and stays linkable — that is the point of the keepsake — it
        // is simply not offered to crawlers by default.
        //
        // KNOWN INTERACTION, recorded rather than hidden. A Disallow stops an
        // obedient crawler fetching the page, which also stops it reading a
        // per-page `noindex`. So a URL discovered from an external link can
        // still be listed URL-only. Closing that residual needs an
        // `X-Robots-Tag` response header, which cannot be set per workspace in
        // next.config and is written up in the E06.05 evidence as the
        // follow-on. Both controls are needed; this one alone is not enough.
        disallow: ["/app", "/p", "/s", "/share", "/redeem", "/welcome", "/api"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
