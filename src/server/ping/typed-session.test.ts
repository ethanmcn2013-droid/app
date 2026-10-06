import assert from "node:assert/strict";
import test from "node:test";
import { PING_TYPED_VERSION, type PingTypedPrepare, type PingTypedResponse } from "@/lib/ping/typed-contract";
import { createPingProofFixture, seedProofTask, PROOF_PROJECT, PROOF_NOW } from "./proof-fixture";
import { createPingCommandService } from "./command-service";
import { createPingTypedSession } from "./typed-session";
import type { ConversationDatabaseAdapter } from "@/server/conversations/database";

const actor = { actorId: "alice", sessionId: "synthetic-session" };
const requestId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function request(n = 1, text = "assign me"): PingTypedPrepare {
  return { version: PING_TYPED_VERSION, action: "prepare", generationId: "generation-one", requestId: requestId(n),
    projectId: PROOF_PROJECT, selectedTaskIds: ["target"], text, snapshots: { target: {
      assignees: ["bob"], due: null, dueAtSeconds: null, startDay: 2, durationDays: 3,
      lane: "todo", boardColumnKey: null, completedAtSeconds: null,
    } } };
}
function token(result: PingTypedResponse): string {
  assert.ok(result.ok && result.action === "prepare"); return result.token;
}
const action = (token: string, action: "execute" | "cancel" | "receipt" | "refresh", generationId = "generation-one") =>
  ({ version: PING_TYPED_VERSION, action, generationId, token });
async function rows(f: Awaited<ReturnType<typeof createPingProofFixture>>) {
  return (await f.client.execute("SELECT id,assignees,due,due_at,lane,start_day,duration_days,completed_at FROM tasks ORDER BY id")).rows;
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

test("actual typed compound execution, idempotent token and canonical status-aware readback", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { assignees: ["bob"], startDay: 2, durationDays: 3 });
    let calls = 0; const base = createPingCommandService(f.adapter, { now: () => PROOF_NOW });
    const groups: string[][] = [];
    const traced: ConversationDatabaseAdapter = { ...f.adapter, transaction: (mode, work) => f.adapter.transaction(mode, async tx => {
      const group: string[] = []; groups.push(group);
      return work({ execute: statement => { group.push(typeof statement === "string" ? statement : statement.sql); return tx.execute(statement); } });
    }) };
    const session = createPingTypedSession(traced, { now: () => PROOF_NOW, service: { ...base, execute: original => { calls++; return base.execute(original); } } });
    const input = { ...request(1, "assign me and due 2026-10-08 and status doing"), requestId: "abcdef00-0000-4000-8000-000000000001" };
    const prepared = await session.handle(actor, input), handle = token(prepared);
    assert.deepEqual(await session.handle(actor, input), prepared);
    assert.deepEqual(await session.handle(actor, { ...input, requestId: input.requestId.toUpperCase() }), prepared);
    assert.deepEqual(await session.handle(actor, { ...input, text: "clear due" }), { ok: false, code: "request_conflict" });
    const done = await session.handle(actor, action(handle, "execute"));
    assert.ok(done.ok && done.action === "execute" && done.knowledge === "committed");
    assert.equal(done.receipt.changedCount, 1); assert.equal(done.receipt.affectedCount, 1);
    const replay = await session.handle(actor, action(handle, "execute"));
    assert.ok(replay.ok && replay.action === "execute" && replay.knowledge === "committed");
    assert.equal(calls, 1);
    assert.deepEqual(await session.handle(actor, { ...input, requestId: input.requestId.toUpperCase() }), prepared);
    assert.deepEqual((await rows(f)).map(row => ({ id: row.id, assignees: row.assignees, due: row.due, dueAt: Number(row.due_at),
      lane: row.lane, start: Number(row.start_day), duration: Number(row.duration_days), completed: row.completed_at })),
    [{ id: "target", assignees: '["bob","alice"]', due: "2026-10-08", dueAt: 1791450000, lane: "doing", start: 2, duration: 3, completed: null }]);
    const read = await session.handle(actor, action(handle, "refresh"));
    assert.ok(read.ok && read.action === "refresh"); assert.equal(read.projection, "matches");
    assert.equal(read.tasks[0].dueAt, "2026-10-08T09:00:00.000Z"); assert.equal(typeof read.tasks[0].updatedAt, "string");
    assert.ok(groups.some(group => group.some(sql => sql.includes("FROM workspace_members")) && group.some(sql => sql.includes('"comment_count"'))),
      "canonical task select and current scope authorization share the same read transaction");
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 1);
  } finally { f.client.close(); }
});

