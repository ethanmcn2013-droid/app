import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteConversationDatabaseAdapter, type ConversationTransaction } from "./database";
import { createConversationService } from "./service";

test("remote adapter keeps authorization and write on one interactive handle, then commits", async () => {
  const trace: string[] = [];
  const transaction: ConversationTransaction = {
    async execute(statement) {
      trace.push(typeof statement === "string" ? statement : statement.sql);
      return { rows: [] };
    },
    async commit() { trace.push("COMMIT"); },
    async rollback() { trace.push("ROLLBACK"); },
  };
  const adapter = createRemoteConversationDatabaseAdapter({ client: {
    async transaction(mode) { trace.push(`BEGIN ${mode}`); return transaction; },
  } });
  assert.equal(adapter.boundary, "remote-interactive-transaction");
  const result = await adapter.transaction("write", async (executor) => {
    await executor.execute({ sql: "SELECT exact_membership WHERE actor=?", args: ["actor"] });
    await executor.execute({ sql: "INSERT source AND receipt", args: [] });
    return "accepted";
  });
  assert.equal(result, "accepted");
  assert.deepEqual(trace, ["BEGIN write", "SELECT exact_membership WHERE actor=?", "INSERT source AND receipt", "COMMIT"]);
});

test("remote adapter rolls back after an authorization/write failure and never returns a receipt", async () => {
  const trace: string[] = [];
  const adapter = createRemoteConversationDatabaseAdapter({ client: {
    async transaction() {
      return {
        async execute(statement) { trace.push(typeof statement === "string" ? statement : statement.sql); return { rows: [] }; },
        async commit() { trace.push("COMMIT"); },
        async rollback() { trace.push("ROLLBACK"); },
      };
    },
  } });
  await assert.rejects(adapter.transaction("write", async (executor) => {
    await executor.execute("SELECT exact_membership");
    throw new Error("revoked");
  }), /revoked/);
  assert.deepEqual(trace, ["SELECT exact_membership", "ROLLBACK"]);
  assert.equal(createRemoteConversationDatabaseAdapter({ client: {} as never }).available, false);
});

test("remote actor resolution uses a fresh parameterized single read and preserves transient/unexpected failures", async () => {
  const statements: unknown[] = [];
  let id: string | null = "mapped_actor";
  let failure: Error | undefined;
  let transactions = 0;
  const adapter = createRemoteConversationDatabaseAdapter({ client: {
    async execute(statement) {
      statements.push(statement);
      if (failure) throw failure;
      return { rows: id ? [{ id }] : [] };
    },
    async transaction() { transactions++; throw Error("unexpected_transaction"); },
  } });
  const service = createConversationService(adapter);
  assert.equal(await service.resolveActor("clerk_subject"), "mapped_actor");
  id = null; assert.equal(await service.resolveActor("clerk_subject"), null);
  failure = Object.assign(Error("locked"), { code: "SQLITE_BUSY" });
  assert.equal(await service.resolveActor("clerk_subject"), null);
  failure = Error("unexpected_provider_failure");
  await assert.rejects(service.resolveActor("clerk_subject"), /unexpected_provider_failure/);
  assert.equal(await service.resolveActor("x"), null);
  assert.equal(transactions, 0); assert.equal(statements.length, 4);
  for (const statement of statements) assert.deepEqual(statement, { sql: "SELECT id FROM users WHERE clerk_id = ? LIMIT 1", args: ["clerk_subject"] });
  assert.equal(await createConversationService({ ...adapter, available: false }).resolveActor("clerk_subject"), null);
  assert.equal(statements.length, 4);
});
