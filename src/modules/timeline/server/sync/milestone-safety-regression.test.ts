/**
 * WP1 · destructive-reconciliation shields, proved against two real databases.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * The P0 was that a FAILED read and an AUTHORIZED EMPTY read had the same
 * shape. `getMilestonesForClerkId` returned `SyncedMilestone[]` and converted
 * every error to `[]`; `writeRoadmapNodes`, given an empty incoming set,
 * deletes every synchronized node in the project. So an expired read token, a
 * Tasks outage, a subject with no Tasks user row, or simply a Project with
 * more than 200 milestones all deleted real planning work and reported a
 * successful sync while doing it.
 *
 * ── WHY IT USES REAL DATABASES ─────────────────────────────────────────────
 * `timeline-provisioning-contract.test.mjs:15-19` records that no two-database
 * (Tasks + Timeline) fixture existed in this repo, and DECISIONS.md D-009
 * carries that forward as a WP4 gate. A pure test of the reconcile rule would
 * not have caught this defect: the truncation half lives in SQL (`LIMIT 200`
 * with no total), and the deletion half lives in SQL too. Both are exercised
 * here against real libSQL files — a small one, but a real engine running the
 * real query text and the real delete — so what is asserted is what ships.
 *
 * The fixture is two temporary file-backed libSQL databases, one standing in
 * for Tasks and one for Timeline, torn down per test.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { planMilestoneReconciliation } from "@/modules/timeline/lib/milestone-reconciliation";
import {
  digestMilestones,
  makeMilestoneSyncSource,
  MILESTONE_PAGE_LIMIT,
  type MilestoneSnapshot,
} from "@/modules/timeline/server/sync/tasks-milestone-source";
import type { SyncedMilestone } from "@/modules/timeline/server/db/timeline-queries";

const CLERK_ID = "user_couple";
const TASKS_USER_ID = "u_1";
const PROJECT_A = "ws_project_a";
const TIMELINE_SLUG = "glenmara-house";
const TIMELINE_PROJECT = "plan";

/**
 * One Timeline database for the whole file, bound before the module that reads
 * it is loaded.
 *
 * `timeline-client.ts` builds its drizzle client from TIMELINE_DATABASE_URL at
 * module-evaluation time and `timeline-queries.ts` imports it by relative
 * specifier, so a per-test cache-busted import of the queries module would
 * still reach the client bound on the first import — writing to whatever
 * database that was. The env is therefore set here, before the first dynamic
 * import, and isolation comes from resetting the schema between tests instead.
 */
const SCRATCH_DIR = mkdtempSync(join(tmpdir(), "wp1-milestone-"));
const TIMELINE_URL = pathToFileURL(join(SCRATCH_DIR, "timeline.db")).href;
process.env.TIMELINE_DATABASE_URL = TIMELINE_URL;
delete process.env.TIMELINE_AUTH_TOKEN;

let timelineWriter:
  | typeof import("@/modules/timeline/server/db/timeline-queries")
  | null = null;

async function loadTimelineWriter() {
  timelineWriter ??= await import(
    "@/modules/timeline/server/db/timeline-queries"
  );
  return timelineWriter;
}

// ── Tasks-side fixture ───────────────────────────────────────────────────────

