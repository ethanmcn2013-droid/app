import assert from "node:assert/strict";
import test from "node:test";
import { createCalendarFrame } from "@/lib/calendar-frame";
import { createPingProofBridge, instrumentProofAdapter, type ProofPorts } from "../../../scripts/ping/bridge/proof-runner";
import { createProofReadback } from "../../../scripts/ping/bridge/proof-readback";
import { createPingCommandService, type PingProofSeam } from "./command-service";
import { createPingProofFixture, PROOF_NOW, PROOF_PROJECT, seedProofSponsor, seedProofTask } from "./proof-fixture";

type Seed = Readonly<{
  id: string;
  assignees: string[];
  startDay: number;
  durationDays: number;
  due?: string | null;
  dueAt?: number | null;
  lane?: string;
}>;
type SetupOptions = Readonly<{
  seeds?: readonly Seed[];
  creation?: boolean;
  sponsor?: boolean;
  afterWrite?: (seam: PingProofSeam, index: number) => void | Promise<void>;
}>;

const seal = { generationId: "bridge-generation", inputItemId: "bridge-complete-input", state: "complete" as const };
const editProposal = (effects: Record<string, unknown>) => ({
  version: "ping.proposal.v1", outcome: "plan", operation: { kind: "edit_selected", effects },
});
const createProposal = { version: "ping.proposal.v1", outcome: "plan", operation: {
  kind: "create_placeholders", count: 10, title: "Synthetic placeholder", effects: {},
} };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function setup(options: SetupOptions = {}) {
  const fixture = await createPingProofFixture();
  try {
    const seeds = options.seeds ?? (options.creation ? [] : [{ id: "target-a", assignees: ["bob"], startDay: 2, durationDays: 2 }]);
    for (const seed of seeds) {
      await seedProofTask(fixture.client, seed.id, {
        assignees: seed.assignees,
        startDay: seed.startDay,
        durationDays: seed.durationDays,
        due: seed.due ?? null,
        dueAt: seed.dueAt ?? null,
        lane: seed.lane ?? "todo",
      });
    }
    const commandId = "00000000-0000-4000-8000-000000000061";
    const capture = {
      generationId: "bridge-generation", connectionEpoch: "bridge-epoch", contextKey: "bridge-context",
      sessionId: "bridge-session", actorId: "alice", inputItemId: seal.inputItemId, commandId,
      projectId: PROOF_PROJECT, selectedTaskIds: options.creation ? [] : seeds.map((seed) => seed.id),
      snapshots: options.creation ? {} : Object.fromEntries(seeds.map((seed) => [seed.id, {
        assignees: [...seed.assignees], due: seed.due ?? null, dueAtSeconds: seed.dueAt ?? null,
        startDay: seed.startDay, durationDays: seed.durationDays, lane: seed.lane ?? "todo",
        boardColumnKey: null, completedAtSeconds: null,
      }])),
      referenceInstant: "2026-10-06T09:00:00.000Z", timeZone: "Europe/Dublin", expectedColumnConfig: null,
    };
    const instrument = instrumentProofAdapter(fixture.adapter);
    const captureConfig = options.sponsor ? await seedProofSponsor(fixture.client) : undefined;
    const executor = createPingCommandService(instrument.forPhase("executor"), {
      now: () => PROOF_NOW, captureConfig, afterWrite: options.afterWrite,
    });
    const lookup = createPingCommandService(instrument.forPhase("receipt"));
    const frame = createCalendarFrame({ now: new Date(PROOF_NOW), timeZone: "Europe/Dublin", source: "review",
      planningPeriod: { id: "synthetic-period", name: "Synthetic period", startDate: "2026-10-01", endDate: "2026-10-31" } });
    const reader = createProofReadback(instrument.forPhase("readback"), frame);
    let clock = 0;
    let dropResponse = false;
    let finishReadbackLate = false;
    const ports: ProofPorts = {
      clock: () => clock,
      execute: async (original) => {
        const result = await executor.execute(original);
        if (dropResponse) throw new Error("synthetic_response_loss");
        return result;
      },
      receipt: lookup.getReceiptForCommand,
      readback: async (original, receipt) => {
        if (finishReadbackLate) clock = 10_000;
        return reader(original, receipt);
      },
    };
    const bridge = createPingProofBridge(capture, ports);
    return {
      ...fixture, seeds, capture, bridge, executor, lookup, reader, instrument, ports,
      makeBridge: (nextCapture: typeof capture) => createPingProofBridge(nextCapture, ports),
      setClock: (value: number) => { clock = value; },
      dropResponse: () => { dropResponse = true; },
      makeReadbackLate: () => { finishReadbackLate = true; },
    };
  } catch (error) {
    fixture.client.close();
    throw error;
  }
}

