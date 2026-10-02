import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { registerHooks, createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "../../..");
const require = createRequire(import.meta.url);
const stubUrl = new URL("./board-fidelity.fixture-stub.cjs", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (["@/server/auth", "@/server/db", "next/cache", "server-only"].includes(specifier)) {
      return { url: stubUrl, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const old = Math.floor(Date.now() / 1000) - 86400;
const created = old - 86400;
const savedEnv = Object.fromEntries([
  "TASKS_DATABASE_URL", "TASKS_AUTH_TOKEN", "VERCEL",
  "SIGNAL_ACCESS_MODE", "NEXT_PUBLIC_SIGNAL_ACCESS_MODE",
  "SIGNAL_ACTIVE_PROJECT_V3_ENABLED",
].map(key => [key, process.env[key]]));
let client, readerClient, db, board, source;
let seq = 0;

before(async () => {
  const root = process.env.BOARD_FIDELITY_TEST_ROOT;
  assert.ok(root && isAbsolute(root), "parent-owned fixture root required");
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  assert.ok(basename(root).startsWith("signal-board-fidelity-run-"));
  process.env.TASKS_DATABASE_URL = pathToFileURL(join(root, "fixture.db")).href;
  delete process.env.TASKS_AUTH_TOKEN;
  delete process.env.VERCEL;
  process.env.SIGNAL_ACCESS_MODE = "production";
  process.env.NEXT_PUBLIC_SIGNAL_ACCESS_MODE = "production";

  const { createClient } = require("@libsql/client");
  const { drizzle } = require("drizzle-orm/libsql");
  const schema = await import(pathToFileURL(join(appRoot, "src/server/db/schema.ts")).href);
  client = createClient({ url: process.env.TASKS_DATABASE_URL });
  await client.execute("PRAGMA foreign_keys = OFF");
  const migrations = readdirSync(join(appRoot, "drizzle"))
    .filter(name => /^\d{4}_.+\.sql$/.test(name) && name >= "0014_")
    .sort();
  for (const migration of migrations) {
    await client.executeMultiple(readFileSync(join(appRoot, "drizzle", migration), "utf8"));
  }
  await client.execute("PRAGMA foreign_keys = ON");
  const foreignKeys = await client.execute("PRAGMA foreign_keys");
  assert.equal(Number(foreignKeys.rows[0]?.foreign_keys), 1, "receiving actions run with FK enforcement");
  db = drizzle(client, { schema });
  globalThis.__boardFidelity = { actor: "owner_actor", workspace: "", db };
  board = await import("./board.ts");
  source = await import("../../modules/signal/lib/data/source.ts");
  readerClient = await import("../../modules/signal/server/tasks-db/signal-tasks-db-client.ts");
  await execute("INSERT INTO users(id,clerk_id,color,initials) VALUES ('owner_actor','clerk_owned','blue','OA')");
  await execute("INSERT INTO users(id,clerk_id,color,initials) VALUES ('foreign_actor','clerk_foreign','grey','FA')");
});

after(() => {
  readerClient?.getTasksClient()?.close();
  client?.close();
  delete globalThis.__boardFidelity;
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  // The parent runner removes its exact fixture only after this process exits.
});

async function execute(sql, args = []) {
  return (await client.execute({ sql, args })).rows;
}

async function project(id, config = null) {
  await execute("INSERT INTO workspaces(id,slug,name,owner_user_id,context_type) VALUES (?,?,?,?,?)", [id, id, id, "owner_actor", "project"]);
  await execute("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES (?,'owner_actor','owner')", [id]);
  if (config) await execute("INSERT INTO meta(key,value,updated_at) VALUES (?,?,?)", [`board:${id}:columns`, JSON.stringify(config), old]);
  globalThis.__boardFidelity.workspace = id;
  globalThis.__boardFidelity.actor = "owner_actor";
}

function config(custom, doneKeys = ["done"]) {
  return {
    system: {}, custom: custom.map(key => ({ key, name: key })),
    order: ["todo", "doing", "review", "done", ...custom],
    colors: {}, descriptions: {}, limits: {}, doneKeys,
  };
}

async function task(ws, id, { lane = "todo", column = null, completed = null } = {}) {
  await execute(
    "INSERT INTO tasks(id,workspace_id,seq,title,lane,board_column_key,priority,assignees,tags,blocked_by,created_at,updated_at,completed_at) VALUES (?,?,?,?,?,?,'p2','[]','[]','[]',?,?,?)",
    [id, ws, ++seq, id, lane, column, created, old, completed],
  );
}

async function raw(id) {
  const rows = await execute("SELECT workspace_id,lane,board_column_key,updated_at,completed_at FROM tasks WHERE id=?", [id]);
  assert.equal(rows.length, 1);
  return Object.fromEntries(Object.entries(rows[0]));
}

async function read(ws, id) {
  const row = (await source.tasksDbSource.read(ws)).tasks.find(item => item.id === id);
  assert.ok(row, "the real active reader must return the task");
  return row;
}

async function storedConfig(ws) {
  const rows = await execute("SELECT value FROM meta WHERE key=?", [`board:${ws}:columns`]);
  assert.equal(rows.length, 1);
  return JSON.parse(String(rows[0].value));
}

async function storedMeta(key) {
  const rows = await execute("SELECT value FROM meta WHERE key=?", [key]);
  return rows.length ? String(rows[0].value) : null;
}

test("the rendered Board B changes only B while the ambient cookie still names A", async () => {
  await project("scope_a", config(["col-stage"]));
  await project("scope_b", config(["col-stage"]));
  await task("scope_b", "scope_b_task", { lane: "doing", column: "col-stage" });
  const aConfig = await storedMeta("board:scope_a:columns");
  const aTask = await raw("scope_b_task");
  globalThis.__boardFidelity.workspace = "scope_a";
  assert.deepEqual(await board.renameBoardAction("scope_b", "Board B"), { ok: true });
  assert.deepEqual(await board.renameColumnAction("scope_b", "col-stage", "Stage B"), { ok: true });
  assert.deepEqual(await board.setColumnColorAction("scope_b", "col-stage", "neutral"), { ok: true });
  assert.deepEqual(await board.setColumnDescriptionAction("scope_b", "col-stage", "B description"), { ok: true });
  assert.deepEqual(await board.setColumnLimitAction("scope_b", "col-stage", 2), { ok: true });
  assert.deepEqual(await board.setColumnDoneAction("scope_b", "col-stage", true), { ok: true });
  const added = await board.addColumnAction("scope_b", "New B");
  assert.equal(added.ok, true);
  assert.deepEqual(await board.reorderColumnsAction("scope_b", [
    "todo", "doing", "review", "done", added.key, "col-stage",
  ]), { ok: true });
  assert.deepEqual(await board.deleteColumnAction("scope_b", "col-stage", "done"), { ok: true, tasksReassigned: 1 });

  assert.equal(await storedMeta("board:scope_a:name"), null);
  assert.equal(await storedMeta("board:scope_a:columns"), aConfig);
  assert.equal(await storedMeta("board:scope_b:name"), "Board B");
  const bConfig = await storedConfig("scope_b");
  assert.ok(bConfig.custom.some(column => column.key === added.key));
  assert.ok(!bConfig.custom.some(column => column.key === "col-stage"));
  assert.equal((await raw("scope_b_task")).lane, "done");
  assert.notDeepEqual(await raw("scope_b_task"), aTask);
});

test("missing and malformed rendered Project ids refuse before any board write", async () => {
  await project("scope_refuse", config(["col-stage"]));
  const before = await storedMeta("board:scope_refuse:columns");
  await assert.rejects(board.renameColumnAction("", "col-stage", "wrong"), /project isn.t available/);
  await assert.rejects(board.deleteColumnAction("bad id", "col-stage", "done"), /project isn.t available/);
  await assert.rejects(board.renameColumnAction(undefined, "col-stage", "wrong"), /project isn.t available/);
  assert.equal(await storedMeta("board:scope_refuse:columns"), before);
});

test("flag-off Board still writes its rendered Project instead of the active cookie", async () => {
  await project("flag_a", config(["col-stage"]));
  await project("flag_b", config(["col-stage"]));
  const aBefore = await storedMeta("board:flag_a:columns");
  globalThis.__boardFidelity.workspace = "flag_a";
  const previousFlag = process.env.SIGNAL_ACTIVE_PROJECT_V3_ENABLED;
  process.env.SIGNAL_ACTIVE_PROJECT_V3_ENABLED = "false";
  try {
    assert.deepEqual(await board.renameColumnAction("flag_b", "col-stage", "Rendered B"), { ok: true });
  } finally {
    if (previousFlag === undefined) delete process.env.SIGNAL_ACTIVE_PROJECT_V3_ENABLED;
    else process.env.SIGNAL_ACTIVE_PROJECT_V3_ENABLED = previousFlag;
  }
  assert.equal(await storedMeta("board:flag_a:columns"), aBefore);
  assert.equal((await storedConfig("flag_b")).custom[0].name, "Rendered B");
});

test("revoked route membership refuses at the write lock with no SQL effects", async () => {
  await project("scope_revoke", config(["col-stage"]));
  const before = await storedMeta("board:scope_revoke:columns");
  const originalTransaction = db.transaction;
  let revoked = false;
  db.transaction = async function (callback, options) {
    if (!revoked) {
      revoked = true;
      await execute("DELETE FROM workspace_members WHERE workspace_id='scope_revoke' AND user_id='owner_actor'");
    }
    return originalTransaction.call(this, callback, options);
  };
  try {
    await assert.rejects(board.renameColumnAction("scope_revoke", "col-stage", "wrong"), /project isn.t available/);
  } finally {
    db.transaction = originalTransaction;
  }
  assert.equal(revoked, true);
  assert.equal(await storedMeta("board:scope_revoke:columns"), before);
});

test("durable Project deletion intent fences config and task reassignment", async () => {
  await project("scope_deleting", config(["col-stage"]));
  await task("scope_deleting", "scope_deleting_task", { lane: "doing", column: "col-stage" });
  const beforeConfig = await storedMeta("board:scope_deleting:columns");
  const beforeTask = await raw("scope_deleting_task");
  await execute(
    "INSERT INTO project_drive_operations(id,workspace_id,operation_kind,status,dedupe_key) VALUES (?,?,?,?,?)",
    ["delete-scope-deleting", "scope_deleting", "project_delete", "pending", "a".repeat(64)],
  );
  await assert.rejects(board.renameColumnAction("scope_deleting", "col-stage", "wrong"), /being deleted/);
  await assert.rejects(board.deleteColumnAction("scope_deleting", "col-stage", "done"), /being deleted/);
  assert.equal(await storedMeta("board:scope_deleting:columns"), beforeConfig);
  assert.deepEqual(await raw("scope_deleting_task"), beforeTask);
});

test("account erasure tombstone fences board meta writes", async () => {
  await project("scope_account_deleting", config(["col-stage"]));
  const before = await storedMeta("board:scope_account_deleting:columns");
  const { accountDeletionTombstoneKey } = await import("../account-deletion-key.ts");
  const key = accountDeletionTombstoneKey("clerk_owned");
  await execute("INSERT INTO meta(key,value,updated_at) VALUES (?, 'erasure-requested:v1', unixepoch())", [key]);
  try {
    await assert.rejects(
      board.renameColumnAction("scope_account_deleting", "col-stage", "wrong"),
      /project isn.t available/,
    );
    assert.equal(await storedMeta("board:scope_account_deleting:columns"), before);
  } finally {
    await execute("DELETE FROM meta WHERE key=?", [key]);
  }
});

test("card move advances the persisted proxy and active read; no-op and refused move preserve bytes", async () => {
  await project("move_ws", config(["col-open", "col-paid"], ["done", "col-paid"]));
  await task("move_ws", "move_task");
  const before = await raw("move_task");
  assert.deepEqual(await board.moveTaskToColumnAction("move_task", "review"), { ok: true });
  const moved = await raw("move_task");
  const observed = await read("move_ws", "move_task");
  assert.equal(moved.lane, "review");
  assert.ok(Number(moved.updated_at) > Number(before.updated_at));
  assert.equal(observed.status, "review");
  assert.equal(observed.lastStatusChangeAt, new Date(Number(moved.updated_at) * 1000).toISOString());
  assert.equal(observed.lastActivityAt, observed.lastStatusChangeAt);

  assert.deepEqual(await board.moveTaskToColumnAction("move_task", "review"), { ok: true });
  assert.deepEqual(await raw("move_task"), moved);
  globalThis.__boardFidelity.actor = "foreign_actor";
  assert.deepEqual(await board.moveTaskToColumnAction("move_task", "todo"), { ok: true });
  assert.deepEqual(await raw("move_task"), moved);
  globalThis.__boardFidelity.actor = "owner_actor";
});

test("card custom done, done-to-done and reopen transitions preserve their stamp rules", async () => {
  await project("card_done_ws", config(["col-open", "col-paid"], ["done", "col-paid"]));
  await task("card_done_ws", "card_done_task", { lane: "doing", column: "col-open" });
  await board.moveTaskToColumnAction("card_done_task", "col-paid");
  const firstDone = await raw("card_done_task");
  assert.ok(Number(firstDone.completed_at) > old);
  assert.equal((await read("card_done_ws", "card_done_task")).status, "shipped");
  await board.moveTaskToColumnAction("card_done_task", "done");
  assert.equal((await raw("card_done_task")).completed_at, firstDone.completed_at);
  await board.moveTaskToColumnAction("card_done_task", "col-open");
  assert.equal((await raw("card_done_task")).completed_at, null);
  assert.equal((await read("card_done_ws", "card_done_task")).completedAt, null);
});

test("explicit open-column deletion into done stamps completion and remains scoped", async () => {
  await project("delete_ws", config(["col-stage"]));
  await task("delete_ws", "delete_target", { lane: "doing", column: "col-stage" });
  await task("delete_ws", "delete_unaffected", { lane: "doing" });
  await project("delete_other_ws", config(["col-stage"]));
  await task("delete_other_ws", "delete_other_target", { lane: "doing", column: "col-stage" });
  const otherProjectTask = await raw("delete_other_target");
  globalThis.__boardFidelity.workspace = "delete_ws";
  const untouched = await raw("delete_unaffected");
  assert.deepEqual(await board.deleteColumnAction("delete_ws", "col-stage", "done"), { ok: true, tasksReassigned: 1 });
  const moved = await raw("delete_target");
  const observed = await read("delete_ws", "delete_target");
  assert.equal(moved.lane, "done");
  assert.equal(moved.board_column_key, null);
  assert.ok(Number(moved.completed_at) > old);
  assert.ok(Number(moved.updated_at) > old);
  assert.equal(observed.status, "shipped");
  assert.equal(observed.completedAt, new Date(Number(moved.completed_at) * 1000).toISOString());
  assert.deepEqual(await raw("delete_unaffected"), untouched);
  assert.deepEqual(await raw("delete_other_target"), otherProjectTask);
  assert.equal((await read("delete_other_ws", "delete_other_target")).status, "in-flight");
  assert.ok(!(await storedConfig("delete_ws")).custom.some(column => column.key === "col-stage"));
});

test("explicit done-to-open clears completion while done-to-done keeps its old stamp", async () => {
  await project("delete_reopen_ws", config(["col-done", "col-open"], ["done", "col-done"]));
  await task("delete_reopen_ws", "delete_reopen_task", { lane: "doing", column: "col-done", completed: old });
  assert.deepEqual(await board.deleteColumnAction("delete_reopen_ws", "col-done", "col-open"), { ok: true, tasksReassigned: 1 });
  assert.equal((await raw("delete_reopen_task")).completed_at, null);
  assert.equal((await read("delete_reopen_ws", "delete_reopen_task")).status, "in-flight");

  await project("delete_done_ws", config(["col-done", "col-also-done"], ["done", "col-done", "col-also-done"]));
  await task("delete_done_ws", "delete_done_task", { lane: "doing", column: "col-done", completed: old });
  assert.deepEqual(await board.deleteColumnAction("delete_done_ws", "col-done", "col-also-done"), { ok: true, tasksReassigned: 1 });
  assert.equal((await raw("delete_done_task")).completed_at, old);
  assert.equal((await read("delete_done_ws", "delete_done_task")).status, "shipped");
});

test("implicit return to mixed canonical lanes stamps only the actual done transition", async () => {
  await project("mixed_ws", config(["col-stage"]));
  await task("mixed_ws", "mixed_done", { lane: "done", column: "col-stage" });
  await task("mixed_ws", "mixed_todo", { lane: "todo", column: "col-stage" });
  await task("mixed_ws", "mixed_raw", { lane: "col-stage" });
  assert.deepEqual(await board.deleteColumnAction("mixed_ws", "col-stage"), { ok: true, tasksReassigned: 3 });
  const done = await raw("mixed_done");
  assert.equal(done.board_column_key, null);
  assert.ok(Number(done.completed_at) > old);
  assert.equal((await read("mixed_ws", "mixed_done")).status, "shipped");
  assert.equal((await raw("mixed_todo")).completed_at, null);
  assert.equal((await raw("mixed_raw")).lane, "doing");
  assert.equal((await raw("mixed_raw")).completed_at, null);
});

test("implicit return honors a nonstandard done key across mixed underlying lanes", async () => {
  await project("mixed_review_ws", config(["col-stage"], ["review"]));
  await task("mixed_review_ws", "mixed_review_done", { lane: "review", column: "col-stage" });
  await task("mixed_review_ws", "mixed_review_open", { lane: "done", column: "col-stage" });
  assert.deepEqual(await board.deleteColumnAction("mixed_review_ws", "col-stage"), { ok: true, tasksReassigned: 2 });
  const terminal = await raw("mixed_review_done");
  assert.ok(Number(terminal.completed_at) > old);
  assert.equal((await read("mixed_review_ws", "mixed_review_done")).status, "shipped");
  assert.equal((await raw("mixed_review_open")).completed_at, null);
  assert.notEqual((await read("mixed_review_ws", "mixed_review_open")).status, "shipped");
});

test("removing the sole custom done key falls back without stamping unaffected config-only changes", async () => {
  await project("fallback_ws", config(["col-done"], ["col-done"]));
  await task("fallback_ws", "fallback_claimed", { lane: "doing", column: "col-done", completed: old });
  await task("fallback_ws", "fallback_unaffected", { lane: "done" });
  const unaffected = await raw("fallback_unaffected");
  assert.deepEqual(await board.deleteColumnAction("fallback_ws", "col-done", "doing"), { ok: true, tasksReassigned: 1 });
  assert.deepEqual((await storedConfig("fallback_ws")).doneKeys, ["done"]);
  assert.equal((await raw("fallback_claimed")).completed_at, null);
  assert.deepEqual(await raw("fallback_unaffected"), unaffected);
  assert.equal((await read("fallback_ws", "fallback_unaffected")).status, "shipped");
  assert.equal((await read("fallback_ws", "fallback_unaffected")).completedAt, null);
});

test("foreign board membership refuses deletion before task or config write", async () => {
  await project("foreign_ws", config(["col-stage"]));
  await task("foreign_ws", "foreign_target", { lane: "doing", column: "col-stage" });
  const beforeTask = await raw("foreign_target");
  const beforeConfig = await storedConfig("foreign_ws");
  globalThis.__boardFidelity.actor = "foreign_actor";
  try { await assert.rejects(board.deleteColumnAction("foreign_ws", "col-stage", "done"), /project isn.t available/); }
  finally { globalThis.__boardFidelity.actor = "owner_actor"; }
  assert.deepEqual(await raw("foreign_target"), beforeTask);
  assert.deepEqual(await storedConfig("foreign_ws"), beforeConfig);
});

test("in-transaction membership reproof refuses a revoked card move", async () => {
  await project("revoke_ws");
  await task("revoke_ws", "revoke_target");
  const beforeTask = await raw("revoke_target");
  const originalTransaction = db.transaction;
  let intercepted = false;
  db.transaction = async function (callback, options) {
    if (!intercepted) {
      intercepted = true;
      await execute("DELETE FROM workspace_members WHERE workspace_id='revoke_ws' AND user_id='owner_actor'");
    }
    return originalTransaction.call(this, callback, options);
  };
  try { assert.deepEqual(await board.moveTaskToColumnAction("revoke_target", "review"), { ok: true }); }
  finally { db.transaction = originalTransaction; }
  assert.equal(intercepted, true);
  assert.deepEqual(await raw("revoke_target"), beforeTask);
});

test("a card move uses the current done meaning observed after its initial scope proof", async () => {
  await project("config_race_ws", config(["col-paid"], ["done"]));
  await task("config_race_ws", "config_race_target", { lane: "doing" });
  const originalTransaction = db.transaction;
  let switched = false;
  db.transaction = async function (callback, options) {
    if (!switched) {
      switched = true;
      await execute("UPDATE meta SET value=? WHERE key=?", [
        JSON.stringify(config(["col-paid"], ["done", "col-paid"])),
        "board:config_race_ws:columns",
      ]);
    }
    return originalTransaction.call(this, callback, options);
  };
  try { assert.deepEqual(await board.moveTaskToColumnAction("config_race_target", "col-paid"), { ok: true }); }
  finally { db.transaction = originalTransaction; }
  assert.equal(switched, true);
  assert.ok(Number((await raw("config_race_target")).completed_at) > old);
  assert.equal((await read("config_race_ws", "config_race_target")).status, "shipped");
});

test("deletion revalidates an explicit destination against the config under its write lock", async () => {
  await project("delete_race_ws", config(["col-source", "col-destination"]));
  await task("delete_race_ws", "delete_race_target", { lane: "doing", column: "col-source" });
  const beforeTask = await raw("delete_race_target");
  const originalTransaction = db.transaction;
  let switched = false;
  db.transaction = async function (callback, options) {
    if (!switched) {
      switched = true;
      await execute("UPDATE meta SET value=? WHERE key=?", [
        JSON.stringify(config(["col-source"])), "board:delete_race_ws:columns",
      ]);
    }
    return originalTransaction.call(this, callback, options);
  };
  try { await assert.rejects(board.deleteColumnAction("delete_race_ws", "col-source", "col-destination"), /Unknown destination column/); }
  finally { db.transaction = originalTransaction; }
  assert.equal(switched, true);
  assert.deepEqual(await raw("delete_race_target"), beforeTask);
  assert.ok((await storedConfig("delete_race_ws")).custom.some(column => column.key === "col-source"));
});

test("config persistence failure rolls back the preceding scoped task update", async () => {
  await project("rollback_ws", config(["col-stage"]));
  await task("rollback_ws", "rollback_target", { lane: "doing", column: "col-stage" });
  const beforeTask = await raw("rollback_target");
  const beforeConfig = await storedConfig("rollback_ws");
  const originalTransaction = db.transaction;
  let injected = false;
  db.transaction = function (callback, options) {
    return originalTransaction.call(this, async tx => {
      const originalRun = tx.run;
      tx.run = function () {
        injected = true;
        throw new Error("synthetic config persistence failure");
      };
      try { return await callback(tx); }
      finally { tx.run = originalRun; }
    }, options);
  };
  try { await assert.rejects(board.deleteColumnAction("rollback_ws", "col-stage", "done")); }
  finally { db.transaction = originalTransaction; }
  assert.equal(injected, true);
  assert.deepEqual(await raw("rollback_target"), beforeTask);
  assert.deepEqual(await storedConfig("rollback_ws"), beforeConfig);
});
