import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
// NOT from `@/server/db/queries` — that module is `server-only` and cannot be
// loaded by the test runner. The resolver was split into its own file for
// exactly this reason. The checkpoint that wrote this suite kept the old
// import, so the whole file threw `Cannot find module 'server-only'` on load
// and none of it had ever run.
import { resolveShareLinkRowWith } from "@/server/db/share-link-resolver";
import {
  generateSharePublicId,
  generateShareSecret,
  hashShareToken,
  isResolvableShareToken,
  isShareSecretShape,
  isSharePublicId,
  shareHashesEqual,
} from "@/server/share-token";

/**
 * E08.06 / R-033 — share-link token security contract.
 *
 * Every database-backed test below runs the REAL resolver against a REAL
 * SQLite file whose share_links table is built from the checked-in migration
 * 0027 SQL, not from a hand-written approximation. If 0027 changes and stops
 * creating the unique index, the uniqueness test fails.
 */

const MIGRATION_0027 = readFileSync(
  new URL("../../drizzle/0027_share_link_token_hash.sql", import.meta.url),
  "utf8",
);

/** The pre-0027 shape, so the cutover is exercised from where it truly starts. */
const PRE_0027_SHARE_LINKS = `
  CREATE TABLE share_links (
    token TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT,
    view TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'view',
    label TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    revoked_at INTEGER,
    expires_at INTEGER,
    visits INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    active_domain TEXT,
    archived_at INTEGER
  );
  INSERT INTO workspaces (id, name, active_domain) VALUES ('ws-a', 'A', 'wedding');
  INSERT INTO workspaces (id, name, active_domain) VALUES ('ws-b', 'B', 'wedding');
`;

async function freshDatabase(): Promise<{
  client: Client;
  database: ReturnType<typeof drizzle>;
  cleanup: () => Promise<void>;
}> {
  const directory = mkdtempSync(join(tmpdir(), "signal-share-token-"));
  const path = join(directory, "test.db").replaceAll("\\", "/");
  const client = createClient({ url: `file:${path}` });
  await client.executeMultiple(PRE_0027_SHARE_LINKS);
  // Apply the checked-in migration exactly as the runner does: split on the
  // breakpoint marker, never on semicolons.
  for (const statement of MIGRATION_0027.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) await client.execute(trimmed);
  }
  return {
    client,
    database: drizzle(client, { schema }),
    cleanup: async () => {
      client.close();
    },
  };
}

type Row = {
  token: string;
  tokenHash?: string | null;
  scheme?: "plaintext" | "sha256";
  workspaceId?: string;
  revokedAt?: number | null;
  expiresAt?: number | null;
};

async function insertLink(client: Client, row: Row) {
  await client.execute({
    sql: `INSERT INTO share_links
            (token, token_hash, token_scheme, workspace_id, view, revoked_at, expires_at)
          VALUES (?, ?, ?, ?, 'board', ?, ?)`,
    args: [
      row.token,
      row.tokenHash ?? null,
      row.scheme ?? "plaintext",
      row.workspaceId ?? "ws-a",
      row.revokedAt ?? null,
      row.expiresAt ?? null,
    ],
  });
}

// ── Entropy and shape ────────────────────────────────────────────────────

describe("share secret entropy", () => {
  it("mints 256 bits, base64url, 43 characters", () => {
    const secret = generateShareSecret();
    assert.equal(secret.length, 43);
    assert.ok(isShareSecretShape(secret));
    // 43 base64url chars encode 32 bytes = 256 bits. Stated as arithmetic,
    // not as a claim: 32 * 8 = 256, and Math.ceil(32 * 4 / 3) = 43.
    assert.equal(Buffer.from(secret, "base64url").length, 32);
  });

  it("does not repeat across a run", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(generateShareSecret());
    assert.equal(seen.size, 2000);
  });

  it("keeps the public id distinguishable from a secret", () => {
    const id = generateSharePublicId();
    assert.ok(isSharePublicId(id));
    assert.ok(!isShareSecretShape(id));
    assert.ok(!isSharePublicId(generateShareSecret()));
  });
});