test("forged identity, changed session/generation, stale preimage and foreign selection fail without writes", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    const session = createPingTypedSession(f.adapter, { now: () => PROOF_NOW });
    assert.deepEqual(await session.handle(actor, { ...request(), actorId: "owner" }), { ok: false, code: "invalid_input" });
    assert.deepEqual(await session.handle(actor, { ...request(), snapshots: { target: { ...request().snapshots.target, startDay: 9 } } }),
      { ok: false, code: "stale_capture" });
    const prepared = await session.handle(actor, request()), handle = token(prepared);
    assert.deepEqual(await session.handle({ ...actor, sessionId: "other-session" }, action(handle, "execute")), { ok: false, code: "unavailable" });
    assert.deepEqual(await session.handle(actor, action(handle, "execute", "changed-generation")), { ok: false, code: "stale_capture" });
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 0);
    const foreign = createPingTypedSession(f.adapter, { now: () => PROOF_NOW });
    assert.deepEqual(await foreign.handle(actor, { ...request(), projectId: "synthetic-foreign-project" }), { ok: false, code: "stale_capture" });
    assert.equal((await rows(f))[0].assignees, '["bob"]');
  } finally { f.client.close(); }
});

test("lost response retains original identity; absence is unknown and recovery never executes again", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    let calls = 0; const base = createPingCommandService(f.adapter, { now: () => PROOF_NOW });
    const session = createPingTypedSession(f.adapter, { now: () => PROOF_NOW, service: { ...base, execute: async original => {
      calls++; await base.execute(original); throw new Error("synthetic_response_loss");
    } } });
    const handle = token(await session.handle(actor, request()));
    const lost = await session.handle(actor, action(handle, "execute"));
    assert.ok(lost.ok && lost.action === "execute" && lost.knowledge === "unresolved");
    const recovered = await session.handle(actor, action(handle, "receipt"));
    assert.ok(recovered.ok && recovered.action === "receipt" && recovered.knowledge === "committed");
    assert.equal(recovered.commandId, lost.commandId); assert.equal(calls, 1);
    const failing = createPingTypedSession(f.adapter, { now: () => PROOF_NOW, service: { ...base,
      execute: async () => ({ ok: false, reason: "temporarily_unavailable" }) } });
    const untouched = { ...request(2), text: "clear due", snapshots: { target: { ...request().snapshots.target, assignees: ["bob", "alice"] } } };
    const next = token(await failing.handle(actor, untouched)); await failing.handle(actor, action(next, "execute"));
    const absent = await failing.handle(actor, action(next, "receipt"));
    assert.ok(absent.ok && absent.action === "receipt" && absent.knowledge === "unresolved" && absent.detail === "absent");
    assert.deepEqual(await failing.handle(actor, { ...untouched, requestId: requestId(3) }), { ok: false, code: "busy" });
  } finally { f.client.close(); }
});

