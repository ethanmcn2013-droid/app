import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/**
 * Strip PII from a Sentry event before it leaves the browser/server.
 *
 *   - user → reduced to `{id}` only (opaque Clerk userId)
 *   - request.cookies / data / query_string → dropped
 *   - request.headers → sensitive auth/session headers redacted
 *   - breadcrumbs to clerk/stripe/svix/webhooks endpoints → dropped
 *
 * Pairs with `sendDefaultPii: false` on the init, together they keep
 * IP, cookies, and Clerk session tokens out of Sentry payloads.
 */
const REDACTED_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "x-forwarded-for",
  "x-real-ip",
  "stripe-signature",
]);

function isSensitiveBreadcrumbUrl(url: string): boolean {
  return (
    url.includes("clerk.") ||
    url.includes("stripe.com") ||
    url.includes("svix.com") ||
    url.includes("/api/webhooks/") ||
    url.includes("/api/auth/")
  );
}

export function scrubEvent(
  event: ErrorEvent,
  _hint: EventHint,
): ErrorEvent | null {
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  const req = event.request;
  if (req) {
    delete req.cookies;
    delete req.data;
    delete req.query_string;
    if (req.headers) {
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        const key = k.toLowerCase();
        if (REDACTED_HEADERS.has(key) || key.startsWith("x-clerk-") || key.startsWith("svix-")) {
          continue;
        }
        if (typeof v === "string") filtered[k] = v;
      }
      req.headers = filtered;
    }
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.filter((b) => {
      const url = (b.data?.url as string | undefined) ?? "";
      return !isSensitiveBreadcrumbUrl(url);
    });
  }

  return event;
}
