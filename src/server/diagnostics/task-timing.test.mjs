import assert from "node:assert/strict";
import {AsyncLocalStorage} from "node:async_hooks";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {test} from "node:test";
import {fileURLToPath} from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const helperPath = fileURLToPath(new URL("./task-timing.ts", import.meta.url));
const timingPath = fileURLToPath(new URL("./identity-timing.ts", import.meta.url));
const operationalLogPath = fileURLToPath(new URL("../operational-log.ts", import.meta.url));
const scrubPath = fileURLToPath(new URL("../../lib/sentry-scrub.ts", import.meta.url));
const queriesPath = fileURLToPath(new URL("../db/queries.ts", import.meta.url));

function loadSource(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}, fileName: path,
  }).outputText;
  const loaded = {exports: {}};
  new Function("require", "module", "exports", compiled)(name => dependencies[name] ?? require(name), loaded, loaded.exports);
  return loaded.exports;
}

function enabledEnv() {
  return {
    SIGNAL_TASK_TIMING_DIAGNOSTIC: "isolated-preview-task-timing-v1",
    SIGNAL_IDENTITY_TIMING_DIAGNOSTIC: "isolated-preview-auth-timing-v1",
    SIGNAL_SPRINT_PREVIEW_AUTH: "isolated-clerk-preview-v1",
    SIGNAL_RELIABILITY_ATTEST: "isolated-reliability-v1",
    SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(Date.now() + 60 * 60 * 1_000),
    VERCEL: "1", VERCEL_ENV: "preview", VERCEL_TARGET_ENV: "preview", NODE_ENV: "production",
    NEXT_PUBLIC_SIGNAL_DEPLOYMENT_ENV: "preview", SIGNAL_ACCESS_MODE: "production",
    NEXT_PUBLIC_SIGNAL_ACCESS_MODE: "production", VERCEL_DEPLOYMENT_ID: "dpl_Synthetic123",
    VERCEL_PROJECT_ID: "prj_Synthetic123", VERCEL_URL: "synthetic-preview.vercel.app",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_synthetic", CLERK_SECRET_KEY: "sk_test_synthetic",
  };
}

async function withEnv(env, work) {
  const keys = Object.keys(env); const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) { if (env[key] === undefined) delete process.env[key]; else process.env[key] = env[key]; }
  try { return await work(); }
  finally { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}

function fixture(operationalLog, options = {}) {
  const request = new AsyncLocalStorage(); const callbacks = new Map(); const logs = [];
  const cache = implementation => {
    const values = new Map();
    return () => {
      if (options.failCache) throw Error("private-cache-failure");
      const id = request.getStore() ?? 0;
      if (!values.has(id)) values.set(id, implementation());
      return values.get(id);
    };
  };
  const after = callback => { if (options.failSchedule) throw Error("private-schedule-failure");
    const id = request.getStore() ?? 0; const list = callbacks.get(id) ?? [];
    list.push(callback); callbacks.set(id, list); };
  const timing = loadSource(timingPath, {
    "server-only": {}, "react": {cache}, "next/server": {after},
    "@/lib/auth/recipient-proof-authorized-parties": {SPRINT_PREVIEW_AUTH_MARKER: "isolated-clerk-preview-v1"},
    "@/server/operational-log": {opLog() {}},
  });
  const task = loadSource(helperPath, {
    "server-only": {}, "react": {cache}, "next/server": {after},
    "@/server/diagnostics/identity-timing": timing,
    "@/server/operational-log": operationalLog ?? {opLog: (level, scope, message, fields) => logs.push({level, scope, message, fields})},
  });
  return {task, request, callbacks, logs};
}

test("second opt-in inherits all isolated Preview and expiry guards", () => {
  const {task} = fixture(); const env = enabledEnv(); const now = Date.now();
  assert.equal(task.taskTimingEnabled(env, now), true);
  for (const change of [
    {SIGNAL_TASK_TIMING_DIAGNOSTIC: undefined}, {SIGNAL_TASK_TIMING_DIAGNOSTIC: "true"},
    {SIGNAL_IDENTITY_TIMING_DIAGNOSTIC: undefined}, {SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now - 1)},
    {SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(now + 7 * 60 * 60 * 1_000)},
    {VERCEL_ENV: "production"}, {VERCEL_TARGET_ENV: "production"},
    {NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_synthetic"}, {CLERK_SECRET_KEY: "sk_live_synthetic"},
  ]) assert.equal(task.taskTimingEnabled({...env, ...change}, now), false);
});

