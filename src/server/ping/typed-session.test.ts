import assert from "node:assert/strict";
import test from "node:test";
import { PING_TYPED_VERSION, type PingTypedPrepare, type PingTypedResponse } from "@/lib/ping/typed-contract";
import { createPingProofFixture, seedProofTask, PROOF_PROJECT, PROOF_NOW } from "./proof-fixture";
import { createPingCommandService } from "./command-service";
import { createPingTypedSession } from "./typed-session";
import type { ConversationDatabaseAdapter } from "@/server/conversations/database";
import { PING_VOICE_VERSION, type PingVoiceResponse } from "@/lib/ping/voice-contract";
import type { PingVoiceModelInput, PingVoiceTransport } from "@/lib/ping/voice-session";

const actor = { actorId: "alice", sessionId: "synthetic-session" };
const voicePlan = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects: { selfAssignment: "add" } } };
function scriptedVoice(interpret?: (input: PingVoiceModelInput, signal: AbortSignal) => Promise<unknown>, onCommit?: () => void, onQueued?: () => void) {
  let listener: (raw: unknown) => void = () => {}; const sent: string[] = [], inputs: PingVoiceModelInput[] = [];
  const transport: PingVoiceTransport = { subscribe: fn => { listener = fn; return () => {}; }, queuedBytes: () => { onQueued?.(); return 0; }, close: () => {},
    send: text => { sent.push(text); if (JSON.parse(text).type === "input_audio_buffer.commit") {
      onCommit?.();
      listener(JSON.stringify({ type: "input_audio_buffer.committed", item_id: "server-item", previous_item_id: null }));
      listener(JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", item_id: "server-item", content_index: 0, transcript: "assign me" }));
    } } };
  return { sent, inputs, providers: { createTransport: () => transport,
    interpret: (input: PingVoiceModelInput, signal: AbortSignal) => { inputs.push(input); return interpret ? interpret(input, signal) : Promise.resolve(voicePlan); } } };
}
function voiceBegin(n = 1) { const { projectId, selectedTaskIds, snapshots } = request(n);
  return { version: PING_VOICE_VERSION, action: "begin", requestId: requestId(n), projectId, selectedTaskIds, snapshots }; }
function voiceHandle(result: PingVoiceResponse) { assert.ok(result.ok && result.action === "begin"); return result; }
function voiceControl(handle: ReturnType<typeof voiceHandle>, action: "finish" | "status" | "cancel") {
  return { version: PING_VOICE_VERSION, action, generationId: handle.generationId, token: handle.token,
    ...(action === "finish" ? { throughFrame: 1, totalSamples: 2 } : {}) };
}
const voiceEnvelope = (handle: ReturnType<typeof voiceHandle>, ordinal = 1) => ({ version: PING_VOICE_VERSION,
  generationId: handle.generationId, token: handle.token, ordinal });
const pcm = () => new Uint8Array([0, 128, 255, 63]);
const auth = async () => actor;
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
    assert.equal(read.tasks[0].workspaceId, PROOF_PROJECT); assert.equal(read.tasks[0].dueAt, "2026-10-08T09:00:00.000Z"); assert.equal(typeof read.tasks[0].updatedAt, "string");
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
    const refreshed = await session.handle(actor, action(late, "refresh"));
    assert.ok(refreshed.ok && refreshed.action === "refresh"); assert.equal(refreshed.projection, "matches");
    assert.equal(refreshed.receipt.commandId, committed.commandId);
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

test("server Start freezes original capture, exact bytes and trusted finals execute once with canonical refresh", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    let reentrant: Promise<PingVoiceResponse> | null = null;
    const script = scriptedVoice(undefined, () => { reentrant = session.handleVoice(actor, voiceControl(handle, "finish"), auth); }); let calls = 0;
    const base = createPingCommandService(f.adapter, { now: () => PROOF_NOW });
    const session = createPingTypedSession(f.adapter, { now: () => PROOF_NOW, voice: script.providers,
      service: { ...base, execute: original => { calls++; return base.execute(original); } } });
    const begin = voiceBegin(); const handle = voiceHandle(await session.handleVoice(actor, begin, auth));
    assert.deepEqual(await session.handleVoice(actor, begin, auth), handle);
    assert.deepEqual(await session.handle(actor, request(2)), { ok: false, code: "busy" });
    assert.deepEqual(await session.handle(actor, action(handle.token, "execute", handle.generationId)), { ok: false, code: "invalid_input" });
    const uploaded = await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => pcm(), auth);
    assert.deepEqual(uploaded, { ok: true, action: "audio", generationId: handle.generationId, commandId: handle.commandId,
      projectId: PROOF_PROJECT, acceptedThrough: 1, totalSamples: 2 });
    assert.deepEqual(await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => pcm(), auth), uploaded);
    assert.deepEqual(await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => new Uint8Array([0, 0]), auth),
      { ok: false, code: "request_conflict" });
    const [done, duplicate] = await Promise.all([session.handleVoice(actor, voiceControl(handle, "finish"), auth),
      session.handleVoice(actor, voiceControl(handle, "finish"), auth)]);
    assert.deepEqual(duplicate, done); assert.ok(done.ok && "knowledge" in done && done.knowledge === "committed");
    assert.deepEqual(await reentrant, done, "reentrant duplicate joins the reserved promise and never claims zero before invocation");
    assert.equal(done.commandId, handle.commandId); assert.equal(calls, 1);
    assert.deepEqual(script.sent.map(text => JSON.parse(text)), [{ type: "input_audio_buffer.append", audio: "AID/Pw==" }, { type: "input_audio_buffer.commit" }]);
    assert.deepEqual(script.inputs, [{ version: "ping.interpretation.v1", transcript: "assign me", selectedTaskCount: 1,
      referenceInstant: new Date(PROOF_NOW).toISOString(), timeZone: "Europe/Dublin", systemColumnKeys: ["todo", "doing", "review", "done"] }]);
    assert.deepEqual((await rows(f)).map(row => [row.id, row.assignees, row.start_day, row.duration_days, row.due, row.completed_at]),
      [["target", '["bob","alice"]', 2, 3, null, null]]);
    const refreshed = await session.handle(actor, action(handle.token, "refresh", handle.generationId));
    assert.ok(refreshed.ok && refreshed.action === "refresh"); assert.equal(refreshed.projection, "matches");
    assert.equal(refreshed.tasks[0].assignees.length, 2);
    const recovered = await session.handleVoice(actor, voiceControl(handle, "status"), auth);
    assert.ok(recovered.ok && "knowledge" in recovered && recovered.knowledge === "committed"); assert.equal(calls, 1);
  } finally { f.client.close(); }
});

