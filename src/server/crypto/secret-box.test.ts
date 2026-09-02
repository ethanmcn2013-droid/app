import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import {
  SecretBoxError,
  isSealed,
  keyRingFromEnv,
  open,
  providerTokenAadContext,
  seal,
  secretEquals,
  versionOf,
  type KeyRing,
} from "@/server/crypto/secret-box";

/**
 * WP-2 — the secrets substrate's contract.
 *
 * This is the first cryptography in the repository, and the thing it will
 * hold is a durable credential to a customer's Google Drive. The tests
 * that matter here are not the happy path — a round trip is the easy part
 * and would pass for a scheme with no integrity protection at all. They
 * are the refusals: altered bytes, the wrong key, and a ciphertext lifted
 * from another row.
 */

function ring(version = 1, extra?: Record<number, Buffer>): KeyRing {
  const keys = new Map<number, Buffer>([[version, randomBytes(32)]]);
  for (const [v, k] of Object.entries(extra ?? {})) keys.set(Number(v), k);
  return { currentVersion: version, keys };
}

const CONTEXT = providerTokenAadContext("conn-123");
const TOKEN = "1//0gFAKE-refresh-token-shaped-value_abcdefghijklmnop";

describe("secret-box: the round trip", () => {
  it("returns exactly what was sealed", () => {
    const r = ring();
    assert.equal(open(seal(TOKEN, CONTEXT, r), CONTEXT, r), TOKEN);
  });

  it("never puts the plaintext in the envelope", () => {
    const r = ring();
    const envelope = seal(TOKEN, CONTEXT, r);
    assert.ok(!envelope.includes(TOKEN), "the token must not appear verbatim");
    // Nor should a recognisable slice of it survive.
    assert.ok(!envelope.includes(TOKEN.slice(0, 12)));
  });

  it("produces a different envelope every time, from a fresh nonce", () => {
    const r = ring();
    const seen = new Set(
      Array.from({ length: 32 }, () => seal(TOKEN, CONTEXT, r)),
    );
    assert.equal(
      seen.size,
      32,
      "identical envelopes mean a reused nonce, which is GCM's one fatal error",
    );
  });

  it("handles an empty string, and unicode", () => {
    const r = ring();
    for (const value of ["", "🔑 ünïcødé — a name with an em dash"]) {
      assert.equal(open(seal(value, CONTEXT, r), CONTEXT, r), value);
    }
  });

  it("survives a value longer than one cipher block", () => {
    const r = ring();
    const long = "x".repeat(9_001);
    assert.equal(open(seal(long, CONTEXT, r), CONTEXT, r), long);
  });
});

describe("secret-box: tamper detection", () => {
  it("refuses an altered ciphertext", () => {
    const r = ring();
    const parts = seal(TOKEN, CONTEXT, r).split(".");
    const bytes = Buffer.from(parts[4], "base64url");
    bytes[0] ^= 0x01; // one bit
    parts[4] = bytes.toString("base64url");
    assert.throws(
      () => open(parts.join("."), CONTEXT, r),
      (e: SecretBoxError) => e.reason === "cannot-open",
    );
  });

  it("refuses an altered authentication tag", () => {
    const r = ring();
    const parts = seal(TOKEN, CONTEXT, r).split(".");
    const tag = Buffer.from(parts[3], "base64url");
    tag[0] ^= 0x01;
    parts[3] = tag.toString("base64url");
    assert.throws(
      () => open(parts.join("."), CONTEXT, r),
      (e: SecretBoxError) => e.reason === "cannot-open",
    );
  });

  it("refuses an altered nonce", () => {
    const r = ring();
    const parts = seal(TOKEN, CONTEXT, r).split(".");
    const nonce = Buffer.from(parts[2], "base64url");
    nonce[0] ^= 0x01;
    parts[2] = nonce.toString("base64url");
    assert.throws(
      () => open(parts.join("."), CONTEXT, r),
      (e: SecretBoxError) => e.reason === "cannot-open",
    );
  });

  it("refuses a truncated envelope", () => {
    const r = ring();
    const envelope = seal(TOKEN, CONTEXT, r);
    assert.throws(
      () => open(envelope.slice(0, envelope.length - 8), CONTEXT, r),
      (e: SecretBoxError) => e.reason === "cannot-open",
    );
  });

  it("refuses anything that is not one of our envelopes", () => {
    const r = ring();
    for (const junk of ["", "hello", "sb1.1.2.3", "a.b.c.d.e", TOKEN]) {
      assert.throws(
        () => open(junk, CONTEXT, r),
        (e: SecretBoxError) =>
          e.reason === "malformed-envelope" || e.reason === "cannot-open",
        `"${junk}" must be refused`,
      );
    }
  });
});

describe("secret-box: the wrong key", () => {
  it("refuses a key that did not seal it", () => {
    const sealed = seal(TOKEN, CONTEXT, ring());
    const other = ring(); // different random key, same version number
    assert.throws(
      () => open(sealed, CONTEXT, other),
      (e: SecretBoxError) => e.reason === "cannot-open",
    );
  });

  it("says so when the sealing version is no longer held", () => {
    const old = ring(1);
    const sealed = seal(TOKEN, CONTEXT, old);
    const current = ring(2); // v1 dropped, as after a careless rotation
    assert.throws(
      () => open(sealed, CONTEXT, current),
      (e: SecretBoxError) => e.reason === "unknown-key-version",
    );
  });
});

