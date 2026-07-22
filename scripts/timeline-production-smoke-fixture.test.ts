import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { createClient, type Client } from "@libsql/client";
import {
  assertWriteSafety,
  buildSmokeFixture,
  cleanupSmokeFixture,
  createSmokeFixture,
  inspectSmokeFixture,
  parseSmokeState,
  redactSmokeSecrets,
  revokeSmokeFixture,
} from "./timeline-production-smoke-fixture.js";

const RUN_ID = "00000000-0000-4000-8000-000000000001";
const RAW_TOKEN = Buffer.alloc(32, 7).toString("base64url");
const NOW = new Date("2026-07-22T12:00:00.000Z");

async function freshDatabase(): Promise<Client> {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE timeline_publications (
      id TEXT PRIMARY KEY,
      workspace_slug TEXT NOT NULL,
      source_workspace_id TEXT NOT NULL,
      source_object_id TEXT,
      source_revision INTEGER NOT NULL DEFAULT 1,
      source_digest TEXT NOT NULL,
      label TEXT NOT NULL,
      primary_date_label TEXT,
      primary_date TEXT,
      audience_kind TEXT NOT NULL,
      timezone TEXT NOT NULL,
      owner_display_label TEXT,
      state TEXT NOT NULL DEFAULT 'draft',
      last_updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      published_at INTEGER,
      unpublished_at INTEGER,
      qualified_view_count INTEGER NOT NULL DEFAULT 0,
      last_qualified_view_at INTEGER
    );
    CREATE TABLE timeline_publication_items (
      public_id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL REFERENCES timeline_publications(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      calendar_date TEXT,
      state TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      source_relation TEXT NOT NULL,
      source_digest TEXT NOT NULL,
      copied_at INTEGER NOT NULL DEFAULT (unixepoch()),
      published_at INTEGER,
      unpublished_at INTEGER,
      diverged_at INTEGER,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE audience_shares (
      id TEXT PRIMARY KEY,
      publication_id TEXT NOT NULL REFERENCES timeline_publications(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL DEFAULT 'active',
      version INTEGER NOT NULL DEFAULT 1,
      expires_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      rotated_at INTEGER,
      revoked_at INTEGER,
      last_access_at INTEGER,
      visit_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE audience_view_receipts (
      publication_id TEXT NOT NULL REFERENCES timeline_publications(id) ON DELETE CASCADE,
      session_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (publication_id, session_hash)
    );
  `);
  return client;
}

function fixture() {
  return buildSmokeFixture({ runId: RUN_ID, rawToken: RAW_TOKEN, now: NOW });
}

test("builds a 22 percent synthetic story without credentials in state", () => {
  const built = fixture();
  assert.equal(built.items.length, 9);
  assert.equal(built.items.filter((item) => item.state === "covered").length, 2);
  assert.equal(built.state.rawToken, RAW_TOKEN);
  assert.equal(built.state.routePath, `/s/${RAW_TOKEN}`);
  assert.equal("authToken" in built.state, false);
  assert.equal("databaseUrl" in built.state, false);
  assert.deepEqual(parseSmokeState(JSON.parse(JSON.stringify(built.state))), built.state);
});

test("dry-run checks schema and collisions but writes nothing", async () => {
  const client = await freshDatabase();
  await createSmokeFixture(client, fixture(), false);
  const rows = await client.execute("SELECT COUNT(*) AS count FROM timeline_publications");
  assert.equal(Number(rows.rows[0]?.count), 0);
  client.close();
});

test("create, inspect, revoke, and cleanup cover the smoke lifecycle", async () => {
  const client = await freshDatabase();
  const built = fixture();
  await createSmokeFixture(client, built, true);
  await client.execute({
    sql: `INSERT INTO audience_view_receipts
          (publication_id, session_hash, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    args: [built.state.publicationId, "digest-only", 10, 20],
  });
  await client.execute({
    sql: `UPDATE timeline_publications
          SET qualified_view_count = 1, last_qualified_view_at = 10 WHERE id = ?`,
    args: [built.state.publicationId],
  });

  const inspection = await inspectSmokeFixture(client, built.state);
  assert.deepEqual(inspection, {
    publicationId: built.state.publicationId,
    publicationState: "published",
    qualifiedViewCount: 1,
    lastQualifiedViewAtEpoch: 10,
    receiptCount: 1,
    itemCount: 9,
    activeShareCount: 1,
    totalShareCount: 1,
    totalShareVisits: 0,
  });
  assert.equal("rawToken" in inspection, false);
  assert.equal("tokenHash" in inspection, false);
  assert.equal("sessionHash" in inspection, false);

  await revokeSmokeFixture(client, built.state, true);
  const revoked = await inspectSmokeFixture(client, built.state);
  assert.equal(revoked.activeShareCount, 0);
  assert.equal(revoked.totalShareCount, 1);

  await cleanupSmokeFixture(client, built.state, true);
  for (const table of [
    "timeline_publications",
    "timeline_publication_items",
    "audience_shares",
    "audience_view_receipts",
  ]) {
    const rows = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
    assert.equal(Number(rows.rows[0]?.count), 0, `${table} must be empty after cleanup`);
  }
  client.close();
});

test("cleanup refuses a mismatched synthetic marker", async () => {
  const client = await freshDatabase();
  const built = fixture();
  await createSmokeFixture(client, built, true);
  await client.execute({
    sql: "UPDATE timeline_publications SET source_digest = 'not-the-fixture' WHERE id = ?",
    args: [built.state.publicationId],
  });
  await assert.rejects(
    cleanupSmokeFixture(client, built.state, true),
    /does not carry the exact smoke marker/,
  );
  const remaining = await client.execute("SELECT COUNT(*) AS count FROM timeline_publications");
  assert.equal(Number(remaining.rows[0]?.count), 1);
  client.close();
});

test("remote writes require acknowledgement and an existing checkpoint", () => {
  const remote = "libsql://timeline-example.turso.io";
  assert.throws(
    () =>
      assertWriteSafety(remote, {
        apply: true,
        acknowledgeRemoteWrite: false,
        checkpointPath: null,
      }),
    /Remote write refused/,
  );
  assert.throws(
    () =>
      assertWriteSafety(remote, {
        apply: true,
        acknowledgeRemoteWrite: true,
        checkpointPath: join(tmpdir(), "missing-timeline-checkpoint.sqlite"),
      }),
    /existing pre-write snapshot/,
  );

  const checkpoint = join(tmpdir(), `timeline-smoke-checkpoint-${process.pid}.sqlite`);
  writeFileSync(checkpoint, "checkpoint");
  try {
    assert.doesNotThrow(() =>
      assertWriteSafety(remote, {
        apply: true,
        acknowledgeRemoteWrite: true,
        checkpointPath: checkpoint,
      }),
    );
  } finally {
    unlinkSync(checkpoint);
  }
});

test("error redaction removes bearer and auth tokens", () => {
  const authToken = "database-auth-secret";
  const message = `request /s/${RAW_TOKEN} failed using ${authToken}`;
  const redacted = redactSmokeSecrets(message, [RAW_TOKEN, authToken]);
  assert.equal(redacted.includes(RAW_TOKEN), false);
  assert.equal(redacted.includes(authToken), false);
});
