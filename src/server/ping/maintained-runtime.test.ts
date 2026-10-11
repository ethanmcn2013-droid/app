import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createMaintainedPingRuntime, maintainedPingTarget } from "./maintained-runtime";
import { createPingProofFixture, PROOF_PROJECT, PROOF_NOW } from "./proof-fixture";
import { createPingTypedHttp } from "./http";
import { createPingReceiptHttp } from "./receipt-http";
import type { ConversationTransactionalClient } from "@/server/conversations/database";
import { PING_GLOBAL_STOP_KEY, pingActorStopKey } from "./operational-admission";

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

test("matched remote adapter refuses a prepared command when paused before invocation", async () => {
  const f = await createPingProofFixture(); const env = environment(); let writes = 0;
  const runtime = createMaintainedPingRuntime({ env: () => env, demo: () => false,
    authenticate: async () => ({ userId: "clerk_alice", sessionId: "synthetic-session" }),
    client: () => ({ transaction: async mode => {
      if (mode === "write") writes++;
      return await f.client.transaction(mode) as unknown as Awaited<ReturnType<ConversationTransactionalClient["transaction"]>>;
    } }) });
  try {
    const post = createPingTypedHttp({ authenticate: runtime.authenticate, session: runtime.session, typedOnly: () => true });
    const prepare = await (await post(request({ version: "ping.typed.v1", action: "prepare", generationId: "paused",
      requestId: "00000000-0000-4000-8000-000000000002", projectId: PROOF_PROJECT,
      selectedTaskIds: [], snapshots: {}, text: "create 1 tasks" }))).json();
    assert.equal(prepare.ok, true, JSON.stringify(prepare));
    const beforeWrites = writes;
    const beforeTasks = Number((await f.client.execute("SELECT COUNT(*) AS n FROM tasks")).rows[0].n);
    env.PING_NEW_WORK_PAUSED = "1";
    const refused = await (await post(request({ version: "ping.typed.v1", action: "execute", generationId: "paused", token: prepare.token }))).json();
    assert.equal(refused.ok, false);
    assert.equal(writes, beforeWrites, "pause blocks the executor before a write transaction");
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM tasks")).rows[0].n), beforeTasks);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 0);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM activities")).rows[0].n), 0);
  } finally { f.client.close(); }
});

test("durable account/global stop refuses Prepare and captured execution but retains authenticated original receipt", async () => {
  const f = await createPingProofFixture(); const env = environment();
  const runtime = createMaintainedPingRuntime({ env: () => env, demo: () => false,
    authenticate: async () => ({ userId: "clerk_alice", sessionId: "synthetic-session" }),
    client: () => ({ transaction: async mode => await f.client.transaction(mode) as unknown as
      Awaited<ReturnType<ConversationTransactionalClient["transaction"]>> }) });
  try {
    const post = createPingTypedHttp({ authenticate: runtime.authenticate, session: runtime.session, typedOnly: () => true });
    const prepare = (i: number) => ({ version: "ping.typed.v1", action: "prepare", generationId: "durable",
      requestId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, projectId: PROOF_PROJECT,
      selectedTaskIds: [], snapshots: {}, text: "create 1 tasks" });
    const first = await (await post(request(prepare(20)))).json(); assert.equal(first.ok, true);
    const original = await (await post(request({ version: "ping.typed.v1", action: "execute",
      generationId: "durable", token: first.token }))).json(); assert.equal(original.knowledge, "committed");
    const captured = await (await post(request(prepare(21)))).json(); assert.equal(captured.ok, true);
    await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,'1')", args: [pingActorStopKey("alice")] });
    assert.deepEqual(await (await post(request(prepare(22)))).json(), { ok: false, code: "unavailable" });
    const denied = await (await post(request({ version: "ping.typed.v1", action: "execute",
      generationId: "durable", token: captured.token }))).json();
    assert.equal(denied.knowledge, "unresolved");
    assert.deepEqual(await runtime.receipt("alice", first.commandId, PROOF_PROJECT), original.receipt);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM tasks")).rows[0].n), 1);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 1);
    await f.client.execute({ sql: "UPDATE meta SET value='0' WHERE key=?", args: [pingActorStopKey("alice")] });
    await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?,'1')", args: [PING_GLOBAL_STOP_KEY] });
    assert.deepEqual(await (await post(request(prepare(23)))).json(), { ok: false, code: "unavailable" });
    assert.deepEqual(await runtime.receipt("alice", first.commandId, PROOF_PROJECT), original.receipt);
  } finally { f.client.close(); }
});