async function taskRows(client: Awaited<ReturnType<typeof createPingProofFixture>>["client"]) {
  const result = await client.execute(`SELECT id,workspace_id,assignees,due,due_at,lane,start_day,duration_days,completed_at
    FROM tasks ORDER BY id`);
  return result.rows.map((row) => ({
    id: String(row.id), workspace_id: String(row.workspace_id), assignees: String(row.assignees),
    due: row.due == null ? null : String(row.due), due_at: row.due_at == null ? null : Number(row.due_at),
    lane: String(row.lane), start_day: row.start_day == null ? null : Number(row.start_day),
    duration_days: row.duration_days == null ? null : Number(row.duration_days),
    completed_at: row.completed_at == null ? null : Number(row.completed_at),
  }));
}
async function literalCounts(client: Awaited<ReturnType<typeof createPingProofFixture>>["client"]) {
  const counts: Record<string, number> = {};
  for (const table of ["tasks", "activities", "ping_command_receipts", "sponsored_use_intents", "sponsored_use_subjects"] as const) {
    const result = await client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
    counts[table] = Number(result.rows[0]?.count);
  }
  return counts;
}
function stage(bridge: ReturnType<typeof createPingProofBridge>, effects: Record<string, unknown>) {
  return bridge.stageTyped(editProposal(effects), seal);
}

test("compound edit preserves collaborators and a later no-op has affected-but-unchanged receipt", async () => {
  const f = await setup({ seeds: [
    { id: "target-a", assignees: ["bob", "alice"], startDay: 2, durationDays: 2 },
    { id: "target-b", assignees: ["bob"], startDay: 4, durationDays: 3 },
  ] });
  try {
    const before = await taskRows(f.client);
    assert.deepEqual(before, [
      { id: "target-a", workspace_id: PROOF_PROJECT, assignees: '["bob","alice"]', due: null, due_at: null, lane: "todo", start_day: 2, duration_days: 2, completed_at: null },
      { id: "target-b", workspace_id: PROOF_PROJECT, assignees: '["bob"]', due: null, due_at: null, lane: "todo", start_day: 4, duration_days: 3, completed_at: null },
    ]);
    assert.ok(stage(f.bridge, { selfAssignment: "add", dueDate: "2026-10-08", statusColumnKey: "doing" }));
    assert.equal(await f.bridge.invoke(), true);
    const receipt = f.bridge.snapshot().receipt!;
    assert.equal(receipt.affectedCount, 2);
    assert.equal(receipt.changedCount, 2);
    assert.deepEqual(receipt.effects, [
      { taskId: "target-a", changedFields: ["due", "lane"] },
      { taskId: "target-b", changedFields: ["assignees", "due", "lane"] },
    ]);
    const afterCompound = await taskRows(f.client);
    assert.deepEqual(afterCompound, [
      { id: "target-a", workspace_id: PROOF_PROJECT, assignees: '["bob","alice"]', due: "2026-10-08", due_at: 1791450000, lane: "doing", start_day: 2, duration_days: 2, completed_at: null },
      { id: "target-b", workspace_id: PROOF_PROJECT, assignees: '["bob","alice"]', due: "2026-10-08", due_at: 1791450000, lane: "doing", start_day: 4, duration_days: 3, completed_at: null },
    ]);
    assert.deepEqual(await literalCounts(f.client), { tasks: 2, activities: 5, ping_command_receipts: 1, sponsored_use_intents: 0, sponsored_use_subjects: 0 });

    const noOpCapture = {
      ...f.capture, commandId: "00000000-0000-4000-8000-000000000062",
      snapshots: {
        "target-a": { assignees: ["bob", "alice"], due: "2026-10-08", dueAtSeconds: 1791450000, startDay: 2, durationDays: 2, lane: "doing", boardColumnKey: null, completedAtSeconds: null },
        "target-b": { assignees: ["bob", "alice"], due: "2026-10-08", dueAtSeconds: 1791450000, startDay: 4, durationDays: 3, lane: "doing", boardColumnKey: null, completedAtSeconds: null },
      },
    };
    const noOp = f.makeBridge(noOpCapture);
    assert.ok(stage(noOp, { selfAssignment: "add" }));
    assert.equal(await noOp.invoke(), true);
    assert.equal(noOp.snapshot().receipt?.outcome, "no_changes");
    assert.equal(noOp.snapshot().receipt?.affectedCount, 2);
    assert.equal(noOp.snapshot().receipt?.changedCount, 0);
    assert.deepEqual(noOp.snapshot().receipt?.effects, [
      { taskId: "target-a", changedFields: [] }, { taskId: "target-b", changedFields: [] },
    ]);
    assert.deepEqual(await taskRows(f.client), afterCompound);
    assert.deepEqual(await literalCounts(f.client), { tasks: 2, activities: 5, ping_command_receipts: 2, sponsored_use_intents: 0, sponsored_use_subjects: 0 });
  } finally { f.client.close(); }
});

