/**
 * Client-side Sentry init. Next 16 picks this up automatically when
 * placed at `src/instrumentation-client.ts`.
 *
 * No-ops when DSN is unset.
 */
import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

const isBearerTimeline =
  typeof window !== "undefined" &&
  (window.location.pathname === "/s" || window.location.pathname.startsWith("/s/"));

if (process.env.NEXT_PUBLIC_SENTRY_DSN && !isBearerTimeline) {
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