// ── Hashing and constant-time comparison ─────────────────────────────────

describe("share token hashing", () => {
  it("produces a 64-char hex sha256 that is not the secret", () => {
    const secret = generateShareSecret();
    const hash = hashShareToken(secret);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, secret);
    assert.ok(!hash.includes(secret));
  });

  it("agrees with the standalone backfill script's implementation", async () => {
    // The backfill runs outside the app bundle and re-implements the hash.
    // If the two ever disagree, every backfilled link dies silently. This
    // asserts the script's own source, so a drifting edit fails here.
    const script = readFileSync(
      new URL("../../scripts/db/backfill-share-link-token-hashes.mjs", import.meta.url),
      "utf8",
    );
    assert.match(
      script,
      /createHash\("sha256"\)\.update\(secret, "utf8"\)\.digest\("hex"\)/,
    );
    assert.match(script, /\^\[A-Za-z0-9_-\]\{8,256\}\$/);
  });

  it("refuses to hash a value that cannot be a live token", () => {
    assert.throws(() => hashShareToken(""), /Invalid share token shape/);
    assert.throws(() => hashShareToken("short"), /Invalid share token shape/);
    assert.throws(() => hashShareToken("has spaces in it"), /Invalid share token shape/);
    assert.throws(() => hashShareToken("a".repeat(257)), /Invalid share token shape/);
  });

  it("compares only well-formed digests, and never by ==", () => {
    const a = hashShareToken(generateShareSecret());
    assert.ok(shareHashesEqual(a, a));
    assert.ok(!shareHashesEqual(a, hashShareToken(generateShareSecret())));
    // A malformed operand is rejected rather than length-crashing
    // timingSafeEqual, because that crash is itself a timing signal.
    assert.ok(!shareHashesEqual(a, "nope"));
    assert.ok(!shareHashesEqual("nope", a));
    assert.ok(!shareHashesEqual(a.toUpperCase(), a));
  });

  it("accepts every legacy token shape still in circulation", () => {
    assert.ok(isResolvableShareToken("a".repeat(16))); // ~64-bit generation
    assert.ok(isResolvableShareToken("a".repeat(32))); // 128-bit generation
    assert.ok(isResolvableShareToken(generateShareSecret()));
  });
});

// ── The database contract ────────────────────────────────────────────────

describe("share_links storage after migration 0027", () => {
  it("carries a UNIQUE index on token_hash, at the index level", async () => {
    const { client, cleanup } = await freshDatabase();
    try {
      const indexes = await client.execute(
        "SELECT name, \"unique\" AS uniq FROM pragma_index_list('share_links') WHERE name = 'uq_share_links_token_hash'",
      );
      assert.equal(indexes.rows.length, 1);
      assert.equal(Number(indexes.rows[0].uniq), 1);

      const secret = generateShareSecret();
      await insertLink(client, {
        token: generateSharePublicId(),
        tokenHash: hashShareToken(secret),
        scheme: "sha256",
      });
      // Not "the code checks first" — the database refuses outright.
      await assert.rejects(
        insertLink(client, {
          token: generateSharePublicId(),
          tokenHash: hashShareToken(secret),
          scheme: "sha256",
        }),
        /UNIQUE/i,
      );
    } finally {
      await cleanup();
    }
  });

  it("permits many un-backfilled rows to coexist during cutover", async () => {
    const { client, cleanup } = await freshDatabase();
    try {
      await insertLink(client, { token: "legacy-one-aaaaaaaa" });
      await insertLink(client, { token: "legacy-two-bbbbbbbb" });
      const rows = await client.execute(
        "SELECT COUNT(*) AS n FROM share_links WHERE token_hash IS NULL",
      );
      assert.equal(Number(rows.rows[0].n), 2);
    } finally {
      await cleanup();
    }
  });
});

// ── The resolver ─────────────────────────────────────────────────────────