test("upload reservation rejects Finish overlap and cancellation prevents late body/auth from sending", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    const script = scriptedVoice(), gate = deferred();
    const session = createPingTypedSession(f.adapter, { voice: script.providers });
    const handle = voiceHandle(await session.handleVoice(actor, voiceBegin(), auth));
    const uploading = session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => { await gate.promise; return pcm(); }, auth);
    assert.deepEqual(await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => pcm(), auth), { ok: false, code: "busy" });
    assert.deepEqual(await session.handleVoice(actor, { ...voiceControl(handle, "finish"), throughFrame: 0, totalSamples: 0 }, auth),
      { ok: false, code: "invalid_input" });
    const cancelled = await session.handleVoice(actor, voiceControl(handle, "cancel"), auth);
    assert.ok(cancelled.ok && "knowledge" in cancelled && cancelled.knowledge === "not_invoked");
    assert.deepEqual(await session.handleVoice(actor, voiceBegin(2), auth), { ok: false, code: "busy" });
    gate.resolve(); assert.deepEqual(await uploading, { ok: false, code: "stale_capture" });
    assert.equal(script.sent.length, 0); assert.equal(script.inputs.length, 0);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM ping_command_receipts")).rows[0].n), 0);
    const next = voiceHandle(await session.handleVoice(actor, voiceBegin(2), auth));
    await session.handleVoice(actor, voiceControl(next, "cancel"), auth);
    assert.deepEqual(await session.handleVoice(actor, voiceBegin(), auth), { ok: false, code: "request_conflict" });
  } finally { f.client.close(); }
});

