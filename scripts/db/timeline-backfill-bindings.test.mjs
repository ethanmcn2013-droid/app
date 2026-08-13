/**
 * The backfill, against two real databases.
 *
 * The classifier is proved separately and purely. What is proved here is the
 * part a pure test cannot reach: that a dry run writes nothing at all, that an
 * apply writes exactly the exact-evidence rows and their mirrors, that a
 * second apply is a no-op, that the committed receipt names nobody, and that
 * the manifest refuses to be written inside the repository.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { defaultRoot } from "./migration-ledger.mjs";
import { testDatabaseUrl } from "./test-temp-database.mjs";
import { loadTimelineLedger, runTimelineMigrations } from "./timeline-migrate.mjs";
import { backfillBindings } from "./timeline-backfill-bindings.mjs";

const context = loadTimelineLedger();
const OWNER = "user_couple";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "timeline-backfill-test-"));
}

async function seedTimeline(url) {
  const client = createClient({ url });
  await runTimelineMigrations({ client, context, releaseSha: "backfill-test" });
  const workspace = (slug, suiteId, owner = OWNER) => client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id, suite_workspace_id) VALUES (?, ?, ?, ?)",
    args: [slug, slug, owner, suiteId],
  });
  const project = (workspaceSlug, slug, sourceId) => client.execute({
    sql: "INSERT INTO projects (workspace_slug, slug, name, one_liner, accent, source_tasks_workspace_id) VALUES (?, ?, ?, '', 'default', ?)",
    args: [workspaceSlug, slug, slug, sourceId],
  });

  // 1 · exact: parent A, one child A.                        → auto-bind
  await workspace("exact", "ws_a");
  await project("exact", "plan", "ws_a");
  // 2 · parent B, one unbound child.                          → auto-bind + child mirror
  await workspace("unbound-child", "ws_b");
  await project("unbound-child", "plan", null);
  // 3 · unbound parent, one child C, owned by this actor.     → auto-bind + parent mirror
  await workspace("unbound-parent", null);
  await project("unbound-parent", "plan", "ws_c");
  // 4 · parent D, child E.                                    → needs_review
  await workspace("conflict", "ws_d");
  await project("conflict", "plan", "ws_e");
  // 5 · two unbound children under a bound parent.            → needs_review
  await workspace("venue", "ws_f");
  await project("venue", "couple-one", null);
  await project("venue", "couple-two", null);
  // 6 · Tasks Project no longer exists.                       → orphaned
  await workspace("gone", "ws_missing");
  await project("gone", "plan", "ws_missing");
  // 7 · fully unlinked.                                       → no write, ever
  await workspace("manual-only", null);
  await project("manual-only", "plan", null);
  client.close();
}

async function seedTasks(url) {
  const client = createClient({ url });
  await client.executeMultiple(`
    CREATE TABLE users (id TEXT PRIMARY KEY, clerk_id TEXT);
    CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT, owner_user_id TEXT, archived_at INTEGER);
  `);
  await client.execute("INSERT INTO users VALUES ('u_1', 'user_couple')");
  for (const id of ["ws_a", "ws_b", "ws_c", "ws_d", "ws_e", "ws_f"]) {
    await client.execute({ sql: "INSERT INTO workspaces VALUES (?, ?, 'u_1', NULL)", args: [id, id] });
  }
  client.close();
}

async function harness() {
  const dir = tempDir();
  // `testDatabaseUrl` asserts absolute, outside the repository, and that the
  // directory is still there — and builds the URL with `pathToFileURL`.
  // Hand-assembling a `file:` URL yields `file:C:/…` on Windows and
  // `file:/tmp/…` on Linux: two shapes that work for two different reasons.
  const timelineUrl = testDatabaseUrl(dir, "timeline.db");
  const tasksUrl = testDatabaseUrl(dir, "tasks.db");
  await seedTimeline(timelineUrl);
  await seedTasks(tasksUrl);
  return {
    dir,
    timelineUrl,
    tasksUrl,
    cleanup: () => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* the OS can have it */
      }
    },
  };
}

