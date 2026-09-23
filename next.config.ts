import type { NextConfig } from "next";
import { SERVER_ACTION_BODY_LIMIT } from "./src/lib/upload-limit";

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

// WP-0: attachment bytes go from the browser straight to Vercel Blob, so
// the browser now originates two requests it never used to. `vercel.com`
// is the control-plane host a presigned PUT is signed against; the
// `*.blob.vercel-storage.com` wildcard covers the object host the response
// names. Both are browser-originated, so both belong in the policy — the
// server-side calls in src/server/storage.ts do not.
const blobUpload =
  "https://vercel.com https://*.blob.vercel-storage.com";

// Project Drive delegates attachment bytes straight from the signed-in
// browser to a server-minted Google resumable session. This exact API origin
// is sufficient; Drive pages are opened in a new tab and are never framed.
const googleDriveApi = "https://www.googleapis.com";

const googleTag = "https://www.googletagmanager.com";
const googleAnalytics =
  "https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com";

/**
 * R-032, decided as Option A in D-033: the couple-facing public routes carry
 * no third-party analytics. `analytics: false` drops the Google tag and
 * Analytics hosts from script-src and connect-src, so the policy itself
 * refuses what `@/lib/public-analytics-boundary` already stops the component
 * from rendering. Two layers, deliberately: the component seam is the control
 * that runs today, this is defence in depth.
 */
function buildCsp({
  analytics,
  frameAncestors,
}: {
  analytics: boolean;
  frameAncestors: string;
}) {
  const tagScript = analytics ? ` ${googleTag}` : "";
  const tagConnect = analytics ? ` ${googleTag} ${googleAnalytics}` : "";
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com ${clerkHosts} ${turnstile} https://clerk.accounts.dev https://js.stripe.com https://*.sentry.io${tagScript}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://va.vercel-scripts.com ${clerkHosts} https://accounts.clerk.com https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://eu.i.posthog.com https://us.i.posthog.com ${blobUpload} ${googleDriveApi}${tagConnect}`,
    `frame-src 'self' ${turnstile} https://*.clerk.accounts.dev https://js.stripe.com https://hooks.stripe.com`,
    `worker-src 'self' blob:`,
    `frame-ancestors ${frameAncestors}`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
    // CSP violation reporting — collected at /api/csp-report so we can verify
    // the policy is clean before promoting Report-Only → enforce.
    `report-uri /api/csp-report`,
    `report-to csp`,
  ].join("; ");
}

const csp = buildCsp({ analytics: true, frameAncestors: `'none'` });

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

/**
 * ── No third-party analytics on couple-facing public surfaces ──────────
 *
 * D-033 ratified R-032 option A: `/p`, `/s`, `/share` and `/embed` are excluded
 * from GA4 entirely and unconditionally. `/s` already receives
 * `audienceArtifactHeaders`, whose enforced CSP names no third-party host at
 * all. These headers cover the other three.
 *
 * This is the third of three layers. The first is `isAnalyticsExcludedPath` in
 * src/lib/public-analytics-boundary.ts; the second is `<GoogleTag>` calling it
 * itself rather than trusting its `enabled` prop. The component seam is the
 * control that actually runs today; this one means the browser refuses the
 * loader and the beacon even if a tag were somehow rendered.
 *
 * Deliberately a PARTIAL policy — script-src, connect-src and three cheap
 * hardening directives identical to the baseline. It sets no `default-src`, so
 * it can only ever restrict what a page executes and connects to, never what it
 * may load or render. The baseline CSP still ships alongside it. Two policies
 * of the same name intersect, which is the standards-defined way to add a
 * restriction to one route without touching the global rule's source literal
 * (scripts/check-frame-headers.mjs pins that literal).
 *
 * Emitted ENFORCED, not Report-Only. The baseline ships Report-Only until
 * SIGNAL_ENFORCE_CSP is set; a privacy control that only reports is not a
 * control. Restricting rather than granting is what makes that safe here.
 *
 * `frame-ancestors` is repeated at the value each route already has, so that if
 * SIGNAL_ENFORCE_CSP is ever set — making the baseline use this same header key
 * — an override cannot silently relax framing on these routes.
 */