test("Cancel during fresh Finish authentication cannot revive a bound original or execute", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    const script = scriptedVoice(), entered = deferred(), release = deferred(); let calls = 0;
    const base = createPingCommandService(f.adapter);
    const session = createPingTypedSession(f.adapter, { voice: script.providers, service: { ...base,
      execute: original => { calls++; return base.execute(original); } } });
    const handle = voiceHandle(await session.handleVoice(actor, voiceBegin(), auth));
    await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => pcm(), auth);
    const finishing = session.handleVoice(actor, voiceControl(handle, "finish"), async () => { entered.resolve(); await release.promise; return actor; });
    await entered.promise;
    const cancelled = await session.handleVoice(actor, voiceControl(handle, "cancel"), auth);
    assert.ok(cancelled.ok && "knowledge" in cancelled && cancelled.knowledge === "not_invoked");
    release.resolve(); assert.deepEqual(await finishing, cancelled && { ...cancelled, action: "finish" });
    assert.equal(calls, 0); assert.equal(script.inputs.length, 1); assert.equal((await rows(f))[0].assignees, '["bob"]');
  } finally { f.client.close(); }
});

test("stale Start preimage and revoked current membership never execute a voice plan", async () => {
  for (const change of ["preimage", "revoke"] as const) {
    const f = await createPingProofFixture();
    try {
      await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
      const session = createPingTypedSession(f.adapter, { voice: scriptedVoice().providers });
      const handle = voiceHandle(await session.handleVoice(actor, voiceBegin(), auth));
      await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => pcm(), auth);
      await f.client.execute(change === "preimage" ? `UPDATE tasks SET assignees='["bob","charlie"]' WHERE id='target'` :
        "DELETE FROM workspace_members WHERE user_id='alice'");
      const done = await session.handleVoice(actor, voiceControl(handle, "finish"), auth);
      assert.ok(done.ok && "knowledge" in done && done.knowledge === (change === "preimage" ? "unresolved" : "not_invoked"));
      assert.equal((await rows(f))[0].assignees, change === "preimage" ? '["bob","charlie"]' : '["bob"]');
      assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM ping_command_receipts")).rows[0].n), 0);
    } finally { f.client.close(); }
  }
});

test("physical invocation failure is unresolved; repeated Finish/status never mint or invoke again", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 }); let calls = 0;
    const base = createPingCommandService(f.adapter);
    const session = createPingTypedSession(f.adapter, { voice: scriptedVoice().providers, service: { ...base,
      execute: async () => { calls++; throw Error("synthetic response loss"); } } });
    const handle = voiceHandle(await session.handleVoice(actor, voiceBegin(), auth));
    await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => pcm(), auth);
    const done = await session.handleVoice(actor, voiceControl(handle, "finish"), auth);
    assert.ok(done.ok && "knowledge" in done && done.knowledge === "unresolved");
    const recovered = await session.handleVoice(actor, voiceControl(handle, "finish"), auth);
    assert.ok(recovered.ok && "knowledge" in recovered && recovered.knowledge === "unresolved" && recovered.detail === "absent");
    assert.equal(recovered.commandId, handle.commandId); assert.equal(calls, 1);
    assert.deepEqual(await session.handleVoice(actor, voiceBegin(2), auth), { ok: false, code: "busy" });
  } finally { f.client.close(); }
});

