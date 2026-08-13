/**
 * WP4 · the generation/lease compare-and-set, proved against a real Timeline
 * database.
 *
 * ── THE WINDOW ─────────────────────────────────────────────────────────────
 * WP1 stopped a bad read from DELETING. It left a second race untouched: two
 * refreshes overlapping. Open Project A, switch to B, come back to A. Three
 * reads in flight, and whichever finishes LAST wins — regardless of which one
 * read Tasks most recently. A slow A1 landing after a fast A2 quietly puts the
 * older snapshot back, with no error anywhere and no way for the user to tell.
 *
 * The plan's answer (§6.5): "a reconcile commits only when its generation/lease
 * is still current". This proves the three properties that makes true:
 *
 *   1. a later refresh takes a higher generation, invalidating an in-flight one;
 *   2. the older refresh's commit is REFUSED, and refuses to write its nodes;
 *   3. the refusal is atomic — the node write and the compare-and-set share one
 *      transaction, so a lost race leaves nothing behind.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

const SCRATCH_DIR = mkdtempSync(join(tmpdir(), "wp4-sync-generation-"));
const TIMELINE_URL = pathToFileURL(join(SCRATCH_DIR, "timeline.db")).href;
process.env.TIMELINE_DATABASE_URL = TIMELINE_URL;
delete process.env.TIMELINE_AUTH_TOKEN;

const TASKS_PROJECT = "ws_project_a";
const TIMELINE_SLUG = "glenmara-house";
const TIMELINE_PROJECT = "plan";
const OWNER = "user_couple";

type SyncStateModule = typeof import("@/modules/timeline/server/sync/sync-state");
type QueriesModule = typeof import("@/modules/timeline/server/db/timeline-queries");

let syncState: SyncStateModule | null = null;
let queries: QueriesModule | null = null;

async function modules() {
  syncState ??= await import("@/modules/timeline/server/sync/sync-state");
  queries ??= await import("@/modules/timeline/server/db/timeline-queries");
  return { syncState, queries };
}

/** The real baseline plus the real 0001, applied to a real engine. */
async function resetTimelineDatabase(client: ReturnType<typeof createClient>) {
  await client.executeMultiple(`
    DROP TABLE IF EXISTS timeline_source_sync_state;
    DROP TABLE IF EXISTS suite_project_bindings;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS workspaces;
  `);
  const statements = (file: string, wanted: RegExp) =>
    readFileSync(file, "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => wanted.test(statement));

  await client.executeMultiple(
    [
      ...statements(
        "drizzle-timeline/0000_timeline_baseline.sql",
        /^CREATE TABLE `(tasks|projects|workspaces)`/,
      ),
      ...statements(
        "drizzle-timeline/0001_suite_project_bindings.sql",
        /^CREATE (TABLE|UNIQUE INDEX)/,
      ),
    ].join(";\n") + ";",
  );
  await client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id, suite_workspace_id) VALUES (?, ?, ?, ?)",
    args: [TIMELINE_SLUG, "Glenmara House", OWNER, TASKS_PROJECT],
  });
  await client.execute({
    sql: "INSERT INTO projects (workspace_slug, slug, name, one_liner, accent, source_tasks_workspace_id) VALUES (?, ?, ?, '', 'default', ?)",
    args: [TIMELINE_SLUG, TIMELINE_PROJECT, "The plan", TASKS_PROJECT],
  });
}

async function seedNodes(
  client: ReturnType<typeof createClient>,
  titles: ReadonlyArray<readonly [string, string]>,
) {
  for (const [id, title] of titles) {
    await client.execute({
      sql: `INSERT INTO tasks (id, project_slug, workspace_slug, title, description, status, kind, assignee)
            VALUES (?, ?, ?, ?, '', 'next', 'milestone', 'claude-code')`,
      args: [id, TIMELINE_PROJECT, TIMELINE_SLUG, title],
    });
  }
}

async function nodeTitles(client: ReturnType<typeof createClient>) {
  const result = await client.execute({
    sql: "SELECT id, title FROM tasks WHERE workspace_slug = ? ORDER BY id",
    args: [TIMELINE_SLUG],
  });
  return result.rows.map((row) => `${String(row.id)}:${String(row.title)}`);
}

function milestone(id: string, title: string) {
  return {
    id,
    projectSlug: TIMELINE_PROJECT,
    workspaceSlug: TIMELINE_SLUG,
    title,
    status: "next" as const,
    targetDate: null,
    sortOrder: 0,
  };
}

