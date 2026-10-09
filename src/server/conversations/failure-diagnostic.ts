import { randomUUID } from "node:crypto";

const codes = new Set(["SQLITE_BUSY", "SQLITE_BUSY_SNAPSHOT", "SQLITE_LOCKED", "HRANA_PROTO_ERROR", "HRANA_CLOSED_ERROR", "HRANA_WEBSOCKET_ERROR", "SERVER_ERROR", "TRANSACTION_CLOSED", "CLIENT_CLOSED", "SQLITE_CONSTRAINT", "SQLITE_CONSTRAINT_UNIQUE"]);
export function conversationFailureCode(error: unknown): string {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    const value = current as { code?: unknown; cause?: unknown };
    if (typeof value.code === "string") return codes.has(value.code) ? value.code : "unknown";
    current = value.cause;
  }
  return "unknown";
}
export type ConversationFailureDiagnostic = Readonly<{
  correlationId: string;
  operation: "promotion" | "http";
  code: string;
  outcome: "retry" | "recovered" | "unresolved";
  attempt: number;
}>;
/** No error objects, request keys, actor identities or source content reach logs. */
export function reportConversationFailure(diagnostic: ConversationFailureDiagnostic) {
  try { console.warn("conversation_operation_failure", diagnostic); } catch { /* Diagnostics never decide the operation outcome. */ }
}
export const newConversationCorrelation = randomUUID;
