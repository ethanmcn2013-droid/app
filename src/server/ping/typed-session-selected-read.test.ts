import assert from "node:assert/strict";
import test from "node:test";
import { createPingProofFixture, seedProofTask, PROOF_PROJECT, PROOF_NOW } from "./proof-fixture";
import { createPingTypedSession } from "./typed-session";
import { createPingCommandService } from "./command-service";
import type { PingCommand } from "@/lib/ping/command";
import type { PingTypedSnapshot } from "@/lib/ping/typed-contract";
import type { ConversationDatabaseAdapter } from "@/server/conversations/database";

const actor = { actorId: "alice", sessionId: "selected-read-test" };
const snapshot: PingTypedSnapshot = { assignees: ["bob"], due: null, dueAtSeconds: null, startDay: null, durationDays: null,
  lane: "todo", boardColumnKey: null, completedAtSeconds: null };
const prepare = (ids: string[]) => ({ version: "ping.typed.v1", action: "prepare", generationId: "selected-read",
  requestId: "00000000-0000-4000-8000-000000000001", projectId: PROOF_PROJECT, selectedTaskIds: ids,
  snapshots: Object.fromEntries(ids.map(id => [id, structuredClone(snapshot)])), text: "assign me" });

test("prepare batches selected reads but preserves canonical capture order even when SQL returns another order", async () => {
  const f = await createPingProofFixture();
  try {
    for (const id of ["first", "second", "sibling"]) await seedProofTask(f.client, id);
    await seedProofTask(f.client, "foreign", { projectId: "synthetic-foreign-project" });
    const before = (await f.client.execute("SELECT * FROM tasks ORDER BY id")).rows;
    let taskReads = 0; let capturedOrder: string[] = [];
    const adapter: ConversationDatabaseAdapter = { ...f.adapter, transaction: (mode, operation) => f.adapter.transaction(mode, tx => operation({
      execute: async statement => {
        const result = await tx.execute(statement);
        const sql = typeof statement === "string" ? statement : statement.sql;
        if (sql.includes("id IN (") && sql.includes("FROM tasks")) { taskReads++; return { ...result, rows: [...result.rows].reverse() }; }
        return result;
      },
    })) };
    const service = createPingCommandService(adapter, { now: () => PROOF_NOW });
    const session = createPingTypedSession(adapter, { now: () => PROOF_NOW, service: { ...service, execute: original => {
      const command = original.command as PingCommand;
      if (command.operation.kind === "edit_selected") capturedOrder = [...command.operation.taskIds];
      return service.execute(original);
    } } });
    await f.client.execute("UPDATE tasks SET start_day=2 WHERE id='second'");
    const request = prepare(["second", "first"]); request.snapshots.second = { ...request.snapshots.second, startDay: 2 };
    const prepared = await session.handle(actor, request);
    assert.ok(prepared.ok && prepared.action === "prepare"); assert.equal(taskReads, 1);
    const control = (action: string) => ({ version: "ping.typed.v1", action, generationId: prepared.generationId, token: prepared.token });
    const saved = await session.handle(actor, control("execute"));
    assert.ok(saved.ok && saved.action === "execute" && saved.knowledge === "committed");
    assert.deepEqual(capturedOrder, ["first", "second"], "existing capture normalization sorts IDs independently of SQL row order"); assert.equal(saved.receipt.changedCount, 2);
    const after = (await f.client.execute("SELECT * FROM tasks ORDER BY id")).rows;
    assert.deepEqual(after.filter(row => ["sibling", "foreign"].includes(String(row.id))), before.filter(row => ["sibling", "foreign"].includes(String(row.id))));
    const refreshed = await session.handle(actor, control("refresh")); assert.ok(refreshed.ok && refreshed.action === "refresh");
    assert.equal(refreshed.projection, "matches"); assert.deepEqual(refreshed.receipt, saved.receipt);
  } finally { f.client.close(); }
});

test("batched prepare rejects missing, foreign, duplicate input, stale and malformed result sets without effects", async () => {
  const f = await createPingProofFixture();
  try {
    await seedProofTask(f.client, "target"); await seedProofTask(f.client, "sibling");
    await seedProofTask(f.client, "foreign", { projectId: "synthetic-foreign-project" });
    const before = (await f.client.execute("SELECT * FROM tasks ORDER BY id")).rows;
    for (const mode of ["missing", "foreign", "duplicate-input", "stale", "duplicate-result", "unexpected-result", "unauthorized"] as const) {
      const adapter: ConversationDatabaseAdapter = { ...f.adapter, transaction: (access, operation) => f.adapter.transaction(access, tx => operation({
        execute: async statement => {
          const result = await tx.execute(statement); const sql = typeof statement === "string" ? statement : statement.sql;
          if (sql.includes("FROM tasks") && sql.includes("id IN (") && result.rows.length) {
            if (mode === "duplicate-result") return { ...result, rows: [result.rows[0], result.rows[0]] };
            if (mode === "unexpected-result") return { ...result, rows: [{ ...result.rows[0], id: "unexpected" }] };
          }
          return result;
        },
      })) };
      const ids = mode === "missing" ? ["target", "missing"] : mode === "foreign" ? ["target", "foreign"] : mode === "duplicate-input" ? ["target", "target"] : mode === "duplicate-result" ? ["target", "sibling"] : ["target"];
      const request = prepare(ids); if (mode === "stale") request.snapshots.target = { ...request.snapshots.target, assignees: ["alice"] };
      const session = createPingTypedSession(adapter, { now: () => PROOF_NOW });
      const result = await session.handle(mode === "unauthorized" ? { ...actor, actorId: "outsider" } : actor, request);
      assert.deepEqual(result, { ok: false, code: mode === "duplicate-input" ? "invalid_input" : "stale_capture" }, mode);
    }
    assert.deepEqual((await f.client.execute("SELECT * FROM tasks ORDER BY id")).rows, before);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM ping_command_receipts")).rows[0].n), 0);
    assert.equal(Number((await f.client.execute("SELECT COUNT(*) n FROM activities")).rows[0].n), 0);
  } finally { f.client.close(); }
});