/** The subset of the Tasks schema the milestone read touches. */
async function seedTasksDatabase(
  client: Client,
  options: Readonly<{
    milestoneCount: number;
    linkSubject?: boolean;
    /**
     * Whether the actor has a `workspace_members` row for this Project.
     *
     * Defaulted to true, and that default is exactly why F1 survived the first
     * round of these tests: every case proved the authorized paths and none
     * proved the unauthorized one. Removing the row is the whole repro — the
     * Project was deleted, or the collaborator was removed.
     */
    linkMembership?: boolean;
  }>,
): Promise<void> {
  await client.executeMultiple(`
    CREATE TABLE users (id TEXT PRIMARY KEY, clerk_id TEXT);
    CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE workspace_members (workspace_id TEXT, user_id TEXT);
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      title TEXT,
      lane TEXT,
      due_at INTEGER,
      workspace_id TEXT,
      is_milestone INTEGER,
      parent_task_id TEXT
    );
  `);
  if (options.linkSubject !== false) {
    await client.execute({
      sql: "INSERT INTO users VALUES (?, ?)",
      args: [TASKS_USER_ID, CLERK_ID],
    });
  }
  await client.execute({
    sql: "INSERT INTO workspaces VALUES (?, ?)",
    args: [PROJECT_A, "Project A"],
  });
  if (options.linkMembership !== false) {
    await client.execute({
      sql: "INSERT INTO workspace_members VALUES (?, ?)",
      args: [PROJECT_A, TASKS_USER_ID],
    });
  }
  for (let i = 0; i < options.milestoneCount; i += 1) {
    await client.execute({
      sql: "INSERT INTO tasks VALUES (?, ?, 'todo', ?, ?, 1, NULL)",
      args: [
        `task_${String(i).padStart(4, "0")}`,
        `Milestone ${i}`,
        1_800_000_000_000 + i * 86_400_000,
        PROJECT_A,
      ],
    });
  }
}

type Harness = Readonly<{ tasksUrl: string; cleanup: () => void }>;

let harnessCounter = 0;

function makeHarness(): Harness {
  const path = join(SCRATCH_DIR, `tasks-${(harnessCounter += 1)}.db`);
  return {
    tasksUrl: pathToFileURL(path).href,
    // Best effort. The milestone source caches its libSQL client on purpose
    // (an expired token self-heals on the next run) and never exposes it, so
    // on Windows the file handle can outlive the test and the file refuses to
    // go. A stale temp file is not a test failure; deleting the assertion to
    // avoid one would be.
    cleanup: () => {
      try {
        rmSync(path, { force: true });
      } catch {
        /* left for the OS */
      }
    },
  };
}

/** A Timeline database with the real baseline schema and one empty project. */
async function seedTimelineDatabase(client: Client): Promise<void> {
  await client.executeMultiple(`
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS projects;
    DROP TABLE IF EXISTS workspaces;
    DROP TABLE IF EXISTS node_overlays;
  `);
  const baseline = readFileSync("drizzle-timeline/0000_timeline_baseline.sql", "utf8");
  const wanted = /^CREATE TABLE `(tasks|projects|workspaces|node_overlays)`/;
  await client.executeMultiple(
    baseline
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => wanted.test(statement))
      .join(";\n") + ";",
  );
  await client.execute({
    sql: "INSERT INTO workspaces (slug, name, owner_user_id) VALUES (?, ?, ?)",
    args: [TIMELINE_SLUG, "Glenmara House", CLERK_ID],
  });
  await client.execute({
    sql: `INSERT INTO projects (workspace_slug, slug, name, one_liner, accent)
          VALUES (?, ?, ?, '', 'default')`,
    args: [TIMELINE_SLUG, TIMELINE_PROJECT, "The plan"],
  });
}

/** The synchronized and manual nodes a couple already has on their Timeline. */
async function seedExistingNodes(client: Client): Promise<void> {
  const rows: Array<[string, string]> = [
    ["ms-ws_project_a-task_0000", "Venue walkthrough"],
    ["ms-ws_project_a-task_0001", "Menu finalised"],
    ["manual-hand-written", "Ring collection"],
  ];
  for (const [id, title] of rows) {
    await client.execute({
      sql: `INSERT INTO tasks (id, project_slug, workspace_slug, title, description, status, kind, assignee)
            VALUES (?, ?, ?, ?, '', 'next', 'milestone', 'claude-code')`,
      args: [id, TIMELINE_PROJECT, TIMELINE_SLUG, title],
    });
  }
}

async function nodeIds(client: Client): Promise<string[]> {
  const result = await client.execute({
    sql: "SELECT id FROM tasks WHERE workspace_slug = ? AND project_slug = ? ORDER BY id",
    args: [TIMELINE_SLUG, TIMELINE_PROJECT],
  });
  return result.rows.map((row) => String(row.id));
}