function noThirdPartyAnalyticsCsp(frameAncestors: string): string {
  const policy = [
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com ${clerkHosts} ${turnstile} https://clerk.accounts.dev https://js.stripe.com https://*.sentry.io`,
    `connect-src 'self' https://va.vercel-scripts.com ${clerkHosts} https://accounts.clerk.com https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io`,
    `frame-ancestors ${frameAncestors}`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");
  if (policy.includes(googleTag) || policy.includes("google-analytics.com")) {
    throw new Error(
      "next.config: the couple-facing analytics policy names a Google host. R-032 forbids it.",
    );
  }
  return policy;
}

const publicSurfaceAnalyticsHeaders = [
  { key: "Content-Security-Policy", value: noThirdPartyAnalyticsCsp("'none'") },
];

const embedSurfaceAnalyticsHeaders = [
  { key: "Content-Security-Policy", value: noThirdPartyAnalyticsCsp("*") },
];

// Reconciliation note. Two Wave 3 packages implemented R-032 in this file
// concurrently. Both shipped an enforced, analytics-free CSP for /p and
// /share; the difference was full policy versus partial. The partial policy
// above is kept because an unconditionally enforced `default-src 'self'` on
// /p and /share is a behaviour change the baseline has not yet been promoted
// to make, and the privacy control does not need it. Same outcome for
// analytics, smaller blast radius.

const productionAppHosts = [
  "app.signalstudio.ie",
  "tasks.signalstudio.ie",
] as const;

function retiredMarketingRedirects() {
  const paths = [
    {
      source: "/features",
      destination: "https://signalstudio.ie/tasks",
    },
    {
      source: "/pricing",
      destination: "https://signalstudio.ie/pricing",
    },
    {
      source: "/changelog",
      destination: "https://signalstudio.ie/dispatch",
    },
    {
      source: "/about",
      destination: "https://signalstudio.ie/about",
    },
    {
      source: "/roadmap",
      destination: "https://signalstudio.ie/timeline",
    },
    // ── Estate consolidation (2026-08-12) ───────────────────────────────
    // The rest of the marketing surface follows the five above. Everything
    // here titled itself "Tasks" rather than Signal Studio, and every path
    // also answered on tasks.signalstudio.ie — productionAppHosts covers
    // both hosts, which is the point: without these, tasks./templates/*
    // keeps serving 200s off a hostname we retired.
    {
      source: "/students",
      destination: "https://signalstudio.ie/students",
    },
    {
      source: "/principles",
      destination: "https://signalstudio.ie/principles",
    },
    {
      source: "/privacy",
      destination: "https://signalstudio.ie/privacy",
    },
    {
      source: "/terms",
      destination: "https://signalstudio.ie/terms",
    },
    {
      source: "/security",
      destination: "https://signalstudio.ie/security",
    },
    {
      source: "/status",
      destination: "https://signalstudio.ie/",
    },
    {
      source: "/templates",
      destination: "https://signalstudio.ie/tasks",
    },
    // One wildcard for all thirteen slugs. The two slug-rename rules that
    // used to sit further down (final-paper-sprint, job-application-sprint)
    // are deleted: they would have chained old slug → new slug → here.
    {
      source: "/templates/:path*",
      destination: "https://signalstudio.ie/tasks",
    },
    // Ordered before the /for wildcard — first match wins.
    {
      source: "/for/students",
      destination: "https://signalstudio.ie/students",
    },
    {
      source: "/for/weddings",
      destination: "https://signalstudio.ie/venues",
    },
    {
      source: "/for/:path*",
      destination: "https://signalstudio.ie/tasks",
    },
    // Exact path only: the functional /embed/[slug] surface is untouched.
    {
      source: "/embed/guide",
      destination: "https://signalstudio.ie/tasks",
    },
  ] as const;

  return productionAppHosts.flatMap((host) =>
    paths.map((route) => ({
      ...route,
      has: [{ type: "host" as const, value: host }],
      permanent: true,
    })),
  );
}

// AD-012: /embed/[slug] is a documented framable surface — partners and venue
// pages iframe it to show a live task board. A blocking X-Frame-Options on
// /embed cannot be neutralised by CSP frame-ancestors while the CSP ships
// Report-Only (browsers only let an ENFORCED frame-ancestors override XFO),
// so /embed must receive no X-Frame-Options at all: the global rule excludes
// /embed/* via negative lookahead, and /embed/:path* gets the full security
// header set minus XFO, with frame-ancestors * in its CSP.
// Analytics off here too (R-032 / D-033): /embed renders a couple's published
// workspace inside somebody else's page.
const embedCsp = buildCsp({ analytics: false, frameAncestors: "*" });
const embedFrameHeaders = [
  { key: enforceCsp ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: embedCsp },
  ...securityHeaders.filter(
    (h) => h.key !== "X-Frame-Options" && !h.key.startsWith("Content-Security-Policy"),
  ),
];

const nextConfig: NextConfig = {
  // Dev-only: the floating dev-tools badge sits over the bottom-nav Home tab
  // at 375px and contaminates every mobile design capture. No production effect.
  devIndicators: false,
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
    serverActions: {
      // Photo capture in Notes posts image bytes to a server action, and
      // base64 inflates them by about 1.37x, so the framework's 1 MB
      // default rejects anything over roughly 730 KB with a generic error.
      //
      // WP-0: this was 8 MB, which is ABOVE Vercel's own 4.5 MB cap on a
      // function request body — so it never fired, and bodies between the
      // two got an opaque platform 413 instead. The value now comes from
      // src/lib/upload-limit.ts, sits under the platform cap on purpose,
      // and is asserted against it by
      // src/server/upload-limit-contract.test.ts. Attachment bytes no
      // longer travel this way at all; they go browser → Vercel Blob.
      bodySizeLimit: SERVER_ACTION_BODY_LIMIT,
    },
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
        headers: [...embedFrameHeaders, ...embedSurfaceAnalyticsHeaders],
      },
      {
        source: "/s/:path*",
        headers: audienceArtifactHeaders,
      },
      // R-032 / D-033: no third-party analytics on the couple-facing public
      // surfaces. /s already carries an enforced, analytics-free policy above.
      {
        source: "/p/:path*",
        headers: publicSurfaceAnalyticsHeaders,
      },
      {
        source: "/share/:path*",
        headers: publicSurfaceAnalyticsHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/app",
        has: [{ type: "host", value: "tasks.signalstudio.ie" }],
        destination: "https://app.signalstudio.ie/app/tasks",
        permanent: true,
      },
      {
        source: "/app/:path*",
        has: [{ type: "host", value: "tasks.signalstudio.ie" }],
        destination: "https://app.signalstudio.ie/app/:path*",
        permanent: true,
      },
      {
        source: "/app/board",
        destination: "/app/tasks",
        permanent: false,
      },
      {
        source: "/app/tasks/board",
        destination: "/app/tasks",
        permanent: false,
      },
      {
        source: "/app/list",
        destination: "/app/tasks/list",
        permanent: false,
      },
      {
        source: "/app/calendar",
        destination: "/app/tasks/calendar",
        permanent: false,
      },
      {
        source: "/app/plan",
        destination: "/app/timeline",
        permanent: false,
      },
      {
        source: "/app/plan/:path*",
        destination: "/app/timeline/:path*",
        permanent: false,
      },
      {
        source: "/app/brief",
        destination: "/app/signal",
        permanent: false,
      },
      {
        source: "/app/brief/:path*",
        destination: "/app/signal/:path*",
        permanent: false,
      },
      // The two /templates slug renames (final-paper-sprint,
      // job-application-sprint) were removed in the 2026-08-12 estate
      // consolidation. They resolved to sibling template pages that no
      // longer exist, so leaving them here would have chained old slug →
      // new slug → the umbrella. The /templates/:path* rule inside
      // retiredMarketingRedirects() now catches every slug in one hop.
      ...retiredMarketingRedirects(),
    ];
  },
};

export default nextConfig;
