import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { ConversationDatabaseAdapter, ConversationSqlExecutor } from "@/server/conversations/database";
import type { AssistantActionTransaction } from "./context";

/** Bind canonical conversation services to the already fenced assistant writer transaction.
 * No nested transaction, connection, global database or external delivery is opened here.
 */
export function assistantConversationAdapter(tx: AssistantActionTransaction): ConversationDatabaseAdapter {
  const executor: ConversationSqlExecutor = {
    async execute(statement) {
      const text = typeof statement === "string" ? statement : statement.sql;
      const args = typeof statement === "string" ? [] : statement.args ?? [];
      const segments = text.split("?");
      if (segments.length !== args.length + 1) throw new Error("assistant_statement_invalid");
      const pieces: SQL[] = [];
      for (let index = 0; index < segments.length; index++) {
        pieces.push(sql.raw(segments[index]));
        if (index < args.length) pieces.push(sql`${args[index]}`);
      }
      // all() executes both SELECT and mutation RETURNING on this same transaction.
      const rows = await tx.all<Record<string, unknown>>(sql.join(pieces, sql.raw("")));
      return { rows };
    },
  };
  return { available: true, boundary: "local-serialized-connection", transaction: async (_mode, operation) => operation(executor) };
}
