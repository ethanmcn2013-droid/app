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
  await workspace("review"); await task("review", "dependency", { lane: "doing" }); await task("review", "review-task", { lane: "review", blocked: ["dependency"] });
  const row = await readTask("review", "review-task");
  assert.deepEqual({ status: row.status, blockedBy: row.blockedBy }, { status: "review", blockedBy: ["dependency"] });
});

test("completed dependencies clear without changing historical task timestamps", async () => {
  await workspace("dependency-clear");
  await task("dependency-clear", "clear-upstream", { completed: NOW - DAY });
  await task("dependency-clear", "clear-dependent", { lane: "doing", blocked: ["clear-upstream"] });
  const row = await readTask("dependency-clear", "clear-dependent");
  assert.equal(row.status, "in-flight"); assert.deepEqual(row.blockedBy, []);
  assert.equal(row.lastStatusChangeAt, new Date(NOW - 3_600_000).toISOString());
  assert.equal(row.lastActivityAt, row.lastStatusChangeAt);
  await fixture.client.execute("UPDATE tasks SET lane='doing' WHERE id='clear-upstream'");
  const reopened = await readTask("dependency-clear", "clear-dependent");
  assert.equal(reopened.status, "blocked"); assert.deepEqual(reopened.blockedBy, ["clear-upstream"]);
});

test("later validated comment creation advances only activity proxy", async () => {
  await workspace("comment-evidence"); await task("comment-evidence", "comment-target", { lane: "doing", updated: NOW - 10 * DAY });
  await event("comment-evidence", "comment-target", "real-comment", NOW - DAY, "commentAdd", { kind: "commentAdd", commentId: "comment-proof" });
  const row = await readTask("comment-evidence", "comment-target");
  assert.equal(row.lastActivityAt, new Date(NOW - DAY).toISOString());
  assert.equal(row.lastStatusChangeAt, new Date(NOW - 10 * DAY).toISOString());
  assert.deepEqual(row.blockedBy, []); assert.equal(row.status, "in-flight");
});

for (const fault of ["older", "equal", "foreign", "mismatched-column", "mismatched-payload", "deleted", "missing-id", "numeric-id", "malformed", "future", "precreation", "invalid-time"] as const) {
  test(`comment evidence excludes ${fault} without moving activity backward`, async () => {
    const id = `comment-${fault}`; await task("comment-evidence", id, { lane: "doing", updated: NOW - 10 * DAY });
    const at = fault === "older" ? NOW - 20 * DAY : fault === "equal" ? NOW - 10 * DAY : fault === "future" ? NOW + DAY : fault === "precreation" ? NOW - 50 * DAY : NOW - DAY;
    const eventId = `${id}-event`;
    await event(fault === "foreign" ? "foreign-workspace" : "comment-evidence", id, eventId, at, fault === "mismatched-column" ? "update" : "commentAdd", { kind: fault === "deleted" ? "commentRemove" : fault === "mismatched-payload" ? "update" : "commentAdd", commentId: fault === "missing-id" ? " " : fault === "numeric-id" ? 17 : "valid-comment" });
    if (fault === "malformed") await fixture.client.execute({ sql: "UPDATE activities SET payload='{broken' WHERE id=?", args: [eventId] });
    if (fault === "invalid-time") await fixture.client.execute({ sql: "UPDATE activities SET created_at='invalid' WHERE id=?", args: [eventId] });
    const row = await readTask("comment-evidence", id);
    assert.equal(row.lastActivityAt, new Date(NOW - 10 * DAY).toISOString());
    assert.equal(row.lastStatusChangeAt, row.lastActivityAt);
  });
}

test("invalid latest comment cannot evict earlier eligible positive evidence", async () => {
  await task("comment-evidence", "comment-valid-earlier", { lane: "doing", updated: NOW - 10 * DAY });
  await event("comment-evidence", "comment-valid-earlier", "comment-eligible", NOW - 2 * DAY, "commentAdd", { kind: "commentAdd", commentId: "valid" });
  await event("comment-evidence", "comment-valid-earlier", "comment-ineligible", NOW + DAY, "commentAdd", { kind: "commentAdd", commentId: "future" });
  assert.equal((await readTask("comment-evidence", "comment-valid-earlier")).lastActivityAt, new Date(NOW - 2 * DAY).toISOString());
});

