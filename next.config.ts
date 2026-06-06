import type { NextConfig } from "next";

/**
 * ── Security headers ───────────────────────────────────────────────
 * Suite-wide baseline — matches Studio/Roadmap pattern (Plan 4.1).
 *   1. Standard headers (HSTS, X-Frame-Options, etc.) in enforce mode.
 *   2. Content-Security-Policy in Report-Only mode — promote to
 *      enforce once verified clean.
 *
 * Tasks-specific allowances vs Studio CSP:
 *   - Clerk (auth) hosts
 *   - Stripe (checkout / payments)
 *   - Sentry (browser SDK ingest)
 *
 * Server-side API calls (Resend, OpenAI/Anthropic, Turso) don't need
 * CSP entries — only the browser-originated network goes here.
 */

const isDev = process.env.NODE_ENV === "development";

// CSP allowlists mirrored from notes/next.config.ts (suite-locked enforce model). Report-Only until cross-suite verification — see audit/ISSUES.md suite-01.
// Clerk's prod Frontend API is a CNAME under our own domain, so the
// wildcard `https://*.signalstudio.ie` covers whatever label Clerk
// uses without a deploy-time guess. *.clerk.com + clerk-telemetry.com
// cover Clerk infra/telemetry; Turnstile bot-protection on Cloudflare.
// Stripe (js.stripe.com, api.stripe.com, hooks.stripe.com) and Sentry
// browser ingest are tasks-specific and stay.
const clerkHosts =
  "https://*.signalstudio.ie https://*.clerk.accounts.dev https://*.clerk.com https://clerk-telemetry.com";
const turnstile = "https://challenges.cloudflare.com";

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com ${clerkHosts} ${turnstile} https://clerk.accounts.dev https://js.stripe.com https://*.sentry.io`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://va.vercel-scripts.com ${clerkHosts} https://accounts.clerk.com https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
  `frame-src 'self' ${turnstile} https://*.clerk.accounts.dev https://js.stripe.com https://hooks.stripe.com`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shake heavy barrel imports — Clerk is used in 17 files across
    // the app + marketing; the full barrel ships ~6× what we actually call.
    // Roadmap's next.config carries the same shape (Phase 6.2).
    optimizePackageImports: ["@clerk/nextjs", "motion"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/templates/final-paper-sprint", destination: "/templates/final-paper-push", permanent: true },
      { source: "/templates/job-application-sprint", destination: "/templates/job-application-push", permanent: true },
    ];
  },
};

export default nextConfig;
