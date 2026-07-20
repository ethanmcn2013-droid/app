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
const enforceCsp = process.env.SIGNAL_ENFORCE_CSP === "true";

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

const googleTag = "https://www.googletagmanager.com";
const googleAnalytics =
  "https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com";

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com ${clerkHosts} ${turnstile} https://clerk.accounts.dev https://js.stripe.com https://*.sentry.io ${googleTag}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://va.vercel-scripts.com ${clerkHosts} https://accounts.clerk.com https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://eu.i.posthog.com https://us.i.posthog.com ${googleTag} ${googleAnalytics}`,
  `frame-src 'self' ${turnstile} https://*.clerk.accounts.dev https://js.stripe.com https://hooks.stripe.com`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  // CSP violation reporting — collected at /api/csp-report so we can verify
  // the policy is clean before promoting Report-Only → enforce.
  `report-uri /api/csp-report`,
  `report-to csp`,
].join("; ");

const securityHeaders = [
  { key: enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: csp },
  { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

// AD-012: /embed/[slug] is a documented framable surface — partners and venue
// pages iframe it to show a live task board. The global "/(.*)" rule above
// sends X-Frame-Options: DENY and CSP frame-ancestors 'none', which blocks
// that contract. Fix: a second headers entry for /embed/:path* overrides
// exactly those two headers (Next.js "last key wins" per-path merge).
// All other security headers from the global rule still apply to embed routes.
const embedCsp = csp.replace("frame-ancestors 'none'", "frame-ancestors *");
const embedFrameHeaders = [
  // Override: allow framing from any origin (modern browsers honour CSP).
  { key: enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: embedCsp },
  // Override: SAMEORIGIN instead of DENY so legacy XFO-only browsers do not
  // hard-block the embed; CSP frame-ancestors * is the authoritative signal
  // for browsers that support it.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  env: {
    // Build-time, non-secret deployment posture used by shared server/client
    // access-mode code. Vercel preview and production builds receive the same
    // literal on both sides of hydration; an unset production build still
    // fails closed inside access-mode.ts.
    NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: process.env.VERCEL_ENV ?? "",
  },
  experimental: {
    // Tree-shake heavy barrel imports — Clerk is used in 17 files across
    // the app + marketing; the full barrel ships ~6× what we actually call.
    // Roadmap's next.config carries the same shape (Phase 6.2).
    optimizePackageImports: ["@clerk/nextjs", "motion"],
  },
  async headers() {
    return [
      // Global baseline — applies to every route including /embed.
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // AD-012: embed exception — overrides the two framing headers so that
      // /embed/:path* routes are framable. All other security headers from the
      // global rule above remain in effect (Next.js "last key wins" merge).
      {
        source: "/embed/:path*",
        headers: embedFrameHeaders,
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
