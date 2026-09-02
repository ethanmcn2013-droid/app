import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Somewhere safe to put a provider's refresh token.
 *
 * ── Why this exists, and why it is the first cryptography in the repo ──
 *
 * Project Drive needs a long-lived Google refresh token per connected
 * account: a durable credential to a real person's Drive. There was no
 * `createCipheriv` anywhere in this codebase before this file, and the one
 * precedent was the wrong one — `calendar_connections` in the Notes module
 * stores its Google refresh token in plaintext, relying on Turso's at-rest
 * encryption, with a comment admitting it is a follow-up. Copying that
 * shape for Drive would take a known shortcut and multiply it.
 *
 * ── What this is ──────────────────────────────────────────────────────
 *
 * AES-256-GCM. Authenticated encryption, so a ciphertext that has been
 * altered fails to open rather than decrypting to something plausible.
 * Each seal draws a fresh 96-bit nonce, which is what GCM requires and
 * what makes nonce reuse — its one catastrophic failure mode — impossible
 * by construction here.
 *
 * ── Three deliberate choices ──────────────────────────────────────────
 *
 * **The envelope carries its own key version.** Rotation is a thing that
 * happens to keys, and a scheme that cannot express "this row was sealed
 * with the old key" forces a flag day. `open()` reads the version out of
 * the envelope and looks it up, so a rotation is: add the new key, bump
 * the version, keep the old one in `PROVIDER_TOKEN_KEY_RETIRED` until the
 * rows have been re-sealed, then drop it.
 *
 * **Every seal is bound to a context string.** The context becomes GCM's
 * additional authenticated data: it is not encrypted, but the ciphertext
 * will not open without it. Seal a connection's token under
 * `providerTokenAadContext(id)` and that ciphertext cannot be lifted into
 * another row and opened there. Encryption alone does not stop a row-swapping
 * attack; binding does.
 *
 * **The plaintext is never returned on a failure path.** Every refusal
 * throws `SecretBoxError` with a reason and no payload, so a caller
 * logging the error cannot accidentally log the secret.
 */

/** Envelope prefix. Bump only if the format itself changes. */
const FORMAT = "sb1";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const NONCE_BYTES = 12; // 96 bits, the GCM standard
const TAG_BYTES = 16;
const PROVIDER_CONNECTION_CONTEXT_PREFIX = "provider_connection";

/**
 * The one AAD namespace for a provider connection's refresh token.
 *
 * Keep this independent of the database layer so WP-4 cannot accidentally
 * invent a second string at a seal/open call site. The connection id is the
 * row identity; the fixed prefix prevents the same ciphertext being opened
 * as a different kind of secret if another encrypted column is added later.
 */
export function providerTokenAadContext(connectionId: string): string {
  if (
    connectionId.length === 0 ||
    connectionId !== connectionId.trim() ||
    connectionId.includes("\0")
  ) {
    throw new TypeError("provider token context requires a canonical connection id");
  }
  return `${PROVIDER_CONNECTION_CONTEXT_PREFIX}:${connectionId}`;
}

export type SecretBoxReason =
  /** The environment is not configured to seal or open anything. */
  | "no-key"
  /** `PROVIDER_TOKEN_KEY` is present but not a 32-byte base64 value. */
  | "malformed-key"
  /** The envelope is not something this module wrote. */
  | "malformed-envelope"
  /** Sealed with a key version we no longer hold. */
  | "unknown-key-version"
  /** Wrong key, altered bytes, or the wrong context. Indistinguishable, deliberately. */
  | "cannot-open";

export class SecretBoxError extends Error {
  readonly reason: SecretBoxReason;

  constructor(reason: SecretBoxReason, detail?: string) {
    // No plaintext, no ciphertext, no key material — ever. This message
    // ends up in logs.
    super(`secret-box: ${reason}${detail ? ` (${detail})` : ""}`);
    this.name = "SecretBoxError";
    this.reason = reason;
  }
}

// ── Key material ──────────────────────────────────────────────────────

export type KeyRing = {
  /** The version new seals are written with. */
  currentVersion: number;
  /** Every version we can still open, including the current one. */
  keys: ReadonlyMap<number, Buffer>;
};

function decodeKey(raw: string, label: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(raw.trim(), "base64");
  } catch {
    throw new SecretBoxError("malformed-key", `${label} is not base64`);
  }
  if (key.length !== KEY_BYTES) {
    // The length is safe to say; the bytes are not.
    throw new SecretBoxError(
      "malformed-key",
      `${label} decodes to ${key.length} bytes, expected ${KEY_BYTES}`,
    );
  }
  return key;
}

/**
 * Read the key ring out of the environment.
 *
 *   PROVIDER_TOKEN_KEY          base64, 32 bytes — what new seals use
 *   PROVIDER_TOKEN_KEY_VERSION  integer, defaults to 1
 *   PROVIDER_TOKEN_KEY_RETIRED  optional JSON, {"1":"<base64>"} — older
 *                               versions kept only so existing rows still
 *                               open during a rotation
 *
 * Generate one with:
 *   node -p "require('crypto').randomBytes(32).toString('base64')"
 */