/** Run one snapshot through the real decision + the real writer. */
async function reconcileWith(snapshot: MilestoneSnapshot): Promise<void> {
  const plan = planMilestoneReconciliation(snapshot);
  if (plan.kind === "skip") return;
  const { writeRoadmapNodes } = await loadTimelineWriter();
  await writeRoadmapNodes(
    TIMELINE_SLUG,
    TIMELINE_PROJECT,
    plan.items.map((item) => ({
      ...item,
      workspaceSlug: TIMELINE_SLUG,
      projectSlug: TIMELINE_PROJECT,
    })),
    { reconcile: plan.reconcile },
  );
}

/** The real source, reading the real query text against a real engine. Each
 *  call builds a fresh client from the env, so a per-test Tasks file is
 *  enough isolation here. */
async function readSnapshot(tasksUrl: string): Promise<MilestoneSnapshot> {
  process.env.TASKS_DATABASE_URL = tasksUrl;
  process.env.TASKS_AUTH_TOKEN = "test-token";
  const source = makeMilestoneSyncSource();
  assert.ok(source, "the source must be constructible with both env vars set");
  return source.getMilestonesForClerkId(CLERK_ID, PROJECT_A);
}

// ── The source tells the truth about what it saw ─────────────────────────────

test("a source failure is a failure, not an empty Project", async (t) => {
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  t.after(() => tasks.close());
  // A Tasks database with no schema at all: the outage case. Before WP1 this
  // returned [], which downstream means "delete every synchronized node".
  await tasks.execute("CREATE TABLE placeholder (id TEXT)");

  const snapshot = await readSnapshot(harness.tasksUrl);
  assert.equal(snapshot.kind, "error");
  assert.ok(!("items" in snapshot), "a failed read carries no items to write");
});

test("a subject with no Tasks user row is unavailable, not empty", async (t) => {
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  t.after(() => tasks.close());
  await seedTasksDatabase(tasks, { milestoneCount: 3, linkSubject: false });

  const snapshot = await readSnapshot(harness.tasksUrl);
  assert.equal(snapshot.kind, "unavailable");
});

test("a 201-row source reports partial and its true total", async (t) => {
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  t.after(() => tasks.close());
  // 250 rows: past the 200 cap by enough that the old code would have deleted
  // 50 real milestones on every sync.
  await seedTasksDatabase(tasks, { milestoneCount: 250 });

  const snapshot = await readSnapshot(harness.tasksUrl);
  assert.equal(snapshot.kind, "partial");
  assert.equal(
    snapshot.kind === "partial" ? snapshot.totalCount : -1,
    250,
    "the true total must survive the cap",
  );
  assert.equal(
    snapshot.kind === "partial" ? snapshot.items.length : -1,
    MILESTONE_PAGE_LIMIT + 1,
    "201 rows are fetched so the 200-row cap is observable",
  );
});

test("a whole source reports complete, with a digest", async (t) => {
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  t.after(() => tasks.close());
  await seedTasksDatabase(tasks, { milestoneCount: 3 });

  const snapshot = await readSnapshot(harness.tasksUrl);
  assert.equal(snapshot.kind, "complete");
  if (snapshot.kind !== "complete") return;
  assert.equal(snapshot.items.length, 3);
  assert.equal(snapshot.totalCount, 3);
  assert.match(snapshot.digest, /^[0-9a-f]{64}$/);
});

test("a caller with no Tasks membership is unauthorized, not an authorized zero", async (t) => {
  // F1. Row-level authorization used to live inside the milestone query's
  // `EXISTS (SELECT 1 FROM workspace_members …)` subquery. A caller with no
  // membership row therefore matched no rows and got ZERO ROWS rather than an
  // error — indistinguishable from a Project that genuinely has no milestones,
  // which is the one state permitted to delete everything.
  //
  // The Project was deleted, or the collaborator was removed. Either way, the
  // right answer is "you may not read this", never "this is empty".
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  t.after(() => tasks.close());
  await seedTasksDatabase(tasks, { milestoneCount: 12, linkMembership: false });

  const snapshot = await readSnapshot(harness.tasksUrl);
  assert.equal(snapshot.kind, "unauthorized");
  assert.equal(
    snapshot.kind === "unauthorized" ? snapshot.code : null,
    "membership_absent",
  );
});