test("invalid future activity proxy or creation never permits comment fallback", async () => {
  await task("comment-evidence", "comment-future-proxy", { lane: "doing", updated: NOW + DAY });
  await event("comment-evidence", "comment-future-proxy", "future-proxy-event", NOW - DAY, "commentAdd", { kind: "commentAdd", commentId: "valid" });
  assert.equal((await readTask("comment-evidence", "comment-future-proxy")).lastActivityAt, new Date(NOW + DAY).toISOString());
  await task("comment-evidence", "comment-future-creation", { lane: "doing", updated: NOW - 10 * DAY });
  await fixture.client.execute({ sql: "UPDATE tasks SET created_at=? WHERE id='comment-future-creation'", args: [(NOW + DAY) / 1000] });
  await event("comment-evidence", "comment-future-creation", "future-creation-event", NOW - DAY, "commentAdd", { kind: "commentAdd", commentId: "valid" });
  assert.equal((await readTask("comment-evidence", "comment-future-creation")).lastActivityAt, new Date(NOW - 10 * DAY).toISOString());
});

test("comment evidence query failure rejects the whole read", async () => {
  const raw = clientModule.getTasksClient(); assert.ok(raw); const original = raw.execute;
  raw.execute = async (...args: Parameters<typeof raw.execute>) => {
    const input: unknown = args[0], query = typeof input === "string" ? input : (input as { sql: string }).sql;
    if (/MAX\(a.created_at\)/.test(query)) throw new Error("synthetic comment evidence unavailable");
    return original.apply(raw, args);
  };
  try { await assert.rejects(source.tasksDbSource.read("comment-evidence")); }
  finally { raw.execute = original; }
});

test("configured terminal dependencies clear but configured raw done remains a blocker", async () => {
  await workspace("dependency-configured", acceptedConfig);
  await task("dependency-configured", "configured-upstream", { lane: "doing", column: "accepted" });
  await task("dependency-configured", "configured-open-upstream");
  await task("dependency-configured", "configured-dependent", { lane: "review", blocked: ["configured-upstream", "configured-open-upstream"] });
  const row = await readTask("dependency-configured", "configured-dependent");
  assert.equal(row.status, "review"); assert.deepEqual(row.blockedBy, ["configured-open-upstream"]);
});

test("archived and child terminal dependencies clear without becoming visible rows", async () => {
  await workspace("dependency-hidden");
  await task("dependency-hidden", "hidden-dependent", { lane: "doing", blocked: ["hidden-archived", "hidden-child"] });
  await task("dependency-hidden", "hidden-archived", { archived: NOW - DAY });
  await task("dependency-hidden", "hidden-child", { parent: "hidden-dependent" });
  const read = await source.tasksDbSource.read("dependency-hidden");
  assert.deepEqual(read.tasks.map(row => row.id), ["hidden-dependent"]);
  assert.deepEqual(read.tasks[0].blockedBy, []); assert.equal(read.tasks[0].status, "in-flight");
});

test("cleared dependencies do not release an explicit waiting column", async () => {
  await workspace("dependency-waiting"); await task("dependency-waiting", "waiting-upstream");
  await task("dependency-waiting", "waiting-dependent", { lane: "doing", column: "waiting", blocked: ["waiting-upstream"] });
  const row = await readTask("dependency-waiting", "waiting-dependent");
  assert.equal(row.status, "blocked"); assert.deepEqual(row.blockedBy, []);
});

