import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { isProjectId, type ProjectId } from "@/lib/projects/project-ref";

/**
 * Signed, short-lived state for the Google Drive OAuth redirect.
 *
 * This module deliberately owns only the cryptographic envelope. The start
 * route stores `nonce` in an httpOnly cookie; the callback supplies that
 * cookie as `expected.nonce`, verifies the state, and deletes the cookie so a
 * second callback cannot replay it. Cookie I/O stays in the routes, while the
 * hard-to-review signing and binding rules stay here and are unit tested.
 *
 * No error includes the raw state, nonce, binding, or secret. A caller may log
 * the stable `reason`, never the presented value.
 */

export const GOOGLE_OAUTH_STATE_INTENTS = Object.freeze([
  "connect-google-drive",
  "reconnect-google-drive",
] as const);

export type GoogleOAuthStateIntent =
  (typeof GOOGLE_OAUTH_STATE_INTENTS)[number];

export type GoogleOAuthStateBinding = Readonly<{
  userId: string;
  sessionId: string;
  projectId: ProjectId;
  intent: GoogleOAuthStateIntent;
}>;

export type GoogleOAuthStateExpectation = GoogleOAuthStateBinding &
  Readonly<{
    /** The double-submit value read from the callback's httpOnly cookie. */
    nonce: string;
  }>;

export type GoogleOAuthStateClaims = GoogleOAuthStateBinding &
  Readonly<{
    version: 1;
    nonce: string;
    issuedAt: number;
    expiresAt: number;
  }>;

export type CreatedGoogleOAuthState = Readonly<{
  /** The only value sent to Google and accepted back from its callback. */
  state: string;
  /** Store in a 10-minute httpOnly, secure, sameSite=lax cookie. */
  nonce: string;
  expiresAt: number;
}>;

/**
 * The non-secret values retained in the callback-only, httpOnly cookie.
 * The signed state remains the authority; this cookie supplies the independent
 * double-submit nonce and the expected Project/intent needed to verify it.
 */
export type GoogleOAuthStateCookie = Readonly<{
  nonce: string;
  projectId: ProjectId;
  intent: GoogleOAuthStateIntent;
}>;

export type GoogleOAuthStateReason =
  | "missing-secret"
  | "weak-secret"
  | "invalid-binding"
  | "invalid-lifetime"
  | "invalid-state"
  | "expired"
  | "future-issued"
  | "binding-mismatch";

export class GoogleOAuthStateError extends Error {
  readonly reason: GoogleOAuthStateReason;

  constructor(reason: GoogleOAuthStateReason) {
    super(`google-oauth-state: ${reason}`);
    this.name = "GoogleOAuthStateError";
    this.reason = reason;
  }
}

export const GOOGLE_OAUTH_STATE_MAX_TTL_SECONDS = 10 * 60;
const MAX_FUTURE_SKEW_SECONDS = 30;
const MIN_SECRET_BYTES = 32;
const NONCE_BYTES = 32;
const MAX_STATE_CHARS = 4_096;
const MAX_ENCODED_PAYLOAD_CHARS = 2_048;
const MAX_COOKIE_CHARS = 1_024;
const MAX_BINDING_CHARS = 256;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const BINDING_VALUE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function isIntent(value: unknown): value is GoogleOAuthStateIntent {
  return (
    typeof value === "string" &&
    (GOOGLE_OAUTH_STATE_INTENTS as readonly string[]).includes(value)
  );
}

function isBindingValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_BINDING_CHARS &&
    BINDING_VALUE.test(value)
  );
}

function decodeCanonicalBase64url(
  value: string,
  maxChars: number,
): Buffer | null {
  if (
    value.length === 0 ||
    value.length > maxChars ||
    !BASE64URL.test(value)
  ) {
    return null;
  }
  const decoded = Buffer.from(value, "base64url");
  return decoded.toString("base64url") === value ? decoded : null;
}

function isNonce(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const decoded = decodeCanonicalBase64url(value, 64);
  return decoded !== null && decoded.length === NONCE_BYTES;
}

function validateSecret(secret: string | undefined): string {
  if (secret === undefined || secret.length === 0) {
    throw new GoogleOAuthStateError("missing-secret");
  }
  if (
    secret !== secret.trim() ||
    Buffer.byteLength(secret, "utf8") < MIN_SECRET_BYTES
  ) {
    throw new GoogleOAuthStateError("weak-secret");
  }
  return secret;
}