test("voice unavailable by default; client finality/proposal fields cannot enter Start custody", async () => {
  const f = await createPingProofFixture();
  try {
    assert.deepEqual(await createPingTypedSession(f.adapter).handleVoice(actor, voiceBegin(), auth), { ok: false, code: "unavailable" });
    const session = createPingTypedSession(f.adapter, { voice: scriptedVoice().providers });
    assert.deepEqual(await session.handleVoice(actor, { ...voiceBegin(), proposal: voicePlan }, auth), { ok: false, code: "invalid_input" });
    assert.deepEqual(await session.handleVoice(actor, { ...voiceBegin(), generationId: "client-authority" }, auth), { ok: false, code: "invalid_input" });
    let constructions = 0; const script = scriptedVoice();
    const fresh = createPingTypedSession(f.adapter, { voice: { ...script.providers,
      createTransport: () => { constructions++; return script.providers.createTransport(); } } });
    assert.deepEqual(await fresh.handleVoice(actor, { ...voiceBegin(), selectedTaskIds: [], snapshots: {} }, async () => null),
      { ok: false, code: "unavailable" });
    assert.equal(constructions, 0); assert.equal(script.sent.length, 0);
  } finally { f.client.close(); }
});

test("pause refuses new work and permanently closes an untouched original, while re-enable permits fresh identity", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    let admitted: unknown = true, throws = false, calls = 0;
    const base = createPingCommandService(f.adapter);
    const session = createPingTypedSession(f.adapter, { isNewWorkAllowed: () => { if (throws) throw Error("private control detail"); return admitted as boolean; },
      voice: scriptedVoice().providers, service: { ...base, execute: original => { calls++; return base.execute(original); } } });
    const handle = token(await session.handle(actor, request()));
    admitted = false;
    assert.deepEqual(await session.handle(actor, action(handle, "execute")), { ok: false, code: "unavailable" });
    const cancelled = await session.handle(actor, action(handle, "cancel"));
    assert.ok(cancelled.ok && cancelled.action === "cancel" && cancelled.knowledge === "not_invoked");
    for (const value of [false, undefined, "true", 1]) {
      admitted = value;
      assert.deepEqual(await session.handle(actor, request(2)), { ok: false, code: "unavailable" });
      assert.deepEqual(await session.handleVoice(actor, voiceBegin(2), auth), { ok: false, code: "unavailable" });
    }
    throws = true; admitted = true;
    assert.deepEqual(await session.handle(actor, request(2)), { ok: false, code: "unavailable" });
    throws = false;
    assert.deepEqual(await session.handle(actor, action(handle, "execute")), { ok: false, code: "stale_capture" });
    const fresh = token(await session.handle(actor, request(2)));
    const done = await session.handle(actor, action(fresh, "execute"));
    assert.ok(done.ok && "knowledge" in done && done.knowledge === "committed"); assert.equal(calls, 1);
    assert.equal((await rows(f))[0].assignees, '["bob","alice"]');
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM ping_command_receipts")).rows[0].n), 1);
  } finally { f.client.close(); }
});

test("observed pause invalidates a still-preparing capture even if re-enabled before its READ settles", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    let allowed = true, held = false; const entered = deferred(), release = deferred();
    const adapter: ConversationDatabaseAdapter = { ...f.adapter, transaction: (mode, work) => f.adapter.transaction(mode, async tx => {
      if (!held) { held = true; entered.resolve(); await release.promise; } return work(tx);
    }) };
    const session = createPingTypedSession(adapter, { isNewWorkAllowed: () => allowed });
    const preparing = session.handle(actor, request()); await entered.promise;
    allowed = false; assert.deepEqual(await session.handle(actor, request(2)), { ok: false, code: "unavailable" });
    allowed = true; release.resolve(); assert.deepEqual(await preparing, { ok: false, code: "unavailable" });
    const fresh = token(await session.handle(actor, request(2)));
    const stopped = await session.handle(actor, action(fresh, "cancel"));
    assert.ok(stopped.ok && stopped.action === "cancel" && stopped.knowledge === "not_invoked");
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM ping_command_receipts")).rows[0].n), 0);
  } finally { f.client.close(); }
});

