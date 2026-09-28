/**
 * The first analytics test that runs a real provider against a real database.
 *
 * ── WHY THIS EXISTS (DECISIONS.md D-012, ANALYTICS_TRUTH R2/R3/R10) ─────────
 * Before this file, all 47 analytics test cases ran over `fixtures.ts` or over
 * source text. Not one imported a provider, the service, the policy or the
 * snapshot layer. So the suite was green while `blocked_work.explicitCount`
 * was structurally always 0, while analytics read "done" with a different
 * predicate from the board, and while the task read had no ORDER BY. A fixture
 * cannot catch any of those, because a fixture is written from the same
 * assumptions as the code.
 *
 * These tests write rows in the shapes production actually holds — post-0024
 * `board_column_key` claims, a stored per-workspace column config that renames
 * Done — and assert what the provider reads back.
 *
 * File-backed rather than `:memory:`, matching the precedent in
 * `timeline/server/couple-artifact-boundary.test.ts`: the libSQL sqlite3 client
 * hands a fresh empty `:memory:` database to each connection.
 */

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import {
  asProjectId,
  PROGRAM_AXIS_NOT_CARRIED,
  type AnalyticsQuery,
} from "../../../lib/analytics/contracts";
import { calculateMetrics } from "../../../lib/analytics/metrics";
import { buildBriefing } from "../../../lib/analytics/rules";
import { getAnalyticsFixture } from "../../../lib/analytics/fixtures";

const SCRATCH_DIR = mkdtempSync(join(tmpdir(), "wp4-tasks-provider-"));
const TASKS_URL = pathToFileURL(join(SCRATCH_DIR, "tasks.db")).href;
process.env.TASKS_DATABASE_URL = TASKS_URL;
delete process.env.TASKS_AUTH_TOKEN;

const WORKSPACE = asProjectId("ws_live");
const OTHER_WORKSPACE = asProjectId("ws_other");

let client: Client;
let provider: typeof import("./tasks") | null = null;

async function load() {
  provider ??= await import("./tasks");
  return provider;
}

function query(overrides: Partial<AnalyticsQuery> = {}): AnalyticsQuery {
  return {
    scope: { type: "workspace", id: WORKSPACE, workspaceId: WORKSPACE },
    period: {
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
      timezone: "Europe/Dublin",
      preset: "four_weeks",
    },
    program: PROGRAM_AXIS_NOT_CARRIED,
    ...overrides,
  };
}

/** The columns the analytics mirror names, in the shapes Tasks stores them. */
async function createSchema(): Promise<void> {
  await client.executeMultiple(`
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS activities;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS meta;
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      lane TEXT NOT NULL,
      board_column_key TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      assignees TEXT,
      tags TEXT,
      due TEXT,
      due_at INTEGER,
      blocked_by TEXT,
      idle_days INTEGER,
      source_note_id TEXT,
      is_milestone INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      archived_at INTEGER,
      parent_task_id TEXT
    );
    CREATE TABLE activities (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY NOT NULL,
      clerk_id TEXT,
      email TEXT,
      name TEXT,
      initials TEXT NOT NULL
    );
    CREATE TABLE meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

interface TaskSeed {
  id: string;
  workspaceId?: string;
  title?: string;
  lane: string;
  boardColumnKey?: string | null;
  tags?: string[];
  assignees?: string[];
  blockedBy?: string[];
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number | null;
  archivedAt?: number | null;
  parentTaskId?: string | null;
  dueAt?: number | null;
}

async function seedTask(seed: TaskSeed): Promise<void> {
  await client.execute({
    sql: `INSERT INTO tasks
            (id, workspace_id, title, lane, board_column_key, priority, assignees,
             tags, blocked_by, is_milestone, created_at, updated_at, completed_at, archived_at, parent_task_id, due_at)
          VALUES (?, ?, ?, ?, ?, 'normal', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    args: [
      seed.id,
      seed.workspaceId ?? WORKSPACE,
      seed.title ?? `Task ${seed.id}`,
      seed.lane,
      seed.boardColumnKey ?? null,
      JSON.stringify(seed.assignees ?? ["user_a"]),
      JSON.stringify(seed.tags ?? []),
      JSON.stringify(seed.blockedBy ?? []),
      seed.createdAt ?? 1_752_000_000,
      seed.updatedAt ?? 1_752_000_000,
      seed.completedAt ?? null,
      seed.archivedAt ?? null,
      seed.parentTaskId ?? null,
      seed.dueAt ?? null,
    ],
  });
}