/**
 * Read exactly one named environment value. Keeping this separate makes the
 * create/verify APIs accept an explicit secret and lets tests prove they never
 * fall back to another credential.
 */
export function googleOAuthStateSecretFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return validateSecret(env.OAUTH_STATE_SECRET);
}

function validateBinding(binding: GoogleOAuthStateBinding): void {
  if (
    !isBindingValue(binding.userId) ||
    !isBindingValue(binding.sessionId) ||
    !isProjectId(binding.projectId) ||
    !isIntent(binding.intent)
  ) {
    throw new GoogleOAuthStateError("invalid-binding");
  }
}

function canonicalJson(claims: GoogleOAuthStateClaims): string {
  // Property order is part of the format. Verification re-encodes and
  // compares this exact representation, rejecting duplicate keys, extra keys,
  // alternate number forms, or a payload whose fields were reordered.
  return JSON.stringify({
    version: claims.version,
    nonce: claims.nonce,
    userId: claims.userId,
    sessionId: claims.sessionId,
    projectId: claims.projectId,
    intent: claims.intent,
    issuedAt: claims.issuedAt,
    expiresAt: claims.expiresAt,
  });
}

function encodeClaims(claims: GoogleOAuthStateClaims): string {
  return Buffer.from(canonicalJson(claims), "utf8").toString("base64url");
}

function sign(encodedClaims: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(encodedClaims).digest();
}

function signatureMatches(
  encodedClaims: string,
  presented: string,
  secret: string,
): boolean {
  const expected = sign(encodedClaims, secret);
  const received = decodeCanonicalBase64url(presented, 64) ?? Buffer.alloc(0);
  const fixedLength = Buffer.alloc(expected.length);
  received.copy(fixedLength, 0, 0, expected.length);

  // Always execute the fixed-length comparison once the two state segments
  // exist. The final length check prevents a valid signature plus ignored
  // trailing bytes from being accepted.
  const equal = timingSafeEqual(expected, fixedLength);
  return equal && received.length === expected.length;
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  const leftDigest = createHash("sha256").update(leftBytes).digest();
  const rightDigest = createHash("sha256").update(rightBytes).digest();
  return (
    timingSafeEqual(leftDigest, rightDigest) &&
    leftBytes.length === rightBytes.length
  );
}

function isClaimsShape(value: unknown): value is GoogleOAuthStateClaims {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const claims = value as Partial<GoogleOAuthStateClaims>;
  return (
    claims.version === 1 &&
    isNonce(claims.nonce) &&
    isBindingValue(claims.userId) &&
    isBindingValue(claims.sessionId) &&
    isProjectId(claims.projectId) &&
    isIntent(claims.intent) &&
    typeof claims.issuedAt === "number" &&
    Number.isSafeInteger(claims.issuedAt) &&
    claims.issuedAt >= 0 &&
    typeof claims.expiresAt === "number" &&
    Number.isSafeInteger(claims.expiresAt) &&
    claims.expiresAt > claims.issuedAt &&
    claims.expiresAt - claims.issuedAt <=
      GOOGLE_OAUTH_STATE_MAX_TTL_SECONDS
  );
}

function canonicalCookieJson(value: GoogleOAuthStateCookie): string {
  return JSON.stringify({
    version: 1,
    nonce: value.nonce,
    projectId: value.projectId,
    intent: value.intent,
  });
}

/** Encode the callback binding without exposing it to browser JavaScript. */
export function encodeGoogleOAuthStateCookie(
  value: GoogleOAuthStateCookie,
): string {
  if (
    !isNonce(value.nonce) ||
    !isProjectId(value.projectId) ||
    !isIntent(value.intent)
  ) {
    throw new GoogleOAuthStateError("invalid-binding");
  }
  return Buffer.from(canonicalCookieJson(value), "utf8").toString("base64url");
}

/**
 * Decode a canonical callback binding. Invalid or browser-altered cookies are
 * an ordinary OAuth refusal, so this returns `null` and never echoes input.
 */
