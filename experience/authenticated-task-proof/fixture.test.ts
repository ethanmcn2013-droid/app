import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { seedFiveStoreFixture, validateProofInput, type ProofInput } from "./fixture";
function input(): ProofInput {
  const suffix = randomUUID();
  return { version: 1, runtimeGrant: { sourceSha: "a".repeat(40), sourceTree: "b".repeat(40), buildId: "fixture-only", expiresAt: new Date(Date.now() + 60000).toISOString(), operations: ["seed", "sign-in", "read", "create", "title", "restart", "cleanup"] },
    origin: "http://127.0.0.1:3188", storeRoot: resolve(`D:/Codex-scratch/release-all-20261013/02b-source/unit-five-stores-${suffix}`), evidenceRoot: resolve(`D:/Codex-scratch/release-all-20261013/02b-source/unit-evidence-${suffix}`), issuer: "https://fixture.clerk.accounts.dev", clerkOrigins: ["https://fixture.clerk.accounts.dev", "https://api.clerk.com"], testEmailCodeEligible: false,
    accounts: [{ subject: "user_fixtureA", email: "a@example.invalid", projectId: "fixture_a", planningPeriodId: "period_a", controlProjectId: "control_a", controlTaskId: "control_task_a", siblingTaskId: "sibling_a" }, { subject: "user_fixtureB", email: "b@example.invalid", projectId: "fixture_b", planningPeriodId: "period_b", controlProjectId: "control_b", controlTaskId: "control_task_b", siblingTaskId: "sibling_b" }] };
}
test("fixture admission fails closed before store creation", async () => {
  const config = input(); config.runtimeGrant.expiresAt = "2000-01-01T00:00:00Z";
  assert.throws(() => validateProofInput(config));
  await assert.rejects(seedFiveStoreFixture(config)); assert.equal(existsSync(config.storeRoot), false);
});
test("synthetic five-store fixture has disjoint memberships and ordinary catalog selects primary Project", async () => {
  const config = input();
  try {
    // The native SQLite package retains file handles after client.close on
    // Windows; process exit, followed by parent cleanup, is the reliable fence.
    const code = `const assert = require('node:assert/strict'); const {createClient}=require('@libsql/client'); const {drizzle}=require('drizzle-orm/libsql'); const schema=require('./src/server/db/schema.ts'); const {firstMembershipByCatalogOrder}=require('./src/server/projects/catalog.ts'); const {seedFiveStoreFixture}=require('./experience/authenticated-task-proof/fixture.ts');
      (async()=> { const config=${JSON.stringify(config)}; const urls=await seedFiveStoreFixture(config); assert.equal(new Set(Object.values(urls)).size,5);
      for(const [module,url] of Object.entries(urls)){ const client=createClient({url}); const tables=(await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows;
      if(module==='ENTITLEMENTS_DATABASE_URL') assert.equal(tables.length,0); else assert(tables.length>0);
      if(module==='TASKS_DATABASE_URL'){ const rows=(await client.execute('SELECT user_id,workspace_id,role FROM workspace_members ORDER BY user_id,workspace_id')).rows; assert.deepEqual(rows.map(row=>[row.user_id,row.workspace_id,row.role]),[['user_fixtureA','control_a','owner'],['user_fixtureA','fixture_a','owner'],['user_fixtureB','control_b','owner'],['user_fixtureB','fixture_b','owner']]); assert.equal((await client.execute('SELECT count(*) n FROM planning_periods')).rows[0].n,2); assert.equal((await client.execute('SELECT count(*) n FROM tasks')).rows[0].n,4);
      const database=drizzle(client,{schema}); for(const account of config.accounts) assert.equal(await firstMembershipByCatalogOrder(database,account.subject),account.projectId);
      await client.execute('UPDATE workspaces SET position=1000'); for(const account of config.accounts) assert.equal(await firstMembershipByCatalogOrder(database,account.subject),account.controlProjectId); } client.close(); }
      await assert.rejects(seedFiveStoreFixture(config),/unoccupied/); })().catch(()=>{process.exitCode=1;});`;
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./src/test/register-server-only.mjs", "--eval", code], { timeout: 30000, stdio: "pipe" });
  } finally { assert(config.storeRoot.startsWith(resolve("D:/Codex-scratch/release-all-20261013/02b-source"))); rmSync(config.storeRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
});
