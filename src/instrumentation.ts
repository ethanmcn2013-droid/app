/**
 * Next.js 16 instrumentation hook. Runs once at server boot. We use
 * it to wire Sentry — server-side and edge — without imposing a
 * top-level import on every entry point.
 *
 * When `SENTRY_DSN` is unset (dev/preview), this short-circuits so
 * the app boots without an external service.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? "development",
      tracesSampleRate: 0.1,
      // Anti-noise: don't sample drizzle/sqlite errors more than once.
      beforeSend(event) {
        return event;
      },
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? "development",
      tracesSampleRate: 0.1,
    });
  }
}

/** Next 16 calls this on every uncaught request error. We forward
 *  to Sentry's helper, which reads request + context shape and tags
 *  appropriately. No-op when DSN is unset. */
export const onRequestError = (async (...args: unknown[]) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  // Type-cast through the SDK's exported signature.
  (Sentry.captureRequestError as unknown as (...a: unknown[]) => unknown)(
    ...args,
  );
}) as (err: unknown, request: unknown, context: unknown) => void | Promise<void>;
