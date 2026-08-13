/**
 * The inventory's two obligations: correct counts, and no capacity to write.
 *
 * The second is the one worth testing hardest. This script runs against
 * production by hand at the most anxious moment of a migration, and a
 * carefully-worded comment promising read-only is not a safety property.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createClient } from "@libsql/client";
import { loadTimelineLedger, runTimelineMigrations } from "./timeline-migrate.mjs";
import { readRepositoryFile } from "./test-temp-database.mjs";
import {
  assertReadOnly,
  crossCheckTasksProjects,
  inventoryTimeline,
  readOnlyQuery,
} from "./timeline-inventory.mjs";

const context = loadTimelineLedger();
// Read against the repository root, not the process cwd: a relative read is
// one `cd` away from asserting nothing at all.
const SOURCE = readRepositoryFile("scripts/db/timeline-inventory.mjs");

async function timelineFixture() {
  const client = createClient({ url: ":memory:" });
  await runTimelineMigrations({ client, context, releaseSha: "inventory-test" });

  const workspace = async (slug, suiteId) => client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id, suite_workspace_id) VALUES (?, ?, 'user_couple', ?)",
    args: [slug, slug, suiteId],
  });
  const project = async (workspaceSlug, slug, sourceId) => client.execute({
    sql: "INSERT INTO projects (workspace_slug, slug, name, one_liner, accent, source_tasks_workspace_id) VALUES (?, ?, ?, '', 'default', ?)",
    args: [workspaceSlug, slug, slug, sourceId],
  });

  // Exact: parent A, one child A.
  await workspace("exact", "ws_a");
  await project("exact", "plan", "ws_a");
  // Conflict: parent B, child C.
  await workspace("conflict", "ws_b");
  await project("conflict", "plan", "ws_c");
  // Unbound parent, two children, one of them bound.
  await workspace("unbound", null);
  await project("unbound", "plan", null);
  await project("unbound", "second", "ws_d");
  // Two workspaces whose children claim the same Tasks Project.
  await workspace("twin-one", null);
  await project("twin-one", "plan", "ws_e");
  await workspace("twin-two", null);
  await project("twin-two", "plan", "ws_e");
  // A Tasks Project that no longer exists anywhere.
  await workspace("gone", "ws_missing");
  await project("gone", "plan", "ws_missing");

  await client.execute({
    sql: "INSERT INTO node_overlays (workspace_slug, node_id, source, hidden) VALUES ('exact', 'manual:plan:1', 'manual', 0)",
    args: [],
  });
  await client.execute({
    sql: "INSERT INTO node_overlays (workspace_slug, node_id, source, hidden) VALUES ('exact', 'ms-ws_a-t1', 'synced', 1)",
    args: [],
  });
  await client.execute({
    sql: "INSERT INTO timeline_publications (id, workspace_slug, source_workspace_id, source_digest, label, audience_kind, timezone, state) VALUES ('pub_1', 'exact', 'ws_a', 'digest', 'Our day', 'couple', 'Europe/Dublin', 'published')",
    args: [],
  });
  await client.execute({
    sql: "INSERT INTO audience_shares (id, publication_id, token_hash, state) VALUES ('share_1', 'pub_1', 'hash', 'active')",
    args: [],
  });
  await client.execute({
    sql: "INSERT INTO audience_shares (id, publication_id, token_hash, state) VALUES ('share_2', 'pub_1', 'hash-2', 'revoked')",
    args: [],
  });
  return client;
}

async function tasksFixture() {
  const client = createClient({ url: ":memory:" });
  await client.executeMultiple(`
    CREATE TABLE users (id TEXT PRIMARY KEY, clerk_id TEXT);
    CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT, owner_user_id TEXT, archived_at INTEGER);
    CREATE TABLE workspace_members (workspace_id TEXT, user_id TEXT);
  `);
  await client.execute("INSERT INTO users VALUES ('u_1', 'user_couple')");
  for (const [id, archived] of [["ws_a", null], ["ws_b", null], ["ws_c", null], ["ws_d", 1_700_000_000], ["ws_e", null]]) {
    await client.execute({
      sql: "INSERT INTO workspaces VALUES (?, ?, 'u_1', ?)",
      args: [id, id, archived],
    });
    await client.execute({ sql: "INSERT INTO workspace_members VALUES (?, 'u_1')", args: [id] });
  }
  return client;
}

test("the inventory counts every shape the classification table names", async (t) => {
  const timeline = await timelineFixture();
  t.after(() => timeline.close());
  const report = await inventoryTimeline(timeline);

  assert.equal(report.workspaces.total, 6);
  assert.equal(report.workspaces.nullParentMapping, 3);
  assert.equal(report.workspaces.bound, 3);
  assert.equal(report.projects.total, 7);
  assert.equal(report.projects.nullChildMapping, 1);
  assert.equal(report.projects.parentChildConflicts, 1, "parent=B child=C is one conflict");
  assert.equal(report.projects.duplicateSourceIdGroups, 1, "ws_e is claimed twice");
  assert.equal(report.projects.multiWorkspaceSourceIdGroups, 1);
  assert.equal(report.workspaceChildren.multiChildWorkspaces, 1);
  assert.equal(report.workspaceChildren.multiBoundChildWorkspaces, 0);
  assert.equal(report.overlays.total, 2);
  assert.equal(report.overlays.manual, 1);
  assert.equal(report.overlays.hidden, 1);
  assert.equal(report.publications.total, 1);
  assert.equal(report.publications.published, 1);
  assert.equal(report.shares.total, 2);
  assert.equal(report.shares.active, 1);
  assert.equal(report.bindings.present, true);
  assert.equal(report.bindings.total, 0);
  assert.equal(report.syncState.present, true);
  assert.equal(report.integrity, "ok");
  assert.equal(report.foreignKeyViolations, 0);
});

test("the cross-database check separates missing Projects from archived ones", async (t) => {
  const timeline = await timelineFixture();
  const tasks = await tasksFixture();
  t.after(() => {
    timeline.close();
    tasks.close();
  });

  const cross = await crossCheckTasksProjects(timeline, tasks);
  assert.equal(cross.referenced, 6, "ws_a, ws_b, ws_c, ws_d, ws_e and ws_missing");
  assert.equal(cross.present, 5);
  assert.equal(cross.missing, 1, "only ws_missing is genuinely gone");
  assert.equal(cross.archived, 1, "ws_d is archived, which is not the same as missing");
});

test("the inventory refuses anything that is not a single read", () => {
  for (const statement of [
    "INSERT INTO workspaces VALUES ('x')",
    "UPDATE workspaces SET name = 'x'",
    "DELETE FROM workspaces",
    "DROP TABLE workspaces",
    "SELECT 1; DELETE FROM workspaces",
    "  delete from projects",
    "ATTACH DATABASE 'other.db' AS other",
  ]) {
    assert.throws(() => assertReadOnly(statement), /refused a statement that is not a single read/, statement);
  }
  assert.equal(assertReadOnly("SELECT COUNT(*) AS value FROM workspaces"), "SELECT COUNT(*) AS value FROM workspaces");
  assert.equal(assertReadOnly("PRAGMA foreign_keys"), "PRAGMA foreign_keys");
});

test("a write cannot reach a database even by calling the query helper", async (t) => {
  const timeline = await timelineFixture();
  t.after(() => timeline.close());
  await assert.rejects(
    () => readOnlyQuery(timeline, "DELETE FROM workspaces"),
    /refused a statement that is not a single read/,
  );
  assert.equal(
    Number((await timeline.execute("SELECT COUNT(*) AS value FROM workspaces")).rows[0].value),
    6,
  );
});

test("the file has exactly one execute call, and it is the guarded one", () => {
  // The behavioural tests above prove the guard refuses writes. This proves
  // nothing can go around it: a second `execute` added later — however
  // innocent — fails here rather than shipping to production.
  const executeCalls = SOURCE.match(/\.execute\s*\(/g) ?? [];
  assert.equal(executeCalls.length, 1, "every database call must go through readOnlyQuery");
  assert.match(
    SOURCE,
    /export async function readOnlyQuery[\s\S]{0,200}client\.execute\(\{ sql: assertReadOnly\(sql\), args \}\)/,
    "the one execute must pass its SQL through assertReadOnly",
  );
  for (const forbidden of ["executeMultiple", "batch(", "transaction("]) {
    assert.ok(!SOURCE.includes(forbidden), `${forbidden} has no place in a read-only inventory`);
  }
});