test("disabled guard invokes every original work exactly once and retains result and error", async () => {
  const f = fixture(); let calls = 0; const original = Error("private-original-error");
  await withEnv({...enabledEnv(), SIGNAL_TASK_TIMING_DIAGNOSTIC: undefined}, async () => {
    assert.equal(await f.task.withTaskActionTiming("create", async () => {calls++; return "private-result";}), "private-result");
    await assert.rejects(f.task.measureTaskBoardQuery(async () => {calls++; throw original;}), error => error === original);
    assert.deepEqual(f.task.measureTaskBoardMap(1, () => {calls++; return ["private-row"];}), ["private-row"]);
    assert.equal(f.callbacks.size, 0);
  });
  assert.equal(calls, 3);
});

test("expired guard, failing cache and failing after scheduler preserve one original call", async () => {
  let calls = 0;
  const expired = fixture();
  await withEnv({...enabledEnv(), SIGNAL_RELIABILITY_ATTEST_UNTIL_MS: String(Date.now() - 1)}, async () => {
    assert.equal(await expired.task.withTaskActionTiming("create", async () => {calls++; return "original";}), "original");
    assert.equal(expired.callbacks.size, 0);
  });
  const missingCache = fixture(undefined, {failCache: true});
  await withEnv(enabledEnv(), async () => {
    assert.equal(await missingCache.task.withTaskActionTiming("edit", async () => {calls++; return "original";}), "original");
    assert.equal(await missingCache.task.measureTaskBoardQuery(async () => {calls++; return "query";}), "query");
    assert.deepEqual(missingCache.task.measureTaskBoardMap(1, () => {calls++; return ["row"];}), ["row"]);
    assert.equal(missingCache.callbacks.size, 0);
  });
  const failedSchedule = fixture(undefined, {failSchedule: true});
  await withEnv(enabledEnv(), async () => {
    assert.equal(await failedSchedule.task.withTaskActionTiming("complete", async () => {calls++; return "original";}), "original");
    assert.equal(failedSchedule.callbacks.size, 0);
  });
  assert.equal(calls, 5);
});

test("concurrent action scopes and unclassified board reads remain separate numeric summaries", async () => {
  const f = fixture();
  await withEnv(enabledEnv(), async () => {
    const action = (id, scope, secret) => f.request.run(id, () => f.task.withTaskActionTiming(scope, async () => {
      await f.task.measureTaskStage("identity", async () => {await new Promise(resolve => setImmediate(resolve)); return secret;});
      await f.task.measureTaskStage("projectProof", async () => true);
      await f.task.measureTaskStage("writeAndActivity", async () => true);
      return f.task.measureTaskStage("finalRead", async () => f.task.measureTaskBoardMap(2,
        () => [secret, secret]));
    }));
    assert.deepEqual(await Promise.all([
      action(1, "create", "private-create"), action(2, "edit", "private-edit"),
      f.request.run(3, () => f.task.measureTaskBoardQuery(async () => ["private-unclassified"])),
    ]), [["private-create", "private-create"], ["private-edit", "private-edit"], ["private-unclassified"]]);
    for (const id of [1, 2, 3]) { assert.equal(f.callbacks.get(id)?.length, 1); f.callbacks.get(id)[0](); }
    assert.equal(f.logs.length, 3);
    assert.equal(f.logs[0].fields.create_actionTotal_count, 1);
    assert.equal(f.logs[0].fields.create_rowsReturned, 2);
    assert.equal(f.logs[0].fields.edit_actionTotal_count, 0);
    assert.equal(f.logs[1].fields.edit_actionTotal_count, 1);
    assert.equal(f.logs[1].fields.edit_rowsReturned, 2);
    assert.equal(f.logs[2].fields.unclassified_boardQuery_count, 1);
    assert.equal(f.logs[2].fields.create_actionTotal_count, 0);
    assert.ok(f.logs.every(log => Object.values(log.fields).every(value => typeof value === "number")));
    assert.doesNotMatch(JSON.stringify(f.logs), /private|create-result|edit-result/i);
  });
});