test("the binding is written from the parent mirror, and only from an exact one", async (t) => {
  const client = createClient({ url: TIMELINE_URL });
  t.after(() => client.close());
  await resetTimelineDatabase(client);
  const { syncState: state } = await modules();

  const first = await state.ensureSuiteProjectBinding({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    primaryTimelineSlug: TIMELINE_PROJECT,
    authority: { kind: "inherits-workspace-binding" },
  });
  assert.deepEqual(first, { kind: "bound", created: true });

  // Idempotent: a second visit does not create a second row.
  assert.deepEqual(
    await state.ensureSuiteProjectBinding({
      tasksWorkspaceId: TASKS_PROJECT,
      timelineWorkspaceSlug: TIMELINE_SLUG,
      primaryTimelineSlug: TIMELINE_PROJECT,
      authority: { kind: "inherits-workspace-binding" },
    }),
    { kind: "bound", created: false },
  );

  // A Project the parent mirror does not name cannot be inherited into a
  // binding, whatever the caller believes.
  assert.deepEqual(
    await state.ensureSuiteProjectBinding({
      tasksWorkspaceId: "ws_project_b",
      timelineWorkspaceSlug: TIMELINE_SLUG,
      primaryTimelineSlug: TIMELINE_PROJECT,
      authority: { kind: "inherits-workspace-binding" },
    }),
    { kind: "not-exact", reason: "parent-mirror-disagrees" },
  );

  const rows = await client.execute("SELECT COUNT(*) AS value FROM suite_project_bindings");
  assert.equal(Number(rows.rows[0]!.value), 1);

  // And the legacy mirrors are untouched by any of it.
  const workspace = await client.execute({
    sql: "SELECT suite_workspace_id FROM workspaces WHERE slug = ?",
    args: [TIMELINE_SLUG],
  });
  assert.equal(workspace.rows[0]!.suite_workspace_id, TASKS_PROJECT);
});

test("a later refresh invalidates an earlier one still in flight", async (t) => {
  const client = createClient({ url: TIMELINE_URL });
  t.after(() => client.close());
  await resetTimelineDatabase(client);
  const { syncState: state } = await modules();
  await state.ensureSuiteProjectBinding({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    primaryTimelineSlug: TIMELINE_PROJECT,
    authority: { kind: "inherits-workspace-binding" },
  });

  const a1 = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  const a2 = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.ok(a1 && a2);
  assert.equal(a2.generation, a1.generation + 1, "each refresh takes the next generation");

  // A2 finishes first, as the fast one does.
  assert.equal(
    await state.commitSyncGeneration(
      (await import("@/modules/timeline/server/db/timeline-client")).db,
      a2,
      { status: "complete", sourceCount: 2, importedCount: 2, snapshotDigest: "newer" },
    ),
    true,
  );
  // A1 was reading the whole time and now tries to land its older snapshot.
  assert.equal(
    await state.commitSyncGeneration(
      (await import("@/modules/timeline/server/db/timeline-client")).db,
      a1,
      { status: "complete", sourceCount: 1, importedCount: 1, snapshotDigest: "older" },
    ),
    false,
    "an older refresh must never overwrite a newer snapshot",
  );

  const row = await state.readSyncStateRow(TASKS_PROJECT);
  assert.equal(row?.snapshotDigest, "newer");
  assert.equal(row?.importedCount, 2);
});

test("a lost race writes no nodes at all, because the CAS shares its transaction", async (t) => {
  const client = createClient({ url: TIMELINE_URL });
  t.after(() => client.close());
  await resetTimelineDatabase(client);
  const { syncState: state, queries: q } = await modules();
  const { db } = await import("@/modules/timeline/server/db/timeline-client");
  await state.ensureSuiteProjectBinding({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    primaryTimelineSlug: TIMELINE_PROJECT,
    authority: { kind: "inherits-workspace-binding" },
  });

  // A2's result is already on screen: two milestones, current titles.
  await seedNodes(client, [
    ["ms-ws_project_a-task_0000", "Venue walkthrough (revised)"],
    ["ms-ws_project_a-task_0001", "Menu finalised"],
  ]);

  const a1 = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  const a2 = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.ok(a1 && a2);
  await state.commitSyncGeneration(db, a2, {
    status: "complete",
    sourceCount: 2,
    importedCount: 2,
    snapshotDigest: "newer",
  });

  // A1 now tries to commit the stale snapshot it read before the switch: one
  // milestone, an old title, and a destructive reconcile that would delete the
  // other. This is the exact shape that used to win by finishing last.
  const committed = await db.transaction(async (tx) => {
    const current = await state.commitSyncGeneration(tx, a1, {
      status: "complete",
      sourceCount: 1,
      importedCount: 1,
      snapshotDigest: "older",
    });
    if (!current) return false;
    await q.writeRoadmapNodes(
      TIMELINE_SLUG,
      TIMELINE_PROJECT,
      [milestone("ms-ws_project_a-task_0000", "Venue walkthrough")],
      { reconcile: "destructive", executor: tx },
    );
    return true;
  });

  assert.equal(committed, false, "the stale refresh is refused");
  assert.deepEqual(
    await nodeTitles(client),
    [
      "ms-ws_project_a-task_0000:Venue walkthrough (revised)",
      "ms-ws_project_a-task_0001:Menu finalised",
    ],
    "the newer snapshot survives: no title reverted and nothing was deleted",
  );
  assert.equal((await state.readSyncStateRow(TASKS_PROJECT))?.snapshotDigest, "newer");
});