before(async () => {
  client = createClient({ url: TASKS_URL });
  await createSchema();
});

async function persistedMetrics() {
  const { TasksAnalyticsProvider } = await load();
  const readQuery = query(), result = await new TasksAnalyticsProvider().read(readQuery);
  const fixture = getAnalyticsFixture("empty");
  const snapshot = { ...fixture.snapshot, scope: readQuery.scope, capturedAt: "2026-07-31T12:00:00Z", tasks: result.tasks, events: result.events, coverage: { ...fixture.snapshot.coverage, providers: { ...fixture.snapshot.coverage.providers, tasks: result.coverage } } };
  return { result, metrics: calculateMetrics(snapshot, readQuery), briefing: buildBriefing(snapshot, readQuery) };
}
test("persisted archive state is carried explicitly by the actual provider", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({ id: "archive-marked", lane: "doing", archivedAt: 1_752_100_000 });
  await seedTask({ id: "archive-active", lane: "doing" });
  const { result } = await persistedMetrics();
  assert.equal(Reflect.get(result.tasks.find(task => task.id === "archive-marked")!, "archived"), true);
  assert.equal(Reflect.get(result.tasks.find(task => task.id === "archive-active")!, "archived"), false);
});
test("persisted archived open work contributes no current metrics or observations", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({ id: "archive-current-concern", lane: "doing", boardColumnKey: "waiting", archivedAt: 1_752_100_000, dueAt: 1_752_000_000 });
  const { metrics, briefing } = await persistedMetrics();
  assert.equal(metrics.open_work.value?.count, 0);
  for (const key of ["open_overdue_work", "open_work_age", "stalled_work", "blocked_work", "unowned_work", "workload_distribution"] as const) assert.ok(metrics[key].sources.every(source => source.id !== "archive-current-concern"));
  assert.ok(briefing.observations.every(observation => observation.sources.every(source => source.id !== "archive-current-concern")));
});
test("persisted archived completion remains part of period history", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({ id: "archive-history", lane: "done", archivedAt: 1_752_100_000, completedAt: Date.parse("2026-07-15T12:00:00Z") / 1000 });
  const { result, metrics } = await persistedMetrics();
  assert.equal(result.tasks.length, 1); assert.equal(metrics.work_completed.value?.count, 1);
});
test("restoring a persisted archived open task re-enables current metrics", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({ id: "archive-restore", lane: "doing", archivedAt: 1_752_100_000 });
  assert.equal((await persistedMetrics()).metrics.open_work.value?.count, 0);
  await client.execute("UPDATE tasks SET archived_at=NULL WHERE id='archive-restore'");
  assert.equal((await persistedMetrics()).metrics.open_work.value?.count, 1);
});
test("persisted children are excluded before the provider's 2001-record bound", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await client.batch(Array.from({ length: 2_001 }, (_, index) => ({ sql: "INSERT INTO tasks(id,workspace_id,title,lane,priority,is_milestone,created_at,updated_at,parent_task_id) VALUES (?,?,'Synthetic child','doing','normal',0,1752000000,1752000000,'zz-top-level-parent')", args: [`aa-child-${index.toString().padStart(4, "0")}`, WORKSPACE] })), "write");
  await seedTask({ id: "zz-top-level-parent", lane: "doing" });
  const { result } = await persistedMetrics();
  assert.equal(result.tasks.length, 1);
  assert.deepEqual(result.tasks.map(task => task.id), ["zz-top-level-parent"]);
  assert.ok(!result.coverage.issues.includes("tasks_record_limit_reached"));
});
test("archived completed dependencies remain resolved while excluded children stay unknown", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  const completedAt = Date.parse("2026-07-15T12:00:00Z") / 1000;
  await seedTask({ id: "dependency-archived", lane: "done", archivedAt: 1_752_100_000, completedAt });
  await seedTask({ id: "dependency-child", lane: "done", parentTaskId: "dependency-main", completedAt });
  await seedTask({ id: "dependency-main", lane: "doing", blockedBy: ["dependency-archived", "dependency-child"] });
  const { result, metrics } = await persistedMetrics();
  const main = result.tasks.find(task => task.id === "dependency-main"); assert.ok(main);
  assert.deepEqual(main.blocking.unresolvedDependencyIds, ["dependency-child"]);
  assert.ok(!result.tasks.some(task => task.id === "dependency-child"));
  assert.equal(metrics.work_completed.value?.count, 1);
});