test("maintained canonical adapter enforces both daily quotas across a fresh runtime without redispatch", async () => {
  for (const quota of [{ commands: 99, affected: 1, count: 1 }, { commands: 49, affected: 10, count: 10 }]) {
    const f = await createPingProofFixture(); const env = environment();
    const make = () => createMaintainedPingRuntime({ env: () => env, demo: () => false, now: () => PROOF_NOW,
      authenticate: async () => ({ userId: "clerk_alice", sessionId: "synthetic-session" }),
      client: () => ({ transaction: async mode => await f.client.transaction(mode) as unknown as
        Awaited<ReturnType<ConversationTransactionalClient["transaction"]>> }) });
    try {
      const now = Math.floor(PROOF_NOW / 1000);
      for (let i = 0; i < quota.commands; i++) await f.client.execute({
        sql: "INSERT INTO ping_command_receipts VALUES(?,?,?,?,?,?)", args: ["alice", `prior-${i}`, PROOF_PROJECT,
          "synthetic-prior-plan", JSON.stringify({ affectedCount: quota.affected }), now],
      });
      const first = make();
      const post = createPingTypedHttp({ authenticate: first.authenticate, session: first.session, typedOnly: () => true });
      const prepare = (i: number, count: number) => ({ version: "ping.typed.v1", action: "prepare", generationId: "quota",
        requestId: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, projectId: PROOF_PROJECT,
        selectedTaskIds: [], snapshots: {}, text: `create ${count} tasks` });
      const handle = await (await post(request(prepare(40, quota.count)))).json(); assert.equal(handle.ok, true);
      const committed = await (await post(request({ version: "ping.typed.v1", action: "execute",
        generationId: "quota", token: handle.token }))).json(); assert.equal(committed.knowledge, "committed");
      const fresh = make();
      assert.deepEqual(await fresh.receipt("alice", handle.commandId, PROOF_PROJECT), committed.receipt);
      const next = createPingTypedHttp({ authenticate: fresh.authenticate, session: fresh.session, typedOnly: () => true });
      const captured = await (await next(request(prepare(41, 1)))).json(); assert.equal(captured.ok, true);
      const denied = await (await next(request({ version: "ping.typed.v1", action: "execute",
        generationId: "quota", token: captured.token }))).json(); assert.equal(denied.knowledge, "unresolved");
      assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM tasks")).rows[0].n), quota.count);
      assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), quota.commands + 1);
    } finally { f.client.close(); }
  }
});

test("committed remote-adapter command never redispatches when paused and recovers after a fresh runtime", async () => {
  const f = await createPingProofFixture(); const env = environment(); let clients = 0, writes = 0;
  const identity = { userId: "clerk_alice", sessionId: "synthetic-session" };
  const make = () => createMaintainedPingRuntime({ env: () => env, demo: () => false, authenticate: async () => identity,
    client: () => { clients++; return { transaction: async mode => {
      if (mode === "write") writes++;
      return await f.client.transaction(mode) as unknown as Awaited<ReturnType<ConversationTransactionalClient["transaction"]>>;
    } }; } });
  try {
    const first = make(), actor = await first.authenticate(); assert.equal(actor?.actorId, "alice");
    const post = createPingTypedHttp({ authenticate: first.authenticate, session: first.session, typedOnly: () => true });
    const prepare = await (await post(request({ version: "ping.typed.v1", action: "prepare", generationId: "one",
      requestId: "00000000-0000-4000-8000-000000000001", projectId: PROOF_PROJECT,
      selectedTaskIds: [], snapshots: {}, text: "create 1 tasks" }))).json();
    assert.equal(prepare.ok, true, JSON.stringify(prepare));
    const execute = { version: "ping.typed.v1", action: "execute", generationId: "one", token: prepare.token };
    const committed = await (await post(request(execute))).json(); assert.equal(committed.knowledge, "committed");
    const committedWrites = writes;
    env.PING_NEW_WORK_PAUSED = "1";
    const replay = await (await post(request(execute))).json(); assert.deepEqual(replay.receipt, committed.receipt);
    assert.equal(writes, committedWrites, "paused replay reads the original receipt without redispatch");
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 1);
    const restarted = make(); assert.ok(await restarted.authenticate());
    const recovered = await restarted.receipt("alice", prepare.commandId, PROOF_PROJECT);
    assert.deepEqual(recovered, committed.receipt);
    assert.equal(writes, committedWrites, "fresh paused runtime recovers without another write");
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
