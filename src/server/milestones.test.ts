/**
 * Milestone tests.
 *
 * The maybeAwardCompletionMilestone function imports the real db singleton,
 * so we test the core logic via two extracted helpers:
 *
 *   1. awardableThresholds (pure) — which thresholds would be newly crossed
 *      given a count and a set of already-awarded thresholds.
 *
 *   2. SQL logic against a fresh memory DB — the DISTINCT count query and the
 *      ON CONFLICT DO NOTHING exactly-once insert.
 *
 * Run: node --import tsx --test src/server/milestones.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { freshMemoryDb } from "./db/memory-test-db";
import { awardableThresholds, MILESTONE_THRESHOLDS } from "@/lib/milestones-pure";

// ── Pure helper: awardableThresholds ─────────────────────────────────────────

test("awardableThresholds: count below all thresholds → empty", () => {
  const result = awardableThresholds(99, new Set());
  assert.deepEqual(result, []);
});

test("awardableThresholds: count exactly at 100 → [100]", () => {
  const result = awardableThresholds(100, new Set());
  assert.deepEqual(result, [100]);
});

test("awardableThresholds: count 250 → [100, 250]", () => {
  const result = awardableThresholds(250, new Set());
  assert.deepEqual(result, [100, 250]);
});

test("awardableThresholds: count 1000 → all four thresholds", () => {
  const result = awardableThresholds(1000, new Set());
  assert.deepEqual(result, [100, 250, 500, 1000]);
});

test("awardableThresholds: 100 already awarded, count=100 → []", () => {
  const result = awardableThresholds(100, new Set([100]));
  assert.deepEqual(result, []);
});

test("awardableThresholds: 100 already awarded, count=250 → [250] only", () => {
  const result = awardableThresholds(250, new Set([100]));
  assert.deepEqual(result, [250]);
});

test("awardableThresholds: all awarded, count=1000 → []", () => {
  const result = awardableThresholds(1000, new Set([100, 250, 500, 1000]));
  assert.deepEqual(result, []);
});

test("awardableThresholds: count 499 → [100, 250] only (500 not reached)", () => {
  const result = awardableThresholds(499, new Set());
  assert.deepEqual(result, [100, 250]);
});

// ── MILESTONE_THRESHOLDS order and values ─────────────────────────────────────

test("MILESTONE_THRESHOLDS are [100, 250, 500, 1000] in ascending order", () => {
  assert.deepEqual([...MILESTONE_THRESHOLDS], [100, 250, 500, 1000]);
});

// ── Memory DB: DISTINCT count SQL ────────────────────────────────────────────

async function seedCompletions(
  client: Awaited<ReturnType<typeof freshMemoryDb>>["client"],
  userId: string,
  taskIds: string[],
  countPerTask: number = 1,
) {
  // Each taskId gets countPerTask completion activity rows (to test DISTINCT).
  let i = 0;
  for (const taskId of taskIds) {
    for (let j = 0; j < countPerTask; j++) {
      await client.execute(`
        INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload)
        VALUES ('act-${i++}', 'ws-ms', '${taskId}', '${userId}',
                'toggleComplete', '{"kind":"toggleComplete","to":"done"}')
      `);
    }
  }
}

test("DISTINCT count: completing one task twice counts once", async () => {
  const { client } = await freshMemoryDb();

  // Seed minimal schema rows.
  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('u-ms','clerk_ms','#111','MS'); -- ds-allow: SQL seed colour value, not CSS
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES ('ws-ms','ws-ms-slug','MS WS','u-ms');
    INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES
      ('t-ms-1','ws-ms','Task 1','done','med');
  `);

  // Insert 5 completion activities for the same task (recurrence-style).
  await seedCompletions(client, "u-ms", ["t-ms-1"], 5);

  const rs = await client.execute(`
    SELECT COUNT(DISTINCT task_id) AS n
    FROM activities
    WHERE user_id = 'u-ms'
      AND kind = 'toggleComplete'
      AND json_extract(payload, '$.to') = 'done'
  `);
  assert.equal(Number(rs.rows[0]!.n), 1, "One task completed 5 times counts as 1 distinct");
});

test("DISTINCT count: 3 distinct tasks → count 3", async () => {
  const { client } = await freshMemoryDb();

  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('u-ms2','clerk_ms2','#222','M2'); -- ds-allow: SQL seed colour value, not CSS
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES ('ws-ms2','ws-ms2-slug','MS WS2','u-ms2');
    INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES
      ('t2-1','ws-ms2','Task 1','done','med'),
      ('t2-2','ws-ms2','Task 2','done','med'),
      ('t2-3','ws-ms2','Task 3','done','med');
  `);

  await seedCompletions(client, "u-ms2", ["t2-1", "t2-2", "t2-3"], 2);

  const rs = await client.execute(`
    SELECT COUNT(DISTINCT task_id) AS n
    FROM activities
    WHERE user_id = 'u-ms2'
      AND kind = 'toggleComplete'
      AND json_extract(payload, '$.to') = 'done'
  `);
  assert.equal(Number(rs.rows[0]!.n), 3, "3 distinct tasks should count as 3");
});

test("DISTINCT count: only counts 'done' direction, not reopens", async () => {
  const { client } = await freshMemoryDb();

  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('u-ms3','clerk_ms3','#333','M3'); -- ds-allow: SQL seed colour value, not CSS
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES ('ws-ms3','ws-ms3-slug','MS WS3','u-ms3');
    INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES
      ('t3-1','ws-ms3','Task 1','done','med');
  `);

  // One done + one open (reopen) for the same task.
  await client.execute(`
    INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload)
    VALUES
      ('act-d','ws-ms3','t3-1','u-ms3','toggleComplete','{"kind":"toggleComplete","to":"done"}'),
      ('act-o','ws-ms3','t3-1','u-ms3','toggleComplete','{"kind":"toggleComplete","to":"open"}')
  `);

  const rs = await client.execute(`
    SELECT COUNT(DISTINCT task_id) AS n
    FROM activities
    WHERE user_id = 'u-ms3'
      AND kind = 'toggleComplete'
      AND json_extract(payload, '$.to') = 'done'
  `);
  assert.equal(Number(rs.rows[0]!.n), 1, "Only done-direction activities should count");
});

// ── Memory DB: ON CONFLICT DO NOTHING exactly-once ────────────────────────────

test("ON CONFLICT DO NOTHING: second insert for same milestone key → rowsAffected=0", async () => {
  const { client } = await freshMemoryDb();

  const key = "milestone:u-test:100";

  const r1 = await client.execute(`
    INSERT INTO meta (key, value, updated_at)
    VALUES ('${key}', '100', unixepoch())
    ON CONFLICT(key) DO NOTHING
  `);
  assert.equal(r1.rowsAffected, 1, "First insert should have rowsAffected=1");

  const r2 = await client.execute(`
    INSERT INTO meta (key, value, updated_at)
    VALUES ('${key}', '105', unixepoch())
    ON CONFLICT(key) DO NOTHING
  `);
  assert.equal(r2.rowsAffected, 0, "Second insert should have rowsAffected=0 (exactly-once)");

  // Verify original value is preserved (DO NOTHING doesn't update).
  const rs = await client.execute(`SELECT value FROM meta WHERE key = '${key}'`);
  assert.equal(rs.rows[0]!.value as string, "100", "Original value should be unchanged");
});

test("ON CONFLICT DO NOTHING: different users get independent milestone keys", async () => {
  const { client } = await freshMemoryDb();

  const k1 = "milestone:u-a:100";
  const k2 = "milestone:u-b:100";

  const r1 = await client.execute(
    `INSERT INTO meta (key, value, updated_at) VALUES ('${k1}', '100', unixepoch()) ON CONFLICT(key) DO NOTHING`,
  );
  const r2 = await client.execute(
    `INSERT INTO meta (key, value, updated_at) VALUES ('${k2}', '102', unixepoch()) ON CONFLICT(key) DO NOTHING`,
  );

  assert.equal(r1.rowsAffected, 1, "User A milestone should be awarded");
  assert.equal(r2.rowsAffected, 1, "User B milestone should be awarded independently");
});

// ── Threshold logic driven against memory DB (integration) ───────────────────

test("threshold crossing: 100 distinct completions triggers the 100 threshold", async () => {
  const { client } = await freshMemoryDb();

  await client.executeMultiple(`
    INSERT INTO users (id, clerk_id, color, initials) VALUES ('u-t100','clerk_t100','#444','T1'); -- ds-allow: SQL seed colour value, not CSS
    INSERT INTO workspaces (id, slug, name, owner_user_id) VALUES ('ws-t100','ws-t100-slug','T100 WS','u-t100');
  `);

  // Create 100 distinct tasks.
  const taskInserts = Array.from({ length: 100 }, (_, i) =>
    `('task-t100-${i}','ws-t100','Task ${i}','done','med')`
  ).join(",\n");
  await client.execute(
    `INSERT INTO tasks (id, workspace_id, title, lane, priority) VALUES ${taskInserts}`,
  );

  // Create 100 completion activities, one per task.
  const actInserts = Array.from({ length: 100 }, (_, i) =>
    `('act-t100-${i}','ws-t100','task-t100-${i}','u-t100','toggleComplete','{"kind":"toggleComplete","to":"done"}')`
  ).join(",\n");
  await client.execute(
    `INSERT INTO activities (id, workspace_id, task_id, user_id, kind, payload) VALUES ${actInserts}`,
  );

  const rs = await client.execute(`
    SELECT COUNT(DISTINCT task_id) AS n
    FROM activities
    WHERE user_id = 'u-t100'
      AND kind = 'toggleComplete'
      AND json_extract(payload, '$.to') = 'done'
  `);
  const count = Number(rs.rows[0]!.n);
  assert.equal(count, 100, "100 distinct completions");

  const awardable = awardableThresholds(count, new Set());
  assert.deepEqual(awardable, [100], "Should award exactly the 100 threshold");
});