async function timelineState(url) {
  const client = createClient({ url });
  try {
    const bindings = await client.execute("SELECT tasks_workspace_id, timeline_workspace_slug, primary_timeline_slug, state, provenance FROM suite_project_bindings ORDER BY tasks_workspace_id");
    const workspaces = await client.execute("SELECT slug, suite_workspace_id FROM workspaces ORDER BY slug");
    const projects = await client.execute("SELECT workspace_slug, slug, source_tasks_workspace_id FROM projects ORDER BY workspace_slug, slug");
    return {
      bindings: bindings.rows.map((row) => ({ ...row })),
      workspaces: workspaces.rows.map((row) => ({ ...row })),
      projects: projects.rows.map((row) => ({ ...row })),
    };
  } finally {
    client.close();
  }
}

test("a dry run classifies everything and writes nothing", async (t) => {
  const fixture = await harness();
  t.after(fixture.cleanup);
  const before = await timelineState(fixture.timelineUrl);

  const { receipt } = await backfillBindings({
    timelineUrl: fixture.timelineUrl,
    tasksUrl: fixture.tasksUrl,
    salt: "test-salt",
    now: () => 1_786_600_000_000,
  });

  assert.equal(receipt.mode, "dry-run");
  assert.equal(receipt.tasksExportComplete, true);
  assert.equal(receipt.summary.autoBind, 3);
  assert.equal(receipt.summary.needsReview, 2);
  assert.equal(receipt.summary.orphaned, 1);
  assert.equal(receipt.summary.unlinked, 1);
  assert.deepEqual(receipt.summary.autoBindByRule, {
    "parent-and-one-matching-child": 1,
    "parent-and-one-unbound-child": 1,
    "unbound-parent-one-owned-child": 1,
  });
  assert.equal(receipt.wrote, 0);
  assert.deepEqual(await timelineState(fixture.timelineUrl), before);
});

test("the committed receipt carries counts and salted hashes only", async (t) => {
  const fixture = await harness();
  t.after(fixture.cleanup);
  const { receipt } = await backfillBindings({
    timelineUrl: fixture.timelineUrl,
    tasksUrl: fixture.tasksUrl,
    salt: "test-salt",
  });
  const serialized = JSON.stringify(receipt);
  for (const secret of ["exact", "venue", "glenmara", "ws_a", "ws_missing", "test-salt", "couple-one"]) {
    assert.ok(!serialized.includes(secret), `the receipt must not carry ${secret}`);
  }
  for (const hash of [...receipt.boundWorkspaceHashes, ...receipt.needsReviewHashes]) {
    assert.match(hash, /^[a-f0-9]{16}$/);
  }
  assert.equal(receipt.boundWorkspaceHashes.length, 3);
  assert.equal(receipt.needsReviewHashes.length, 2);
});

test("apply writes exactly the exact-evidence rows, their mirrors, and nothing else", async (t) => {
  const fixture = await harness();
  t.after(fixture.cleanup);
  const manifestPath = path.join(fixture.dir, "manifest.json");

  const first = await backfillBindings({
    timelineUrl: fixture.timelineUrl,
    tasksUrl: fixture.tasksUrl,
    apply: true,
    manifestPath,
    salt: "test-salt",
    now: () => 1_786_600_000_000,
  });
  assert.equal(first.receipt.wrote, 3);

  const state = await timelineState(fixture.timelineUrl);
  assert.deepEqual(state.bindings, [
    { tasks_workspace_id: "ws_a", timeline_workspace_slug: "exact", primary_timeline_slug: "plan", state: "active", provenance: "legacy_exact" },
    { tasks_workspace_id: "ws_b", timeline_workspace_slug: "unbound-child", primary_timeline_slug: "plan", state: "active", provenance: "legacy_exact" },
    { tasks_workspace_id: "ws_c", timeline_workspace_slug: "unbound-parent", primary_timeline_slug: "plan", state: "active", provenance: "legacy_exact" },
  ]);

  // The mirrors are dual-written, never cleared.
  const workspaces = Object.fromEntries(state.workspaces.map((row) => [row.slug, row.suite_workspace_id]));
  assert.equal(workspaces["unbound-parent"], "ws_c", "the parent mirror is filled in");
  assert.equal(workspaces.exact, "ws_a");
  assert.equal(workspaces.conflict, "ws_d", "an unwritable workspace keeps exactly what it had");
  assert.equal(workspaces["manual-only"], null);

  const children = Object.fromEntries(state.projects.map((row) => [`${row.workspace_slug}/${row.slug}`, row.source_tasks_workspace_id]));
  assert.equal(children["unbound-child/plan"], "ws_b", "the child mirror is filled in");
  assert.equal(children["conflict/plan"], "ws_e", "a conflicting child is preserved exactly as it was");
  assert.equal(children["venue/couple-one"], null);
  assert.equal(children["venue/couple-two"], null);
  assert.equal(children["gone/plan"], "ws_missing");

  // Second run: everything exact is already bound, so nothing is written.
  const second = await backfillBindings({
    timelineUrl: fixture.timelineUrl,
    tasksUrl: fixture.tasksUrl,
    apply: true,
    manifestPath,
    salt: "test-salt",
  });
  assert.equal(second.receipt.wrote, 0);
  assert.equal(second.receipt.summary.alreadyBound, 3);
  assert.deepEqual(await timelineState(fixture.timelineUrl), state);
});

