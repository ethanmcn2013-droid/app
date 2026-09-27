import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { freshFileDb } from "./memory-test-db";
import { shouldSeedImplicitDevelopmentDatabase } from "./development-seed-policy";

const development = { NODE_ENV: "development" };
const localState = { demoMode: false, productionMode: false, alreadySeeded: false };

test("zero-config local development remains eligible for its one-time legacy fixture", () => {
  assert.equal(shouldSeedImplicitDevelopmentDatabase(development, localState), true);
  assert.equal(shouldSeedImplicitDevelopmentDatabase(development, { ...localState, alreadySeeded: true }), false);
});

test("explicit database or credential configuration never authorizes implicit fixture writes", () => {
  for (const url of ["file:tasks.db", "file:C:/synthetic/target.db", "libsql://synthetic.example", "https://synthetic.example", "", "   "]) {
    assert.equal(shouldSeedImplicitDevelopmentDatabase({ ...development, TASKS_DATABASE_URL: url }, localState), false);
  }
  for (const token of ["synthetic-token", "", "   "]) {
    assert.equal(shouldSeedImplicitDevelopmentDatabase({ ...development, TASKS_AUTH_TOKEN: token }, localState), false);
  }
});

test("production deployment, production access, demo and non-development runtimes never implicitly seed", () => {
  for (const NODE_ENV of ["production", "test", undefined]) {
    assert.equal(shouldSeedImplicitDevelopmentDatabase({ NODE_ENV }, localState), false);
  }
  assert.equal(shouldSeedImplicitDevelopmentDatabase({ ...development, VERCEL: "1" }, localState), false);
  assert.equal(shouldSeedImplicitDevelopmentDatabase(development, { ...localState, productionMode: true }), false);
  assert.equal(shouldSeedImplicitDevelopmentDatabase(development, { ...localState, demoMode: true }), false);
});

test("actual DB module preserves explicit data and binds demo/review to empty memory without seeding", async () => {
  const { client, cleanup } = await freshFileDb();
  try {
    await client.executeMultiple(`
      INSERT INTO users(id,name,color,initials) VALUES ('configured-user','Synthetic configured user','#444','S');
      INSERT INTO workspaces(id,slug,name,owner_user_id,context_type) VALUES ('configured-project','configured-project','Synthetic configured project','configured-user','project');
      INSERT INTO workspace_members(workspace_id,user_id,role) VALUES ('configured-project','configured-user','owner');
      INSERT INTO tasks(id,workspace_id,title,lane,priority) VALUES ('configured-task','configured-project','Synthetic configured task','todo','p2');
    `);
    const locations = await client.execute("PRAGMA database_list");
    const databasePath = String(locations.rows.find((row) => row.name === "main")?.file ?? "");
    assert.ok(databasePath);
    const environment: NodeJS.ProcessEnv = { NODE_ENV: "development" };
    for (const key of ["PATH", "Path", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "SYSTEMROOT", "SystemRoot", "TEMP", "TMP", "COMSPEC", "ComSpec"]) {
      if (process.env[key]) environment[key] = process.env[key];
    }
    Object.assign(environment, { NODE_ENV: "development", TASKS_DATABASE_URL: pathToFileURL(databasePath).href });
    const indexUrl = pathToFileURL(fileURLToPath(new URL("./index.ts", import.meta.url))).href;
    const childCode = `(async()=>{
      globalThis.fetch=()=>{throw new Error("unexpected_network_request");};
      const module=await import(${JSON.stringify(indexUrl)});
      const db=module.db??module.default?.db;
      if(!db)throw new Error("db_module_export_missing");
      try {
        await new Promise(resolve=>setImmediate(resolve));
        const locations=await db.$client.execute("PRAGMA database_list");
        const tables=await db.$client.execute("SELECT COUNT(*) count FROM sqlite_master WHERE type='table'");
        console.log(JSON.stringify({seedFlag:globalThis._seeded??null,
          databasePath:locations.rows.find(row=>row.name==='main')?.file,
          tableCount:Number(tables.rows[0].count)}));
      } finally {db.$client.close();}
    })().catch(error=>{console.error(error);process.exitCode=1;});`;
    const expectedCounts = { users: 1, workspaces: 1, members: 1, tasks: 1, comments: 0, periods: 0 };
    for (const accessMode of ["development", "production", "demo", "review"]) {
      const memoryOnly = accessMode === "demo" || accessMode === "review";
      const child = spawnSync(process.execPath, ["--import", "tsx", "--import", "./src/test/register-server-only.mjs", "--eval", childCode],
        { cwd: process.cwd(), env: { ...environment, SIGNAL_ACCESS_MODE: accessMode, NEXT_PUBLIC_SIGNAL_ACCESS_MODE: accessMode,
          ...(memoryOnly ? { TASKS_AUTH_TOKEN: "synthetic-token-must-not-reach-memory-client" } : {}) },
          encoding: "utf8", windowsHide: true, timeout: 30_000 });
      assert.equal(child.status, 0, child.stderr);
      const observed = JSON.parse(child.stdout.trim());
      assert.equal(observed.seedFlag, null, accessMode);
      assert.equal(observed.databasePath, memoryOnly ? "" : databasePath, accessMode);
      if (memoryOnly) assert.equal(observed.tableCount, 0, `${accessMode} must have an empty in-memory database`);
      else assert.ok(observed.tableCount > 0, `${accessMode} must retain the migrated configured database`);
      assert.doesNotMatch(child.stderr, /seedIfEmpty failed|incomplete_task_comment/);
      const counts = await client.execute(`SELECT
        (SELECT COUNT(*) FROM users) users,
        (SELECT COUNT(*) FROM workspaces) workspaces,
        (SELECT COUNT(*) FROM workspace_members) members,
        (SELECT COUNT(*) FROM tasks) tasks,
        (SELECT COUNT(*) FROM comments) comments,
        (SELECT COUNT(*) FROM planning_periods) periods`);
      assert.deepEqual(counts.rows[0], expectedCounts, `${accessMode} must not seed the configured target`);
      const task = await client.execute("SELECT id,workspace_id,title FROM tasks");
      assert.deepEqual(task.rows, [{ id: "configured-task", workspace_id: "configured-project", title: "Synthetic configured task" }]);
    }
  } finally { cleanup(); }
});
