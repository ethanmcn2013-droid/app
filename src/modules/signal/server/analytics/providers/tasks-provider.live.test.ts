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
      completed_at INTEGER
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
}

async function seedTask(seed: TaskSeed): Promise<void> {
  await client.execute({
    sql: `INSERT INTO tasks
            (id, workspace_id, title, lane, board_column_key, priority, assignees,
             tags, blocked_by, is_milestone, created_at, updated_at, completed_at)
          VALUES (?, ?, ?, ?, ?, 'normal', ?, ?, ?, 0, ?, ?, ?)`,
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
    ],
  });
}

before(async () => {
  client = createClient({ url: TASKS_URL });
  await createSchema();
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
  assert.ok(
    !result.coverage.capabilities.includes("decision_read"),
    "the Tasks provider cannot read decisions and must not claim to",
  );
});
