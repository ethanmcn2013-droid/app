import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { tasks, workspaceMembers } from "@/server/db/schema";
import type { ExistingNotesExtractIdentity } from "@/server/notes-extract-idempotency";

type NotesExtractDatabase = LibSQLDatabase<typeof schema>;

export type NotesExtractAccess =
  | Readonly<{ kind: "denied" }>
  | Readonly<{
      kind: "allowed";
      workspaceId: string;
      existing: ExistingNotesExtractIdentity | null;
    }>;

const notesExtractIdentitySelection = {
  id: tasks.id,
  workspaceId: tasks.workspaceId,
  sourceNoteExtractBody: tasks.sourceNoteExtractBody,
  sourceNoteExtractSha256: tasks.sourceNoteExtractSha256,
};

export async function readNotesExtractIdentity(
  database: NotesExtractDatabase,
  sourceNoteId: string,
): Promise<ExistingNotesExtractIdentity | null> {
  const [existing] = await database
    .select(notesExtractIdentitySelection)
    .from(tasks)
    // isolation-ok: the caller derives sourceNoteId from an authenticated,
    // assertion-bound subject and note id before this lookup.
    .where(eq(tasks.sourceNoteId, sourceNoteId))
    .limit(1);
  return existing ?? null;
}

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

  const existing = await readNotesExtractIdentity(
    database,
    input.sourceNoteId,
  );

  return {
    kind: "allowed",
    workspaceId: member.workspaceId,
    existing,
  };
}