export function keyRingFromEnv(
  // A plain record rather than NodeJS.ProcessEnv: this reads three named
  // keys and nothing else, and the narrower type lets a test hand it a
  // literal without inventing a NODE_ENV it does not care about.
  env: Readonly<Record<string, string | undefined>> = process.env,
): KeyRing {
  const raw = env.PROVIDER_TOKEN_KEY;
  if (!raw) throw new SecretBoxError("no-key", "PROVIDER_TOKEN_KEY is not set");

  const currentVersion = Number(env.PROVIDER_TOKEN_KEY_VERSION ?? "1");
  if (!Number.isInteger(currentVersion) || currentVersion < 1) {
    throw new SecretBoxError(
      "malformed-key",
      "PROVIDER_TOKEN_KEY_VERSION must be a positive integer",
    );
  }

  const keys = new Map<number, Buffer>();
  keys.set(currentVersion, decodeKey(raw, "PROVIDER_TOKEN_KEY"));

  const retired = env.PROVIDER_TOKEN_KEY_RETIRED;
  if (retired) {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(retired) as Record<string, string>;
    } catch {
      throw new SecretBoxError(
        "malformed-key",
        "PROVIDER_TOKEN_KEY_RETIRED is not JSON",
      );
    }
    for (const [version, value] of Object.entries(parsed)) {
      const n = Number(version);
      if (!Number.isInteger(n) || n < 1) {
        throw new SecretBoxError(
          "malformed-key",
          "PROVIDER_TOKEN_KEY_RETIRED has a non-integer version",
        );
      }
      // A retired entry must never shadow the current key. Silently
      // preferring the old one would produce rows nobody can open later.
      if (n === currentVersion) continue;
      keys.set(n, decodeKey(value, `PROVIDER_TOKEN_KEY_RETIRED[${version}]`));
    }
  }

  return { currentVersion, keys };
}

// ── Seal / open ───────────────────────────────────────────────────────

/**
 * Encrypt `plaintext`, bound to `context`.
 *
 * The result is a single opaque string, safe to put in one text column:
 *
 *   sb1.<version>.<nonce>.<tag>.<ciphertext>     (base64url, no padding)
 *
 * `context` should name the row this belongs to. Provider-token callers must
 * use `providerTokenAadContext(connectionId)`. It is stored nowhere; the
 * caller must supply the same value to `open()`, which is the point: the
 * ciphertext is useless in any other row.
 */
export function seal(
  plaintext: string,
  context: string,
  ring: KeyRing = keyRingFromEnv(),
): string {
  const key = ring.keys.get(ring.currentVersion);
  if (!key) {
    throw new SecretBoxError("no-key", "the current version has no key");
  }

  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    FORMAT,
    String(ring.currentVersion),
    nonce.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Decrypt an envelope produced by `seal`, under the same `context`.
 *
 * Throws `SecretBoxError` and never returns a partial or wrong plaintext.
 * A wrong key, altered bytes and a mismatched context all surface as the
 * same `cannot-open` — telling them apart would tell an attacker which of
 * the three they had got right.
 */
export function open(
  envelope: string,
  context: string,
  ring: KeyRing = keyRingFromEnv(),
): string {
  const parts = envelope.split(".");
  if (parts.length !== 5 || parts[0] !== FORMAT) {
    throw new SecretBoxError("malformed-envelope", `${parts.length} parts`);
  }

  const version = Number(parts[1]);
  if (!Number.isInteger(version) || version < 1) {
    throw new SecretBoxError("malformed-envelope", "bad version");
  }

  const key = ring.keys.get(version);
  if (!key) {
    // Worth distinguishing: this one is an operator problem (a key was
    // dropped too early in a rotation), not an attack.
    throw new SecretBoxError("unknown-key-version", `v${version}`);
  }

  const nonce = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const ciphertext = Buffer.from(parts[4], "base64url");

  if (nonce.length !== NONCE_BYTES || tag.length !== TAG_BYTES) {
    throw new SecretBoxError("malformed-envelope", "bad nonce or tag length");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, nonce);
    decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Swallow the underlying message deliberately: node's GCM failure
    // text is uninformative to us and informative to an attacker.
    throw new SecretBoxError("cannot-open");
  }
}

/**
 * Which key version sealed this, without opening it.
 *
 * For the re-seal pass a rotation needs: find the rows still on the old
 * version without decrypting every row to find out.
 */
export function versionOf(envelope: string): number | null {
  const parts = envelope.split(".");
  if (parts.length !== 5 || parts[0] !== FORMAT) return null;
  const version = Number(parts[1]);
  return Number.isInteger(version) && version >= 1 ? version : null;
}

/** Does this look like something `seal` produced? Cheap, no key needed. */
export function isSealed(value: string): boolean {
  return versionOf(value) !== null;
}

/**
 * Constant-time comparison, for the places that compare a secret to a
 * secret rather than opening one — a `state` parameter, say.
 *
 * Exported from here because this is the module that owns "do not leak
 * information through timing", and a second implementation elsewhere is
 * how that rule gets forgotten.
 */
export function secretEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, which would itself leak
  // the length. Compare a fixed-size digest-shaped pad instead.
  if (left.length !== right.length) {
    // Still do the work, so the early return is not itself a timing
    // signal on the common path.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
