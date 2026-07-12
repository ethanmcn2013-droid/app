import { test } from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { freshMemoryDb } from "./memory-test-db";

test("scenario A: legacy workspaces keep ids, content, links and receive one finite default period", async () => {
  const { client, db } = await freshMemoryDb({
    beforeMigration: async (filename, connection) => {
      if (filename !== "0013_planning_periods.sql") return;
      await connection.executeMultiple(`
        INSERT INTO users (id, color, initials) VALUES
          ('owner-a', 'black', 'OA'),
          ('owner-b', 'gray', 'OB');
        INSERT INTO workspaces (id, slug, name, owner_user_id, active_domain, created_at) VALUES
          ('ws-a1', 'a-one', 'Geography', 'owner-a', 'student', 1767225600),
          ('ws-a2', 'a-two', 'History', 'owner-a', 'student', 1767312000),
          ('ws-ambiguous', 'ambiguous', 'Review me', 'owner-a', 'marketing', 1767398400);
        INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
          ('ws-a1', 'owner-a', 'owner'),
          ('ws-a2', 'owner-a', 'owner'),
          ('ws-ambiguous', 'owner-a', 'owner'),
          ('ws-ambiguous', 'owner-b', 'owner');
        INSERT INTO tasks (id, workspace_id, title, lane, priority, assignees, created_at, updated_at)
          VALUES ('task-a1', 'ws-a1', 'Original private task', 'todo', 'p2', '[]', 1767225600, 1767225600);
        INSERT INTO share_links (token, workspace_id, view, mode)
          VALUES ('existing-public-token', 'ws-a1', 'board', 'view');
      `);
    },
  });

  const grouped = await client.execute(`
    SELECT id, planning_period_id, context_type FROM workspaces
    WHERE id IN ('ws-a1', 'ws-a2') ORDER BY id
  `);
  assert.equal(grouped.rows.length, 2);
  assert.equal(grouped.rows[0].id, "ws-a1");
  assert.equal(grouped.rows[0].planning_period_id, grouped.rows[1].planning_period_id);
  assert.equal(grouped.rows[0].context_type, "project");

  const period = await client.execute({
    sql: "SELECT name, start_date, end_date, timezone FROM planning_periods WHERE id = ?",
    args: [String(grouped.rows[0].planning_period_id)],
  });
  assert.equal(period.rows[0].name, "Active work");
  assert.equal(period.rows[0].start_date, "2026-01-01");
  assert.equal(period.rows[0].end_date, "2026-12-31");
  assert.equal(period.rows[0].timezone, "UTC");

  const content = await client.execute("SELECT id, title, workspace_id FROM tasks WHERE id = 'task-a1'");
  assert.deepEqual(content.rows[0], {
    id: "task-a1",
    title: "Original private task",
    workspace_id: "ws-a1",
  });
  const link = await client.execute("SELECT token, workspace_id FROM share_links WHERE token = 'existing-public-token'");
  assert.equal(link.rows[0].token, "existing-public-token");
  assert.equal(link.rows[0].workspace_id, "ws-a1");

  const ambiguous = await client.execute("SELECT planning_period_id FROM workspaces WHERE id = 'ws-ambiguous'");
  assert.equal(ambiguous.rows[0].planning_period_id, null);
  const report = await client.execute("SELECT disposition FROM planning_period_migration_report WHERE workspace_id = 'ws-ambiguous'");
  assert.equal(report.rows[0].disposition, "ambiguous_owner");

  // Keep a typed drizzle read in the test so schema/catalog drift fails TS.
  const typed = await db.run(sql`SELECT COUNT(*) AS count FROM planning_periods`);
  assert.equal(Number(typed.rows[0].count) >= 1, true);
});

test("scenario D: sponsorship metadata does not create membership or expose content columns", async () => {
  const { client } = await freshMemoryDb();
  const columns = await client.execute("PRAGMA table_info(workspace_sponsorships)");
  const names = columns.rows.map((row) => String(row.name));
  assert.deepEqual(names, [
    "id", "workspace_id", "sponsor_id", "sponsor_ref", "entitlement_ref",
    "status", "consented_metadata", "metadata_version", "consent_receipt_id",
    "consented_at", "revoked_at", "created_at", "updated_at",
  ]);
  for (const forbidden of ["role", "member", "task", "note", "timeline", "content", "email"]) {
    assert.equal(names.some((name) => name.includes(forbidden)), false);
  }
});