test("response loss recovers only the original intent and a changed payload conflicts in the same database", async () => {
  const f = await setup();
  try {
    f.dropResponse();
    assert.ok(stage(f.bridge, { dueDate: "2026-10-09" }));
    assert.equal(await f.bridge.invoke(), true);
    assert.equal(f.bridge.snapshot().knowledge, "unresolved");
    assert.equal(f.bridge.snapshot().committedEffectCount, null);
    assert.deepEqual(await literalCounts(f.client), { tasks: 1, activities: 1, ping_command_receipts: 1, sponsored_use_intents: 0, sponsored_use_subjects: 0 });
    assert.deepEqual(await taskRows(f.client), [
      { id: "target-a", workspace_id: PROOF_PROJECT, assignees: '["bob"]', due: "2026-10-09", due_at: 1791536400, lane: "todo", start_day: 2, duration_days: 2, completed_at: null },
    ]);
    assert.equal(await f.bridge.recover("manual-original"), true);
    assert.equal(f.bridge.snapshot().knowledge, "committed");
    assert.equal(f.bridge.snapshot().counters.executorCalls, 1);
    assert.equal(f.bridge.snapshot().counters.authorizedReceiptCalls, 1);
    assert.equal(f.instrument.snapshot().receipt.writeAttempts, 0);

    const original = f.bridge.snapshot().original!;
    if (original.command.operation.kind !== "edit_selected") throw new Error("expected selected-task command");
    const conflicting = {
      ...original.command,
      operation: { ...original.command.operation, effects: { ...original.command.operation.effects, dueDate: "2026-10-10" } },
    };
    assert.deepEqual(await f.lookup.getReceiptForCommand({ command: conflicting, context: original.context }), {
      ok: false, reason: "request_conflict",
    });
    assert.deepEqual(await taskRows(f.client), [
      { id: "target-a", workspace_id: PROOF_PROJECT, assignees: '["bob"]', due: "2026-10-09", due_at: 1791536400, lane: "todo", start_day: 2, duration_days: 2, completed_at: null },
    ]);
    assert.equal((await literalCounts(f.client)).ping_command_receipts, 1);
  } finally { f.client.close(); }
});

test("cancel before executor latch makes zero calls; cancel after latch keeps a valid completion truthful", async () => {
  const before = await setup();
  try {
    assert.ok(stage(before.bridge, { dueDate: "2026-10-09" }));
    const initialRows = await taskRows(before.client);
    before.bridge.cancel();
    assert.equal(await before.bridge.invoke(), false);
    assert.equal(before.bridge.snapshot().knowledge, "not_invoked");
    assert.equal(before.bridge.snapshot().committedEffectCount, 0);
    assert.equal(before.bridge.snapshot().counters.executorCalls, 0);
    assert.deepEqual(await taskRows(before.client), initialRows);
    assert.deepEqual(await literalCounts(before.client), { tasks: 1, activities: 0, ping_command_receipts: 0, sponsored_use_intents: 0, sponsored_use_subjects: 0 });
  } finally { before.client.close(); }

  const reached = deferred();
  const release = deferred();
  const after = await setup({ afterWrite: async (seam) => {
    if (seam === "receipt") { reached.resolve(); await release.promise; }
  } });
  try {
    assert.ok(stage(after.bridge, { dueDate: "2026-10-09" }));
    const pending = after.bridge.invoke();
    await reached.promise;
    after.bridge.cancel();
    assert.equal(after.bridge.snapshot().knowledge, "unresolved");
    assert.equal(after.bridge.snapshot().committedEffectCount, null);
    release.resolve();
    assert.equal(await pending, true);
    assert.equal(after.bridge.snapshot().knowledge, "committed");
    assert.equal(after.bridge.snapshot().projection, "not_requested");
    assert.equal(after.bridge.snapshot().counters.executorCalls, 1);
    assert.equal(await after.bridge.invoke(), false);
    assert.deepEqual(await taskRows(after.client), [
      { id: "target-a", workspace_id: PROOF_PROJECT, assignees: '["bob"]', due: "2026-10-09", due_at: 1791536400, lane: "todo", start_day: 2, duration_days: 2, completed_at: null },
    ]);
    assert.deepEqual(await literalCounts(after.client), { tasks: 1, activities: 1, ping_command_receipts: 1, sponsored_use_intents: 0, sponsored_use_subjects: 0 });
  } finally { release.resolve(); after.client.close(); }
});