test("pause in reentrant queuedBytes prevents actual commit/model calls and closed voice never resumes", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    let allowed = true, queued = 0;
    const script = scriptedVoice(undefined, undefined, () => { if (++queued === 2) allowed = false; });
    const session = createPingTypedSession(f.adapter, { isNewWorkAllowed: () => allowed, voice: script.providers });
    const handle = voiceHandle(await session.handleVoice(actor, voiceBegin(), auth));
    await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => pcm(), auth);
    const done = await session.handleVoice(actor, voiceControl(handle, "finish"), auth);
    assert.ok(done.ok && "knowledge" in done && done.knowledge === "not_invoked");
    assert.deepEqual(script.sent.map(text => JSON.parse(text)), [{ type: "input_audio_buffer.append", audio: "AID/Pw==" }]);
    assert.equal(script.inputs.length, 0);
    allowed = true;
    const retry = await session.handleVoice(actor, voiceControl(handle, "finish"), auth);
    assert.ok(retry.ok && "knowledge" in retry && retry.knowledge === "not_invoked");
    assert.equal(script.sent.length, 1); assert.equal((await rows(f))[0].assignees, '["bob"]');
  } finally { f.client.close(); }
});

test("pause after Finish binding during auth retains physical guard and never invokes after re-enable", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    let allowed = true, calls = 0; const entered = deferred(), release = deferred();
    const base = createPingCommandService(f.adapter);
    const session = createPingTypedSession(f.adapter, { isNewWorkAllowed: () => allowed, voice: scriptedVoice().providers,
      service: { ...base, execute: original => { calls++; return base.execute(original); } } });
    const handle = voiceHandle(await session.handleVoice(actor, voiceBegin(), auth));
    await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => pcm(), auth);
    const finishing = session.handleVoice(actor, voiceControl(handle, "finish"), async () => { entered.resolve(); await release.promise; return actor; });
    await entered.promise; allowed = false;
    const stopped = await session.handleVoice(actor, voiceControl(handle, "status"), auth);
    assert.ok(stopped.ok && "knowledge" in stopped && stopped.knowledge === "not_invoked");
    allowed = true; assert.deepEqual(await session.handle(actor, request(2)), { ok: false, code: "busy" });
    release.resolve(); const done = await finishing;
    assert.ok(done.ok && "knowledge" in done && done.knowledge === "not_invoked"); assert.equal(calls, 0);
    assert.equal((await rows(f))[0].assignees, '["bob"]');
  } finally { f.client.close(); }
});

test("pause and invoked owner Cancel preserve pending guard, one commit and authorized canonical recovery", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    let allowed = true, calls = 0, at = PROOF_NOW; const entered = deferred(), release = deferred();
    const base = createPingCommandService(f.adapter, { now: () => PROOF_NOW });
    const session = createPingTypedSession(f.adapter, { now: () => at, isNewWorkAllowed: () => allowed,
      service: { ...base, execute: async original => { calls++; entered.resolve(); await release.promise; return base.execute(original); } } });
    const handle = token(await session.handle(actor, request()));
    const executing = session.handle(actor, action(handle, "execute")); await entered.promise; allowed = false;
    const cancelled = await session.handle(actor, action(handle, "cancel"));
    assert.ok(cancelled.ok && "knowledge" in cancelled && cancelled.knowledge === "unresolved" && cancelled.detail === "pending");
    allowed = true; assert.deepEqual(await session.handle(actor, request(2)), { ok: false, code: "busy" });
    allowed = false; release.resolve(); const done = await executing;
    assert.ok(done.ok && "knowledge" in done && done.knowledge === "committed");
    const recovered = await session.handle(actor, action(handle, "receipt"));
    assert.ok(recovered.ok && "knowledge" in recovered && recovered.knowledge === "committed");
    const current = await session.handle(actor, action(handle, "refresh"));
    assert.ok(current.ok && current.action === "refresh"); assert.equal(current.projection, "matches");
    assert.deepEqual((await rows(f)).map(row => [row.assignees, row.start_day, row.duration_days]), [['["bob","alice"]', 2, 3]]);
    assert.equal(calls, 1); assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM ping_command_receipts")).rows[0].n), 1);
    await f.client.execute("DELETE FROM workspace_members WHERE user_id='alice'"); at += 1000;
    assert.deepEqual(await session.handle(actor, action(handle, "receipt")), { ok: false, code: "unavailable" });
    assert.deepEqual(await session.handle(actor, action(handle, "refresh")), { ok: false, code: "unavailable" });
    assert.equal(calls, 1);
  } finally { f.client.close(); }
});

