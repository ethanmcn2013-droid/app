import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { createLocalConversationDatabaseAdapter, type ConversationSqlExecutor } from "@/server/conversations/database";
import { createPingCommandService } from "./command-service";
import { createPingProofFixture, PROOF_NOW, PROOF_PROJECT, proofCommand, proofContext, proofCount,
  proofEditCommand, seedProofTask } from "./proof-fixture";
import { admitPingCommittedAction, logPingCommittedUsage, pingActorStopKey,
  pingDurableAdmissionAllowed, PING_GLOBAL_STOP_KEY } from "./operational-admission";

const options = { now: () => PROOF_NOW, admitNewCommand: admitPingCommittedAction };
async function history(f: Awaited<ReturnType<typeof createPingProofFixture>>, count: number, affected = 1,
  actor = "alice", seconds = PROOF_NOW / 1000) {
  for (let i = 0; i < count; i++) await f.client.execute({
    sql: "INSERT INTO ping_command_receipts VALUES(?,?,?,?,?,?)",
    args: [actor, `synthetic-prior-${actor}-${seconds}-${i}`, PROOF_PROJECT, "synthetic-prior-plan",
      JSON.stringify({ affectedCount: affected }), seconds],
  });
}
const execute = (service: ReturnType<typeof createPingCommandService>, index: number, count = 1, actor = "alice") => {
  const command = proofCommand(index, {}, count);
  return service.execute({ command, context: proofContext(command, actor) });
};

test("durable command boundary survives reconnect, actor isolation and UTC rollover; replay costs nothing", async () => {
  const f = await createPingProofFixture(); let reopened: ReturnType<typeof createClient> | undefined;
  try {
    await history(f, 99);
    const service = createPingCommandService(f.adapter, options);
    const original = await execute(service, 1000); assert.ok(original.ok && !original.replayed);
    assert.deepEqual(await execute(service, 1001), { ok: false, reason: "unavailable" });
    const prior = await execute(service, 1000); assert.ok(prior.ok && prior.replayed);
    assert.deepEqual(prior.receipt, original.receipt);
    assert.ok((await execute(service, 1002, 1, "bob")).ok);
    f.client.close(); reopened = createClient({ url: `file:${f.databasePath.replaceAll("\\", "/")}` });
    const fresh = createPingCommandService(createLocalConversationDatabaseAdapter({ client: reopened }), options);
    assert.deepEqual(await execute(fresh, 1003), { ok: false, reason: "unavailable" });
    const tomorrow = createPingCommandService(createLocalConversationDatabaseAdapter({ client: reopened }),
      { ...options, now: () => PROOF_NOW + 86400_000 });
    assert.ok((await execute(tomorrow, 1004)).ok);
  } finally { reopened?.close(); f.client.close(); }
});

test("affected-task boundary rejects the whole command and rollback consumes no budget", async () => {
  const f = await createPingProofFixture();
  try {
    await history(f, 49, 10); // 490 affected, not 490 commands.
    const fault = createPingCommandService(f.adapter, { ...options, afterWrite: () => { throw Error("private-fault"); } });
    assert.equal((await execute(fault, 1100, 10)).ok, false);
    assert.equal(await proofCount(f.client, "tasks"), 0);
    assert.equal(await proofCount(f.client, "activities"), 0);
    assert.equal(await proofCount(f.client, "ping_command_receipts"), 49);
    const service = createPingCommandService(f.adapter, options);
    assert.ok((await execute(service, 1101, 10)).ok);
    assert.deepEqual(await execute(service, 1102), { ok: false, reason: "unavailable" });
    assert.equal(await proofCount(f.client, "tasks"), 10);
    assert.equal(await proofCount(f.client, "ping_command_receipts"), 50);
  } finally { f.client.close(); }
});