test("cancel before latch is untouched; cancel during invocation stays unknown then retains historical commit", async () => {
  const f = await createPingProofFixture(); const entered = deferred(), release = deferred();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    let calls = 0; const base = createPingCommandService(f.adapter, { now: () => PROOF_NOW });
    const session = createPingTypedSession(f.adapter, { now: () => PROOF_NOW, service: { ...base, execute: async original => {
      calls++; entered.resolve(); await release.promise; return base.execute(original);
    } } });
    const early = token(await session.handle(actor, request()));
    const cancelled = await session.handle(actor, action(early, "cancel"));
    assert.ok(cancelled.ok && cancelled.action === "cancel" && cancelled.knowledge === "not_invoked");
    assert.deepEqual(await session.handle(actor, action(early, "execute")), { ok: false, code: "stale_capture" }); assert.equal(calls, 0);
    const late = token(await session.handle(actor, request(2))); const pending = session.handle(actor, action(late, "execute"));
    assert.deepEqual(await session.handle(actor, request(1)), { ok: false, code: "request_conflict" });
    await entered.promise;
    const unknown = await session.handle(actor, action(late, "cancel"));
    assert.ok(unknown.ok && unknown.action === "cancel" && unknown.knowledge === "unresolved");
    assert.deepEqual(await session.handle(actor, request(3)), { ok: false, code: "busy" });
    release.resolve(); const committed = await pending;
    assert.ok(committed.ok && committed.action === "execute" && committed.knowledge === "committed"); assert.equal(calls, 1);
    assert.deepEqual(await session.handle(actor, action(late, "refresh")), { ok: false, code: "busy" });
    assert.equal((await rows(f))[0].assignees, '["bob","alice"]');
  } finally { release.resolve(); f.client.close(); }
});

test("fresh refresh scope refuses revocation and preserves literal historical state", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    const session = createPingTypedSession(f.adapter, { now: () => PROOF_NOW });
    const handle = token(await session.handle(actor, request())); await session.handle(actor, action(handle, "execute"));
    await f.client.execute("DELETE FROM workspace_members WHERE user_id='alice'");
    assert.deepEqual(await session.handle(actor, action(handle, "refresh")), { ok: false, code: "unavailable" });
    assert.deepEqual(await session.handle(actor, action(handle, "receipt")), { ok: false, code: "unavailable" });
    assert.equal((await rows(f))[0].assignees, '["bob","alice"]');
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 1);
  } finally { f.client.close(); }
});

test("ordinary untouched completion stamp is preserved; later relevant divergence is explicit", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3, completedAt: 123 });
    const session = createPingTypedSession(f.adapter, { now: () => PROOF_NOW });
    const input = request(1, "status doing");
    const handle = token(await session.handle(actor, { ...input, snapshots: { target: { ...input.snapshots.target, completedAtSeconds: 123 } } }));
    await session.handle(actor, action(handle, "execute")); const read = await session.handle(actor, action(handle, "refresh"));
    assert.ok(read.ok && read.action === "refresh"); assert.equal(read.projection, "matches");
    assert.equal(read.tasks[0].completedAt, "1970-01-01T00:02:03.000Z");
    await f.client.execute("UPDATE tasks SET start_day=9 WHERE id='target'");
    const diverged = await session.handle(actor, action(handle, "refresh"));
    assert.ok(diverged.ok && diverged.action === "refresh"); assert.equal(diverged.projection, "diverged");
  } finally { f.client.close(); }
});

test("explicit resolved retirement permits more than 32 commands but never reuses retired request identity", async () => {
  const f = await createPingProofFixture();
  try {
    const session = createPingTypedSession(f.adapter, { now: () => PROOF_NOW });
    const make = (n: number): PingTypedPrepare => ({ ...request(n, "create 1 tasks"),
      requestId: n === 1 ? "abcdef00-0000-4000-8000-000000000001" : requestId(n), selectedTaskIds: [], snapshots: {} });
    for (let n = 1; n <= 33; n++) {
      const handle = token(await session.handle(actor, make(n)));
      const done = await session.handle(actor, action(handle, "execute"));
      assert.ok(done.ok && done.action === "execute" && done.knowledge === "committed");
    }
    assert.deepEqual(await session.handle(actor, make(1)), { ok: false, code: "request_conflict" });
    assert.deepEqual(await session.handle(actor, { ...make(1), requestId: make(1).requestId.toUpperCase() }), { ok: false, code: "request_conflict" });
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM tasks")).rows[0].n), 33);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 33);
  } finally { f.client.close(); }
});
