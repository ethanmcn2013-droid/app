import assert from "node:assert/strict";
import test from "node:test";
import { createPingTypedHttp } from "./http";
import { createPingTypedSession } from "./typed-session";
import { createPingProofFixture, PROOF_PROJECT } from "./proof-fixture";
import { PING_TYPED_VERSION } from "@/lib/ping/typed-contract";

const url = "https://isolated.invalid/api/ping";
function request(body: unknown, origin = "https://isolated.invalid", extra: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", origin, ...extra }, body: JSON.stringify(body) });
}
test("missing auth, cross-origin and malformed bodies fail before session construction", async () => {
  let construction = 0;
  const unauthenticated = createPingTypedHttp({ authenticate: async () => null, session: async () => { construction++; return null; } });
  assert.equal((await unauthenticated(request({}))).status, 401);
  const authed = createPingTypedHttp({ authenticate: async () => ({ actorId: "alice", sessionId: "synthetic-session" }),
    session: async () => { construction++; return null; } });
  assert.equal((await authed(request({}, "https://foreign.invalid"))).status, 404);
  assert.equal((await authed(request({}, "https://isolated.invalid", { "content-length": "48001" }))).status, 400);
  assert.equal((await authed(request({}, "https://isolated.invalid", { "sec-fetch-site": "cross-site" }))).status, 404);
  assert.equal(construction, 0);
});
test("actual isolated handler carries one server-captured command through execution and canonical JSON refresh", async () => {
  const fixture = await createPingProofFixture();
  try {
    const session = createPingTypedSession(fixture.adapter);
    const handle = createPingTypedHttp({ authenticate: async () => ({ actorId: "alice", sessionId: "synthetic-session" }),
      session: async () => session });
    const body = { version: PING_TYPED_VERSION, action: "prepare", generationId: "one", requestId: "00000000-0000-4000-8000-000000000001",
      projectId: PROOF_PROJECT, selectedTaskIds: [], snapshots: {}, text: "create 1 tasks" };
    const forged = await handle(request({ ...body, actorId: "owner" })); assert.equal(forged.status, 400);
    const prepared = await handle(request(body)); assert.equal(prepared.status, 200);
    const plan = await prepared.json(); assert.equal(plan.action, "prepare"); assert.equal(typeof plan.token, "string");
    assert.equal(Object.hasOwn(plan, "actorId"), false); assert.equal(Object.hasOwn(plan, "text"), false);
    const execute = await handle(request({ version: PING_TYPED_VERSION, action: "execute", generationId: "one", token: plan.token }));
    const outcome = await execute.json(); assert.equal(outcome.knowledge, "committed");
    const refresh = await handle(request({ version: PING_TYPED_VERSION, action: "refresh", generationId: "one", token: plan.token }));
    const current = await refresh.json(); assert.equal(current.projection, "matches"); assert.equal(current.tasks.length, 1);
    assert.equal(current.tasks[0].title, "Untitled task"); assert.equal(typeof current.tasks[0].updatedAt, "string");
    assert.match(refresh.headers.get("cache-control")!, /no-store/);
    assert.equal(Number((await fixture.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 1);
  } finally { fixture.client.close(); }
});
