/**
 * Opt-in provider probe. Run only against a designated empty/isolated remote
 * Tasks test database; it creates synthetic probe tables, never App tables.
 * No dotenv loader, ambient fallback, URL/token printing or production mode.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { createRemoteConversationDatabaseAdapter } from "../../src/server/conversations/database";
import { resolveConversationRuntimeTarget } from "../../src/server/conversations/runtime-target";

async function main() {
  const args = new Map(process.argv.slice(2).map((arg) => {
    const separator = arg.indexOf("=");
    return separator > 2 ? [arg.slice(0, separator), arg.slice(separator + 1)] : [arg, ""];
  }));
  const target = resolveConversationRuntimeTarget(process.env, false);
  if (target.mode !== "remote" || process.env.NODE_ENV === "production" || process.env.VERCEL === "1" ||
      !target.target.startsWith("isolated-") || args.get("--target") !== target.target ||
      args.get("--expect-url-sha256") !== process.env.SIGNAL_CONVERSATION_REMOTE_URL_SHA256 ||
      !args.has("--confirm-isolated-write")) throw new Error("isolated_remote_probe_not_authorized");

  const first = createClient({ url: target.url, authToken: target.authToken });
  const second = createClient({ url: target.url, authToken: target.authToken });
  const runId = `probe_${randomUUID().replaceAll("-", "")}`;
  const adapter = createRemoteConversationDatabaseAdapter({ client: {
    transaction: async (mode) => {
      const tx = await first.transaction(mode);
      return {
        execute: (statement) => tx.execute(typeof statement === "string" ? statement : { sql: statement.sql, args: [...(statement.args ?? [])] }),
        commit: () => tx.commit(),
        rollback: () => tx.rollback(),
      };
    },
  } });
  try {
    await first.execute(`CREATE TABLE IF NOT EXISTS conversation_remote_probe_members
      (run_id TEXT PRIMARY KEY, active INTEGER NOT NULL CHECK(active IN (0,1)))`);
    await first.execute(`CREATE TABLE IF NOT EXISTS conversation_remote_probe_receipts
      (run_id TEXT NOT NULL, request_id TEXT NOT NULL, body TEXT NOT NULL,
       PRIMARY KEY(run_id,request_id))`);
    await first.execute({ sql: "INSERT INTO conversation_remote_probe_members(run_id,active) VALUES (?,1)", args: [runId] });

    const submit = (requestId: string) => adapter.transaction("write", async (executor) => {
      const member = await executor.execute({ sql: "SELECT active FROM conversation_remote_probe_members WHERE run_id=?", args: [runId] });
      if (member.rows[0]?.active !== 1) return "denied";
      await executor.execute({ sql: "INSERT OR IGNORE INTO conversation_remote_probe_receipts(run_id,request_id,body) VALUES (?,?,?)", args: [runId, requestId, "synthetic"] });
      return "accepted";
    });
    assert.equal(await submit("first"), "accepted");
    const visible = await second.execute({ sql: "SELECT COUNT(*) AS count FROM conversation_remote_probe_receipts WHERE run_id=?", args: [runId] });
    assert.equal(Number(visible.rows[0]?.count), 1, "second client sees committed receipt");
    assert.equal(await submit("first"), "accepted");
    const duplicate = await second.execute({ sql: "SELECT COUNT(*) AS count FROM conversation_remote_probe_receipts WHERE run_id=?", args: [runId] });
    assert.equal(Number(duplicate.rows[0]?.count), 1, "duplicate request has one effect");

    await assert.rejects(adapter.transaction("write", async (executor) => {
      await executor.execute({ sql: "INSERT INTO conversation_remote_probe_receipts(run_id,request_id,body) VALUES (?,?,?)", args: [runId, "rolled-back", "synthetic"] });
      throw new Error("synthetic_failure_before_commit");
    }), /synthetic_failure_before_commit/);
    const rolledBack = await second.execute({ sql: "SELECT COUNT(*) AS count FROM conversation_remote_probe_receipts WHERE run_id=? AND request_id='rolled-back'", args: [runId] });
    assert.equal(Number(rolledBack.rows[0]?.count), 0, "uncommitted source is absent");

    await second.execute({ sql: "UPDATE conversation_remote_probe_members SET active=0 WHERE run_id=?", args: [runId] });
    assert.equal(await submit("after-revoke"), "denied");
    const afterRevoke = await second.execute({ sql: "SELECT COUNT(*) AS count FROM conversation_remote_probe_receipts WHERE run_id=?", args: [runId] });
    assert.equal(Number(afterRevoke.rows[0]?.count), 1, "revoked actor created no source");
    process.stdout.write(JSON.stringify({ target: target.target, result: "pass", clients: 2,
      committed: 1, duplicateEffects: 0, rolledBackEffects: 0, postRevokeEffects: 0 }) + "\n");
  } finally {
    await first.execute({ sql: "DELETE FROM conversation_remote_probe_receipts WHERE run_id=?", args: [runId] }).catch(() => undefined);
    await first.execute({ sql: "DELETE FROM conversation_remote_probe_members WHERE run_id=?", args: [runId] }).catch(() => undefined);
    first.close();
    second.close();
  }
}

void main().catch(() => {
  process.stderr.write("isolated_remote_probe_failed; inspect the designated test target without printing credentials\n");
  process.exitCode = 1;
});