after(() => {
  client.close();
  try {
    rmSync(SCRATCH_DIR, { recursive: true, force: true });
  } catch {
    /* left for the OS: Windows holds the libSQL file handle past close() */
  }
});

test("canonical Project identity: workspaceId is the Project, tags are Labels", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM meta;");
  await seedTask({ id: "t_mine", lane: "doing", tags: ["Launch Plan", "venue"] });
  // Same tag, a different Project. The workspace predicate must exclude it.
  await seedTask({ id: "t_theirs", lane: "doing", tags: ["Launch Plan"], workspaceId: OTHER_WORKSPACE });

  const { TasksAnalyticsProvider, labelIdFromTag } = await load();
  const result = await new TasksAnalyticsProvider().read(query());

  assert.deepEqual(
    result.tasks.map((task) => task.id),
    ["t_mine"],
    "a shared tag must not pull a task out of another Project",
  );
  assert.equal(result.tasks[0]!.workspaceId, WORKSPACE);
  assert.deepEqual(
    result.tasks[0]!.labelIds,
    [labelIdFromTag("Launch Plan"), labelIdFromTag("venue")],
    "tags become Label ids, and remain Labels",
  );
});

test("R2 · a post-0024 Waiting claim reads as explicitly blocked", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM meta;");
  // Exactly what migration 0024 leaves behind: lane rewritten to the canonical
  // in-motion value, the Waiting column carried as a board_column_key claim.
  await seedTask({ id: "t_waiting", lane: "doing", boardColumnKey: "waiting" });
  // A legacy row that predates 0024 must read identically, as it does on the board.
  await seedTask({ id: "t_legacy_waiting", lane: "waiting" });
  await seedTask({ id: "t_moving", lane: "doing" });

  const { TasksAnalyticsProvider } = await load();
  const result = await new TasksAnalyticsProvider().read(query());
  const blocking = new Map(result.tasks.map((task) => [task.id, task.blocking.explicit]));

  assert.equal(blocking.get("t_waiting"), true, "post-0024 waiting claim is explicit blocking");
  assert.equal(blocking.get("t_legacy_waiting"), true, "pre-0024 waiting lane still reads the same");
  assert.equal(blocking.get("t_moving"), false, "ordinary in-motion work is not blocked");
});

test("R3 · Done is read from the workspace column config, like every other surface", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM meta;");
  // A workspace that renamed Done to a custom column and declared it done-meaning.
  await client.execute({
    sql: "INSERT INTO meta (key, value, updated_at) VALUES (?, ?, ?)",
    args: [
      `board:${WORKSPACE}:columns`,
      JSON.stringify({
        system: {},
        custom: [{ key: "shipped", name: "Shipped" }],
        order: ["todo", "doing", "review", "shipped", "done"],
        colors: {},
        descriptions: {},
        limits: {},
        doneKeys: ["shipped"],
      }),
      1_752_000_000,
    ],
  });
  await seedTask({ id: "t_shipped", lane: "doing", boardColumnKey: "shipped", completedAt: 1_752_100_000 });
  await seedTask({ id: "t_done_column", lane: "done", completedAt: 1_752_100_000 });

  const { TasksAnalyticsProvider } = await load();
  const result = await new TasksAnalyticsProvider().read(query());
  const terminal = new Map(result.tasks.map((task) => [task.id, task.terminal]));

  assert.equal(
    terminal.get("t_shipped"),
    true,
    "a workspace's declared done column must read as done in analytics too",
  );
  assert.equal(
    terminal.get("t_done_column"),
    false,
    "a config that does not declare `done` as done-meaning must not be overridden",
  );
});

