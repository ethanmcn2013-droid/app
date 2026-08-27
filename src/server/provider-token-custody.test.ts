import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { randomBytes } from "node:crypto";
import { seal, open, isSealed, type KeyRing } from "@/server/crypto/secret-box";
import { redactCredentialShapes, redactSensitiveUrl } from "@/lib/sentry-scrub";

/**
 * WP-2 acceptance — "no plaintext token can reach the database, logs, or
 * Sentry."
 *
 * `secret-box.test.ts` proves the cryptography is sound. This file proves
 * the *custody*: that the sound thing is the only thing the rest of the
 * codebase can do, and that a token which escapes into a log line or an
 * error payload is caught on the way out.
 *
 * The distinction matters. A correct `seal()` that nobody is obliged to
 * call protects nothing, and the failure would be invisible — a plaintext
 * column looks exactly like an encrypted one until somebody reads it.
 */

const SRC = "src";

function allSources(dir = SRC, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      allSources(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Source with comments stripped, line endings normalised. */
function codeOf(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, "$1");
}

const SOURCES = allSources();

function ring(): KeyRing {
  return { currentVersion: 1, keys: new Map([[1, randomBytes(32)]]) };
}

// ── The database ──────────────────────────────────────────────────────

describe("custody · nothing stores a token in the clear", () => {
  it("no schema column is named for a bare access or refresh token", () => {
    // Hard rule §2.7. `provider_connections` does not exist yet — this is
    // a ratchet, and it starts asserting the moment WP-3 adds the table.
    const schemas = SOURCES.filter((p) => /schema\.ts$/.test(p));
    assert.ok(schemas.length > 0, "expected at least one schema file");

    const offenders: string[] = [];
    for (const path of schemas) {
      const code = codeOf(path);
      // An access token is minted per request and never persisted at all.
      for (const m of code.matchAll(/["'`]([a-z_]*access_token[a-z_]*)["'`]/gi)) {
        offenders.push(`${path}: ${m[1]}`);
      }
      // A refresh token may rest, but only as ciphertext, and the column
      // name has to say so. `calendar_connections.refresh_token` in the
      // Notes module is the known exception and is exempted by name below,
      // deliberately and visibly, rather than by a loose pattern.
      for (const m of code.matchAll(/["'`]([a-z_]*refresh_token[a-z_]*)["'`]/gi)) {
        const column = m[1];
        if (column.endsWith("_cipher")) continue;
        if (path.includes("notes-schema") && column === "refresh_token") {
          continue; // pre-existing, tracked as a follow-up in STATUS.md
        }
        offenders.push(`${path}: ${column}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "a refresh token column must be named *_cipher; an access token must " +
        "not be stored at all",
    );
  });

  it("the known plaintext exception is still exactly one table", () => {
    // If this count ever rises, a second module has copied the shortcut.
    const notes = SOURCES.filter((p) => p.includes("notes-schema"));
    let plaintext = 0;
    for (const path of notes) {
      for (const m of codeOf(path).matchAll(/["'`](refresh_token)["'`]/g)) {
        void m;
        plaintext += 1;
      }
    }
    assert.ok(
      plaintext <= 1,
      `${plaintext} plaintext refresh_token columns in the Notes module; ` +
        "one is the known follow-up, more than one is a new defect",
    );
  });

  it("only secret-box does the cryptography", () => {
    // A second implementation is how a scheme silently diverges: one place
    // gets the context binding, the other forgets it.
    const users = SOURCES.filter(
      (p) =>
        // Path separators differ by platform; this repo is worked on from
        // Windows and checked out on Linux in CI.
        !/crypto[\\/]secret-box/.test(p) &&
        !/\.test\.ts$/.test(p) &&
        /createCipheriv|createDecipheriv/.test(codeOf(p)),
    );
    assert.deepEqual(
      users,
      [],
      "encryption belongs in src/server/crypto/secret-box.ts and nowhere else",
    );
  });
});

// ── Logs and Sentry ───────────────────────────────────────────────────

describe("custody · a leaked credential is caught on the way out", () => {
  const REFRESH = "1//0gABCDEFGHIJKLMNOPqrstuvwxyz0123456789";
  const ACCESS = "ya29.a0AfB_byABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const CLIENT_SECRET = "GOCSPX-abcdefghijklmnopqrstuvwxyz";

  it("redacts a Google refresh token sitting bare in a message", () => {
    const message = `refresh failed for connection conn-1: ${REFRESH}`;
    const scrubbed = redactCredentialShapes(message);
    assert.ok(!scrubbed.includes(REFRESH), "the token must not survive");
    assert.match(scrubbed, /\[redacted\]/);
    assert.ok(scrubbed.includes("conn-1"), "the useful context must survive");
  });

  it("redacts an access token and a client secret too", () => {
    for (const credential of [ACCESS, CLIENT_SECRET]) {
      const scrubbed = redactCredentialShapes(`boom: ${credential} at line 4`);
      assert.ok(!scrubbed.includes(credential), `${credential.slice(0, 8)}… survived`);
      assert.ok(scrubbed.includes("at line 4"), "context survives");
    }
  });

  it("redacts one of our own sealed envelopes", () => {
    const envelope = seal("whatever", "provider_connection:c1", ring());
    const scrubbed = redactCredentialShapes(`row failed to open: ${envelope}`);
    assert.ok(!scrubbed.includes(envelope));
  });

  it("leaves ordinary prose alone", () => {
    // A scrubber that eats everything gets turned off, and then nothing is
    // scrubbed at all.
    for (const ordinary of [
      "Attachment upload failed for task task-9",
      "1//2 of the rows were migrated",
      "the value ya29 is not a token",
      "sb1 is a format name",
    ]) {
      assert.equal(redactCredentialShapes(ordinary), ordinary, ordinary);
    }
  });

  it("still redacts a credential carried in a query string", () => {
    const url = `https://example.test/cb?code=${REFRESH}&state=abc`;
    const scrubbed = redactSensitiveUrl(redactCredentialShapes(url));
    assert.ok(!scrubbed.includes(REFRESH));
  });
});

// ── The seal is bound to its row ──────────────────────────────────────

describe("custody · a ciphertext is useless in the wrong row", () => {
  it("cannot be lifted from one connection to another", () => {
    const r = ring();
    const token = "1//0gREAL-LOOKING-TOKEN-VALUE";
    const sealed = seal(token, "provider_connection:conn-A", r);

    assert.equal(open(sealed, "provider_connection:conn-A", r), token);
    assert.throws(
      () => open(sealed, "provider_connection:conn-B", r),
      /cannot-open/,
      "row-swapping must fail — encryption alone would not stop it",
    );
  });

  it("what goes to the database is recognisably sealed", () => {
    const sealed = seal("1//0gTOKEN", "provider_connection:c", ring());
    assert.ok(isSealed(sealed));
    assert.ok(!sealed.includes("1//0g"), "no plaintext prefix survives");
  });
});