export function parseGoogleOAuthStateCookie(
  encoded: string | null | undefined,
): GoogleOAuthStateCookie | null {
  if (typeof encoded !== "string") return null;
  const bytes = decodeCanonicalBase64url(encoded, MAX_COOKIE_CHARS);
  if (!bytes) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const candidate = parsed as {
    version?: unknown;
    nonce?: unknown;
    projectId?: unknown;
    intent?: unknown;
  };
  if (
    candidate.version !== 1 ||
    !isNonce(candidate.nonce) ||
    !isProjectId(candidate.projectId) ||
    !isIntent(candidate.intent)
  ) {
    return null;
  }
  const result: GoogleOAuthStateCookie = {
    nonce: candidate.nonce,
    projectId: candidate.projectId,
    intent: candidate.intent,
  };
  return encodeGoogleOAuthStateCookie(result) === encoded ? result : null;
}

function decodeClaims(encoded: string): GoogleOAuthStateClaims {
  const bytes = decodeCanonicalBase64url(
    encoded,
    MAX_ENCODED_PAYLOAD_CHARS,
  );
  if (!bytes) throw new GoogleOAuthStateError("invalid-state");

  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new GoogleOAuthStateError("invalid-state");
  }
  if (!isClaimsShape(value)) {
    throw new GoogleOAuthStateError("invalid-state");
  }

  if (encodeClaims(value) !== encoded) {
    throw new GoogleOAuthStateError("invalid-state");
  }
  return value;
}

export function createGoogleOAuthState(
  binding: GoogleOAuthStateBinding,
  secret: string,
  options: Readonly<{ now?: number; ttlSeconds?: number }> = {},
): CreatedGoogleOAuthState {
  validateBinding(binding);
  const signingSecret = validateSecret(secret);
  const now = options.now ?? Math.floor(Date.now() / 1_000);
  const ttlSeconds =
    options.ttlSeconds ?? GOOGLE_OAUTH_STATE_MAX_TTL_SECONDS;
  const expiresAt = now + ttlSeconds;

  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !Number.isSafeInteger(ttlSeconds) ||
    ttlSeconds < 1 ||
    ttlSeconds > GOOGLE_OAUTH_STATE_MAX_TTL_SECONDS ||
    !Number.isSafeInteger(expiresAt)
  ) {
    throw new GoogleOAuthStateError("invalid-lifetime");
  }

  const nonce = randomBytes(NONCE_BYTES).toString("base64url");
  const claims: GoogleOAuthStateClaims = {
    version: 1,
    nonce,
    ...binding,
    issuedAt: now,
    expiresAt,
  };
  const encoded = encodeClaims(claims);
  const signature = sign(encoded, signingSecret).toString("base64url");
  return {
    state: `${encoded}.${signature}`,
    nonce,
    expiresAt: claims.expiresAt,
  };
}

export function verifyGoogleOAuthState(
  state: string,
  expected: GoogleOAuthStateExpectation,
  secret: string,
  now = Math.floor(Date.now() / 1_000),
): GoogleOAuthStateClaims {
  validateBinding(expected);
  if (!isNonce(expected.nonce)) {
    throw new GoogleOAuthStateError("invalid-binding");
  }
  const signingSecret = validateSecret(secret);
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new GoogleOAuthStateError("invalid-lifetime");
  }
  if (
    typeof state !== "string" ||
    state.length === 0 ||
    state.length > MAX_STATE_CHARS
  ) {
    throw new GoogleOAuthStateError("invalid-state");
  }

  const parts = state.split(".");
  const [encoded, presented] = parts;
  if (
    parts.length !== 2 ||
    !encoded ||
    !presented ||
    !signatureMatches(encoded, presented, signingSecret)
  ) {
    throw new GoogleOAuthStateError("invalid-state");
  }

  const claims = decodeClaims(encoded);
  if (claims.expiresAt <= now) {
    throw new GoogleOAuthStateError("expired");
  }
  if (claims.issuedAt > now + MAX_FUTURE_SKEW_SECONDS) {
    throw new GoogleOAuthStateError("future-issued");
  }

  const matches = [
    timingSafeStringEqual(claims.nonce, expected.nonce),
    timingSafeStringEqual(claims.userId, expected.userId),
    timingSafeStringEqual(claims.sessionId, expected.sessionId),
    timingSafeStringEqual(claims.projectId, expected.projectId),
    timingSafeStringEqual(claims.intent, expected.intent),
  ];
  if (!matches.every(Boolean)) {
    throw new GoogleOAuthStateError("binding-mismatch");
  }

  return claims;
}