test("no-change receipts consume both command and affected budgets without activity; changed replay conflicts", async () => {
  const f = await createPingProofFixture();
  try {
    await history(f, 99);
    await seedProofTask(f.client, "unchanged", { assignees: ["alice"] });
    const command = await proofEditCommand(f.client, ["unchanged"], { selfAssignment: "add" }, 1150);
    const service = createPingCommandService(f.adapter, options);
    const result = await service.execute({ command, context: proofContext(command) });
    assert.ok(result.ok); assert.equal(result.receipt.outcome, "no_changes");
    assert.equal(result.receipt.affectedCount, 1); assert.equal(result.receipt.changedCount, 0);
    assert.equal(await proofCount(f.client, "activities"), 0);
    assert.deepEqual(await execute(service, 1151), { ok: false, reason: "unavailable" });
    const changed = { ...command, operation: { ...command.operation, effects: { selfAssignment: "remove" as const } } };
    assert.deepEqual(await service.execute({ command: changed, context: proofContext(changed) }),
      { ok: false, reason: "request_conflict" });
  } finally { f.client.close(); }
});

test("global/account stops and malformed controls preserve authorized receipts and emit no mutation prefix", async () => {
  const f = await createPingProofFixture();
  try {
    const service = createPingCommandService(f.adapter, options);
    const first = await execute(service, 1200); assert.ok(first.ok);
    for (const key of [PING_GLOBAL_STOP_KEY, pingActorStopKey("alice")]) {
      for (const value of ["1", "false", "", " 0", "unknown-private"]) {
        await f.client.execute({ sql: "INSERT OR REPLACE INTO meta(key,value) VALUES(?,?)", args: [key, value] });
        assert.equal(await pingDurableAdmissionAllowed({ execute: statement => typeof statement === "string"
          ? f.client.execute(statement)
          : f.client.execute({ sql: statement.sql, args: statement.args ? [...statement.args] : undefined }) }, "alice"), false);
        assert.deepEqual(await execute(service, 1201), { ok: false, reason: "unavailable" });
        const replay = await execute(service, 1200); assert.ok(replay.ok && replay.replayed);
        assert.deepEqual(replay.receipt, first.receipt);
        assert.equal(await proofCount(f.client, "tasks"), 1);
        assert.equal(await proofCount(f.client, "activities"), 1);
        assert.equal(await proofCount(f.client, "ping_command_receipts"), 1);
      }
      await f.client.execute({ sql: "UPDATE meta SET value='0' WHERE key=?", args: [key] });
    }
    assert.ok((await execute(service, 1202)).ok);
    await f.client.execute("DELETE FROM workspace_members WHERE user_id='alice'");
    assert.deepEqual(await execute(service, 1200), { ok: false, reason: "unavailable" });
  } finally { f.client.close(); }
});

test("quota read failures and malformed history fail closed before tasks/activity/receipt writes", async () => {
  const f = await createPingProofFixture();
  try {
    const denied = createPingCommandService(f.adapter, { ...options, admitNewCommand: (tx, args) =>
      admitPingCommittedAction({ execute: async statement => {
        if ((typeof statement === "string" ? statement : statement.sql).includes("COUNT(*) AS commands"))
          throw Error("synthetic-private-query-error");
        return tx.execute(statement);
      } }, args) });
    assert.deepEqual(await execute(denied, 1300), { ok: false, reason: "unavailable" });
    assert.equal(await proofCount(f.client, "tasks"), 0);
    assert.equal(await proofCount(f.client, "ping_command_receipts"), 0);
    await history(f, 1, 1.5);
    for (const affectedCount of [1.5, -1, null, "1", undefined]) {
      await f.client.execute({ sql: "UPDATE ping_command_receipts SET receipt_json=?",
        args: [JSON.stringify(affectedCount === undefined ? {} : { affectedCount })] });
      assert.deepEqual(await execute(createPingCommandService(f.adapter, options), 1301), { ok: false, reason: "unavailable" });
    }
    const broken: ConversationSqlExecutor = { execute: async () => { throw Error("private-control-error"); } };
    assert.equal(await pingDurableAdmissionAllowed(broken, "alice"), false);
    assert.equal(await proofCount(f.client, "tasks"), 0);
    assert.equal(await proofCount(f.client, "activities"), 0);
  } finally { f.client.close(); }
});