test("an unauthorized read deletes nothing, even though it saw zero rows", async (t) => {
  // The second half of F1, end to end: the snapshot above must not reach the
  // destructive branch. Before the fix this deleted every synchronized node
  // and the UI reported a successful sync.
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  const timeline = createClient({ url: TIMELINE_URL });
  t.after(() => {
    tasks.close();
    timeline.close();
  });
  await seedTasksDatabase(tasks, { milestoneCount: 12, linkMembership: false });
  await seedTimelineDatabase(timeline);
  await seedExistingNodes(timeline);

  const snapshot = await readSnapshot(harness.tasksUrl);
  await reconcileWith(snapshot);

  assert.deepEqual(await nodeIds(timeline), [
    "manual-hand-written",
    "ms-ws_project_a-task_0000",
    "ms-ws_project_a-task_0001",
  ]);
});

test("an authorized zero is a complete zero", async (t) => {
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  t.after(() => tasks.close());
  await seedTasksDatabase(tasks, { milestoneCount: 0 });

  const snapshot = await readSnapshot(harness.tasksUrl);
  assert.equal(snapshot.kind, "complete");
  assert.equal(snapshot.kind === "complete" ? snapshot.totalCount : -1, 0);
});

// ── What each snapshot is allowed to do to the Timeline ──────────────────────

test("a source failure never deletes synchronized milestones", async (t) => {
  const harness = makeHarness();
  t.after(harness.cleanup);
  const timeline = createClient({ url: TIMELINE_URL });
  t.after(() => timeline.close());
  await seedTimelineDatabase(timeline);
  await seedExistingNodes(timeline);

  for (const snapshot of [
    { kind: "error", code: "milestone_query_failed" },
    { kind: "unauthorized", code: "milestone_query_unauthorized" },
    { kind: "unavailable", code: "subject_not_linked" },
  ] as const) {
    await reconcileWith(snapshot);
    assert.deepEqual(
      await nodeIds(timeline),
      [
        "manual-hand-written",
        "ms-ws_project_a-task_0000",
        "ms-ws_project_a-task_0001",
      ],
      `a ${snapshot.kind} read must leave the last snapshot standing`,
    );
  }
});

test("a truncated source never deletes the milestones past the cap", async (t) => {
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  const timeline = createClient({ url: TIMELINE_URL });
  t.after(() => {
    tasks.close();
    timeline.close();
  });
  await seedTasksDatabase(tasks, { milestoneCount: 250 });
  await seedTimelineDatabase(timeline);
  // A synchronized node sourced from a milestone the capped read cannot see.
  await timeline.execute({
    sql: `INSERT INTO tasks (id, project_slug, workspace_slug, title, description, status, kind, assignee)
          VALUES (?, ?, ?, 'Milestone 240', '', 'next', 'milestone', 'claude-code')`,
    args: ["ms-ws_project_a-task_0240", TIMELINE_PROJECT, TIMELINE_SLUG],
  });

  const snapshot = await readSnapshot(harness.tasksUrl);
  assert.equal(snapshot.kind, "partial");
  await reconcileWith(snapshot);

  const ids = await nodeIds(timeline);
  assert.ok(
    ids.includes("ms-ws_project_a-task_0240"),
    "row 240 is beyond the 200-row cap; being unseen is not being deleted",
  );
  assert.equal(ids.length, 202, "the 201 fetched rows are upserted beside it");
});

test("a legitimate complete zero DOES remove every synchronized row", async (t) => {
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  const timeline = createClient({ url: TIMELINE_URL });
  t.after(() => {
    tasks.close();
    timeline.close();
  });
  await seedTasksDatabase(tasks, { milestoneCount: 0 });
  await seedTimelineDatabase(timeline);
  await seedExistingNodes(timeline);

  const snapshot = await readSnapshot(harness.tasksUrl);
  assert.equal(snapshot.kind, "complete");
  await reconcileWith(snapshot);

  // G2 un-promote is still immediate and total. The shield narrows WHEN it may
  // run, not what it does: an owner who un-promotes every milestone still sees
  // them go, on the very next sync.
  assert.deepEqual(
    await nodeIds(timeline),
    ["manual-hand-written"],
    "synchronized rows go; the manual node is never Tasks reconciliation's to delete",
  );
});

