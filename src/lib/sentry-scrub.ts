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
const MAX_SCRUB_DEPTH = 12;
const CIRCULAR_VALUE = "[circular]";
const TRUNCATED_VALUE = "[truncated]";
const UNSUPPORTED_VALUE = "[unsupported]";

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
  if (
    /(?:^|_)(?:authorization|cookie|credential|password|passphrase|secret|tokens?)(?:_|$)/.test(
      normalized,
    )
  ) {
    return true;
  }

  return /^(?:code|(?:oauth|auth(?:orization)?)_code|code_verifier|(?:oauth_)?state|api_key|private_key|signing_key|(?:session|upload|resumable)_(?:url|uri)|x_(?:forwarded_for|real_ip|clerk_.+)|stripe_signature|svix_.+)$/.test(
    normalized,
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
const CREDENTIAL_SHAPE =
  /https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?[^\s"'<>]+|\b(?:1\/\/[\w-]{10,}|ya29\.[\w.-]{10,}|GOCSPX-[\w-]{10,}|sb1\.\d+(?:\.[\w-]+){3})/gi;

/** Replace anything shaped like a provider credential, wherever it sits. */
export function redactCredentialShapes(value: string): string {
  return value.replace(CREDENTIAL_SHAPE, "[redacted]");
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
    /([?&#](?:code|token|(?:access|refresh|id)_token|state|client_secret|authorization|password|credential|signature|upload_id)=)[^&#\s]*/gi,
    "$1[redacted]",
  );
}

const SENSITIVE_TEXT_PAIR =
  /(["']?\b(?:(?:(?:access|refresh|id)[_-]?)?token|(?:(?:oauth|auth(?:orization)?)[_-]?)?code|(?:client[_-]?)?secret|authorization|password|credential)\b["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:Bearer|Basic)\s+[^\s,;}\]]+|[^\s,;&}\]]+)/gi;

/** The one string transform used at every telemetry/logging boundary. */
export function redactSensitiveText(value: string): string {
  // Shapes first: a bare credential in a message has no key name and no
  // query-string framing for the two passes below to catch it by.
  const withoutCredentials = redactSensitiveUrl(
    redactCredentialShapes(value),
  ).replace(
    /\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi,
    "$1 [redacted]",
  );
  return withoutCredentials.replace(
    SENSITIVE_TEXT_PAIR,
    (_match, prefix: string, rawValue: string) => {
      const quote = /^["']/.exec(rawValue)?.[0] ?? "";
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

  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item, depth + 1, seen));
  }

  // Sentry events are JSON records. Fail closed on browser/provider class
  // instances rather than guessing how to serialize a credential-bearing
  // URL, Headers, Map, typed array, or future SDK object.
  const prototype = Object.getPrototypeOf(value);
  if (
    !(value instanceof Error) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    return UNSUPPORTED_VALUE;
  }

  const result: Record<string, unknown> = {};
  const keys = new Set(Object.keys(value as object));
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
  return /clerk\.|stripe\.com|svix\.com|www\.googleapis\.com\/upload\/drive\/|\/api\/(?:webhooks|auth)\//i.test(
    url,
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
        if (isSensitiveFieldName(key)) {
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
      });
  }

  // One bounded recursive pass covers every present and future Sentry field,
  // including arrays and the nested config/response/cause shape of provider
  // SDK errors. Returning copies also replaces cycles with a safe marker so
  // Sentry's serializer cannot bypass this boundary by failing on one.
  return scrubUnknown(prepared, 0, new WeakSet<object>()) as ErrorEvent;
}
