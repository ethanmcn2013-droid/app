import type { MetadataRoute } from "next";
import { TASKS_URL } from "@/lib/product-urls";

const BASE_URL = TASKS_URL;

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
