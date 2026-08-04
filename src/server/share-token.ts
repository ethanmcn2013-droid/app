import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * One place for share-link token handling.
 *
 * Why this file exists (E08.06 / R-033). Two features in this repo both hand
 * a bearer token to a stranger over a URL, and until now they disagreed about
 * how to store it:
 *
 *   - Timeline's `audience_shares` stored a sha256 hash behind a unique index
 *     and compared it in constant time
 *     (`src/modules/timeline/lib/audience-timeline.ts`).
 *   - Tasks's `share_links` stored the raw token as its primary key and
 *     resolved it by `WHERE token = ?`.
 *
 * A database read disclosed live access to every Tasks share link. This module
 * is the single implementation both shapes now agree on, so the two cannot
 * drift apart again.
 *
 * Three values, and they must not be confused:
 *
 *   - **secret** — the high-entropy value that appears in the URL handed to a
 *     guest. Never written to the database. Not recoverable after minting.
 *   - **hash** — sha256(secret), hex. Stored in `share_links.token_hash`
 *     under a unique index. Holding it does not grant access.
 *   - **public id** — an opaque, non-secret row identifier (`sl_…`). Stored in
 *     `share_links.token`, which stays the primary key so the visit log and
 *     the manage-links UI keep a stable key. Holding it does not grant access.
 */

/** 32 bytes = 256 bits, base64url encoded to 43 characters. */
const SECRET_BYTES = 32;

/** Shape of a secret minted by this module. */
const SECRET_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Shape accepted for *resolution*. Wider than SECRET_RE because links minted
 * before this change are already in circulation: a 32-hex-character (128-bit)
 * generation and, before that, a 16-hex-character (~64-bit) one. Both must
 * keep resolving. This is the same guard `revokeShareLinkAction` already
 * applied, kept verbatim so no live link shape is silently rejected.
 */
const RESOLVABLE_RE = /^[A-Za-z0-9_-]{8,256}$/;

/** Shape of a public row id minted by this module. */
const PUBLIC_ID_RE = /^sl_[a-f0-9]{24}$/;

const HASH_RE = /^[a-f0-9]{64}$/;

/**
 * Storage scheme recorded on each row so the resolver knows, per row, whether
 * `token` holds a secret (legacy) or a public id (current). The cutover is
 * staged; see `scripts/db/backfill-share-link-token-hashes.mjs`.
 */
export type ShareTokenScheme = "plaintext" | "sha256";

/**
 * Mint a share secret.
 *
 * 256 bits. The arithmetic, stated rather than asserted: the guessing surface
 * is 2^256. At an unrealistically generous 10^9 guesses per second against the
 * live route, exhausting one in a million of the keyspace takes longer than
 * the age of the universe. Entropy is therefore not the control that has to
 * hold — which matters, because the redeem-style rate limiting that would
 * otherwise carry the load does not exist on this route (recorded honestly in
 * the E08.06 evidence rather than implied here).
 *
 * The previous generation was 128 bits, which was already sufficient; the
 * widening is free and makes the shape distinguishable from legacy tokens.
 */
export function generateShareSecret(): string {
  return randomBytes(SECRET_BYTES).toString("base64url");
}

/** Mint an opaque, non-secret row identifier for `share_links.token`. */
export function generateSharePublicId(): string {
  return `sl_${randomBytes(12).toString("hex")}`;
}

/** True when `value` is a secret this module minted. */
export function isShareSecretShape(value: string): boolean {
  return SECRET_RE.test(value);
}

/**
 * True when `value` could be a live share secret, including the legacy
 * generations. Used to reject obvious junk before it reaches the database.
 */
export function isResolvableShareToken(value: string): boolean {
  return RESOLVABLE_RE.test(value);
}

/** True when `value` is a public row id this module minted. */
export function isSharePublicId(value: string): boolean {
  return PUBLIC_ID_RE.test(value);
}

/**
 * sha256 of a share secret, hex. Throws on a value that cannot be a live
 * token, so a malformed input can never be hashed into a lookup that
 * accidentally matches something.
 */
export function hashShareToken(secret: string): string {
  if (!isResolvableShareToken(secret)) {
    throw new TypeError("Invalid share token shape");
  }
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/**
 * Constant-time comparison of two hex sha256 digests.
 *
 * Mirrors `hashesEqual` in the Timeline module exactly. Both operands are
 * shape-checked first: `timingSafeEqual` throws on a length mismatch, and
 * that throw is itself a timing signal, so the guard is part of the control
 * rather than defensive noise.
 */
export function shareHashesEqual(left: string, right: string): boolean {
  if (!HASH_RE.test(left) || !HASH_RE.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
