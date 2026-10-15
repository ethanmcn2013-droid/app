import "server-only";
import { normalizePingNamedAssignee, pingMemberNameKey, type PingNamedAssignee } from "@/lib/ping/command";
import type { ConversationSqlExecutor } from "@/server/conversations/database";
import { conversationWriteFencesClear } from "@/server/conversations/write-fences";

/** Current Project only, on the caller's transaction. Render-time roster fallbacks have no authority here. */
export async function resolvePingNamedAssignee(tx: ConversationSqlExecutor, projectId: string, requestedName: string): Promise<
  { ok: true; member: PingNamedAssignee } | { ok: false; code: "unsupported" | "ambiguous" | "unavailable" }
> {
  const key = pingMemberNameKey(requestedName);
  if (key === null) return { ok: false, code: "unsupported" };
  const roster = await tx.execute({ sql: `SELECT u.id,u.name,m.role FROM workspace_members m
    JOIN users u ON u.id=m.user_id WHERE m.workspace_id=?`, args: [projectId] });
  // Count identities, not matching rows, and never prefer a case-sensitive spelling over a collision.
  const matches = new Map<string, (typeof roster.rows)[number]>();
  for (const row of roster.rows) if (pingMemberNameKey(row.name) === key) matches.set(String(row.id), row);
  if (matches.size > 1) return { ok: false, code: "ambiguous" };
  const row = matches.values().next().value;
  if (!row) return { ok: false, code: "unsupported" };
  const member = normalizePingNamedAssignee({ userId: row.id, name: row.name });
  if (!member || (row.role !== "owner" && row.role !== "member")) return { ok: false, code: "unsupported" };
  if (!await conversationWriteFencesClear(tx, member.userId, projectId)) return { ok: false, code: "unavailable" };
  return { ok: true, member };
}