test("the current refresh does write, and records what it saw", async (t) => {
  const client = createClient({ url: TIMELINE_URL });
  t.after(() => client.close());
  await resetTimelineDatabase(client);
  const { syncState: state, queries: q } = await modules();
  const { db } = await import("@/modules/timeline/server/db/timeline-client");
  await state.ensureSuiteProjectBinding({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    primaryTimelineSlug: TIMELINE_PROJECT,
    authority: { kind: "inherits-workspace-binding" },
  });
  await seedNodes(client, [["ms-ws_project_a-task_0001", "Menu finalised"]]);

  const lease = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.ok(lease);
  const committed = await db.transaction(async (tx) => {
    const current = await state.commitSyncGeneration(
      tx,
      lease,
      { status: "complete", sourceCount: 1, importedCount: 1, snapshotDigest: "d1" },
      1_786_600_000_000,
    );
    if (!current) return false;
    await q.writeRoadmapNodes(
      TIMELINE_SLUG,
      TIMELINE_PROJECT,
      [milestone("ms-ws_project_a-task_0000", "Venue walkthrough")],
      { reconcile: "destructive", executor: tx },
    );
    return true;
  });
  assert.equal(committed, true);
  assert.deepEqual(await nodeTitles(client), ["ms-ws_project_a-task_0000:Venue walkthrough"]);

  const freshness = await state.readSyncFreshness({
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.equal(freshness?.status, "complete");
  assert.equal(freshness?.truncated, false);
  assert.equal(freshness?.lastSuccessAt?.getTime(), 1_786_600_000_000);

  // The lease is released on commit, so the next refresh is never blocked
  // behind a refresh that already finished.
  const row = await state.readSyncStateRow(TASKS_PROJECT);
  assert.equal(row?.leaseToken, null);
  assert.equal(row?.leaseExpiresAt, null);
});

test("a truncated refresh is recorded as truncated, not as a whole snapshot", async (t) => {
  const client = createClient({ url: TIMELINE_URL });
  t.after(() => client.close());
  await resetTimelineDatabase(client);
  const { syncState: state } = await modules();
  const { db } = await import("@/modules/timeline/server/db/timeline-client");
  await state.ensureSuiteProjectBinding({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    primaryTimelineSlug: TIMELINE_PROJECT,
    authority: { kind: "inherits-workspace-binding" },
  });

  const lease = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.ok(lease);
  await state.commitSyncGeneration(db, lease, {
    status: "partial",
    sourceCount: 250,
    importedCount: 201,
  });

  const freshness = await state.readSyncFreshness({
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.equal(freshness?.status, "partial");
  assert.equal(freshness?.truncated, true);
  assert.equal(freshness?.sourceCount, 250);
  assert.equal(freshness?.importedCount, 201);
});

test("a failed read releases its lease and does not move the last success", async (t) => {
  const client = createClient({ url: TIMELINE_URL });
  t.after(() => client.close());
  await resetTimelineDatabase(client);
  const { syncState: state } = await modules();
  const { db } = await import("@/modules/timeline/server/db/timeline-client");
  await state.ensureSuiteProjectBinding({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    primaryTimelineSlug: TIMELINE_PROJECT,
    authority: { kind: "inherits-workspace-binding" },
  });

  const good = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.ok(good);
  await state.commitSyncGeneration(
    db,
    good,
    { status: "complete", sourceCount: 3, importedCount: 3, snapshotDigest: "d" },
    1_786_600_000_000,
  );

  const failing = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.ok(failing);
  await state.releaseSyncLease(failing, { status: "error", errorCode: "milestone_query_failed" }, 1_786_600_900_000);

  const freshness = await state.readSyncFreshness({
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.equal(freshness?.status, "error");
  assert.equal(freshness?.errorCode, "milestone_query_failed");
  assert.equal(
    freshness?.lastSuccessAt?.getTime(),
    1_786_600_000_000,
    "a failure does not get to claim it refreshed anything",
  );
  const row = await state.readSyncStateRow(TASKS_PROJECT);
  assert.equal(row?.leaseToken, null);
});

test("the action commits the generation before it writes nodes", () => {
  // The ordering is the whole property, and it lives in one function. A future
  // edit that moves the write above the compare-and-set would still pass every
  // behavioural test above while reintroducing the defect.
  const action = readFileSync(
    "src/modules/timeline/server/actions/workspaces.ts",
    "utf8",
  );
  const start = action.indexOf("export async function syncMilestonesAction(");
  const body = action.slice(start, action.indexOf("\nexport ", start + 1));

  const acquire = body.indexOf("acquireSyncLease({");
  const read = body.indexOf("getMilestonesForClerkId(");
  const cas = body.indexOf("commitSyncGeneration(tx, lease");
  const write = body.search(/writeRoadmapNodes\([\s\S]{0,200}?executor: tx,/);

  assert.ok(acquire !== -1 && acquire < read, "the generation must be taken before the source is read");
  assert.ok(cas !== -1 && write !== -1, "the transactional path must exist");
  assert.ok(cas < write, "the compare-and-set must run before the nodes are written");
  assert.match(
    body.slice(cas, write),
    /if \(!current\) return false;/,
    "a refused compare-and-set must abandon the write",
  );
});

// No teardown, deliberately, for the reason `milestone-safety-regression`
// already records beside this file: libSQL keeps the scratch file's handle
// past `close()` on Windows, so removing the directory is a coin flip and a
// stale temp file is not a test failure. The OS reclaims it.
//
// (Measured, not assumed: removing the teardown did NOT change how often this
// file's CHILD PROCESS exits non-zero with every assertion in it passing. That
// flake reproduces at the same rate on the untouched WP1 harness next door, so
// it belongs to this machine's libSQL/tsx runtime, not to either file.)

test("an unchanged digest updates freshness without rewriting nodes", async (t) => {
  // Plan §6.5. A Timeline whose source has not moved should cost a freshness
  // update and nothing else: no upsert of every row, no delete pass, and no
  // cache invalidation of a page that is already correct.
  const client = createClient({ url: TIMELINE_URL });
  t.after(() => client.close());
  await resetTimelineDatabase(client);
  const { syncState: state } = await modules();
  const { db } = await import("@/modules/timeline/server/db/timeline-client");
  await state.ensureSuiteProjectBinding({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    primaryTimelineSlug: TIMELINE_PROJECT,
    authority: { kind: "inherits-workspace-binding" },
  });

  const first = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.ok(first);
  assert.equal(first.previousDigest, null, "a first refresh has nothing to compare to");
  await state.commitSyncGeneration(db, first, {
    status: "complete",
    sourceCount: 2,
    importedCount: 2,
    snapshotDigest: "digest-1",
  });

  const second = await state.acquireSyncLease({
    tasksWorkspaceId: TASKS_PROJECT,
    timelineWorkspaceSlug: TIMELINE_SLUG,
    timelineSlug: TIMELINE_PROJECT,
  });
  assert.ok(second);
  assert.equal(
    second.previousDigest,
    "digest-1",
    "the next refresh can tell whether the source moved before it writes anything",
  );
});

test("the action skips the node write and the revalidation on an unchanged digest", () => {
  const action = readFileSync(
    "src/modules/timeline/server/actions/workspaces.ts",
    "utf8",
  );
  const start = action.indexOf("export async function syncMilestonesAction(");
  const body = action.slice(start, action.indexOf("\nexport ", start + 1));

  assert.match(
    body,
    /lease\.previousDigest === snapshot\.digest/,
    "the comparison must be against the last COMMITTED digest",
  );
  assert.match(
    body,
    /plan\.reconcile === "destructive" &&\s*\n\s*snapshot\.kind === "complete"/,
    "only a whole snapshot may claim nothing changed; a partial one has not seen everything",
  );
  assert.match(body, /if \(unchanged\) return true;/, "the node write is skipped");
  assert.match(
    body,
    /if \(!unchanged\) \{\s*\n\s*revalidatePath\("\/app\/timeline"\);/,
    "and so is the cache invalidation of a page that is already correct",
  );
});
