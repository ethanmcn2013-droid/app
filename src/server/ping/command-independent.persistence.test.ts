import assert from "node:assert/strict";
import test from "node:test";
import { createPingCommandService } from "./command-service";
import { createPingProofFixture, PROOF_NOW, PROOF_PROJECT, proofCommand, proofContext,
  proofCount, seedProofTask } from "./proof-fixture";

test("unrelated Project member and non-member cannot create in the captured Project scope", async () => {
  const fixture = await createPingProofFixture();
  try {
    const service = createPingCommandService(fixture.adapter, { now: () => PROOF_NOW });
    const inOtherProject = { ...proofCommand(801), projectId: "synthetic-foreign-project" };
    const unjoinedResult = await service.execute({ command: inOtherProject, context: proofContext(inOtherProject, "alice") });
    assert.deepEqual(unjoinedResult, { ok: false, reason: "unavailable" });

    const nonMemberCommand = proofCommand(802);
    const nonMemberResult = await service.execute({ command: nonMemberCommand, context: proofContext(nonMemberCommand, "outsider") });
    assert.deepEqual(nonMemberResult, { ok: false, reason: "unavailable" });

    assert.equal(await proofCount(fixture.client, "tasks"), 0);
    assert.equal(await proofCount(fixture.client, "activities"), 0);
    assert.equal(await proofCount(fixture.client, "ping_command_receipts"), 0);
  } finally { fixture.client.close(); }
});

test("add-self reports affected separately from changed and preserves exact collaborators on a no-op target", async () => {
  const fixture = await createPingProofFixture();
  try {
    await seedProofTask(fixture.client, "already-assigned", { assignees: ["alice", "bob"] });
    await seedProofTask(fixture.client, "needs-assignment", { assignees: ["bob"] });
    const command = {
      version: "ping.command.v1" as const,
      commandId: "10000000-0000-4000-8000-000000000803",
      projectId: PROOF_PROJECT,
      referenceInstant: new Date(PROOF_NOW).toISOString(),
      timeZone: "Europe/Dublin" as const,
      expectedColumnConfig: null,
      operation: {
        kind: "edit_selected" as const,
        taskIds: ["already-assigned", "needs-assignment"],
        effects: { selfAssignment: "add" as const },
        expected: {
          "already-assigned": { assignees: ["alice", "bob"] },
          "needs-assignment": { assignees: ["bob"] },
        },
      },
    };
    const result = await createPingCommandService(fixture.adapter, { now: () => PROOF_NOW })
      .execute({ command, context: proofContext(command) });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.receipt.outcome, "completed");
    assert.equal(result.receipt.affectedCount, 2);
    assert.equal(result.receipt.changedCount, 1);
    const rows = (await fixture.client.execute("SELECT id, assignees FROM tasks ORDER BY id")).rows;
    assert.deepEqual(rows.map(row => ({ id: row.id, assignees: row.assignees })), [
      { id: "already-assigned", assignees: '["alice","bob"]' },
      { id: "needs-assignment", assignees: '["bob","alice"]' },
    ]);
    assert.equal(await proofCount(fixture.client, "activities"), 1);
    assert.equal(await proofCount(fixture.client, "ping_command_receipts"), 1);
  } finally { fixture.client.close(); }
});