test("revoked current membership blocks recovery/readback while the historical write remains persisted", async () => {
  const f = await setup();
  try {
    f.dropResponse();
    assert.ok(stage(f.bridge, { dueDate: "2026-10-09" }));
    await f.bridge.invoke();
    const original = f.bridge.snapshot().original!;
    const historical = await f.lookup.getReceiptForCommand(original);
    assert.equal(historical.ok, true);
    if (!historical.ok || historical.state !== "committed") throw new Error("expected pre-revocation synthetic receipt");

    await f.client.execute("DELETE FROM workspace_members WHERE workspace_id=? AND user_id='alice'", [PROOF_PROJECT]);
    assert.deepEqual(await f.lookup.getReceiptForCommand(original), { ok: false, reason: "unavailable" });
    assert.deepEqual(await f.reader(original, historical.receipt), { ok: false, reason: "denied" });
    assert.equal(await f.bridge.recover("manual-after-revocation"), true);
    assert.equal(f.bridge.snapshot().knowledge, "unresolved");
    assert.equal(f.bridge.snapshot().committedEffectCount, null);
    assert.equal(f.bridge.snapshot().counters.receiptDenied, 1);
    assert.equal(f.bridge.snapshot().counters.executorCalls, 1);
    assert.deepEqual(await taskRows(f.client), [
      { id: "target-a", workspace_id: PROOF_PROJECT, assignees: '["bob"]', due: "2026-10-09", due_at: 1791536400, lane: "todo", start_day: 2, duration_days: 2, completed_at: null },
    ]);
    assert.deepEqual(await literalCounts(f.client), { tasks: 1, activities: 1, ping_command_receipts: 1, sponsored_use_intents: 0, sponsored_use_subjects: 0 });
  } finally { f.client.close(); }
});

test("post-commit projection divergence and late refresh never call the executor again", async () => {
  const f = await setup();
  try {
    assert.ok(stage(f.bridge, { selfAssignment: "add" }));
    assert.equal(await f.bridge.invoke(), true);
    await f.client.execute("UPDATE tasks SET start_day=9 WHERE id='target-a'");
    const changedByOtherWriter = await taskRows(f.client);
    assert.equal(await f.bridge.refresh(), true);
    assert.equal(f.bridge.snapshot().knowledge, "committed");
    assert.equal(f.bridge.snapshot().projection, "diverged");
    assert.equal(f.bridge.snapshot().localCompletionMs, null);

    f.makeReadbackLate();
    assert.equal(await f.bridge.refresh(), true);
    assert.equal(f.bridge.snapshot().projection, "failed");
    assert.equal(f.bridge.snapshot().localCompletionMs, null);
    assert.equal(f.bridge.snapshot().counters.executorCalls, 1);
    assert.equal(f.bridge.snapshot().counters.localReadbackAttempts, 2);
    assert.equal(await f.bridge.invoke(), false);
    assert.deepEqual(await taskRows(f.client), changedByOtherWriter);
    assert.deepEqual(await literalCounts(f.client), { tasks: 1, activities: 1, ping_command_receipts: 1, sponsored_use_intents: 0, sponsored_use_subjects: 0 });
  } finally { f.client.close(); }
});

test("enabled ten-placeholder creation fault at task six rolls every persisted effect back", async () => {
  const f = await setup({ creation: true, sponsor: true, afterWrite: (seam, index) => {
    if (seam === "task" && index === 6) throw new Error("synthetic_sixth_task_fault");
  } });
  try {
    const beforeRows = await taskRows(f.client);
    const beforeCounts = await literalCounts(f.client);
    assert.deepEqual(beforeRows, []);
    assert.deepEqual(beforeCounts, { tasks: 0, activities: 0, ping_command_receipts: 0, sponsored_use_intents: 0, sponsored_use_subjects: 0 });
    assert.ok(f.bridge.stageTyped(createProposal, seal));
    assert.equal(await f.bridge.invoke(), true);
    assert.equal(f.bridge.snapshot().knowledge, "unresolved");
    assert.equal(f.bridge.snapshot().committedEffectCount, null);
    assert.deepEqual(await taskRows(f.client), beforeRows);
    assert.deepEqual(await literalCounts(f.client), beforeCounts);
    assert.equal(await f.bridge.recover("manual-atomic-rollback"), true);
    assert.equal(f.bridge.snapshot().counters.receiptAbsent, 1);
    assert.equal(f.bridge.snapshot().knowledge, "unresolved");
    assert.equal(f.bridge.snapshot().counters.executorCalls, 1);
    assert.deepEqual(await taskRows(f.client), []);
    assert.deepEqual(await literalCounts(f.client), { tasks: 0, activities: 0, ping_command_receipts: 0, sponsored_use_intents: 0, sponsored_use_subjects: 0 });
  } finally { f.client.close(); }
});
