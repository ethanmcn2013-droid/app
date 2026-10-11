import "server-only";
import type { ConversationSqlExecutor } from "@/server/conversations/database";
import { opLog } from "@/server/operational-log";
import type { PingExecutionResult } from "./command-service";

export const PING_DAILY_COMMAND_LIMIT = 100;
export const PING_DAILY_AFFECTED_LIMIT = 500;
export const PING_GLOBAL_STOP_KEY = "ping:admission:global";
export const pingActorStopKey = (actorId: string) => `ping:admission:actor:${actorId}`;
const safeCount = (value: unknown) => (typeof value === "number" || typeof value === "bigint") &&
  Number.isSafeInteger(Number(value)) && Number(value) >= 0;

/** Only existing canonical store controls; no cache, public setter or ambient connection. */
export async function pingDurableAdmissionAllowed(tx: ConversationSqlExecutor, actorId: string): Promise<boolean> {
  try {
    const rows = (await tx.execute({ sql: "SELECT key,value FROM meta WHERE key IN (?,?)",
      args: [PING_GLOBAL_STOP_KEY, pingActorStopKey(actorId)] })).rows;
    return rows.every(row => (row.key === PING_GLOBAL_STOP_KEY || row.key === pingActorStopKey(actorId)) &&
      row.value === "0"); // Missing is unpaused; every other present value fails closed.
  } catch { return false; }
}

/** Called within the fresh authorized writer, after replay and before any physical mutation. */
export async function admitPingCommittedAction(tx: ConversationSqlExecutor, args: {
  actorId: string; affectedCount: number; committedAtSeconds: number;
}): Promise<boolean> {
  try {
    if (!Number.isSafeInteger(args.committedAtSeconds) || args.committedAtSeconds < 0 ||
        !Number.isSafeInteger(args.affectedCount) || args.affectedCount < 1 || args.affectedCount > 10 ||
        !await pingDurableAdmissionAllowed(tx, args.actorId)) return false;
    const start = Math.floor(args.committedAtSeconds / 86400) * 86400;
    if (!Number.isSafeInteger(start + 86400)) return false;
    const row = (await tx.execute({ sql: `SELECT COUNT(*) AS commands,
      COALESCE(SUM(json_extract(receipt_json,'$.affectedCount')),0) AS affected,
      COALESCE(SUM(CASE WHEN json_type(receipt_json,'$.affectedCount')='integer'
        AND json_extract(receipt_json,'$.affectedCount') BETWEEN 1 AND 10 THEN 0 ELSE 1 END),0) AS malformed
      FROM ping_command_receipts WHERE actor_id=? AND committed_at>=? AND committed_at<?`,
    args: [args.actorId, start, start + 86400] })).rows[0];
    if (!row || !safeCount(row.commands) || !safeCount(row.affected) || !safeCount(row.malformed) ||
        Number(row.malformed) !== 0) return false;
    return Number(row.commands) < PING_DAILY_COMMAND_LIMIT &&
      Number(row.affected) + args.affectedCount <= PING_DAILY_AFFECTED_LIMIT;
  } catch { return false; }
}

/** Bounded usage only; logging failure cannot change a committed result or dispatch again. */
export function logPingCommittedUsage(result: PingExecutionResult, log: typeof opLog = opLog): void {
  try {
    if (!result.ok) {
      log("warn", "ping", "Ping action outcome", { version: "ping.operations.v1", stage: "execute", outcome: "failed" });
      return;
    }
    const { affectedCount, changedCount } = result.receipt;
    if (!Number.isSafeInteger(affectedCount) || affectedCount < 1 || affectedCount > 10 ||
        !Number.isSafeInteger(changedCount) || changedCount < 0 || changedCount > affectedCount) return;
    log("warn", "ping", "Ping action outcome", { version: "ping.operations.v1", stage: "execute",
      outcome: result.replayed ? "replayed" : "committed", affectedCount, changedCount, replayed: result.replayed });
  } catch { /* The durable result is independent of diagnostics. */ }
}