test("R3 · with no stored config the default five-column board still resolves", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM meta;");
  await seedTask({ id: "t_done", lane: "done", completedAt: 1_752_100_000 });
  await seedTask({ id: "t_open", lane: "doing" });

  const { TasksAnalyticsProvider } = await load();
  const result = await new TasksAnalyticsProvider().read(query());
  const terminal = new Map(result.tasks.map((task) => [task.id, task.terminal]));

  assert.equal(terminal.get("t_done"), true);
  assert.equal(terminal.get("t_open"), false);
});

test("R10 · the bounded task read carries its own total order", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM meta;");
  // Inserted in the reverse of id order, with identical timestamps. Without an
  // ORDER BY the engine is free to answer in storage order — here, insertion
  // order — so the read is only stable by accident of how rows were written.
  // The bound is `LIMIT 2001`, so on a workspace past that bound "storage
  // order" also decides WHICH rows are dropped, and the truncation flag cannot
  // say which. An explicit total order is the only thing that makes both the
  // sequence and the truncated set reproducible.
  for (let index = 39; index >= 0; index -= 1) {
    await seedTask({
      id: `t_${String(index).padStart(3, "0")}`,
      lane: "doing",
      createdAt: 1_752_000_000,
      updatedAt: 1_752_000_000,
    });
  }

  const { TasksAnalyticsProvider } = await load();
  const first = await new TasksAnalyticsProvider().read(query());
  const second = await new TasksAnalyticsProvider().read(query());
  const ids = first.tasks.map((task) => task.id);

  assert.deepEqual(
    ids,
    second.tasks.map((task) => task.id),
    "repeated reads must return the same rows in the same order",
  );
  assert.deepEqual(
    ids,
    [...ids].sort(),
    "the read must impose its own total order, not inherit the storage engine's",
  );
});

test("the provider declares only capabilities it can actually serve", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM meta;");
  await seedTask({ id: "t_one", lane: "doing" });

  const { TasksAnalyticsProvider } = await load();
  const result = await new TasksAnalyticsProvider().read(query());

  assert.ok(result.coverage.capabilities.includes("task_read"));
  assert.ok(result.coverage.capabilities.includes("task_completion_timestamps"));
  assert.ok(result.coverage.capabilities.includes("task_status_history"));
  assert.ok(!result.coverage.capabilities.includes("task_meaningful_activity"));
  assert.equal(result.coverage.status, "partial");
  assert.ok(result.coverage.issues.includes("tasks_meaningful_activity_history_unverified"));
  assert.ok(
    !result.coverage.capabilities.includes("decision_read"),
    "the Tasks provider cannot read decisions and must not claim to",
  );
});

test("missing history cannot become creation-time inactivity while overdue and completion facts survive", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({id: "old-unknown-activity", lane: "doing", createdAt: Date.parse("2026-07-02T00:00:00Z") / 1000,
    dueAt: Date.parse("2026-07-10T00:00:00Z") / 1000});
  await seedTask({id: "known-completion", lane: "done", completedAt: Date.parse("2026-07-15T00:00:00Z") / 1000});
  const {result, metrics, briefing} = await persistedMetrics();
  assert.equal(result.tasks.find(task => task.id === "old-unknown-activity")?.lastMeaningfulActivityAt, null);
  assert.equal(metrics.stalled_work.status, "unsupported");
  assert.equal(metrics.stalled_work.value, null);
  assert.equal(metrics.open_overdue_work.value?.count, 1);
  assert.deepEqual(metrics.open_overdue_work.sources.map(source => [source.id, source.date]),
    [["old-unknown-activity", "2026-07-10T00:00:00.000Z"]]);
  assert.equal(metrics.work_completed.value?.count, 1);
  assert.ok(!briefing.observations.some(observation => observation.metric.key === "stalled_work"));
  const fixture = getAnalyticsFixture("empty");
  const readQuery = query();
  const contradicted = {...fixture.snapshot, scope: readQuery.scope, capturedAt: "2026-07-31T12:00:00Z",
    tasks: result.tasks, events: result.events,
    coverage: {...fixture.snapshot.coverage, providers: {...fixture.snapshot.coverage.providers,
      tasks: {...result.coverage, capabilities: [...result.coverage.capabilities, "task_meaningful_activity" as const]}}}};
  assert.equal(calculateMetrics(contradicted, readQuery).stalled_work.value, null,
    "a contradictory capability claim cannot turn a null task timestamp into a zero count");
});

