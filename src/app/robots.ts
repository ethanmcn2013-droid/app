import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tasks.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/about", "/students", "/changelog"],
        // Auth-stub workspace + per-token guest links shouldn't be
        // crawled. /api is server-only.
        disallow: ["/app", "/share", "/redeem", "/welcome", "/api"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
