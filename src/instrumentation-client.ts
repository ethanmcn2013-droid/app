/**
 * Client-side Sentry init. Next 16 picks this up automatically when
 * placed at `src/instrumentation-client.ts`.
 *
 * No-ops when DSN is unset.
 */
import * as Sentry from "@sentry/nextjs";
import { isAnalyticsExcludedPath } from "@/lib/public-analytics-boundary";
import { scrubEvent } from "@/lib/sentry-scrub";

// R-032 / D-033 Option A says NO third-party analytics on any couple-facing
// public surface. Sentry is a third party, and this file previously excluded
// only `/s`, so `/p`, `/share` and `/embed` still initialised it — which meant
// removing GA4 did not satisfy the ratified sentence.
//
// This now uses the SAME boundary as GA4 rather than its own list. Two lists
// drift; one cannot. If a fifth couple-facing route is added later it is
// excluded from both by construction.
//
// Note this suppresses transactions as well as errors. `beforeSend` only sees
// error events, so a route excluded here would otherwise still have sent its
// transaction URL — and on these surfaces the URL is the disclosure.
const isCoupleFacingSurface =
  typeof window !== "undefined" &&
  isAnalyticsExcludedPath(window.location.pathname);

if (process.env.NEXT_PUBLIC_SENTRY_DSN && !isCoupleFacingSurface) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "development",
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