describe("secret-box: the context binds the ciphertext to its row", () => {
  it("refuses the right ciphertext under the wrong context", () => {
    const r = ring();
    const sealed = seal(TOKEN, providerTokenAadContext("conn-A"), r);
    // The row-swap: lift A's ciphertext into B's row and try to read it.
    assert.throws(
      () => open(sealed, providerTokenAadContext("conn-B"), r),
      (e: SecretBoxError) => e.reason === "cannot-open",
    );
  });

  it("refuses an empty context when one was used, and the reverse", () => {
    const r = ring();
    assert.throws(() => open(seal(TOKEN, CONTEXT, r), "", r));
    assert.throws(() => open(seal(TOKEN, "", r), CONTEXT, r));
  });

  it("is not fooled by a context that is a prefix of the real one", () => {
    const r = ring();
    const sealed = seal(TOKEN, providerTokenAadContext("conn-1"), r);
    assert.throws(
      () => open(sealed, providerTokenAadContext("conn-12"), r),
      (e: SecretBoxError) => e.reason === "cannot-open",
    );
  });

  it("uses one canonical provider-token AAD namespace", () => {
    assert.equal(
      providerTokenAadContext("conn-123"),
      "provider_connection:conn-123",
    );
    for (const invalid of ["", " conn-123", "conn-123 ", "conn\0-123"]) {
      assert.throws(
        () => providerTokenAadContext(invalid),
        /canonical connection id/,
      );
    }
  });
});

describe("secret-box: rotation", () => {
  it("opens an old envelope while sealing new ones with the new key", () => {
    const v1Key = randomBytes(32);
    const v1: KeyRing = { currentVersion: 1, keys: new Map([[1, v1Key]]) };
    const sealedUnderV1 = seal(TOKEN, CONTEXT, v1);

    // Mid-rotation: v2 is current, v1 is retained only to read old rows.
    const v2: KeyRing = {
      currentVersion: 2,
      keys: new Map([
        [1, v1Key],
        [2, randomBytes(32)],
      ]),
    };

    assert.equal(open(sealedUnderV1, CONTEXT, v2), TOKEN, "old rows still open");
    assert.equal(versionOf(seal(TOKEN, CONTEXT, v2)), 2, "new rows use the new key");
  });

  it("reports the sealing version without needing a key", () => {
    assert.equal(versionOf(seal(TOKEN, CONTEXT, ring(7))), 7);
    assert.equal(versionOf("not an envelope"), null);
    assert.equal(isSealed(seal(TOKEN, CONTEXT, ring())), true);
    assert.equal(isSealed(TOKEN), false);
  });
});

describe("secret-box: reading the key ring from the environment", () => {
  const goodKey = randomBytes(32).toString("base64");

  it("refuses to run with no key at all", () => {
    assert.throws(
      () => keyRingFromEnv({}),
      (e: SecretBoxError) => e.reason === "no-key",
    );
  });

  it("refuses a key of the wrong length", () => {
    assert.throws(
      () => keyRingFromEnv({ PROVIDER_TOKEN_KEY: randomBytes(16).toString("base64") }),
      (e: SecretBoxError) => e.reason === "malformed-key",
    );
  });

  it("defaults to version 1", () => {
    assert.equal(keyRingFromEnv({ PROVIDER_TOKEN_KEY: goodKey }).currentVersion, 1);
  });

  it("loads retired keys for reading, without letting one shadow the current", () => {
    const retiredKey = randomBytes(32).toString("base64");
    const r = keyRingFromEnv({
      PROVIDER_TOKEN_KEY: goodKey,
      PROVIDER_TOKEN_KEY_VERSION: "2",
      PROVIDER_TOKEN_KEY_RETIRED: JSON.stringify({ 1: retiredKey, 2: retiredKey }),
    });
    assert.equal(r.currentVersion, 2);
    assert.equal(r.keys.size, 2);
    assert.ok(
      r.keys.get(2)?.equals(Buffer.from(goodKey, "base64")),
      "a retired entry must never shadow the current key",
    );
  });

  it("refuses a malformed retired map rather than starting half-configured", () => {
    assert.throws(
      () =>
        keyRingFromEnv({
          PROVIDER_TOKEN_KEY: goodKey,
          PROVIDER_TOKEN_KEY_RETIRED: "{not json",
        }),
      (e: SecretBoxError) => e.reason === "malformed-key",
    );
  });

  it("the real production key, if present, is well formed", () => {
    // Guards the shape of what an operator actually pasted into Vercel.
    if (!process.env.PROVIDER_TOKEN_KEY) return;
    assert.doesNotThrow(() => keyRingFromEnv(process.env));
  });
});

describe("secret-box: errors carry no payload", () => {
  it("never puts the plaintext or the key in an error message", () => {
    const r = ring();
    const sealed = seal(TOKEN, CONTEXT, r);
    try {
      open(sealed, "wrong-context", r);
      assert.fail("should have thrown");
    } catch (err) {
      const message = String((err as Error).message);
      assert.ok(!message.includes(TOKEN), "no plaintext in the message");
      assert.ok(!message.includes(sealed), "no ciphertext in the message");
      // A caller logging this learns the shape of the failure and nothing else.
      assert.match(message, /^secret-box: cannot-open$/);
    }
  });
});

describe("secretEquals", () => {
  it("matches equal strings and rejects unequal ones", () => {
    assert.equal(secretEquals("abc123", "abc123"), true);
    assert.equal(secretEquals("abc123", "abc124"), false);
    assert.equal(secretEquals("abc123", "abc1234"), false, "length mismatch");
    assert.equal(secretEquals("", ""), true);
  });
});
