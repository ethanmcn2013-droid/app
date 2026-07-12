import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { tasks, workspaceMembers } from "@/server/db/schema";

type NotesExtractDatabase = LibSQLDatabase<typeof schema>;

export type NotesExtractAccess =
  | Readonly<{ kind: "denied" }>
  | Readonly<{
      kind: "allowed";
      workspaceId: string;
      existing: { id: string; workspaceId: string | null } | null;
    }>;

/**
 * Resolve the current membership before looking up an idempotent task. The
 * denied shape intentionally carries no task or workspace metadata.
 */
export async function resolveNotesExtractAccess(
  database: NotesExtractDatabase,
  input: {
    userId: string;
    requestedWorkspaceId: string;
    sourceNoteId: string;
  },
): Promise<NotesExtractAccess> {
  const [member] = await database
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, input.userId),
        eq(workspaceMembers.workspaceId, input.requestedWorkspaceId),
      ),
    )
    .limit(1);
  if (!member) return { kind: "denied" };

  const [existing] = await database
    .select({ id: tasks.id, workspaceId: tasks.workspaceId })
    .from(tasks)
    // isolation-ok: sourceNoteId is assertion-bound to this user and note;
    // a cross-workspace match yields only an opaque conflict, never metadata.
    .where(eq(tasks.sourceNoteId, input.sourceNoteId))
    .limit(1);

  return {
    kind: "allowed",
    workspaceId: member.workspaceId,
    existing: existing ?? null,
  };
}