describe("resolveShareLinkRow", () => {
  it("resolves a hashed link by its secret and never stores that secret", async () => {
    const { client, database, cleanup } = await freshDatabase();
    try {
      const secret = generateShareSecret();
      const publicId = generateSharePublicId();
      await insertLink(client, {
        token: publicId,
        tokenHash: hashShareToken(secret),
        scheme: "sha256",
      });

      const row = await resolveShareLinkRowWith(database, secret);
      assert.ok(row);
      assert.equal(row.publicId, publicId);
      assert.equal(row.scheme, "sha256");

      // The exposure R-033 described, tested directly: dump the whole table
      // and prove the secret is not in it.
      const dump = await client.execute("SELECT * FROM share_links");
      const serialised = JSON.stringify(dump.rows);
      assert.ok(
        !serialised.includes(secret),
        "the guest secret must not appear anywhere in share_links",
      );
    } finally {
      await cleanup();
    }
  });

  it("refuses the hash itself as a credential", async () => {
    const { client, database, cleanup } = await freshDatabase();
    try {
      const secret = generateShareSecret();
      const hash = hashShareToken(secret);
      await insertLink(client, {
        token: generateSharePublicId(),
        tokenHash: hash,
        scheme: "sha256",
      });
      // Someone who read the database holds the hash. It must not open the
      // link — that is the entire point of storing a hash.
      assert.equal(await resolveShareLinkRowWith(database, hash), null);
    } finally {
      await cleanup();
    }
  });

  it("refuses the public id as a credential", async () => {
    const { client, database, cleanup } = await freshDatabase();
    try {
      const secret = generateShareSecret();
      const publicId = generateSharePublicId();
      await insertLink(client, {
        token: publicId,
        tokenHash: hashShareToken(secret),
        scheme: "sha256",
      });
      assert.equal(await resolveShareLinkRowWith(database, publicId), null);
    } finally {
      await cleanup();
    }
  });

  it("still resolves a pre-0027 plaintext link, so no live link breaks", async () => {
    const { client, database, cleanup } = await freshDatabase();
    try {
      const legacySecret = "abcdef0123456789abcdef0123456789";
      await insertLink(client, { token: legacySecret, scheme: "plaintext" });
      const row = await resolveShareLinkRowWith(database, legacySecret);
      assert.ok(row);
      assert.equal(row.scheme, "plaintext");
    } finally {
      await cleanup();
    }
  });

  it("does not let the legacy branch resolve a row that was already moved", async () => {
    const { client, database, cleanup } = await freshDatabase();
    try {
      // A moved row's `token` is a public id. If the legacy branch ignored
      // token_scheme it would happily match that id and hand out access.
      const secret = generateShareSecret();
      const publicId = generateSharePublicId();
      await insertLink(client, {
        token: publicId,
        tokenHash: hashShareToken(secret),
        scheme: "sha256",
      });
      assert.equal(await resolveShareLinkRowWith(database, publicId), null);
      assert.ok(await resolveShareLinkRowWith(database, secret));
    } finally {
      await cleanup();
    }
  });

  it("returns null for an unknown secret, a malformed one, and an empty one", async () => {
    const { database, cleanup } = await freshDatabase();
    try {
      assert.equal(await resolveShareLinkRowWith(database, generateShareSecret()), null);
      assert.equal(await resolveShareLinkRowWith(database, "../../etc/passwd"), null);
      assert.equal(await resolveShareLinkRowWith(database, ""), null);
      assert.equal(await resolveShareLinkRowWith(database, "a".repeat(300)), null);
    } finally {
      await cleanup();
    }
  });

  it("surfaces revocation and expiry to the caller rather than swallowing them", async () => {
    const { client, database, cleanup } = await freshDatabase();
    try {
      const revoked = generateShareSecret();
      const expired = generateShareSecret();
      await insertLink(client, {
        token: generateSharePublicId(),
        tokenHash: hashShareToken(revoked),
        scheme: "sha256",
        revokedAt: 1_700_000_000,
      });
      await insertLink(client, {
        token: generateSharePublicId(),
        tokenHash: hashShareToken(expired),
        scheme: "sha256",
        expiresAt: 1_700_000_000,
      });
      const r = await resolveShareLinkRowWith(database, revoked);
      const e = await resolveShareLinkRowWith(database, expired);
      assert.ok(r?.revokedAt instanceof Date);
      assert.ok(e?.expiresAt instanceof Date);
      // resolveShareLink turns both into null; proving the fields arrive is
      // what makes that reachable rather than accidental.
    } finally {
      await cleanup();
    }
  });

  it("never crosses a tenant boundary or revives an archived workspace", async () => {
    const { client, database, cleanup } = await freshDatabase();
    try {
      const secret = generateShareSecret();
      await insertLink(client, {
        token: generateSharePublicId(),
        tokenHash: hashShareToken(secret),
        scheme: "sha256",
        workspaceId: "ws-b",
      });
      const row = await resolveShareLinkRowWith(database, secret);
      assert.equal(row?.workspaceId, "ws-b");

      await client.execute("UPDATE workspaces SET archived_at = 1 WHERE id = 'ws-b'");
      assert.equal(await resolveShareLinkRowWith(database, secret), null);
    } finally {
      await cleanup();
    }
  });
});

