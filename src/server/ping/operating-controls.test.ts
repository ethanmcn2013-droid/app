import "server-only";
import assert from "node:assert/strict";
import test from "node:test";
import { PING_TYPED_VERSION, type PingTypedPrepare, type PingTypedResponse } from "@/lib/ping/typed-contract";
import { createPingProofFixture, seedProofTask, PROOF_PROJECT, PROOF_NOW } from "./proof-fixture";
import { createPingCommandService } from "./command-service";
import { createPingTypedSession } from "./typed-session";

const actor = { actorId: "alice", sessionId: "synthetic-session" };
const requestId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function prepare(n: number): PingTypedPrepare {
  return { version: PING_TYPED_VERSION, action: "prepare", generationId: "generation-one", requestId: requestId(n),
    projectId: PROOF_PROJECT, selectedTaskIds: ["target"], text: "assign me", snapshots: { target: {
      assignees: ["bob"], due: null, dueAtSeconds: null, startDay: 2, durationDays: 3,
      lane: "todo", boardColumnKey: null, completedAtSeconds: null,
    } } };
}
function token(response: PingTypedResponse): string {
  assert.ok(response.ok && response.action === "prepare");
  return response.token;
}
const control = (token: string, action: "execute" | "cancel" | "receipt" | "refresh") =>
  ({ version: PING_TYPED_VERSION, action, generationId: "generation-one", token });
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("pausing new work preserves an invoked original through settlement, receipt, and canonical refresh", async () => {
  const fixture = await createPingProofFixture();
  try {
    await seedProofTask(fixture.client, "target", { assignees: ["bob"], startDay: 2, durationDays: 3 });
    const started = deferred();
    const release = deferred();
    let allowed = true;
    let invocations = 0;
    const base = createPingCommandService(fixture.adapter, { now: () => PROOF_NOW });
    const service = { ...base, execute: async (original: Parameters<typeof base.execute>[0]) => {
      invocations++;
      started.resolve();
      await release.promise;
      return base.execute(original);
    } };
    const session = createPingTypedSession(fixture.adapter, {
      now: () => PROOF_NOW,
      service,
      isNewWorkAllowed: () => allowed,
    });

    const originalToken = token(await session.handle(actor, prepare(1)));
    const physicalExecution = session.handle(actor, control(originalToken, "execute"));
    await started.promise;

    allowed = false;
    assert.deepEqual(await session.handle(actor, prepare(2)), { ok: false, code: "unavailable" });
    const whilePhysicalCallIsHeld = await session.handle(actor, control(originalToken, "cancel"));
    assert.ok(whilePhysicalCallIsHeld.ok && whilePhysicalCallIsHeld.action === "cancel");
    assert.equal(whilePhysicalCallIsHeld.knowledge, "unresolved");
    assert.equal(whilePhysicalCallIsHeld.detail, "pending");
    assert.equal(invocations, 1);
    assert.equal(Number((await fixture.client.execute("SELECT COUNT(*) AS n FROM ping_command_receipts")).rows[0].n), 0);

    release.resolve();
    const settled = await physicalExecution;
    assert.ok(settled.ok && settled.action === "execute" && settled.knowledge === "committed");
    assert.equal(settled.receipt.affectedCount, 1);
    assert.equal(settled.receipt.changedCount, 1);
    assert.equal(invocations, 1);

    const recovered = await session.handle(actor, control(originalToken, "receipt"));
    assert.ok(recovered.ok && recovered.action === "receipt" && recovered.knowledge === "committed");
    assert.equal(recovered.receipt.commandId, settled.receipt.commandId);
    assert.equal(recovered.receipt.projectId, PROOF_PROJECT);
    assert.equal(recovered.receipt.affectedCount, 1);
    assert.equal(recovered.receipt.changedCount, 1);

    const refreshed = await session.handle(actor, control(originalToken, "refresh"));
    assert.ok(refreshed.ok && refreshed.action === "refresh");
    assert.equal(refreshed.projection, "matches");
    assert.equal(refreshed.receipt.commandId, settled.receipt.commandId);
    assert.equal(refreshed.tasks.length, 1);
    assert.equal(refreshed.tasks[0].id, "target");
    assert.deepEqual(refreshed.tasks[0].assignees, ["bob", "alice"]);

    const stored = await fixture.client.execute("SELECT actor_id,command_id,project_id FROM ping_command_receipts");
    assert.deepEqual(stored.rows.map((row) => ({ actor: row.actor_id, command: row.command_id, project: row.project_id })),
      [{ actor: "alice", command: settled.receipt.commandId, project: PROOF_PROJECT }]);
    const target = await fixture.client.execute("SELECT assignees,due,due_at,lane,start_day,duration_days,completed_at FROM tasks WHERE id='target'");
    assert.deepEqual(target.rows.map((row) => ({ assignees: row.assignees, due: row.due, dueAt: row.due_at,
      lane: row.lane, start: row.start_day, duration: row.duration_days, completed: row.completed_at })),
    [{ assignees: '["bob","alice"]', due: null, dueAt: null, lane: "todo", start: 2, duration: 3, completed: null }]);
    assert.equal(Number((await fixture.client.execute("SELECT COUNT(*) AS n FROM activities WHERE task_id='target'")).rows[0].n), 1);
    assert.equal(invocations, 1, "pause and recovery must not replay the original executor call");
  } finally {
    fixture.client.close();
  }
});
