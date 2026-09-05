import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

/** Execute the actual action; only identity, DB and Next cache boundaries are fixtures. */
function actionFixture(options: { demo?: boolean; failWrite?: boolean; failCache?: boolean } = {}) {
  const calls: Array<unknown> = [];
  const result = { ok: true, data: { projectId: "a", weddingDate: "2029-06-01", revision: 2, canManage: true, access: { status: "active", expiresAt: "2029-08-30T00:00:00.000Z" } } };
  const boundaries: Record<string, unknown> = {
    "next/cache": { revalidatePath: (path: string, type: string) => { calls.push(["cache", path, type]); if (options.failCache) throw Error("synthetic cache failure"); } },
    "@/lib/access-mode": { isDemoMode: () => !!options.demo },
    "@/server/auth": { getCurrentUser: async () => { calls.push("identity"); return "actual-actor"; } },
    "@/server/db": { db: "isolated-db" },
    "@/server/db/sponsored-wedding-date": { updateSponsoredWeddingDate: async (db: unknown, input: unknown) => { calls.push([db, input]); if (options.failWrite) throw Error("synthetic transaction failure"); return result; } },
  };
  const source = readFileSync(new URL("./sponsored-wedding-date.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: Record<string, (input: unknown) => Promise<unknown>> = {};
  vm.runInNewContext(code, { exports, require: (id: string) => { assert.ok(Object.hasOwn(boundaries, id), `Unexpected boundary ${id}`); return boundaries[id]; } });
  return { action: exports.saveSponsoredWeddingDate, calls, result };
}

test("date action gets the actual actor and carries only the explicit Project to the transaction", async () => {
  const f = actionFixture();
  const input = { projectId: "a", expectedRevision: 1, weddingDate: "2029-06-01", actorUserId: "forged" };
  assert.equal(await f.action(input), f.result);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls)), ["identity", ["isolated-db", { ...input, actorUserId: "actual-actor" }], ["cache", "/app", "layout"]]);
});
test("preview makes no identity, store or cache call and does not claim a saved date", async () => {
  const f = actionFixture({ demo: true });
  assert.deepEqual(JSON.parse(JSON.stringify(await f.action({}))), { ok: false, reason: "preview" });
  assert.deepEqual(f.calls, []);
});
test("a failed transaction is not reported as a successful save", async () => {
  const f = actionFixture({ failWrite: true });
  assert.deepEqual(JSON.parse(JSON.stringify(await f.action({ projectId: "a" }))), { ok: false, reason: "failed" });
  assert.equal(f.calls.length, 2);
});
test("cache failure after commit retains the confirmed durable readback", async () => {
  const f = actionFixture({ failCache: true });
  assert.equal(await f.action({ projectId: "a" }), f.result);
});