// ── Source contract: no path may reintroduce a plaintext compare ─────────

describe("source contract", () => {
  const resolverSource = readFileSync(
    new URL("./db/share-link-resolver.ts", import.meta.url),
    "utf8",
  );
  const queries = readFileSync(
    new URL("./db/queries.ts", import.meta.url),
    "utf8",
  );
  const actions = readFileSync(
    new URL("./actions/share.ts", import.meta.url),
    "utf8",
  );

  it("mints the secret and the stored id from two different calls", () => {
    assert.match(actions, /tokenHash: hashShareToken\(secret\)/);
    assert.match(actions, /token: generateSharePublicId\(\)/);
    assert.match(actions, /tokenScheme: "sha256"/);
    // The old 128-bit hex minter is gone, not merely unused.
    assert.doesNotMatch(actions, /function newToken\(/);
  });

  it("keeps queries.ts out of the credential-comparison business", () => {
    // The resolver moved to its own file. If a future edit puts a share-link
    // lookup back into queries.ts it will be `server-only` again, untestable
    // again, and the assertions below will be checking a file that no longer
    // holds the control. Fail loudly instead.
    assert.doesNotMatch(queries, /eq\(shareLinks\.token/);
    assert.match(queries, /resolveShareLinkRowWith\(db, token\)/);
    // And the resolver must not reach for the process handle itself: that is
    // what dragged `server-only` back in and made this suite unloadable.
    assert.doesNotMatch(resolverSource, /from "\.\/index"/);
  });

  it("hashes before it queries, in every share-link read path", () => {
    // Any equality against shareLinks.token in the resolver must be paired
    // with the plaintext-scheme guard; a bare one is the R-033 bug returning.
    const resolver = resolverSource.slice(
      resolverSource.indexOf("export async function resolveShareLinkRowWith"),
    );
    assert.match(resolver, /hashShareToken\(secret\)/);
    assert.match(resolver, /eq\(shareLinks\.tokenHash, wanted\)/);
    assert.match(resolver, /shareHashesEqual\(hashed\.tokenHash, wanted\)/);
    const bareTokenEquality = resolver.indexOf("eq(shareLinks.token, secret)");
    assert.ok(bareTokenEquality > 0);
    assert.ok(
      resolver
        .slice(bareTokenEquality, bareTokenEquality + 200)
        .includes('eq(shareLinks.tokenScheme, "plaintext")'),
      "the legacy equality branch must stay fenced behind token_scheme",
    );
  });

  it("keeps the emailed-link lookup on the same hashed path", () => {
    const email = actions.slice(actions.indexOf("export async function emailShareLinkAction"));
    assert.match(email, /hashShareToken\(input\.token\)/);
    assert.match(email, /eq\(shareLinks\.tokenScheme, "plaintext"\)/);
  });

  it("counts visits by public id, never by secret", () => {
    const bump = actions.slice(
      actions.indexOf("export async function bumpShareLinkVisitAction"),
      actions.indexOf("/** Per-link analytics shape"),
    );
    assert.match(bump, /publicId: string/);
    assert.doesNotMatch(bump, /\btoken: string/);
  });
});