for (const fault of ["missing", "foreign", "mixed", "malformed"] as const) {
  test(`unknown ${fault} dependencies reject open-source claims`, async () => {
    const id = `dependency-unknown-${fault}`; await workspace(id);
    await task(id, `${id}-done`);
    if (fault === "foreign") {
      await workspace(`${id}-foreign`); await task(`${id}-foreign`, `${id}-unresolved`);
    }
    await task(id, `${id}-dependent`, { lane: "review", blocked: fault === "mixed" ? [`${id}-done`, `${id}-unresolved`] : [`${id}-unresolved`] });
    if (fault === "malformed") await fixture.client.execute({ sql: "UPDATE tasks SET blocked_by=? WHERE id=?", args: [JSON.stringify([null, 17, ""]), `${id}-dependent`] });
    await assert.rejects(source.tasksDbSource.read(id), /Signal dependency state unavailable/);
  });
}

test("unknown dependencies on already terminal work do not invent an open dependency claim", async () => {
  await workspace("dependency-terminal-unknown"); await task("dependency-terminal-unknown", "terminal-unknown", { blocked: ["absent"] });
  assert.equal((await readTask("dependency-terminal-unknown", "terminal-unknown")).status, "shipped");
});

test("more than500 hidden dependency targets use bounded scoped terminal-field queries", async () => {
  const id = "dependency-query-growth"; await workspace(id);
  const blocked = Array.from({ length: 501 }, (_, index) => `dependency-hidden-${index}`);
  await fixture.client.batch(blocked.map(target => ({ sql: "INSERT INTO tasks(id,workspace_id,seq,title,lane,priority,assignees,tags,blocked_by,created_at,updated_at,archived_at) VALUES (?,?,?,'Hidden private title','done','p2','[]','[]','[]',?,?,?)", args: [target, id, ++sequence, (NOW - 40 * DAY) / 1000, NOW / 1000, NOW / 1000] })), "write");
  await task(id, "many-dependencies", { lane: "doing", blocked });
  const raw = clientModule.getTasksClient(); assert.ok(raw);
  const original = raw.execute, queries: string[] = [];
  raw.execute = async (...args: Parameters<typeof raw.execute>) => {
    const input: unknown = args[0]; queries.push(typeof input === "string" ? input : (input as { sql: string }).sql);
    return original.apply(raw, args);
  };
  try {
    const read = await source.tasksDbSource.read(id);
    assert.equal(read.tasks.length, 1); assert.deepEqual(read.tasks[0].blockedBy, []);
    const dependencyQueries = queries.filter(query => /from "tasks"/.test(query) && !/"title"/.test(query));
    assert.equal(dependencyQueries.length, 2); assert.equal(queries.length, 5);
    assert.ok(dependencyQueries.every(query => /"workspace_id"/.test(query) && /"board_column_key"/.test(query)));
  } finally { raw.execute = original; }
});

test("dependency terminal lookup failure rejects instead of returning partial edges", async () => {
  const raw = clientModule.getTasksClient(); assert.ok(raw); const original = raw.execute;
  raw.execute = async (...args: Parameters<typeof raw.execute>) => {
    const input: unknown = args[0], query = typeof input === "string" ? input : (input as { sql: string }).sql;
    if (/from "tasks"/.test(query) && !/"title"/.test(query)) throw new Error("synthetic dependency unavailable");
    return original.apply(raw, args);
  };
  try { await assert.rejects(source.tasksDbSource.read("dependency-hidden")); }
  finally { raw.execute = original; }
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
    assert.equal(queries.length, 6, "one Tasks query, one config query, two <=500-target completion queries and two <=500-target comment queries");
    assert.equal(queries.filter(query => /WITH ranked/.test(query)).length, 2);
    assert.equal(queries.filter(query => /MAX\(a.created_at\)/.test(query)).length, 2);
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
    assert.equal(queries, 4); assert.equal(historyRows, 500);
    context.diagnostic(JSON.stringify({ evidence: "local-history-query-cost", tasks: 500, persistedTransitions: 50_000, queries, historyRows, historyElapsedMs, elapsedMs, limitation: "window ranks matching history; bounded returned evidence does not bound scan work or prove remote latency" }));
  } finally { raw.execute = original; }
});
