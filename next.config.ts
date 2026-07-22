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

// Bearer-link Timelines are a deliberately isolated artifact surface. The
// browser may load first-party code and record one first-party view receipt,
// but no identity, advertising, analytics, payment, or error-reporting host is
// permitted to receive the token-bearing URL.
const audienceArtifactCsp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self'`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'none'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

const audienceArtifactHeaders = [
  { key: "Content-Security-Policy", value: audienceArtifactCsp },
  { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
  { key: "CDN-Cache-Control", value: "private, no-store" },
  { key: "Vercel-CDN-Cache-Control", value: "private, no-store" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

// AD-012: /embed/[slug] is a documented framable surface — partners and venue
// pages iframe it to show a live task board. A blocking X-Frame-Options on
// /embed cannot be neutralised by CSP frame-ancestors while the CSP ships
// Report-Only (browsers only let an ENFORCED frame-ancestors override XFO),
// so /embed must receive no X-Frame-Options at all: the global rule excludes
// /embed/* via negative lookahead, and /embed/:path* gets the full security
// header set minus XFO, with frame-ancestors * in its CSP.
const embedCsp = csp.replace("frame-ancestors 'none'", "frame-ancestors *");
const embedFrameHeaders = [
  { key: enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: embedCsp },
  ...securityHeaders.filter(
    (h) => h.key !== "X-Frame-Options" && !h.key.startsWith("Content-Security-Policy"),
  ),
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
      // Global baseline — every route EXCEPT /embed/* (AD-012: embed pages
      // must not receive X-Frame-Options; the exception entry below carries
      // the rest of the security headers for them).
      {
        source: "/((?!embed/).*)",
        headers: securityHeaders,
      },
      // AD-012: embed exception — framable surface: full security header set
      // minus X-Frame-Options, CSP with frame-ancestors *.
      {
        source: "/embed/:path*",
        headers: embedFrameHeaders,
      },
      {
        source: "/s/:path*",
        headers: audienceArtifactHeaders,
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
