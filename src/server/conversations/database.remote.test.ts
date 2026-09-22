import assert from "node:assert/strict";
import test from "node:test";
import { createRemoteConversationDatabaseAdapter, type ConversationTransaction } from "./database";

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