test("a complete partial-overlap snapshot removes only what is genuinely gone", async (t) => {
  const harness = makeHarness();
  t.after(harness.cleanup);
  const tasks = createClient({ url: harness.tasksUrl });
  const timeline = createClient({ url: TIMELINE_URL });
  t.after(() => {
    tasks.close();
    timeline.close();
  });
  // Only task_0000 remains a milestone in Tasks; task_0001 was un-promoted.
  await seedTasksDatabase(tasks, { milestoneCount: 1 });
  await seedTimelineDatabase(timeline);
  await seedExistingNodes(timeline);

  const snapshot = await readSnapshot(harness.tasksUrl);
  await reconcileWith(snapshot);

  assert.deepEqual(await nodeIds(timeline), [
    "manual-hand-written",
    "ms-ws_project_a-task_0000",
  ]);
});

// ── The rule itself ──────────────────────────────────────────────────────────

test("only a whole complete snapshot may be destructive", () => {
  const wholeZero = planMilestoneReconciliation({
    kind: "complete",
    items: [],
    totalCount: 0,
    digest: "d",
  });
  assert.equal(
    wholeZero.kind === "apply" ? wholeZero.reconcile : null,
    "destructive",
    "an authorized, successful zero is the one state allowed to empty a Timeline",
  );

  // A source that calls itself complete and contradicts its own count is not
  // trusted with a delete.
  const mismatched = planMilestoneReconciliation({
    kind: "complete",
    items: [],
    totalCount: 7,
    digest: "d",
  });
  assert.equal(mismatched.kind === "apply" ? mismatched.reconcile : null, "preserve");

  for (const kind of ["unauthorized", "unavailable", "error"] as const) {
    assert.equal(
      planMilestoneReconciliation({ kind, code: "x" }).kind,
      "skip",
      `${kind} must write nothing at all`,
    );
  }
});

test("the digest separates fields injectively", () => {
  // F11. The encoding escaped the `|` delimiter but not the `\` that does the
  // escaping, so the literal titles `a\|b` and `a|b` hashed identically — one
  // could be edited into the other and the digest would report no change.
  const row = (title: string): SyncedMilestone => ({
    id: "ms-1",
    projectSlug: "plan",
    workspaceSlug: "ws",
    title,
    status: "next",
    targetDate: null,
    sortOrder: 0,
  });
  assert.notEqual(
    digestMilestones([row("a\\|b")]),
    digestMilestones([row("a|b")]),
    "an escaped delimiter and a real one must not collide",
  );
  // And the field boundary itself still holds.
  assert.notEqual(
    digestMilestones([row("a|b")]),
    digestMilestones([{ ...row("a"), status: "next", targetDate: "b" }]),
  );
  // Same input, same digest — it is a change detector, not a nonce.
  assert.equal(digestMilestones([row("x")]), digestMilestones([row("x")]));
});

// ── The wiring, which is where this class of defect actually lives ───────────

test("no failure path in the milestone source degrades to an empty array", () => {
  const source = readFileSync(
    "src/modules/timeline/server/sync/tasks-milestone-source.ts",
    "utf8",
  );
  assert.ok(
    !/catch\s*\([^)]*\)\s*\{[\s\S]{0,400}?return \[\];/.test(source),
    "a catch block that returns [] is indistinguishable from an authorized " +
      "empty Project, and downstream an empty array means delete everything.",
  );
  assert.ok(
    !/LIMIT 200\b/.test(source),
    "the read must fetch past the cap so truncation is observable",
  );
  assert.match(
    source,
    /COUNT\(\*\) OVER \(\) AS total_count/,
    "the true row count must come from the same snapshot as the rows",
  );

  // F1. Authorization must be its own statement, ordered before the row read.
  // Inside the row query's `EXISTS` it is a FILTER, and a filter cannot
  // distinguish "you may not read this" from "there is nothing here" — it
  // returns zero rows for both, and zero rows is the one state allowed to
  // delete everything.
  const membershipProof = source.indexOf('code: "membership_absent"');
  const rowRead = source.indexOf("COUNT(*) OVER () AS total_count");
  assert.ok(
    membershipProof !== -1,
    "the milestone source must prove Tasks membership in its own statement " +
      "and answer `unauthorized` when it is absent",
  );
  assert.ok(
    membershipProof < rowRead,
    "membership must be proved BEFORE the rows are read, not filtered during",
  );
});

