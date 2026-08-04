import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createClient } from "@libsql/client";

/**
 * Migration 0024 against DATA, not an empty database.
 *
 * The ledger suite proves the forward chain applies to a fresh database —
 * where the waiting-lane proofs pass trivially because there is nothing to
 * move. The production dry run caught what that cannot: without drizzle's
 * statement-breakpoint markers only the first statement of a multi-statement
 * file executes. This test seeds the three shapes the migration must handle
 * and asserts every statement's outcome, so a silently-truncated file can
 * never look green again.
 */

const SQL = readFileSync(new URL("../../drizzle/0024_retire_waiting_lane.sql", import.meta.url), "utf8");
const STATEMENTS = SQL.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
const SQL_0025 = readFileSync(new URL("../../drizzle/0025_tasks_completed_at.sql", import.meta.url), "utf8");
const STATEMENTS_0025 = SQL_0025.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);

test("0024 splits into its three statements", () => {
  assert.equal(STATEMENTS.length, 3);
});

test("0024 moves waiting rows and seeds or amends configs, with data present", async () => {
  const client = createClient({ url: ":memory:" });
  await client.execute("CREATE TABLE workspaces (id TEXT PRIMARY KEY)");
  await client.execute("CREATE TABLE tasks (id TEXT PRIMARY KEY, workspace_id TEXT, lane TEXT, board_column_key TEXT)");
  await client.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)");

  // ws-a: waiting rows, NO stored config → gets the seeded default config.
  // ws-b: waiting row, stored config WITHOUT the waiting key → gets amended.
  // ws-c: no waiting rows, no config → untouched.
  await client.execute("INSERT INTO workspaces VALUES ('ws-a'), ('ws-b'), ('ws-c')");
  await client.execute(`INSERT INTO tasks VALUES
    ('t1','ws-a','waiting',NULL),
    ('t2','ws-a','doing',NULL),
    ('t3','ws-b','waiting',NULL),
    ('t4','ws-c','todo',NULL)`);
  await client.execute(
    "INSERT INTO meta VALUES ('board:ws-b:columns', '{\"system\":{},\"custom\":[{\"key\":\"col-pay\",\"name\":\"Paid\"}],\"order\":[\"todo\",\"doing\",\"review\",\"col-pay\",\"done\"],\"colors\":{},\"descriptions\":{},\"limits\":{}}', 0)",
  );

  for (const statement of STATEMENTS) {
    await client.execute(statement);
  }

  const waiting = await client.execute("SELECT COUNT(*) AS n FROM tasks WHERE lane = 'waiting'");
  assert.equal(Number(waiting.rows[0].n), 0);

  const moved = await client.execute(
    "SELECT id, lane, board_column_key FROM tasks WHERE board_column_key = 'waiting' ORDER BY id",
  );
  assert.deepEqual(
    moved.rows.map((row) => [row.id, row.lane, row.board_column_key]),
    [["t1", "doing", "waiting"], ["t3", "doing", "waiting"]],
  );

  const seeded = await client.execute("SELECT value FROM meta WHERE key = 'board:ws-a:columns'");
  assert.equal(seeded.rows.length, 1);
  const seededConfig = JSON.parse(String(seeded.rows[0].value));
  assert.deepEqual(seededConfig.order, ["todo", "doing", "review", "waiting", "done"]);
  assert.deepEqual(seededConfig.custom, [{ key: "waiting", name: "Waiting" }]);

  const amended = await client.execute("SELECT value FROM meta WHERE key = 'board:ws-b:columns'");
  const amendedConfig = JSON.parse(String(amended.rows[0].value));
  assert.deepEqual(amendedConfig.custom, [
    { key: "col-pay", name: "Paid" },
    { key: "waiting", name: "Waiting" },
  ]);
  assert.equal(amendedConfig.order[amendedConfig.order.length - 1], "waiting");

  const untouched = await client.execute("SELECT COUNT(*) AS n FROM meta WHERE key = 'board:ws-c:columns'");
  assert.equal(Number(untouched.rows[0].n), 0);

  client.close();
});

test("0025 adds completed_at and backfills only provable done transitions", async () => {
  const client = createClient({ url: ":memory:" });
  await client.execute("CREATE TABLE tasks (id TEXT PRIMARY KEY, workspace_id TEXT, lane TEXT, board_column_key TEXT)");
  await client.execute("CREATE TABLE activities (id TEXT PRIMARY KEY, task_id TEXT, kind TEXT, payload TEXT, created_at INTEGER)");

  // d1: done with a provable toggle. d2: done with a provable move.
  // d3: done, no log (stays NULL). o1: open with a stale done event
  // (reopened later — must NOT be stamped). c1: claimed task (skipped).
  await client.execute(`INSERT INTO tasks VALUES
    ('d1','ws','done',NULL),
    ('d2','ws','done',NULL),
    ('d3','ws','done',NULL),
    ('o1','ws','doing',NULL),
    ('c1','ws','done','col-x')`);
  await client.execute(`INSERT INTO activities VALUES
    ('a1','d1','toggleComplete','{"kind":"toggleComplete","to":"done"}',1000),
    ('a2','d1','toggleComplete','{"kind":"toggleComplete","to":"done"}',2000),
    ('a3','d2','move','{"kind":"move","from":"doing","to":"done"}',1500),
    ('a4','o1','toggleComplete','{"kind":"toggleComplete","to":"done"}',1200)`);

  assert.equal(STATEMENTS_0025.length, 2);
  for (const statement of STATEMENTS_0025) await client.execute(statement);

  const rows = await client.execute("SELECT id, completed_at FROM tasks ORDER BY id");
  assert.deepEqual(
    rows.rows.map((row) => [row.id, row.completed_at === null ? null : Number(row.completed_at)]),
    [["c1", null], ["d1", 2000], ["d2", 1500], ["d3", null], ["o1", null]],
  );
  client.close();
});