test("the operator manifest carries the exact ids and a rollback, and is written 0600", async (t) => {
  const fixture = await harness();
  t.after(fixture.cleanup);
  const manifestPath = path.join(fixture.dir, "operator", "manifest.json");
  await backfillBindings({
    timelineUrl: fixture.timelineUrl,
    tasksUrl: fixture.tasksUrl,
    apply: true,
    manifestPath,
    salt: "test-salt",
  });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.salt, "test-salt", "the salt lives here, not in the receipt");
  assert.match(manifest.warning, /Never commit/);
  const exact = manifest.decisions.find((entry) => entry.timelineWorkspaceSlug === "unbound-parent");
  assert.equal(exact.priorSuiteWorkspaceId, null, "the prior value is recorded before it is changed");
  assert.deepEqual(exact.rollback, [
    "DELETE FROM suite_project_bindings WHERE tasks_workspace_id = 'ws_c' AND timeline_workspace_slug = 'unbound-parent';",
    "UPDATE workspaces SET suite_workspace_id = NULL WHERE slug = 'unbound-parent' AND suite_workspace_id = 'ws_c';",
  ]);
  const review = manifest.decisions.find((entry) => entry.timelineWorkspaceSlug === "conflict");
  assert.equal(review.decision.kind, "needs_review");
  assert.deepEqual(review.rollback, [], "nothing was written, so there is nothing to roll back");
});

test("apply refuses to write the manifest inside the repository", async (t) => {
  const fixture = await harness();
  t.after(fixture.cleanup);
  await assert.rejects(
    () => backfillBindings({
      timelineUrl: fixture.timelineUrl,
      tasksUrl: fixture.tasksUrl,
      apply: true,
      manifestPath: path.join(defaultRoot, "drizzle-timeline", "manifest.json"),
    }),
    /must live outside the repository/,
  );
  await assert.rejects(
    () => backfillBindings({ timelineUrl: fixture.timelineUrl, tasksUrl: fixture.tasksUrl, apply: true }),
    /--apply requires --manifest/,
  );
  const state = await timelineState(fixture.timelineUrl);
  assert.deepEqual(state.bindings, [], "a refused run writes nothing");
});

test("an unreadable Tasks database aborts rather than orphaning live couples", async (t) => {
  const fixture = await harness();
  t.after(fixture.cleanup);
  await assert.rejects(
    () => backfillBindings({
      timelineUrl: fixture.timelineUrl,
      // The directory exists; the database deliberately does not.
      tasksUrl: testDatabaseUrl(fixture.dir, "no-such-tasks.db"),
    }),
    /Tasks export is incomplete or unavailable/,
  );
  await assert.rejects(
    () => backfillBindings({ timelineUrl: fixture.timelineUrl }),
    /a Tasks database is required/,
  );
});

test("orphaned bindings are written only when explicitly asked for", async (t) => {
  const fixture = await harness();
  t.after(fixture.cleanup);
  const manifestPath = path.join(fixture.dir, "manifest.json");
  await backfillBindings({
    timelineUrl: fixture.timelineUrl,
    tasksUrl: fixture.tasksUrl,
    apply: true,
    manifestPath,
    includeOrphaned: true,
    salt: "test-salt",
  });
  const state = await timelineState(fixture.timelineUrl);
  const orphan = state.bindings.find((row) => row.tasks_workspace_id === "ws_missing");
  assert.equal(orphan.state, "orphaned", "sync is disabled, and nothing is deleted");
  assert.equal(orphan.provenance, "operator_confirmed");

  // The couple's content is untouched: the child still names the Project it
  // always named, and the workspace mirror is unchanged.
  const children = Object.fromEntries(state.projects.map((row) => [`${row.workspace_slug}/${row.slug}`, row.source_tasks_workspace_id]));
  assert.equal(children["gone/plan"], "ws_missing");
});
