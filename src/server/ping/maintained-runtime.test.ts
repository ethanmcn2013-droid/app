import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createMaintainedPingRuntime, maintainedPingTarget } from "./maintained-runtime";
import { createPingProofFixture, PROOF_PROJECT } from "./proof-fixture";
import { createPingTypedHttp } from "./http";
import { createPingReceiptHttp } from "./receipt-http";
import type { ConversationTransactionalClient } from "@/server/conversations/database";

const url = "libsql://synthetic.invalid", origin = "https://synthetic.invalid";
function environment(): Record<string, string | undefined> { return { PING_MAINTAINED_TYPED_ENABLED: "1",
  PING_MAINTAINED_TYPED_TARGET: "synthetic-tasks", PING_MAINTAINED_TYPED_URL_SHA256: createHash("sha256").update(url).digest("hex"),
  TASKS_DATABASE_URL: url, TASKS_AUTH_TOKEN: "synthetic-token", CLERK_SECRET_KEY: "synthetic", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "synthetic" }; }
function request(value: unknown) { return new Request(`${origin}/api/ping`, { method: "POST",
  headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value) }); }

test("default off/demo/invalid target and missing session never construct a client", async () => {
  let clients = 0, authCalls = 0; const env = environment();
  const runtime = createMaintainedPingRuntime({ env: () => env, demo: () => false,
    authenticate: async () => { authCalls++; return { userId: "clerk_alice", sessionId: null }; },
    client: () => { clients++; throw Error("must not construct"); } });
  delete env.PING_MAINTAINED_TYPED_ENABLED;
  assert.equal(await runtime.authenticate(), null); assert.equal(await runtime.session(), null); assert.equal(authCalls, 0);
  env.PING_MAINTAINED_TYPED_ENABLED = "1";
  assert.equal(maintainedPingTarget(env, true), null);
  for (const value of ["file:tasks.db", "libsql://other.invalid", "https://synthetic.invalid", "libsql://user:secret@synthetic.invalid"]) {
    env.TASKS_DATABASE_URL = value; assert.equal(await runtime.authenticate(), null);
  }
  env.TASKS_DATABASE_URL = url;
  assert.equal(await runtime.authenticate(), null); assert.equal(clients, 0); assert.equal(authCalls, 1);
});

test("ambiguous Clerk mapping is rejected and changed session identity is not inferred", async () => {
  const env = environment(); let identity = { userId: "clerk_synthetic", sessionId: "synthetic-session" };
  const runtime = createMaintainedPingRuntime({ env: () => env, demo: () => false, authenticate: async () => identity,
    client: () => ({ transaction: async () => ({ execute: async () => ({ rows: [{ id: "alice" }, { id: "bob" }] }),
      commit: async () => {}, rollback: async () => {} }) }) });
  assert.equal(await runtime.authenticate(), null);
  identity = { userId: "clerk_synthetic", sessionId: "" }; assert.equal(await runtime.authenticate(), null);
});

test("real isolated interactive transactions execute once and recover after a fresh runtime with current authority", async () => {
  const f = await createPingProofFixture(); const env = environment(); let clients = 0;
  const identity = { userId: "clerk_alice", sessionId: "synthetic-session" };
  const make = () => createMaintainedPingRuntime({ env: () => env, demo: () => false, authenticate: async () => identity,
    client: () => { clients++; return f.client as unknown as ConversationTransactionalClient; } });
  try {
    const first = make(), actor = await first.authenticate(); assert.equal(actor?.actorId, "alice");
    const post = createPingTypedHttp({ authenticate: first.authenticate, session: first.session, typedOnly: () => true });
    const prepare = await (await post(request({ version: "ping.typed.v1", action: "prepare", generationId: "one",
      requestId: "00000000-0000-4000-8000-000000000001", projectId: PROOF_PROJECT,
      selectedTaskIds: [], snapshots: {}, text: "create 1 tasks" }))).json();
    assert.equal(prepare.ok, true, JSON.stringify(prepare));
    const execute = { version: "ping.typed.v1", action: "execute", generationId: "one", token: prepare.token };
    const committed = await (await post(request(execute))).json(); assert.equal(committed.knowledge, "committed");
    const replay = await (await post(request(execute))).json(); assert.deepEqual(replay.receipt, committed.receipt);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 1);
    const restarted = make(); assert.ok(await restarted.authenticate());
    const recovered = await restarted.receipt("alice", prepare.commandId, PROOF_PROJECT);
    assert.deepEqual(recovered, committed.receipt);
    assert.equal(await restarted.receipt("alice", prepare.commandId, "synthetic-foreign-project"), null);
    assert.equal(await restarted.receipt("bob", prepare.commandId, PROOF_PROJECT), null);
    await f.client.execute("DELETE FROM workspace_members WHERE user_id='alice'");
    assert.equal(await restarted.receipt("alice", prepare.commandId, PROOF_PROJECT), null);
    const count = clients; env.TASKS_AUTH_TOKEN = "different-synthetic-token";
    assert.equal(await first.authenticate(), null); assert.equal(await first.session(), null); assert.equal(clients, count);
    assert.equal(await first.receipt("alice", prepare.commandId, PROOF_PROJECT), null);
    env.TASKS_AUTH_TOKEN = "synthetic-token"; env.CLERK_SECRET_KEY = "changed-synthetic-clerk";
    assert.equal(await first.session(), null); assert.equal(clients, count);
  } finally { f.client.close(); }
});

test("maintained voice body is rejected before session and receipt endpoint accepts only bounded identity lookup", async () => {
  let sessions = 0, lookups = 0;
  const authenticate = async () => ({ actorId: "alice", sessionId: "synthetic-session" });
  const post = createPingTypedHttp({ authenticate, typedOnly: () => true, session: async () => { sessions++; return null; } });
  assert.equal((await post(request({ version: "ping.voice.v1", action: "begin" }))).status, 400); assert.equal(sessions, 0);
  const recover = createPingReceiptHttp({ authenticate, receipt: async () => { lookups++; return null; } });
  const value = { version: "ping.receipt.lookup.v1", commandId: "00000000-0000-4000-8000-000000000001", projectId: PROOF_PROJECT };
  assert.equal((await recover(request({ ...value, actorId: "owner" }))).status, 400);
  assert.equal((await recover(request({ ...value, transcript: "private" }))).status, 400);
  assert.equal((await recover(request(value))).status, 404); assert.equal(lookups, 1);
  assert.equal((await recover(request({ ...value, filler: "x".repeat(1024) }))).status, 400); assert.equal(lookups, 1);
});

test("stalled receipt body is cancelled at the existing ten-second boundary before lookup", async () => {
  let cancelled = false, lookups = 0;
  const recover = createPingReceiptHttp({ authenticate: async () => ({ actorId: "alice", sessionId: "synthetic" }),
    receipt: async () => { lookups++; return null; } });
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const req = new Request(`${origin}/api/ping/receipt`, { method: "POST", headers: { origin, "content-type": "APPLICATION/JSON" }, body,
    duplex: "half" } as RequestInit);
  assert.equal((await recover(req)).status, 400); assert.equal(cancelled, true); assert.equal(lookups, 0);
});
