import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { freshFileDb } from "@/server/db/memory-test-db";
import type { TaskRead } from "./types";

// Contract regressions for the ACTIVE source, not lib/briefing/tasks-db-source.
// Real current Tasks migrations and persisted rows; no provider replacement.
// These tests intentionally expose baseline failures before the candidate.
const NOW = Date.parse("2026-09-27T12:00:00Z"), DAY = 86_400_000;
let fixture: Awaited<ReturnType<typeof freshFileDb>>;
let source: typeof import("./source");
let clientModule: typeof import("../../server/tasks-db/signal-tasks-db-client");
let sequence = 0;
const envNames = ["TASKS_DATABASE_URL", "TASKS_AUTH_TOKEN"];
const saved = Object.fromEntries(envNames.map(key => [key, process.env[key]]));

before(async () => {
  for (const key of envNames) delete process.env[key];
  mock.timers.enable({ apis: ["Date"], now: NOW });
  fixture = await freshFileDb();
  const file = (await fixture.client.execute("PRAGMA database_list")).rows.find(row => row.name === "main")?.file;
  assert.equal(typeof file, "string");
  const child = relative(resolve(tmpdir()), resolve(String(file)));
  assert.ok(child && !isAbsolute(child) && child !== ".." && !child.startsWith(`..${sep}`), "fixture must be inside process scratch");
  process.env.TASKS_DATABASE_URL = pathToFileURL(String(file)).href;
  source = await import("./source");
  clientModule = await import("../../server/tasks-db/signal-tasks-db-client");
});
after(() => {
  clientModule?.getTasksClient()?.close();
  fixture?.cleanup();
  mock.timers.reset();
  for (const key of envNames) {
    if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
});

async function workspace(id: string, config?: string) {
  await fixture.client.execute({ sql: "INSERT INTO workspaces(id,slug,name) VALUES (?,?,?)", args: [id, id, id] });
  if (config !== undefined) await fixture.client.execute({ sql: "INSERT INTO meta(key,value,updated_at) VALUES (?,?,?)", args: [`board:${id}:columns`, config, NOW / 1000] });
}
async function task(workspaceId: string, id: string, options: {
  lane?: string; column?: string; completed?: number | null; updated?: number;
  blocked?: string[]; archived?: number; parent?: string;
} = {}) {
  await fixture.client.execute({
    sql: "INSERT INTO tasks(id,workspace_id,seq,title,lane,board_column_key,priority,assignees,tags,blocked_by,created_at,updated_at,completed_at,archived_at,parent_task_id) VALUES (?,?,?,?,?,?,'p2','[]','[]',?,?,?,?,?,?)",
    args: [id, workspaceId, ++sequence, id, options.lane ?? "done", options.column ?? null, JSON.stringify(options.blocked ?? []), (NOW - 40 * DAY) / 1000, (options.updated ?? NOW - 3_600_000) / 1000, options.completed == null ? null : options.completed / 1000, options.archived == null ? null : options.archived / 1000, options.parent ?? null],
  });
}
async function event(workspaceId: string, taskId: string, id: string, at: number, kind: string, payload: Record<string, unknown>) {
  await fixture.client.execute({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,?,?,'synthetic-actor',?,?,?)", args: [id, workspaceId, taskId, kind, JSON.stringify(payload), at / 1000] });
}
async function readTask(workspaceId: string, id: string): Promise<TaskRead> {
  const item = (await source.tasksDbSource.read(workspaceId)).tasks.find(row => row.id === id);
  assert.ok(item, `persisted task ${id} must be returned`);
  return item;
}
function completion(item: TaskRead, expected: number | null) {
  assert.ok(Object.hasOwn(item, "completedAt"), "active source must carry explicit nullable canonical completion evidence");
  assert.equal(Reflect.get(item, "completedAt"), expected === null ? null : new Date(expected).toISOString());
}
const acceptedConfig = JSON.stringify({ custom: [{ key: "accepted", name: "Accepted" }], doneKeys: ["accepted"] });

test("configured custom terminal resolves through effective column", async () => {
  await workspace("configured", acceptedConfig); await task("configured", "accepted-task", { lane: "doing", column: "accepted", completed: NOW - DAY });
  assert.equal((await readTask("configured", "accepted-task")).status, "shipped");
});
test("raw done excluded by configured doneKeys remains open", async () => {
  await task("configured", "raw-done", { completed: NOW - DAY });
  assert.notEqual((await readTask("configured", "raw-done")).status, "shipped");
});
test("review stays review while dependency identifiers remain available", async () => {
  await workspace("review"); await task("review", "review-task", { lane: "review", blocked: ["dependency"] });
  const row = await readTask("review", "review-task");
  assert.deepEqual({ status: row.status, blockedBy: row.blockedBy }, { status: "review", blockedBy: ["dependency"] });
});
test("effective custom column overrides a raw review lane", async () => {
  await task("review", "custom-open", { lane: "review", column: "custom-open" });
  assert.notEqual((await readTask("review", "custom-open")).status as string, "review");
});
test("durable old completion survives a recent metadata edit", async () => {
  await workspace("completion"); await task("completion", "old-completion", { completed: NOW - 30 * DAY });
  completion(await readTask("completion", "old-completion"), NOW - 30 * DAY);
});
test("reopened task ignores a retained completion stamp", async () => {
  await task("completion", "reopened", { lane: "doing", completed: NOW - DAY });
  const row = await readTask("completion", "reopened"); assert.notEqual(row.status, "shipped"); completion(row, null);
});
test("terminal with only a metadata timestamp has unknown completion", async () => {
  await task("completion", "unknown-completion"); completion(await readTask("completion", "unknown-completion"), null);
});
test("future durable completion never establishes a recent completion", async () => {
  await task("completion", "future-completion", { completed: NOW + DAY }); completion(await readTask("completion", "future-completion"), null);
});
test("invalid durable timestamp remains unknown", async () => {
  await task("completion", "invalid-completion");
  await fixture.client.execute({ sql: "UPDATE tasks SET completed_at='invalid' WHERE id=?", args: ["invalid-completion"] });
  completion(await readTask("completion", "invalid-completion"), null);
});
test("actual same-workspace terminal transition supplies missing completion", async () => {
  await workspace("history"); await task("history", "real-transition");
  await event("history", "real-transition", "completion-event", NOW - 2 * DAY, "move", { from: "doing", to: "done" });
  completion(await readTask("history", "real-transition"), NOW - 2 * DAY);
});
test("same task ID in foreign workspace cannot supply completion", async () => {
  await task("history", "foreign-history");
  await event("foreign-workspace", "foreign-history", "foreign-event", NOW - DAY, "toggleComplete", { to: "done" });
  completion(await readTask("history", "foreign-history"), null);
});
test("latest reopen invalidates an older completion event", async () => {
  await task("history", "reopened-history");
  await event("history", "reopened-history", "old-event", NOW - 3 * DAY, "toggleComplete", { to: "done" });
  await event("history", "reopened-history", "reopen-event", NOW - DAY, "toggleComplete", { to: "open" });
  completion(await readTask("history", "reopened-history"), null);
});
test("custom-column history is not interpreted using today's terminal configuration", async () => {
  await task("configured", "custom-history", { lane: "doing", column: "accepted" });
  await event("configured", "custom-history", "ambiguous-custom-event", NOW - DAY, "move", { from: "doing", to: "accepted" });
  completion(await readTask("configured", "custom-history"), null);
});
test("current custom terminal cannot inherit an earlier canonical completion event", async () => {
  await task("configured", "older-canonical-history", { lane: "doing", column: "accepted" });
  await event("configured", "older-canonical-history", "older-canonical-done", NOW - 4 * DAY, "move", { from: "doing", to: "done" });
  completion(await readTask("configured", "older-canonical-history"), null);
});
test("unrelated history cannot evict the target's actual completion", async () => {
  await task("history", "bounded-target");
  await event("history", "bounded-target", "target-completion", NOW - DAY, "toggleComplete", { to: "done" });
  const statements = Array.from({ length: 5_001 }, (_, index) => ({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,'history','unrelated','synthetic-actor','update','{}',?)", args: [`irrelevant-${index.toString().padStart(5, "0")}`, (NOW - 2 * DAY) / 1000] }));
  await fixture.client.batch(statements, "write");
  completion(await readTask("history", "bounded-target"), NOW - DAY);
});
test("canonical archived and child records are excluded", async () => {
  await workspace("visibility"); await task("visibility", "parent", { lane: "doing" });
  await task("visibility", "archived", { lane: "doing", archived: NOW - DAY });
  await task("visibility", "child", { lane: "doing", parent: "parent" });
  assert.deepEqual((await source.tasksDbSource.read("visibility")).tasks.map(row => row.id), ["parent"]);
});
test("absent configuration legitimately uses the canonical default done", async () => {
  await workspace("default"); await task("default", "default-done"); assert.equal((await readTask("default", "default-done")).status, "shipped");
});
test("malformed stored configuration cannot silently mean default done", async () => {
  await workspace("malformed", "{broken"); await task("malformed", "malformed-done");
  await assert.rejects(source.tasksDbSource.read("malformed"));
});
test("unreadable configuration cannot silently mean default done", async () => {
  await fixture.client.execute("ALTER TABLE meta RENAME TO unavailable_meta");
  try { await assert.rejects(source.tasksDbSource.read("default")); }
  finally { await fixture.client.execute("ALTER TABLE unavailable_meta RENAME TO meta"); }
});
test("active source read is persisted-state read only", async () => {
  const hashRows = async () => JSON.stringify((await fixture.client.execute("SELECT * FROM tasks ORDER BY id")).rows);
  const previous = await hashRows(); await source.tasksDbSource.read("completion"); assert.equal(await hashRows(), previous);
});
test("equal-time done/reopen conflict remains unknown with done ID ordered first", async () => {
  await task("history", "tied-history");
  await event("history", "tied-history", "a-tied-done", NOW - DAY, "toggleComplete", { to: "done" });
  await event("history", "tied-history", "z-tied-reopen", NOW - DAY, "toggleComplete", { to: "open" });
  completion(await readTask("history", "tied-history"), null);
  completion(await readTask("history", "tied-history"), null);
});
test("equal-time done/reopen conflict remains unknown with done ID ordered last", async () => {
  await task("history", "adverse-tied-history");
  await event("history", "adverse-tied-history", "a-adverse-reopen", NOW - DAY, "toggleComplete", { to: "open" });
  await event("history", "adverse-tied-history", "z-adverse-done", NOW - DAY, "toggleComplete", { to: "done" });
  completion(await readTask("history", "adverse-tied-history"), null);
});
test("ambiguous same-lane move cannot walk backward to an old completion", async () => {
  await task("history", "same-lane-ambiguity");
  await event("history", "same-lane-ambiguity", "older-unambiguous-done", NOW - 3 * DAY, "move", { from: "doing", to: "done" });
  await event("history", "same-lane-ambiguity", "newest-same-lane", NOW - DAY, "move", { from: "done", to: "done" });
  completion(await readTask("history", "same-lane-ambiguity"), null);
});
test("equal-time ambiguous event keeps an otherwise completed group unknown", async () => {
  await task("history", "tied-ambiguity");
  await event("history", "tied-ambiguity", "a-tied-ambiguous", NOW - DAY, "move", { from: "done", to: "done" });
  await event("history", "tied-ambiguity", "z-tied-unambiguous", NOW - DAY, "toggleComplete", { to: "done" });
  completion(await readTask("history", "tied-ambiguity"), null);
});
test("present future completion never falls back to an older valid event", async () => {
  await task("history", "future-stamp-old-event", { completed: NOW + DAY });
  await event("history", "future-stamp-old-event", "older-future-stamp-event", NOW - DAY, "toggleComplete", { to: "done" });
  completion(await readTask("history", "future-stamp-old-event"), null);
});
test("present invalid completion never falls back to an older valid event", async () => {
  await task("history", "invalid-stamp-old-event");
  await fixture.client.execute({ sql: "UPDATE tasks SET completed_at='invalid' WHERE id=?", args: ["invalid-stamp-old-event"] });
  await event("history", "invalid-stamp-old-event", "older-invalid-stamp-event", NOW - DAY, "toggleComplete", { to: "done" });
  completion(await readTask("history", "invalid-stamp-old-event"), null);
});
test("more than128 agreeing events at the latest timestamp remain unknown", async () => {
  await task("history", "tied-overflow-target");
  await fixture.client.batch(Array.from({ length: 129 }, (_, index) => ({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,'history','tied-overflow-target','synthetic-actor','toggleComplete',?,?)", args: [`overflow-${index.toString().padStart(3, "0")}`, JSON.stringify({ to: "done" }), (NOW - DAY) / 1000] })), "write");
  completion(await readTask("history", "tied-overflow-target"), null);
});
test("future terminal event cannot establish completion", async () => {
  await task("history", "future-event-task");
  await event("history", "future-event-task", "future-terminal", NOW + DAY, "toggleComplete", { to: "done" });
  completion(await readTask("history", "future-event-task"), null);
});
test("exhausted targeted history bound remains unknown", async () => {
  await task("history", "exhausted-target");
  await event("history", "exhausted-target", "old-target-done", NOW - 3 * DAY, "toggleComplete", { to: "done" });
  await fixture.client.batch(Array.from({ length: 129 }, (_, index) => ({ sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,'history','exhausted-target','synthetic-actor','move',?,?)", args: [`noop-${index.toString().padStart(3, "0")}`, JSON.stringify({ from: "done", to: "done" }), (NOW - DAY) / 1000] })), "write");
  completion(await readTask("history", "exhausted-target"), null);
});
test("more than fifty workspaces retain exact unique order including empty workspaces", async () => {
  const ids = Array.from({ length: 51 }, (_, index) => `batch-${index.toString().padStart(2, "0")}`);
  for (const id of ids) await workspace(id);
  await task(ids[50], "last-workspace-task", { lane: "doing" });
  const reads = await source.tasksDbSource.readMany!([...ids, ids[0]]);
  assert.deepEqual(reads.map(read => read.workspaceId), ids);
  assert.equal(reads[0].tasks.length, 0); assert.equal(reads[50].tasks[0].id, "last-workspace-task");
});
test("a second batch database failure rejects the whole source read", async () => {
  const raw = clientModule.getTasksClient(); assert.ok(raw);
  const original = raw.execute; let taskQueries = 0;
  raw.execute = async (...args: Parameters<typeof raw.execute>) => {
    const input: unknown = args[0];
    const sql = typeof input === "string" ? input : (input as { sql: string }).sql;
    if (/^select\b/i.test(sql) && /from "tasks"/.test(sql) && ++taskQueries === 2) throw new Error("synthetic second batch unavailable");
    return original.apply(raw, args);
  };
  try {
    await assert.rejects(source.tasksDbSource.readMany!(Array.from({ length: 51 }, (_, index) => `batch-${index.toString().padStart(2, "0")}`)), (error: unknown) => {
      assert.ok(error instanceof Error);
      const cause = Reflect.get(error, "cause");
      assert.ok(cause instanceof Error); assert.equal(cause.message, "synthetic second batch unavailable"); return true;
    });
    assert.equal(taskQueries, 2, "fault must occur at the real second batch query");
  } finally { raw.execute = original; }
});
test("config and targeted completion reads grow by bounded batches rather than per task", async () => {
  const ids = ["query-growth-a", "query-growth-b", "query-growth-c"];
  for (const id of ids) await workspace(id);
  await fixture.client.batch(Array.from({ length: 501 }, (_, index) => ({
    sql: "INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees,tags,blocked_by,created_at,updated_at) VALUES (?,?,?,'Synthetic query growth','done','p2','[]','[]','[]',?,?)",
    args: [`query-growth-${index.toString().padStart(3, "0")}`, ids[index % ids.length], ++sequence, (NOW - 40 * DAY) / 1000, NOW / 1000],
  })), "write");
  const raw = clientModule.getTasksClient(); assert.ok(raw);
  const original = raw.execute; const queries: string[] = [];
  raw.execute = async (...args: Parameters<typeof raw.execute>) => {
    const input: unknown = args[0]; queries.push(typeof input === "string" ? input : (input as { sql: string }).sql);
    return original.apply(raw, args);
  };
  try {
    const reads = await source.tasksDbSource.readMany!(ids);
    assert.equal(reads.flatMap(read => read.tasks).length, 501);
    assert.ok(reads.flatMap(read => read.tasks).every(row => row.completedAt === null));
    assert.equal(queries.length, 4, "one Tasks query, one config query and two <=500-target evidence queries");
    assert.equal(queries.filter(query => /WITH ranked/.test(query)).length, 2);
  } finally { raw.execute = original; }
});
test("substantial per-task history reports local cost and returns only newest timestamp groups", async (context) => {
  const workspaceId = "substantial-history"; await workspace(workspaceId);
  await fixture.client.batch(Array.from({ length: 500 }, (_, index) => ({
    sql: "INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees,tags,blocked_by,created_at,updated_at) VALUES (?,?,?,'Synthetic substantial history','done','p2','[]','[]','[]',?,?)",
    args: [`substantial-${index.toString().padStart(3, "0")}`, workspaceId, ++sequence, (NOW - 40 * DAY) / 1000, NOW / 1000],
  })), "write");
  for (let taskOffset = 0; taskOffset < 500; taskOffset += 10) {
    await fixture.client.batch(Array.from({ length: 1_000 }, (_, index) => {
      const taskIndex = taskOffset + Math.floor(index / 100), transition = index % 100;
      return { sql: "INSERT INTO activities(id,workspace_id,task_id,user_id,kind,payload,created_at) VALUES (?,?,?,'synthetic-actor','toggleComplete',?,?)", args: [`substantial-event-${taskIndex}-${transition}`, workspaceId, `substantial-${taskIndex.toString().padStart(3, "0")}`, JSON.stringify({ to: transition % 2 === 0 ? "open" : "done" }), (NOW - (100 - transition) * 60_000) / 1000] };
    }), "write");
  }
  const raw = clientModule.getTasksClient(); assert.ok(raw);
  const original = raw.execute; let queries = 0, historyRows = 0, historyElapsedMs = 0;
  raw.execute = async (...args: Parameters<typeof raw.execute>) => {
    const input: unknown = args[0], query = typeof input === "string" ? input : (input as { sql: string }).sql;
    const started = performance.now(); const result = await original.apply(raw, args); queries++;
    if (/WITH ranked/.test(query)) { historyRows += result.rows.length; historyElapsedMs += performance.now() - started; }
    return result;
  };
  try {
    const started = performance.now(); const read = await source.tasksDbSource.read(workspaceId); const elapsedMs = performance.now() - started;
    assert.equal(read.tasks.length, 500); assert.ok(read.tasks.every(row => row.completedAt === new Date(NOW - 60_000).toISOString()));
    assert.equal(queries, 3); assert.equal(historyRows, 500);
    context.diagnostic(JSON.stringify({ evidence: "local-history-query-cost", tasks: 500, persistedTransitions: 50_000, queries, historyRows, historyElapsedMs, elapsedMs, limitation: "window ranks matching history; bounded returned evidence does not bound scan work or prove remote latency" }));
  } finally { raw.execute = original; }
});
