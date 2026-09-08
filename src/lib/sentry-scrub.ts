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

const SENSITIVE_KEY = /(token|code|secret|authorization|cookie|password|credential)/i;

/**
 * WP-2. Key-name matching catches `refreshToken` and `refresh_token_cipher`
 * because both contain "token" — but it does nothing for a credential that
 * turns up inside a message string, which is exactly where one lands when
 * an SDK stringifies a failed request. These are the shapes Project Drive
 * introduces, matched on their own distinctive prefixes:
 *
 *   1//0g…      a Google OAuth refresh token
 *   ya29.…      a Google OAuth access token
 *   GOCSPX-…    a Google OAuth client secret
 *   sb1.1.…     one of our own sealed envelopes (see secret-box.ts)
 *
 * The sealed envelope is not a secret — that is the point of sealing it —
 * but it is still a per-customer credential blob, and Sentry is not where
 * it belongs.
 */
const CREDENTIAL_SHAPES: ReadonlyArray<RegExp> = [
  /\b1\/\/[A-Za-z0-9_-]{10,}/g,
  /\bya29\.[A-Za-z0-9._-]{10,}/g,
  /\bGOCSPX-[A-Za-z0-9_-]{10,}/g,
  /\bsb1\.\d+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

/** Replace anything shaped like a provider credential, wherever it sits. */
export function redactCredentialShapes(value: string): string {
  let out = value;
  for (const shape of CREDENTIAL_SHAPES) out = out.replace(shape, "[redacted]");
  return out;
}

export function redactSensitiveUrl(value: string): string {
  const withoutBearerPaths = value.replace(
    /\/(s|share|invite|redeem|oauth)\/[^/?#]+/gi,
    "/$1/[redacted]",
  );
  return withoutBearerPaths.replace(
    /([?&](?:code|token|access_token|refresh_token|id_token|state)=)[^&#]*/gi,
    "$1[redacted]",
  );
}

function redactSensitiveText(value: string): string {
  // Shapes first: a bare credential in a message has no key name and no
  // query-string framing for the two passes below to catch it by.
  return redactSensitiveUrl(redactCredentialShapes(value)).replace(
    /\b(token|code|secret|authorization|credential)\s*[:=]\s*[^\s,;]+/gi,
    "$1=[redacted]",
  );
}

function scrubRecord(
  value: Record<string, unknown> | undefined,
  depth = 0,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof item === "string") {
      result[key] = redactSensitiveText(item);
    } else if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      depth < 3
    ) {
      result[key] = scrubRecord(item as Record<string, unknown>, depth + 1);
    } else {
      result[key] = item;
    }
  }
  return result;
}

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
  void _hint;
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  const req = event.request;
  if (req) {
    if (req.url) req.url = redactSensitiveUrl(req.url);
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

  if (event.tags) {
    event.tags = Object.fromEntries(
      Object.entries(event.tags).filter(([key]) => !SENSITIVE_KEY.test(key)),
    );
  }
  event.extra = scrubRecord(event.extra as Record<string, unknown> | undefined);
  event.contexts = scrubRecord(
    event.contexts as Record<string, unknown> | undefined,
  ) as ErrorEvent["contexts"];
  if (event.message) event.message = redactSensitiveText(event.message);
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = redactSensitiveText(value.value);
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .filter((breadcrumb) => {
        const url = (breadcrumb.data?.url as string | undefined) ?? "";
        return !isSensitiveBreadcrumbUrl(url);
      })
      .map((breadcrumb) => ({
        ...breadcrumb,
        message: breadcrumb.message
          ? redactSensitiveText(breadcrumb.message)
          : breadcrumb.message,
        data: scrubRecord(breadcrumb.data as Record<string, unknown> | undefined),
      }));
  }

  return event;
}
