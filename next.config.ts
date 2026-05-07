import type { NextConfig } from "next";

/**
 * Vercel deploy needs the seeded `tasks.db` file shipped in every
 * function bundle (we copy it to /tmp on cold start). `outputFileTracingIncludes`
 * tells Next.js to include the file in every traced function output.
 *
 * The `serverExternalPackages` entry keeps `better-sqlite3`'s native
 * binding out of the webpack/turbopack bundle so Vercel's Linux
 * prebuilt binary is what gets resolved at runtime.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/**": ["./tasks.db"],
  },
};

export default nextConfig;
