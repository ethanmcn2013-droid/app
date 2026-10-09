import assert from "node:assert/strict";
import test from "node:test";
import { createPingProofFixture, seedProofTask, seedProofSponsor, PROOF_NOW, PROOF_PROJECT } from "./proof-fixture";
import { createPingCommandService, type PingProofSeam } from "./command-service";
import { createPingProofBridge, instrumentProofAdapter, type ProofPorts } from "../../../scripts/ping/bridge/proof-runner";
import { createProofReadback, proofReceiptMatches } from "../../../scripts/ping/bridge/proof-readback";
import { createCalendarFrame } from "@/lib/calendar-frame";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";

const plan = (effects: Record<string, unknown> = { selfAssignment: "add", dueDate: "2026-03-29", statusColumnKey: "doing" }) =>
  ({ version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects } });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };

async function setup(options: { count?: number; creation?: boolean; sponsor?: boolean; measured?: boolean;
  afterWrite?: (seam: PingProofSeam, index: number) => void | Promise<void> } = {}) {
  const fixture = await createPingProofFixture();
  try {
    const ids = options.creation ? [] : Array.from({ length: options.count ?? 1 }, (_, index) => `target-${index + 1}`);
    for (const id of ids) await seedProofTask(fixture.client, id, { startDay: 2, durationDays: 2 });
    await seedProofTask(fixture.client, "untouched");
    await seedProofTask(fixture.client, "foreign", { projectId: "synthetic-foreign-project" });
    const capture = { generationId: "bridge-generation", connectionEpoch: "bridge-epoch", contextKey: "bridge-context",
      sessionId: "bridge-session", actorId: "alice", inputItemId: "bridge-whole-input",
      commandId: "00000000-0000-4000-8000-000000000053", projectId: PROOF_PROJECT,
      selectedTaskIds: ids, snapshots: Object.fromEntries(ids.map((id) => [id, {
        assignees: ["bob"], due: null, dueAtSeconds: null, startDay: 2, durationDays: 2,
        lane: "todo", boardColumnKey: null, completedAtSeconds: null }])),
      referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin", expectedColumnConfig: null };
    const instrument = instrumentProofAdapter(fixture.adapter);
    const captureConfig = options.sponsor ? await seedProofSponsor(fixture.client) : undefined;
    const executor = createPingCommandService(instrument.forPhase("executor"), { now: () => PROOF_NOW, captureConfig, afterWrite: options.afterWrite });
    const lookup = createPingCommandService(instrument.forPhase("receipt"));
    const frame = createCalendarFrame({ now: new Date(PROOF_NOW), timeZone: "Europe/Dublin", source: "review",
      planningPeriod: { id: "synthetic-period", name: "Synthetic period", startDate: "2026-10-01", endDate: "2026-10-31" } });
    const reader = createProofReadback(instrument.forPhase("readback"), frame);
    let now = 0, drop = false, failReadback = false;
    const ports: ProofPorts = {
      clock: () => options.measured ? Math.floor(performance.now()) : now,
      execute: async (original) => { const result = await executor.execute(original); if (drop) throw new Error("synthetic_response_loss"); return result; },
      receipt: lookup.getReceiptForCommand,
      readback: async (original, receipt) => { if (failReadback) throw new Error("synthetic_readback_failure"); return reader(original, receipt); },
    };
    const bridge = createPingProofBridge(capture, ports);
    const stage = (proposal = plan()) => bridge.stageTyped(proposal, { generationId: capture.generationId, inputItemId: capture.inputItemId, state: "complete" });
    return { ...fixture, capture, bridge, stage, executor, lookup, reader, instrument, ports,
      time: (value: number) => { now = value; }, drop: () => { drop = true; }, failReadback: () => { failReadback = true; } };
  } catch (error) { fixture.client.close(); throw error; }
}
type Fixture = Awaited<ReturnType<typeof setup>>;
async function oracle(f: Fixture) {
  // Literal store observation, outside instrumented runner transactions and measurement counts.
  const tasks = (await f.client.execute("SELECT id,workspace_id,title,assignees,lane,due,due_at,start_day,duration_days,completed_at,description,priority,tags,seq,position FROM tasks ORDER BY id")).rows;
  const counts: Record<string, number> = {};
  for (const table of ["activities", "ping_command_receipts", "sponsored_use_intents", "sponsored_use_subjects"]) {
    counts[table] = Number((await f.client.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
  }
  return { tasks, counts };
}

for (const count of [1, 10]) test(`actual ${count}-target compound commit, typed Drizzle readback and independent rows`, async (t) => {
  const f = await setup({ count, measured: true });
  try {
    await f.client.execute({ sql: "UPDATE tasks SET description='Synthetic retained detail',priority='p1',tags='[\"Synthetic tag\"]' WHERE workspace_id=?", args: [PROOF_PROJECT] });
    assert.ok(f.stage()); assert.ok(await f.bridge.invoke()); assert.ok(await f.bridge.refresh());
    const state = f.bridge.snapshot(); assert.equal(state.knowledge, "committed"); assert.equal(state.projection, "confirmed_local");
    assert.equal(state.counters.executorCalls, 1); assert.equal(state.counters.localReadbackAttempts, 1);
    assert.equal(state.receipt!.affectedCount, count); assert.equal(state.receipt!.changedCount, count);
    for (const { task, schedule } of state.rows) {
      assert.deepEqual(task.assignees, ["bob", "alice"]); assert.ok(task.dueAt instanceof Date);
      assert.equal(task.dueAt.toISOString(), "2026-03-29T09:00:00.000Z");
      assert.deepEqual(schedule, { kind: "range", startOn: "2026-03-28", dueOn: "2026-03-29" });
      assert.equal(task.description, "Synthetic retained detail"); assert.equal(task.priority, "p1"); assert.deepEqual(task.tags, ["Synthetic tag"]);
      assert.equal(task.startDay, 2); assert.equal(task.durationDays, 2); assert.equal(task.completedAt, null);
    }
    const observed = await oracle(f); assert.equal(observed.counts.activities, 3 * count); assert.equal(observed.counts.ping_command_receipts, 1);
    for (const row of observed.tasks.filter((row) => String(row.id).startsWith("target-"))) {
      assert.equal(row.assignees, '["bob","alice"]'); assert.equal(row.due, "2026-03-29"); assert.equal(row.due_at, 1774774800);
      assert.equal(row.lane, "doing"); assert.equal(row.start_day, 2); assert.equal(row.duration_days, 2); assert.equal(row.completed_at, null);
      assert.equal(row.description, "Synthetic retained detail"); assert.equal(row.priority, "p1"); assert.equal(row.tags, '["Synthetic tag"]');
    }
    for (const row of observed.tasks.filter((row) => ["foreign", "untouched"].includes(String(row.id)))) {
      assert.equal(row.lane, "todo"); assert.equal(row.due, null); assert.equal(row.assignees, '["bob"]');
    }
    assert.equal(f.instrument.snapshot().executor.writeAttempts, 1); assert.equal(f.instrument.snapshot().readback.readAttempts, 1);
    assert.equal(f.instrument.snapshot().readback.writeAttempts, 0); assert.ok(f.instrument.snapshot().readback.statements >= 4);
    assert.equal(await f.bridge.invoke(), false); assert.equal(f.bridge.snapshot().counters.executorCalls, 1);
    const instrumented = f.instrument.snapshot();
    t.diagnostic(`ping-harness-counts ${JSON.stringify({
      version: "ping-harness-counts/1",
      targets: count,
      executorCalls: state.counters.executorCalls,
      authorizedReceiptCalls: state.counters.authorizedReceiptCalls,
      localReadbackAttempts: state.counters.localReadbackAttempts,
      affectedCount: state.receipt?.affectedCount ?? null,
      changedCount: state.receipt?.changedCount ?? null,
      activityRows: observed.counts.activities,
      receiptRows: observed.counts.ping_command_receipts,
      dbPhases: {
        executor: instrumented.executor,
        receipt: instrumented.receipt,
        readback: instrumented.readback,
      },
    })}`);
    assert.ok(state.localCompletionMs !== null && state.localCompletionMs >= 0);
    t.diagnostic(`isolated fixture-open local invocation-to-projection: ${state.localCompletionMs} ms; n=1; targets=${count}; no browser/provider stages`);
  } finally { f.client.close(); }
});

for (const count of [1, 10]) test(`actual ${count} creations with enabled capture and exact local projection`, async () => {
  const f = await setup({ creation: true, sponsor: true });
  try {
    const proposal = { version: "ping.proposal.v1", outcome: "plan", operation: { kind: "create_placeholders", count, effects: { selfAssignment: "add" } } };
    assert.ok(f.bridge.stageTyped(proposal, { generationId: f.capture.generationId, inputItemId: f.capture.inputItemId, state: "complete" }));
    await f.bridge.invoke(); await f.bridge.refresh(); const state = f.bridge.snapshot();
    assert.equal(state.projection, "confirmed_local"); assert.equal(state.rows.length, count);
    for (const { task, schedule } of state.rows) { assert.equal(task.title, "Untitled task"); assert.deepEqual(task.assignees, ["alice"]); assert.deepEqual(schedule, { kind: "unscheduled" }); }
    const observed = await oracle(f); const created = observed.tasks.filter((row) => String(row.id).startsWith("ping-t-"));
    assert.equal(created.length, count); assert.deepEqual(created.map((row) => Number(row.seq)).sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i + 2));
    assert.deepEqual(created.map((row) => Number(row.position)).sort((a, b) => a - b), Array.from({ length: count }, (_, i) => i + 2));
    assert.equal(observed.counts.activities, count); assert.equal(observed.counts.ping_command_receipts, 1);
    assert.equal(observed.counts.sponsored_use_intents, count); assert.equal(observed.counts.sponsored_use_subjects, 1);
  } finally { f.client.close(); }
});

test("complete synthetic protocol descriptors actually reach the service once", async () => {
  const f = await setup();
  try {
    let time = 0;
    const event = (type: string, fields = {}) => { f.time(++time); return f.bridge.step({ type, generationId: f.capture.generationId, connectionEpoch: f.capture.connectionEpoch, ...fields }); };
    event("accept_audio", { frameOrdinal: 1, decodedBytes: 2, format: "pcm_s16le_mono_24000" });
    event("encoded_audio", { throughFrame: 1, decodedBytes: 2 }); event("finish"); event("seal_tail", { throughFrame: 1 });
    event("final", { itemId: "synthetic-item", contentIndex: 0, text: "Synthetic labelled compound" });
    assert.equal(f.bridge.snapshot().counters.interpretationDescriptors, 0); assert.equal(await f.bridge.invoke(), false);
    event("ack", { itemId: "synthetic-item", previousItemId: null });
    assert.equal(f.bridge.snapshot().counters.interpretationDescriptors, 1);
    event("interpretation", { requestId: f.capture.commandId, proposal: plan() }); event("dispatch", { currentContextKey: f.capture.contextKey });
    assert.equal(f.bridge.snapshot().counters.executorCalls, 0); await f.bridge.invoke(); await f.bridge.refresh();
    assert.equal(f.bridge.snapshot().projection, "confirmed_local"); assert.equal(f.bridge.snapshot().counters.executorCalls, 1);
    event("dispatch", { currentContextKey: f.capture.contextKey }); assert.equal(await f.bridge.invoke(), false);
    assert.equal((await oracle(f)).counts.ping_command_receipts, 1);
    event("cancel"); const cancelled = f.bridge.snapshot();
    assert.equal(cancelled.knowledge, "committed"); assert.equal(cancelled.projection, "stale");
    assert.deepEqual(cancelled.rows, []); assert.equal(cancelled.localCompletionMs, null); assert.equal(cancelled.counters.executorCalls, 1);
    const direct = createPingProofBridge(f.capture, f.ports);
    const envelope = { generationId: f.capture.generationId, connectionEpoch: f.capture.connectionEpoch };
    direct.step({ ...envelope, type: "accept_audio", frameOrdinal: 1, decodedBytes: 2, format: "pcm_s16le_mono_24000" });
    direct.step({ ...envelope, type: "encoded_audio", throughFrame: 1, decodedBytes: 2 });
    direct.step({ ...envelope, type: "reserve_commit", token: "synthetic-direct-token" });
    direct.step({ ...envelope, type: "final", itemId: "synthetic-direct-item", contentIndex: 0, text: "Synthetic cancellation text" });
    assert.equal(direct.snapshot().input.pendingText!.final, "Synthetic cancellation text");
    direct.cancel(); assert.equal(direct.snapshot().input.pendingText, null);
    assert.ok(direct.snapshot().input.segments.every((segment) => segment.final === null && segment.preview === ""));
    assert.equal(direct.snapshot().counters.executorCalls, 0);
  } finally { f.client.close(); }
});

for (const stageFirst of [false, true]) test(`cancel ${stageFirst ? "after descriptor" : "before descriptor"}, actual zero writes`, async () => {
  const f = await setup();
  try {
    const before = await oracle(f); if (stageFirst) f.stage(); f.bridge.cancel(); if (!stageFirst) assert.equal(f.stage(), false);
    assert.equal(await f.bridge.invoke(), false); assert.deepEqual(await oracle(f), before);
    const state = f.bridge.snapshot(); assert.equal(state.knowledge, "not_invoked"); assert.equal(state.committedEffectCount, 0);
    assert.equal(state.counters.dispatchDescriptors, stageFirst ? 1 : 0); assert.equal(state.counters.executorCalls, 0);
    if (stageFirst) {
      const expiring = createPingProofBridge(f.capture, f.ports);
      assert.ok(expiring.stageTyped(plan(), { generationId: f.capture.generationId, inputItemId: f.capture.inputItemId, state: "complete" }));
      f.time(10000); assert.equal(await expiring.invoke(), false); assert.equal(expiring.snapshot().counters.executorCalls, 0);
      assert.equal(expiring.snapshot().input.phase, "closed"); assert.equal(expiring.snapshot().input.pendingText, null);
      assert.deepEqual(await oracle(f), before);
    }
  } finally { f.client.close(); }
});

test("cancel after actual invocation cannot undo a pending commit", async () => {
  const reached = deferred(), release = deferred();
  const f = await setup({ afterWrite: async (seam) => { if (seam === "receipt") { reached.resolve(); await release.promise; } } });
  try {
    f.stage(); const running = f.bridge.invoke(); await reached.promise; f.bridge.cancel();
    assert.equal(f.bridge.snapshot().knowledge, "unresolved"); assert.equal(f.bridge.snapshot().committedEffectCount, null);
    release.resolve(); await running; assert.equal(f.bridge.snapshot().knowledge, "committed");
    assert.equal(await f.bridge.refresh(), false); assert.equal(f.bridge.snapshot().projection, "stale");
    assert.equal((await oracle(f)).counts.ping_command_receipts, 1); assert.equal(await f.bridge.invoke(), false);
  } finally { release.resolve(); f.client.close(); }
});

test("actual response loss, original-intent authorized recovery and no re-execute", async () => {
  const f = await setup();
  try {
    f.stage(); f.drop(); await f.bridge.invoke(); assert.equal(f.bridge.snapshot().knowledge, "unresolved");
    assert.equal(f.bridge.snapshot().committedEffectCount, null); assert.equal((await oracle(f)).counts.ping_command_receipts, 1);
    assert.ok(await f.bridge.recover("manual-one")); assert.equal(f.bridge.snapshot().knowledge, "committed");
    assert.equal(f.bridge.snapshot().counters.authorizedReceiptCalls, 1); assert.equal(f.instrument.snapshot().receipt.writeAttempts, 0);
    await f.bridge.refresh(); assert.equal(f.bridge.snapshot().projection, "confirmed_local"); assert.equal(await f.bridge.invoke(), false);
    const original = f.bridge.snapshot().original!;
    const changed = { ...original, command: { ...original.command, operation: { ...original.command.operation,
      effects: { ...original.command.operation.effects, dueDate: "2026-10-08" } } } };
    assert.deepEqual(await f.lookup.getReceiptForCommand(changed), { ok: false, reason: "request_conflict" });
    assert.deepEqual(await f.lookup.getReceiptForCommand({ ...original, context: { ...original.context, input: { ...original.context.input, state: "incomplete" } } }), { ok: false, reason: "incomplete_input" });
    assert.equal((await oracle(f)).counts.ping_command_receipts, 1);
  } finally { f.client.close(); }
});

for (const fence of ["member", "owner", "actor"] as const) test(`actual ${fence} revocation after commit denies receipt and readback`, async () => {
  const f = await setup();
  try {
    f.stage(); f.drop(); await f.bridge.invoke(); const original = f.bridge.snapshot().original!;
    const historical = await f.lookup.getReceiptForCommand(original); assert.ok(historical.ok && historical.state === "committed");
    if (fence === "member") await f.client.execute("DELETE FROM workspace_members WHERE user_id='alice'");
    else await f.client.execute({ sql: "INSERT INTO meta(key,value) VALUES(?, '{}')", args: [accountDeletionTombstoneKey(`clerk_${fence === "owner" ? "owner" : "alice"}`)] });
    assert.deepEqual(await f.lookup.getReceiptForCommand(original), { ok: false, reason: "unavailable" });
    assert.deepEqual(await f.reader(original, historical.receipt), { ok: false, reason: "denied" });
    await f.bridge.recover("manual-revoked"); assert.equal(f.bridge.snapshot().knowledge, "unresolved");
    assert.equal(f.bridge.snapshot().committedEffectCount, null); assert.equal((await oracle(f)).counts.ping_command_receipts, 1);
    assert.equal(f.bridge.snapshot().counters.executorCalls, 1);
  } finally { f.client.close(); }
});

test("confirmed commit survives readback failure and legitimate later task divergence", async () => {
  const f = await setup();
  try {
    f.stage(); await f.bridge.invoke(); f.failReadback(); await f.bridge.refresh();
    assert.equal(f.bridge.snapshot().knowledge, "committed"); assert.equal(f.bridge.snapshot().projection, "failed");
    assert.equal(f.bridge.snapshot().localCompletionMs, null); assert.equal(await f.bridge.invoke(), false);
    await f.bridge.refresh(); await f.bridge.refresh(); assert.equal(await f.bridge.refresh(), false);
    assert.equal(f.bridge.snapshot().counters.localReadbackAttempts, 3);
    const original = f.bridge.snapshot().original!, receipt = f.bridge.snapshot().receipt!;
    await f.client.execute("UPDATE tasks SET start_day=4,assignees='[\"alice\"]' WHERE id='target-1'");
    const reader = await f.reader(original, receipt); assert.ok(reader.ok); assert.equal(reader.rows[0].task.startDay, 4);
    // A second runner cannot own the first intent; inspect divergence on a fresh projection-only port in a separate test below.
    assert.equal((await oracle(f)).counts.ping_command_receipts, 1);
  } finally { f.client.close(); }
});

test("current projection divergence and stale context cannot pretend visible completion", async () => {
  const f = await setup();
  try {
    f.stage(); await f.bridge.invoke(); await f.client.execute("UPDATE tasks SET start_day=4,assignees='[\"alice\"]' WHERE id='target-1'");
    await f.bridge.refresh(); assert.equal(f.bridge.snapshot().projection, "diverged"); assert.equal(f.bridge.snapshot().knowledge, "committed");
    assert.equal(f.bridge.snapshot().localCompletionMs, null);
    await f.client.execute("UPDATE tasks SET start_day=2,assignees='[\"bob\",\"alice\"]',is_milestone=1 WHERE id='target-1'");
    await f.bridge.refresh(); assert.equal(f.bridge.snapshot().projection, "diverged");
    assert.equal(f.bridge.snapshot().knowledge, "committed"); assert.equal(f.bridge.snapshot().localCompletionMs, null);
    await f.client.execute(`UPDATE tasks SET is_milestone=0,recurrence='{"kind":"weekly","weekday":2}' WHERE id='target-1'`);
    await f.bridge.refresh(); assert.equal(f.bridge.snapshot().projection, "diverged");
    assert.equal(f.bridge.snapshot().knowledge, "committed"); assert.equal(f.bridge.snapshot().counters.localReadbackAttempts, 3);
    f.bridge.changeContext("different-project-context");
    assert.equal(await f.bridge.refresh(), false); assert.equal(f.bridge.snapshot().projection, "stale");
    assert.equal(f.bridge.snapshot().counters.executorCalls, 1);
  } finally { f.client.close(); }
});

for (const seam of ["task", "activity", "capture", "receipt"] as const) test(`real six-insert ${seam} fault rolls back all enabled effects`, async () => {
  const f = await setup({ creation: true, sponsor: true, afterWrite: (at, index) => { if (at === seam && index === (seam === "receipt" ? 10 : 6)) throw new Error("synthetic_fault"); } });
  try {
    const before = await oracle(f);
    assert.ok(f.bridge.stageTyped({ version: "ping.proposal.v1", outcome: "plan", operation: { kind: "create_placeholders", count: 10, effects: {} } },
      { generationId: f.capture.generationId, inputItemId: f.capture.inputItemId, state: "complete" }));
    await f.bridge.invoke(); assert.deepEqual(await oracle(f), before); assert.equal(f.bridge.snapshot().knowledge, "unresolved");
    assert.equal(f.bridge.snapshot().committedEffectCount, null); await f.bridge.recover("manual-absent");
    assert.equal(f.bridge.snapshot().counters.receiptAbsent, 1); assert.equal(f.bridge.snapshot().knowledge, "unresolved");
    f.time(500); await f.bridge.recover("manual-absent"); f.time(2000); await f.bridge.recover("manual-absent");
    assert.equal(f.bridge.snapshot().counters.authorizedReceiptCalls, 3); assert.equal(await f.bridge.recover("manual-absent"), false);
    f.time(10000); assert.equal(await f.bridge.recover("manual-absent"), false); assert.ok(await f.bridge.recover("manual-new"));
    assert.equal(f.bridge.snapshot().counters.executorCalls, 1); assert.equal(await f.bridge.invoke(), false);
  } finally { f.client.close(); }
});

test("malformed receipt identity/count cannot confirm or disclose readback", async () => {
  const f = await setup();
  try {
    f.stage(); await f.bridge.invoke(); const state = f.bridge.snapshot();
    for (const invalid of [{ ...state.receipt, changedCount: 0 }, { ...state.receipt, commandId: "wrong" },
      { ...state.receipt, effects: [state.receipt!.effects[0], state.receipt!.effects[0]] }]) {
      assert.equal(proofReceiptMatches(invalid, state.original!), false);
      assert.deepEqual(await f.reader(state.original!, invalid), { ok: false, reason: "invalid_receipt" });
    }
    assert.equal(f.bridge.step({ type: "receipt", result: "committed" }), false);
    assert.equal(f.bridge.snapshot().counters.executorCalls, 1);
  } finally { f.client.close(); }
});

test("real Drizzle JSON/timestamp/aggregate decode and configured completion stamp", async () => {
  const f = await setup();
  try {
    await f.client.execute("INSERT INTO task_discussion_state(task_id,workspace_id,next_create_seq,next_change_seq) VALUES('target-1','synthetic-ping-project',2,2)");
    await f.client.execute(`INSERT INTO comments(id,workspace_id,task_id,user_id,body,client_request_id,request_hash,revision,create_seq)
      VALUES('synthetic-comment','synthetic-ping-project','target-1','bob','Synthetic comment','synthetic-comment-request','synthetic-hash',1,1)`);
    await seedProofTask(f.client, "child-done", { lane: "done" }); await seedProofTask(f.client, "child-todo");
    await f.client.execute("UPDATE tasks SET parent_task_id='target-1' WHERE id IN ('child-done','child-todo')");
    assert.ok(f.stage(plan({ statusColumnKey: "done" }))); await f.bridge.invoke(); await f.bridge.refresh();
    const state = f.bridge.snapshot(); assert.equal(state.projection, "confirmed_local");
    assert.equal(state.rows[0].task.comments, 1); assert.equal(state.rows[0].task.subtaskCount, 2); assert.equal(state.rows[0].task.subtaskDone, 1);
    assert.deepEqual(state.rows[0].task.assignees, ["bob"]); assert.equal(state.rows[0].task.dueAt, undefined);
    assert.equal(state.rows[0].task.completedAt?.toISOString(), "2026-10-06T09:00:00.000Z");
    assert.deepEqual(state.rows[0].schedule, { kind: "range", startOn: "2026-10-03", dueOn: "2026-10-04" });
    const row = (await oracle(f)).tasks.find((row) => row.id === "target-1")!;
    assert.equal(row.lane, "done"); assert.equal(row.completed_at, 1791277200); assert.equal(row.assignees, '["bob"]');
  } finally { f.client.close(); }
});

test("due clearing preserves independent period range and literal dependent fields", async () => {
  const f = await setup();
  try {
    await f.client.execute("UPDATE tasks SET due='2026-10-25',due_at=1792918800 WHERE id='target-1'");
    const captured = { ...f.capture, snapshots: { "target-1": { ...f.capture.snapshots["target-1"], due: "2026-10-25", dueAtSeconds: 1792918800 } } };
    const bridge = createPingProofBridge(captured, f.ports);
    assert.ok(bridge.stageTyped(plan({ dueDate: null }), { generationId: captured.generationId, inputItemId: captured.inputItemId, state: "complete" }));
    await bridge.invoke(); await bridge.refresh(); const state = bridge.snapshot(); assert.equal(state.projection, "confirmed_local");
    assert.deepEqual(state.rows[0].schedule, { kind: "range", startOn: "2026-10-03", dueOn: "2026-10-04" });
    const row = (await oracle(f)).tasks.find((row) => row.id === "target-1")!;
    assert.equal(row.due, null); assert.equal(row.due_at, null); assert.equal(row.start_day, 2); assert.equal(row.duration_days, 2);
  } finally { f.client.close(); }
});

test("affected2 changed1 preserves collaborators; committed no-op still has receipt", async () => {
  const f = await setup({ count: 2 });
  try {
    await f.client.execute("UPDATE tasks SET assignees='[\"bob\",\"alice\"]' WHERE id='target-1'");
    const capture = { ...f.capture, snapshots: { ...f.capture.snapshots, "target-1": { ...f.capture.snapshots["target-1"], assignees: ["bob", "alice"] } } };
    const bridge = createPingProofBridge(capture, f.ports);
    const seal = { generationId: capture.generationId, inputItemId: capture.inputItemId, state: "complete" };
    assert.ok(bridge.stageTyped(plan({ selfAssignment: "add" }), seal)); await bridge.invoke(); await bridge.refresh();
    assert.equal(bridge.snapshot().projection, "confirmed_local"); assert.equal(bridge.snapshot().receipt!.affectedCount, 2);
    assert.equal(bridge.snapshot().receipt!.changedCount, 1); assert.equal((await oracle(f)).counts.activities, 1);
    const noOpCapture = { ...capture, commandId: "00000000-0000-4000-8000-000000000054",
      snapshots: { "target-1": { ...capture.snapshots["target-1"] }, "target-2": { ...f.capture.snapshots["target-2"], assignees: ["bob", "alice"] } } };
    const noOp = createPingProofBridge(noOpCapture, f.ports); assert.ok(noOp.stageTyped(plan({ selfAssignment: "add" }), seal));
    await noOp.invoke(); await noOp.refresh(); assert.equal(noOp.snapshot().receipt!.outcome, "no_changes");
    assert.equal(noOp.snapshot().projection, "confirmed_local"); assert.equal(noOp.snapshot().committedEffectCount, 0);
    assert.equal((await oracle(f)).counts.ping_command_receipts, 2); assert.equal((await oracle(f)).counts.activities, 1);
  } finally { f.client.close(); }
});

test("actual receipt absence before delayed write then eventual original-ID commit", async () => {
  const f = await setup(), reached = deferred(), release = deferred();
  try {
    const delayed = createPingCommandService({ ...f.adapter, async transaction(mode, operation) {
      if (mode === "write") { reached.resolve(); await release.promise; }
      return f.adapter.transaction(mode, operation);
    } }, { now: () => PROOF_NOW });
    const bridge = createPingProofBridge(f.capture, { ...f.ports, execute: delayed.execute });
    assert.ok(bridge.stageTyped(plan(), { generationId: f.capture.generationId, inputItemId: f.capture.inputItemId, state: "complete" }));
    const pending = bridge.invoke(); await reached.promise;
    assert.ok(await bridge.recover("manual-pending")); assert.equal(bridge.snapshot().counters.receiptAbsent, 1);
    assert.equal(bridge.snapshot().knowledge, "unresolved"); assert.equal((await oracle(f)).counts.ping_command_receipts, 0);
    release.resolve(); await pending; assert.equal(bridge.snapshot().knowledge, "committed");
    assert.equal((await oracle(f)).counts.ping_command_receipts, 1); assert.equal(bridge.snapshot().counters.executorCalls, 1);
  } finally { release.resolve(); f.client.close(); }
});

test("late authorized lookup is counted but cannot confirm its expired window", async () => {
  const f = await setup(), reached = deferred(), release = deferred();
  try {
    const bridge = createPingProofBridge(f.capture, { ...f.ports,
      execute: async (original) => { await f.executor.execute(original); throw new Error("synthetic_loss"); },
      receipt: async (original) => { const result = await f.lookup.getReceiptForCommand(original); reached.resolve(); await release.promise; return result; } });
    assert.ok(bridge.stageTyped(plan(), { generationId: f.capture.generationId, inputItemId: f.capture.inputItemId, state: "complete" }));
    await bridge.invoke(); const pending = bridge.recover("window-one"); await reached.promise;
    f.time(10000); assert.equal(await bridge.recover("window-two"), false); // No overlap even when an old port has not settled.
    release.resolve(); assert.equal(await pending, false); assert.equal(bridge.snapshot().knowledge, "unresolved");
    assert.equal(bridge.snapshot().counters.authorizedReceiptCalls, 1); assert.equal(bridge.snapshot().counters.receiptFailed, 1);
    assert.equal(await bridge.recover("window-one"), false); assert.ok(await bridge.recover("window-two"));
    assert.equal(bridge.snapshot().knowledge, "committed"); assert.equal(bridge.snapshot().counters.executorCalls, 1);
  } finally { release.resolve(); f.client.close(); }
});

test("stale context during actual readback suppresses current-view hydration", async () => {
  const f = await setup(), reached = deferred(), release = deferred();
  try {
    const bridge = createPingProofBridge(f.capture, { ...f.ports, readback: async (original, receipt) => {
      const result = await f.reader(original, receipt); reached.resolve(); await release.promise; return result;
    } });
    assert.ok(bridge.stageTyped(plan(), { generationId: f.capture.generationId, inputItemId: f.capture.inputItemId, state: "complete" }));
    await bridge.invoke(); const pending = bridge.refresh(); await reached.promise;
    bridge.changeContext("other-project-context"); release.resolve(); await pending;
    assert.equal(bridge.snapshot().knowledge, "committed"); assert.equal(bridge.snapshot().projection, "stale");
    assert.deepEqual(bridge.snapshot().rows, []); assert.equal(bridge.snapshot().localCompletionMs, null);
  } finally { release.resolve(); f.client.close(); }
});