test("validated positive activity is retained without certifying bounded or foreign history", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({id: "positive-task", lane: "doing"});
  const recent = Date.parse("2026-07-28T10:00:00Z") / 1000;
  await client.execute({sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,?,?,?,?,?,?)",
    args: ["owned-positive", WORKSPACE, "positive-task", "user_a", "commentAdd", "{}", recent]});
  await client.execute({sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,?,?,?,?,?,?)",
    args: ["foreign-positive", OTHER_WORKSPACE, "positive-task", "user_a", "commentAdd", "{}", recent + 100]});
  const {result, metrics} = await persistedMetrics();
  assert.equal(result.tasks[0]?.lastMeaningfulActivityAt, "2026-07-28T10:00:00.000Z");
  assert.deepEqual(result.events.map(event => event.id), ["owned-positive"]);
  assert.equal(result.coverage.status, "partial");
  assert.ok(!result.coverage.capabilities.includes("task_meaningful_activity"));
  assert.equal(metrics.stalled_work.value, null);
});

test("future activity within a queried period does not become positive evidence", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({id: "future-activity-task", lane: "doing"});
  await client.execute({sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,?,?,?,?,?,?)",
    args: ["future-positive", WORKSPACE, "future-activity-task", "user_a", "commentAdd", "{}",
      Date.parse("2099-07-20T10:00:00Z") / 1000]});
  const {TasksAnalyticsProvider} = await load();
  const result = await new TasksAnalyticsProvider().read(query({period: {...query().period,
    start: "2099-07-01T00:00:00Z", end: "2099-08-01T00:00:00Z"}}));
  assert.equal(result.tasks[0]?.lastMeaningfulActivityAt, null);
  assert.deepEqual(result.events, []);
  assert.ok(result.coverage.issues.includes("tasks_activity_timestamp_invalid_or_future"));
});

test("a truncated history retains observed positives but cannot certify inactivity", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({id: "truncated-activity-task", lane: "doing"});
  const start = Date.parse("2026-07-20T00:00:00Z") / 1000;
  await client.batch(Array.from({length: 5_001}, (_, index) => ({
    sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,?,?,?,?,?,?)",
    args: [`bounded-${index}`, WORKSPACE, "truncated-activity-task", "user_a", "commentAdd", "{}", start + index],
  })), "write");
  const {result, metrics} = await persistedMetrics();
  assert.equal(result.events.length, 5_000);
  assert.ok(result.tasks[0]?.lastMeaningfulActivityAt);
  assert.ok(result.coverage.issues.includes("tasks_activity_limit_reached"));
  assert.ok(!result.coverage.capabilities.includes("task_meaningful_activity"));
  assert.equal(metrics.stalled_work.status, "unsupported");
  assert.equal(metrics.stalled_work.value, null);
});

test("an activity query failure is not an empty successful history", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({id: "activity-query-failure", lane: "doing"});
  await client.execute("ALTER TABLE activities RENAME TO activities_unreadable");
  try {
    const {TasksAnalyticsProvider} = await load();
    await assert.rejects(new TasksAnalyticsProvider().read(query()));
  } finally {
    await client.execute("ALTER TABLE activities_unreadable RENAME TO activities");
  }
});