test("independent writer contenders cannot both spend the last durable command allowance", async () => {
  const f = await createPingProofFixture(); const other = createClient({ url: `file:${f.databasePath.replaceAll("\\", "/")}` });
  try {
    await history(f, 99);
    const services = [createPingCommandService(f.adapter, options),
      createPingCommandService(createLocalConversationDatabaseAdapter({ client: other }), options)];
    const results = await Promise.all(services.map((service, i) => execute(service, 1400 + i)));
    assert.equal(results.filter(r => r.ok).length, 1);
    assert.equal(await proofCount(f.client, "ping_command_receipts"), 100);
    assert.equal(await proofCount(f.client, "tasks"), 1);
    assert.equal(await proofCount(f.client, "activities"), 1);
  } finally { other.close(); f.client.close(); }
});

test("usage logs contain only fixed labels and bounded counts; throwing diagnostics preserve the exact result", () => {
  const result = { ok: true as const, replayed: false, receipt: { version: "ping.receipt.v1" as const,
    commandId: "private-command", projectId: "private-project", committedAtSeconds: 1,
    outcome: "completed" as const, affectedCount: 2, changedCount: 1,
    effects: [{ taskId: "private-task", changedFields: ["private-field"] }] } };
  const lines: unknown[] = [];
  logPingCommittedUsage(result, (...args) => { lines.push(args); });
  assert.deepEqual(lines, [["warn", "ping", "Ping action outcome", { version: "ping.operations.v1",
    stage: "execute", outcome: "committed", affectedCount: 2, changedCount: 1, replayed: false }]]);
  assert.equal(JSON.stringify(lines).includes("private-"), false);
  const before = structuredClone(result);
  assert.doesNotThrow(() => logPingCommittedUsage(result, () => { throw Error("private-log-error"); }));
  assert.deepEqual(result, before);
});

test("real operational sink emits bounded usage without private receipt content", { concurrency: false }, () => {
  const sentinels = ["private-actor-sentinel", "private-project-sentinel", "private-command-sentinel",
    "private-hash-sentinel", "private-task-content-sentinel", "private-session-sentinel"];
  const result = { ok: true as const, replayed: false, actorId: sentinels[0], sessionKey: sentinels[5],
    receipt: { version: "ping.receipt.v1" as const, commandId: sentinels[2], projectId: sentinels[1],
      commandHash: sentinels[3], committedAtSeconds: 1, outcome: "completed" as const,
      affectedCount: 2, changedCount: 1, effects: [{ taskId: sentinels[4], changedFields: [sentinels[4]] }] } };
  const emitted: string[] = [];
  const originalWarn = console.warn;
  try {
    console.warn = (...args: unknown[]) => { emitted.push(args.map(String).join(" ")); };
    logPingCommittedUsage(result);
  } finally { console.warn = originalWarn; }
  assert.deepEqual(emitted, ["[ping] Ping action outcome version=ping.operations.v1 stage=execute outcome=committed affectedCount=2 changedCount=1 replayed=false"]);
  for (const sentinel of sentinels) assert.equal(emitted.join("\n").includes(sentinel), false);
});

test("invalid clock, malformed aggregates and malformed stop responses cannot grant admission", async () => {
  const args = { actorId: "alice", affectedCount: 1, committedAtSeconds: PROOF_NOW / 1000 };
  for (const committedAtSeconds of [-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER]) {
    assert.equal(await admitPingCommittedAction({ execute: async () => ({ rows: [] }) },
      { ...args, committedAtSeconds }), false);
  }
  for (const row of [{ commands: null, affected: 0, malformed: 0 }, { commands: "", affected: 0, malformed: 0 },
    { commands: 0, affected: -1, malformed: 0 }, { commands: 0, affected: Number.MAX_SAFE_INTEGER + 1, malformed: 0 },
    { commands: 0, affected: 0, malformed: null }]) {
    assert.equal(await admitPingCommittedAction({ execute: async statement => ({ rows:
      (typeof statement === "string" ? statement : statement.sql).includes("COUNT(*)") ? [row] : [] }) }, args), false);
  }
  assert.equal(await pingDurableAdmissionAllowed({ execute: async () => ({ rows: [{ key: PING_GLOBAL_STOP_KEY, value: null }] }) }, "alice"), false);
});
