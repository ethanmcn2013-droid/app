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

const MAX_SCRUB_DEPTH = 12;
const CIRCULAR_VALUE = "[circular]";
const TRUNCATED_VALUE = "[truncated]";

/**
 * Whether a field name identifies credential material rather than useful
 * diagnostics. Keep `code` narrow: an OAuth response's bare `code` is a
 * credential, while `statusCode` is the useful shape of a provider failure.
 */
export function isSensitiveFieldName(value: string): boolean {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  const parts = normalized.split("_").filter(Boolean);

  if (
    parts.some((part) =>
      [
        "authorization",
        "cookie",
        "credential",
        "password",
        "passphrase",
        "secret",
        "token",
        "tokens",
      ].includes(part),
    )
  ) {
    return true;
  }

  return (
    normalized === "code" ||
    normalized === "oauth_code" ||
    normalized === "auth_code" ||
    normalized === "authorization_code" ||
    normalized === "code_verifier" ||
    normalized === "state" ||
    normalized === "oauth_state" ||
    normalized === "api_key" ||
    normalized === "private_key" ||
    normalized === "signing_key" ||
    normalized === "session_url" ||
    normalized === "upload_url" ||
    normalized === "resumable_uri" ||
    normalized === "resumable_url"
  );
}

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
  /https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?[^\s"'<>]+/gi,
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
  const withoutUserInfo = value.replace(
    /\b(https?:\/\/)[^\s/:@]+:[^\s/@]+@/gi,
    "$1[redacted]@",
  );
  const withoutBearerPaths = withoutUserInfo.replace(
    /\/(s|share|invite|redeem|oauth)\/[^/?#]+/gi,
    "/$1/[redacted]",
  );
  return withoutBearerPaths.replace(
    /([?&#](?:code|token|access_token|refresh_token|id_token|state|client_secret|authorization|password|credential|signature|upload_id)=)[^&#\s]*/gi,
    "$1[redacted]",
  );
}

const SENSITIVE_TEXT_PAIR =
  /((?:["']?)\b(?:access[_-]?token|refresh[_-]?token|id[_-]?token|token|oauth[_-]?code|auth(?:orization)?[_-]?code|code|client[_-]?secret|secret|authorization|password|credential)\b(?:["']?)\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:Bearer|Basic)\s+[^\s,;}\]]+|[^\s,;&}\]]+)/gi;

/** The one string transform used at every telemetry/logging boundary. */
export function redactSensitiveText(value: string): string {
  // Shapes first: a bare credential in a message has no key name and no
  // query-string framing for the two passes below to catch it by.
  const withoutCredentials = redactSensitiveUrl(
    redactCredentialShapes(value),
  ).replace(
    /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    "$1 [redacted]",
  );
  return withoutCredentials.replace(
    SENSITIVE_TEXT_PAIR,
    (_match, prefix: string, rawValue: string) => {
      const quote = rawValue.startsWith('"')
        ? '"'
        : rawValue.startsWith("'")
          ? "'"
          : "";
      return `${prefix}${quote}[redacted]${quote}`;
    },
  );
}

function scrubUnknown(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }
  if (typeof value === "bigint" || typeof value === "symbol") {
    return String(value);
  }
  if (typeof value === "function") return "[function]";
  if (typeof value !== "object") return value;

  if (depth >= MAX_SCRUB_DEPTH) return TRUNCATED_VALUE;
  if (seen.has(value)) return CIRCULAR_VALUE;
  seen.add(value);

  if (value instanceof Date) return value.toISOString();
  if (value instanceof URL) return redactSensitiveText(value.toString());
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return "[binary]";

  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item, depth + 1, seen));
  }

  if (value instanceof Map) {
    const result: Record<string, unknown> = {};
    for (const [rawKey, item] of value.entries()) {
      const key = String(rawKey);
      if (isSensitiveFieldName(key) || redactSensitiveText(key) !== key) continue;
      result[key] = scrubUnknown(item, depth + 1, seen);
    }
    return result;
  }

  if (value instanceof Set) {
    return Array.from(value, (item) => scrubUnknown(item, depth + 1, seen));
  }

  if (typeof Headers !== "undefined" && value instanceof Headers) {
    const result: Record<string, unknown> = {};
    value.forEach((item, rawKey) => {
      const key = rawKey.toLowerCase();
      if (
        REDACTED_HEADERS.has(key) ||
        key.startsWith("x-clerk-") ||
        key.startsWith("svix-") ||
        isSensitiveFieldName(key)
      ) {
        return;
      }
      result[rawKey] = redactSensitiveText(item);
    });
    return result;
  }

  const result: Record<string, unknown> = {};
  const keys = new Set(Object.keys(value));
  if (value instanceof Error) {
    for (const key of ["name", "message", "stack", "cause"]) {
      if (key in value) keys.add(key);
    }
  }

  for (const key of keys) {
    if (isSensitiveFieldName(key) || redactSensitiveText(key) !== key) continue;
    try {
      result[key] = scrubUnknown(
        (value as Record<string, unknown>)[key],
        depth + 1,
        seen,
      );
    } catch {
      // Provider errors occasionally expose accessor-backed response fields.
      // A failing getter must not disable the whole beforeSend boundary.
      result[key] = "[unavailable]";
    }
  }
  return result;
}

function isSensitiveBreadcrumbUrl(url: string): boolean {
  const normalized = url.toLowerCase();
  return (
    normalized.includes("clerk.") ||
    normalized.includes("stripe.com") ||
    normalized.includes("svix.com") ||
    normalized.includes("www.googleapis.com/upload/drive/") ||
    normalized.includes("/api/webhooks/") ||
    normalized.includes("/api/auth/")
  );
}

export function scrubEvent(
  event: ErrorEvent,
  _hint: EventHint,
): ErrorEvent | null {
  void _hint;
  const prepared: ErrorEvent = { ...event };
  if (event.user) {
    prepared.user = event.user.id ? { id: event.user.id } : undefined;
  }

  const req = event.request;
  if (req) {
    const request = { ...req };
    if (request.url) request.url = redactSensitiveText(request.url);
    delete request.cookies;
    delete request.data;
    delete request.query_string;
    if (request.headers) {
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(request.headers)) {
        const key = k.toLowerCase();
        if (REDACTED_HEADERS.has(key) || key.startsWith("x-clerk-") || key.startsWith("svix-")) {
          continue;
        }
        if (typeof v === "string") filtered[k] = redactSensitiveText(v);
      }
      request.headers = filtered;
    }
    prepared.request = request;
  }

  if (event.breadcrumbs) {
    prepared.breadcrumbs = event.breadcrumbs
      .filter((breadcrumb) => {
        const url =
          typeof breadcrumb.data?.url === "string" ? breadcrumb.data.url : "";
        return !isSensitiveBreadcrumbUrl(url);
      })
      .map((breadcrumb) => ({ ...breadcrumb }));
  }

  // One bounded recursive pass covers every present and future Sentry field,
  // including arrays and the nested config/response/cause shape of provider
  // SDK errors. Returning copies also replaces cycles with a safe marker so
  // Sentry's serializer cannot bypass this boundary by failing on one.
  return scrubUnknown(prepared, 0, new WeakSet<object>()) as ErrorEvent;
}
