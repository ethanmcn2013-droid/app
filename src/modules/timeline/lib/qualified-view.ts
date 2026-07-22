import { createHash } from "node:crypto";

export const QUALIFIED_VIEW_MIN_VISIBLE_MS = 2_000;
export const QUALIFIED_VIEW_RECEIPT_RETENTION_MINUTES = 30;
export const QUALIFIED_VIEW_RECEIPT_RETENTION_MS =
  QUALIFIED_VIEW_RECEIPT_RETENTION_MINUTES * 60 * 1_000;

const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTOMATED_VIEWER_RE =
  /(?:bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot|whatsapp|twitterbot|linkedinbot|google-inspectiontool|headlesschrome|lighthouse|vercelbot)/i;

export type QualifiedViewPayload = Readonly<{
  sessionId: string;
  visibleForMs: number;
}>;

export type QualifiedViewRequestEligibility =
  | { eligible: true }
  | {
      eligible: false;
      reason:
        | "cross-origin"
        | "fetch-metadata"
        | "prefetch"
        | "automated"
        | "content-type";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Strict public write boundary. The browser supplies only a high-entropy,
 * tab-scoped id and its visible dwell time. Unknown fields are rejected so
 * referrers, user-agent strings, IP addresses, or raw tokens cannot drift into
 * the receipt model through permissive object spreading.
 */
export function parseQualifiedViewPayload(value: unknown): QualifiedViewPayload {
  if (!isRecord(value)) throw new TypeError("View receipt must be an object");
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "sessionId" || keys[1] !== "visibleForMs") {
    throw new TypeError("View receipt contains unsupported fields");
  }
  if (typeof value.sessionId !== "string" || !SESSION_ID_RE.test(value.sessionId)) {
    throw new TypeError("View receipt session is invalid");
  }
  if (
    typeof value.visibleForMs !== "number" ||
    !Number.isSafeInteger(value.visibleForMs) ||
    value.visibleForMs < QUALIFIED_VIEW_MIN_VISIBLE_MS ||
    value.visibleForMs > 60_000
  ) {
    throw new TypeError("View receipt dwell time is invalid");
  }
  return { sessionId: value.sessionId.toLowerCase(), visibleForMs: value.visibleForMs };
}

/** Publication-scoped digest prevents cross-publication session correlation. */
export function hashQualifiedViewSession(
  publicationId: string,
  sessionId: string,
): string {
  if (!publicationId.trim() || publicationId.length > 80) {
    throw new TypeError("Publication id is invalid");
  }
  if (!SESSION_ID_RE.test(sessionId)) throw new TypeError("View receipt session is invalid");
  return createHash("sha256")
    .update(`${publicationId}\u0000${sessionId.toLowerCase()}`, "utf8")
    .digest("hex");
}

export function qualifiedViewReceiptExpiry(now: Date): Date {
  const time = now.getTime();
  if (!Number.isFinite(time)) throw new TypeError("Receipt time is invalid");
  return new Date(time + QUALIFIED_VIEW_RECEIPT_RETENTION_MS);
}

function purposeIsPrefetch(headers: Headers): boolean {
  return ["purpose", "sec-purpose", "x-purpose", "x-moz"].some((name) =>
    /prefetch|preview/i.test(headers.get(name) ?? ""),
  );
}

/**
 * Checks only transient request metadata. None of these values are returned to
 * the caller or written to durable storage.
 */
export function qualifiedViewRequestEligibility(
  headers: Headers,
  requestUrl: string,
): QualifiedViewRequestEligibility {
  const requestOrigin = new URL(requestUrl).origin;
  if (headers.get("origin") !== requestOrigin) {
    return { eligible: false, reason: "cross-origin" };
  }
  if (
    headers.get("sec-fetch-site") !== "same-origin" ||
    !["cors", "same-origin"].includes(headers.get("sec-fetch-mode") ?? "") ||
    headers.get("sec-fetch-dest") !== "empty"
  ) {
    return { eligible: false, reason: "fetch-metadata" };
  }
  if (purposeIsPrefetch(headers)) return { eligible: false, reason: "prefetch" };
  const userAgent = headers.get("user-agent") ?? "";
  if (!userAgent || AUTOMATED_VIEWER_RE.test(userAgent)) {
    return { eligible: false, reason: "automated" };
  }
  if (!(headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { eligible: false, reason: "content-type" };
  }
  return { eligible: true };
}