test("malformed persisted activity does not become evidence of recent progress", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({id: "malformed-activity-task", lane: "doing"});
  await client.execute({sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,?,?,?,?,?,?)",
    args: ["malformed-activity", WORKSPACE, "malformed-activity-task", "user_a", "update", "not-json",
      Date.parse("2026-07-28T10:00:00Z") / 1000]});
  const {TasksAnalyticsProvider} = await load();
  await assert.rejects(new TasksAnalyticsProvider().read(query()));
});

test("metric defense uses proved activity, never creation recency, when a provider claims full history", async () => {
  await client.executeMultiple("DELETE FROM tasks; DELETE FROM activities; DELETE FROM meta;");
  await seedTask({id: "metric-defence", lane: "doing", createdAt: Date.parse("2026-07-30T00:00:00Z") / 1000});
  const {result} = await persistedMetrics();
  const readQuery = query();
  const fixture = getAnalyticsFixture("empty");
  const task = result.tasks[0]!;
  const snapshot = {...fixture.snapshot, scope: readQuery.scope, capturedAt: "2026-07-31T12:00:00Z",
    tasks: [{...task, lastMeaningfulActivityAt: "2026-07-01T00:00:00Z"}], events: result.events,
    coverage: {...fixture.snapshot.coverage, providers: {...fixture.snapshot.coverage.providers,
      tasks: {...result.coverage, capabilities: [...result.coverage.capabilities, "task_meaningful_activity" as const]}}}};
  assert.equal(calculateMetrics(snapshot, readQuery).stalled_work.value?.count, 1,
    "recent creation must not suppress a stall backed by old complete activity history");
  const recent = {id: "proved-recent", workspaceId: WORKSPACE, labelIds: [], entityType: "task" as const,
    entityId: task.id, kind: "commented" as const, at: "2026-07-30T10:00:00Z", meaningful: true};
  assert.equal(calculateMetrics({...snapshot, events: [recent]}, readQuery).stalled_work.value?.count, 0,
    "a newer validated event can establish positive recency when the capability is genuinely present");
  for (const lastMeaningfulActivityAt of [null, "2099-01-01T00:00:00Z", "invalid"]) {
    const unknown = calculateMetrics({...snapshot, tasks: [{...task, lastMeaningfulActivityAt}]}, readQuery).stalled_work;
    assert.equal(unknown.status, "unsupported");
    assert.equal(unknown.value, null);
  }
});

/**
 * The privacy boundary the audit found already correct, now pinned.
 *
 * `providers/notes.ts` names its SELECT columns and deliberately does not name
 * `body`. Only `extract_body` — an owner-approved structured extract — crosses
 * into the analytics domain, and `NoteRecord.exposure` is typed
 * `"approved_extract"` to say so at contract level. Nothing enforced it, so a
 * future `SELECT *`, or one added column, would have quietly moved raw private
 * prose into a metrics pipeline. This is a source-text guard because the harm
 * is in what the query asks for, not in what a fixture happens to hold.
 */
test("private Note bodies never enter the analytics domain", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(
    "src/modules/signal/server/analytics/providers/notes.ts",
    "utf8",
  );

  // Strip comments first: the file's own docblock explains the rule and would
  // otherwise be scanned as if it were a query.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const selects = code.match(/SELECT[\s\S]*?FROM/gi) ?? [];
  assert.ok(selects.length > 0, "the Notes provider must issue a named-column SELECT");
  for (const clause of selects) {
    assert.ok(
      !/\*/.test(clause),
      "a wildcard SELECT would pull the private body column into analytics",
    );
    assert.ok(
      !/(^|[\s,(])body([\s,)]|$)/i.test(clause),
      "the raw `body` column must never be selected; only `extract_body` may cross",
    );
  }
  assert.ok(
    source.includes("extract_body"),
    "the approved extract is the only Note text this domain may read",
  );
  assert.ok(
    source.includes('exposure: "approved_extract"'),
    "every NoteRecord must declare itself an approved extract",
  );
});
