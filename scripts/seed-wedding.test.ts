/**
 * seed-wedding.test.ts -- integration tests for the wedding demo seed CLI.
 *
 * Tests:
 *   1. dry-run writes nothing to the database.
 *   2. --confirm seeds the deterministic row set.
 *   3. A second --confirm run is idempotent (same row count, no duplicates).
 *   4. --clean --confirm removes exactly the seed-wed-% rows; a control row
 *      inserted before the seed survives.
 *   5. The prod guard refuses a libsql:// URL without --i-understand-prod.
 *
 * Run:
 *   node --import tsx --test scripts/seed-wedding.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

import {
  buildSeedRows,
  applySeed,
  cleanSeed,
  isRemoteUrl,
  assertSafeEnvironment,
} from "./seed-wedding.js";

// ── Fresh in-memory database helper ───────────────────────────────────────────
//
// Mirrors the pattern from src/server/db/memory-test-db.ts:
// apply all drizzle migrations >= 0014 to get the current schema, with FKs off.

async function freshDb() {
  const here = dirname(fileURLToPath(import.meta.url));
  const drizzleDir = join(here, "..", "drizzle");
  const client = createClient({ url: ":memory:" });
  await client.execute("PRAGMA foreign_keys = OFF");

  const migrationFiles = readdirSync(drizzleDir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f) && f >= "0014_")
    .sort();

  for (const file of migrationFiles) {
    await client.executeMultiple(readFileSync(join(drizzleDir, file), "utf8"));
  }

  return client;
}

// ── Minimal fixture rows required by the schema ────────────────────────────────
//
// The tasks table references workspace_id (but FK is off, so these are only
// needed if we query workspaces). We insert a minimal workspace + user so
// applySeed's UPDATE workspaces ... WHERE id = ? is exercisable.

async function seedFixtures(client: ReturnType<typeof createClient>, workspaceId: string, userId: string) {
  await client.execute({
    sql: `INSERT OR IGNORE INTO users (id, color, initials) VALUES (?, '#aaa', 'TU')`,
    args: [userId],
  });
  await client.execute({
    sql: `INSERT OR IGNORE INTO workspaces (id, slug, name, owner_user_id) VALUES (?, ?, 'Test WS', ?)`,
    args: [workspaceId, `${workspaceId}-slug`, userId],
  });
}

async function countTasks(client: ReturnType<typeof createClient>, workspaceId: string): Promise<number> {
  const rs = await client.execute({
    sql: `SELECT COUNT(*) AS c FROM tasks WHERE id LIKE 'seed-wed-%' AND workspace_id = ?`,
    args: [workspaceId],
  });
  return Number(rs.rows[0]?.c ?? 0);
}

// ── Test 1: dry-run writes nothing ────────────────────────────────────────────

test("dry-run writes no rows to the database", async () => {
  const client = await freshDb();
  const WS = "ws-dry";
  const USER = "u-dry";
  await seedFixtures(client, WS, USER);

  const rows = buildSeedRows(WS, USER);
  await applySeed(client, rows, { dryRun: true });

  const count = await countTasks(client, WS);
  assert.equal(count, 0, "dry-run must not write any task rows");
});

// ── Test 2: --confirm seeds the deterministic set ─────────────────────────────

test("confirm seeds exactly the deterministic row set", async () => {
  const client = await freshDb();
  const WS = "ws-seed";
  const USER = "u-seed";
  await seedFixtures(client, WS, USER);

  const rows = buildSeedRows(WS, USER);
  assert.ok(rows.length > 0, "buildSeedRows must return at least one row");

  await applySeed(client, rows, { dryRun: false });

  const count = await countTasks(client, WS);
  assert.equal(count, rows.length, "seeded row count must equal buildSeedRows length");

  // Verify deterministic id scheme for first and last row.
  const first = rows[0];
  const last = rows[rows.length - 1];
  assert.ok(first, "first row must exist");
  assert.ok(last, "last row must exist");
  assert.match(first.id, /^seed-wed-ws-seed-00$/, "first row id must match deterministic scheme");

  // Verify workspace activeDomain is set.
  const ws = await client.execute({
    sql: `SELECT active_domain FROM workspaces WHERE id = ?`,
    args: [WS],
  });
  assert.equal(ws.rows[0]?.active_domain as string, "wedding", "workspace activeDomain must be set to wedding");
});

// ── Test 3: idempotency -- second confirm leaves the same row count ────────────

test("second confirm run is idempotent -- row count unchanged", async () => {
  const client = await freshDb();
  const WS = "ws-idem";
  const USER = "u-idem";
  await seedFixtures(client, WS, USER);

  const rows = buildSeedRows(WS, USER);

  await applySeed(client, rows, { dryRun: false });
  const countFirst = await countTasks(client, WS);

  await applySeed(client, rows, { dryRun: false });
  const countSecond = await countTasks(client, WS);

  assert.equal(
    countFirst,
    countSecond,
    "running seed twice must leave the same row count (idempotent)",
  );
});

// ── Test 4: --clean removes only seed-wed-% rows; control row survives ─────────

test("clean removes only seed-wed-% rows and leaves control row intact", async () => {
  const client = await freshDb();
  const WS = "ws-clean";
  const USER = "u-clean";
  await seedFixtures(client, WS, USER);

  // Insert a control row that does NOT have the seed prefix.
  await client.execute({
    sql: `INSERT INTO tasks (id, workspace_id, title, lane, priority, assignees)
          VALUES ('control-task-1', ?, 'A real task', 'todo', 'p2', '[]')`,
    args: [WS],
  });

  // Seed the wedding data.
  const rows = buildSeedRows(WS, USER);
  await applySeed(client, rows, { dryRun: false });

  const totalBeforeClean = await client.execute({
    sql: `SELECT COUNT(*) AS c FROM tasks WHERE workspace_id = ?`,
    args: [WS],
  });
  assert.equal(
    Number(totalBeforeClean.rows[0]?.c),
    rows.length + 1,
    "total rows before clean must be seed count + 1 control row",
  );

  // Clean (confirm).
  await cleanSeed(client, WS, { dryRun: false });

  // Seed-prefixed rows are gone.
  const seedCount = await countTasks(client, WS);
  assert.equal(seedCount, 0, "all seed-wed-* rows must be removed by clean");

  // Control row survives.
  const control = await client.execute({
    sql: `SELECT id FROM tasks WHERE id = 'control-task-1'`,
    args: [],
  });
  assert.equal(control.rows.length, 1, "control row must survive the clean operation");
});

// ── Test 5: prod guard refuses remote URL without prod gate ────────────────────

test("prod guard refuses a libsql:// URL without --i-understand-prod", () => {
  // assertSafeEnvironment calls process.exit(1) on refusal.
  // We intercept it by temporarily overriding process.exit.
  const origExit = process.exit.bind(process);
  let exitCode: number | undefined;
  // @ts-expect-error -- override for test
  process.exit = (code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`process.exit(${code}) intercepted`);
  };

  try {
    assertSafeEnvironment("libsql://my-db.turso.io", {
      iProdFlag: false,
      checkpointPath: null,
    });
    // Should not reach here.
    assert.fail("assertSafeEnvironment must throw/exit for a remote URL without prod gate");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert.match(msg, /process\.exit\(1\) intercepted/, "must exit with code 1");
    assert.equal(exitCode, 1, "exit code must be 1");
  } finally {
    process.exit = origExit;
  }
});

// ── Test 6: isRemoteUrl correctly classifies URLs ─────────────────────────────

test("isRemoteUrl returns true for libsql:// and turso.io, false for file: and :memory:", () => {
  assert.equal(isRemoteUrl("libsql://my-db.turso.io"), true);
  assert.equal(isRemoteUrl("https://my-db.turso.io"), true);
  assert.equal(isRemoteUrl("file:./tasks.db"), false);
  assert.equal(isRemoteUrl("file:tasks.db"), false);
  assert.equal(isRemoteUrl(":memory:"), false);
  assert.equal(isRemoteUrl("file::memory:"), false);
});

// ── Test 7: clean dry-run reads but does not delete ───────────────────────────

test("clean dry-run prints preview but deletes nothing", async () => {
  const client = await freshDb();
  const WS = "ws-cdr";
  const USER = "u-cdr";
  await seedFixtures(client, WS, USER);

  const rows = buildSeedRows(WS, USER);
  await applySeed(client, rows, { dryRun: false });

  const countBefore = await countTasks(client, WS);
  assert.ok(countBefore > 0, "must have seed rows before dry-run clean");

  await cleanSeed(client, WS, { dryRun: true });

  const countAfter = await countTasks(client, WS);
  assert.equal(countAfter, countBefore, "dry-run clean must not delete any rows");
});