test("the sync action proves Tasks membership before it can delete anything", () => {
  // The second half of F1. Everything the action checked before WP1 —
  // `getWorkspace` plus `ownerUserId !== userId` — authorizes the LOCAL
  // Timeline row and says nothing about whether the actor may still read the
  // Tasks Project. A couple whose Project was deleted still owned their
  // Timeline, still reached the sync, and had it emptied.
  const action = readFileSync(
    "src/modules/timeline/server/actions/workspaces.ts",
    "utf8",
  );
  const start = action.indexOf("export async function syncMilestonesAction(");
  const body = action.slice(start, action.indexOf("\nexport ", start + 1));

  const membership = body.indexOf("getCurrentTasksWorkspaceContext(");
  const read = body.indexOf("getMilestonesForClerkId(");
  assert.ok(membership !== -1, "the sync action must check Tasks membership");
  assert.ok(
    membership < read,
    "Tasks membership must be proved before the source is read",
  );
  assert.match(
    body,
    /if \(!tasksContext\) \{/,
    "a missing membership must refuse the sync outright",
  );
  assert.match(
    body,
    /tasksContext\.archivedAt !== null/,
    "an archived Project is read-only, and reconciliation is a write",
  );
});

test("one Tasks Project binds to at most one child Timeline", () => {
  // F8. ADR 0001 §6: one Project, one primary Timeline. `ensureBoundProject`
  // used to look only at `projects[0]` — if that child was unbound it was
  // bound, without checking whether a SIBLING already named the same Project.
  // On a multi-child legacy Timeline that produced two children synchronizing
  // from one Project, each deleting the other's rows on every reconcile.
  const source = readFileSync(
    "src/modules/timeline/server/provision-workspace.ts",
    "utf8",
  );
  const start = source.indexOf("async function ensureBoundProject(");
  const body = source.slice(start);
  const alreadyBound = body.indexOf("const alreadyBound = projects.some(");
  const bindCall = body.indexOf("await bindProjectToTasksWorkspace(");
  assert.ok(
    alreadyBound !== -1 && alreadyBound < bindCall,
    "an existing binding to the same Tasks Project must be detected before " +
      "a second child is bound to it",
  );
  assert.ok(
    !/const target = projects\[0\]!;/.test(body),
    "binding `projects[0]` without looking at its siblings must not return",
  );
});

test("the destructive pass is opt-in and the action only opts in on a plan", () => {
  const queries = readFileSync(
    "src/modules/timeline/server/db/timeline-queries.ts",
    "utf8",
  );
  assert.match(
    queries,
    /const reconcile = options\.reconcile \?\? "preserve";/,
    "the safe mode must be the default a forgetful caller gets",
  );
  assert.match(
    queries,
    /if \(reconcile !== "destructive"\) return;/,
    "the delete pass must be skipped unless it was explicitly asked for",
  );

  const action = readFileSync(
    "src/modules/timeline/server/actions/workspaces.ts",
    "utf8",
  );
  assert.match(
    action,
    /planMilestoneReconciliation\(snapshot\)/,
    "the sync action must route the snapshot through the reconciliation rule",
  );
  assert.match(
    action,
    /writeRoadmapNodes\([\s\S]{0,220}?reconcile: plan\.reconcile,/,
    "the writer must be told what the snapshot proved, never a literal",
  );
  assert.ok(
    !/writeRoadmapNodes\([^)]*rawMilestones/.test(action),
    "the untagged array path must not return",
  );
});