test("rendered pause/failure diagnostics exclude private sentinels and use fixed operational labels only", async () => {
  const f = await createPingProofFixture(), originalWarn = console.warn, rendered: string[] = [];
  console.warn = line => { rendered.push(String(line)); };
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    await f.client.execute({ sql: "UPDATE tasks SET title=? WHERE id='target'", args: ["PRIVATE-TASK-TITLE"] });
    let allowed = true; const base = createPingCommandService(f.adapter);
    const session = createPingTypedSession(f.adapter, { isNewWorkAllowed: () => allowed, service: { ...base,
      execute: async () => { throw Error("PRIVATE-TRANSCRIPT PRIVATE-TOKEN PRIVATE-AUDIO PRIVATE-ACTOR PRIVATE-PROJECT PRIVATE-HASH"); } } });
    const handle = token(await session.handle(actor, request()));
    await session.handle(actor, action(handle, "execute")); allowed = false;
    await session.handle(actor, { ...request(2), text: "PRIVATE-TRANSCRIPT" });
    assert.deepEqual(rendered, ["[ping] Ping operational outcome version=ping.operations.v1 stage=execute outcome=failed",
      "[ping] Ping operational outcome version=ping.operations.v1 stage=control outcome=paused"]);
    assert.equal(rendered.join("\n").includes("PRIVATE-"), false);
  } finally { console.warn = originalWarn; f.client.close(); }
});

test("reentrant final admission observes the already-invoked original rather than starting a second execute", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    let checks = 0, reenter = false, calls = 0, handle = "";
    let nested: Promise<PingTypedResponse> | null = null;
    const base = createPingCommandService(f.adapter);
    const session = createPingTypedSession(f.adapter, { isNewWorkAllowed: () => {
      if (reenter && ++checks === 2) { reenter = false; nested = session.handle(actor, action(handle, "execute")); } return true;
    }, service: { ...base, execute: original => { calls++; return base.execute(original); } } });
    handle = token(await session.handle(actor, request())); reenter = true;
    const result = await session.handle(actor, action(handle, "execute"));
    assert.ok(result.ok && "knowledge" in result && result.knowledge === "unresolved");
    await nested;
    assert.equal(calls, 1); assert.equal((await rows(f))[0].assignees, '["bob","alice"]');
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM ping_command_receipts")).rows[0].n), 1);
  } finally { f.client.close(); }
});

test("invoked voice owner Cancel preserves one original and paused canonical refresh after physical settlement", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target", { startDay: 2, durationDays: 3 });
    const entered = deferred(), release = deferred(); let allowed = true, calls = 0;
    const base = createPingCommandService(f.adapter);
    const session = createPingTypedSession(f.adapter, { isNewWorkAllowed: () => allowed, voice: scriptedVoice().providers,
      service: { ...base, execute: async original => { calls++; entered.resolve(); await release.promise; return base.execute(original); } } });
    const handle = voiceHandle(await session.handleVoice(actor, voiceBegin(), auth));
    await session.acceptVoiceAudio(actor, voiceEnvelope(handle), async () => pcm(), auth);
    const finishing = session.handleVoice(actor, voiceControl(handle, "finish"), auth); await entered.promise; allowed = false;
    const cancelled = await session.handleVoice(actor, voiceControl(handle, "cancel"), auth);
    assert.ok(cancelled.ok && "knowledge" in cancelled && cancelled.knowledge === "unresolved" && cancelled.detail === "pending");
    release.resolve(); const done = await finishing;
    assert.ok(done.ok && "knowledge" in done && done.knowledge === "committed");
    const refreshed = await session.handle(actor, action(handle.token, "refresh", handle.generationId));
    assert.ok(refreshed.ok && refreshed.action === "refresh"); assert.equal(refreshed.projection, "matches");
    assert.equal(refreshed.receipt.commandId, handle.commandId); assert.equal(calls, 1);
    assert.equal((await rows(f))[0].assignees, '["bob","alice"]');
  } finally { f.client.close(); }
});