test("failed work and failed after logger preserve original outcome without replay", async () => {
  const original = Error("private-work-error"); let calls = 0;
  const f = fixture({opLog() {throw Error("private-log-error");}});
  await withEnv(enabledEnv(), async () => {
    await assert.rejects(f.request.run(4, () => f.task.withTaskActionTiming("complete", async () => {
      await f.task.measureTaskStage("writeAndActivity", async () => {calls++; throw original;});
    })), error => error === original);
    assert.equal(calls, 1);
    assert.doesNotThrow(() => f.callbacks.get(4)[0]());
  });
});

test("enabled query and mapper failures keep their exact error and record one attempt", async () => {
  const f = fixture(); const queryError = Error("private-query-error"); const mapError = Error("private-map-error");
  let queries = 0; let maps = 0;
  await withEnv(enabledEnv(), async () => {
    await f.request.run(7, async () => {
      await assert.rejects(f.task.measureTaskBoardQuery(async () => {queries++; throw queryError;}), error => error === queryError);
      assert.throws(() => f.task.measureTaskBoardMap(2, () => {maps++; throw mapError;}), error => error === mapError);
    });
    assert.equal(queries, 1); assert.equal(maps, 1);
    f.callbacks.get(7)[0]();
    assert.equal(f.logs[0].fields.unclassified_boardQuery_count, 1);
    assert.equal(f.logs[0].fields.unclassified_boardMap_count, 1);
    assert.equal(f.logs[0].fields.unclassified_rowsReturned, 0);
    assert.doesNotMatch(JSON.stringify(f.logs), /private-query|private-map/);
  });
});

test("real operational sink renders only fixed numeric fields", async () => {
  const scrub = loadSource(scrubPath, {});
  const operationalLog = loadSource(operationalLogPath, {"@/lib/sentry-scrub": scrub});
  const f = fixture(operationalLog); const originalWarn = console.warn; const lines = [];
  console.warn = line => lines.push(String(line));
  try {
    await withEnv(enabledEnv(), async () => {
      await f.request.run(5, () => f.task.withTaskActionTiming("create", async () =>
        f.task.measureTaskBoardMap(2, () => ["private-one", "private-two"])));
      f.callbacks.get(5)[0]();
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /^\[signal\.task\.timing\.v1\] sample version=1 /);
    assert.match(lines[0], /create_rowsReturned=2/);
    assert.match(lines[0], /create_boardMap_count=1/);
    assert.doesNotMatch(lines[0], /private|one|two|SQL|http|workspace/i);
  } finally {console.warn = originalWarn;}
});

test("getTasks source keeps its scoped query/map and return shape under instrumentation", async () => {
  // Execute the real getTasks function body with only its imported store and row mapper replaced.
  const source = readFileSync(queriesPath, "utf8");
  const start = source.indexOf("export async function getTasks(");
  const end = source.indexOf("\n/**", start);
  assert.ok(start >= 0 && end > start);
  const body = ts.transpileModule(source.slice(start, end).replace("export async function", "async function"),
    {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const f = fixture(); const queryLog = [];
  const db = {select() {return {from() {return {where() {return {orderBy() {return {
    async limit(count) {queryLog.push(count); return [{id: "private-id", title: "private-title"}];},
  };}};}};}};}};
  const getTasks = new Function("deps", `with (deps) { ${body}; return getTasks; }`)({
    isDemoMode: () => false, demoTasks: () => [], withReadRetry: work => work(),
    measureTaskBoardQuery: f.task.measureTaskBoardQuery, measureTaskBoardMap: f.task.measureTaskBoardMap,
    db, taskColumnsWithCount: {}, tasks: {workspaceId: "workspace", parentTaskId: "parent", archivedAt: "archived"},
    byWorkspace: (_column, _id, ...conditions) => conditions, isNull: value => value,
    laneOrderSql: "lane", positionOrderSql: "position", rowToTask: row => ({id: row.id, title: row.title}),
  });
  await withEnv(enabledEnv(), async () => {
    assert.deepEqual(await f.request.run(6, () => f.task.withTaskActionTiming("edit", () => getTasks("private-project"))),
      [{id: "private-id", title: "private-title"}]);
    assert.deepEqual(queryLog, [2000]);
    f.callbacks.get(6)[0]();
    assert.equal(f.logs[0].fields.edit_boardQuery_count, 1);
    assert.equal(f.logs[0].fields.edit_boardMap_count, 1);
    assert.equal(f.logs[0].fields.edit_rowsReturned, 1);
    assert.doesNotMatch(JSON.stringify(f.logs), /private-project|private-id|private-title/);
  });
});
