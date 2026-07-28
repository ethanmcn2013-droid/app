import type { SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "@/server/db/schema";
import { tasks } from "@/server/db/schema";
import { readNotesExtractIdentity } from "@/server/notes-extract-access";
import type { ExistingNotesExtractIdentity } from "@/server/notes-extract-idempotency";

type NotesExtractDatabase = LibSQLDatabase<typeof schema>;

const identitySelection = {
  id: tasks.id,
  workspaceId: tasks.workspaceId,
  sourceNoteExtractBody: tasks.sourceNoteExtractBody,
  sourceNoteExtractSha256: tasks.sourceNoteExtractSha256,
};

/**
 * Insert once, then converge on the canonical source-note row if another
 * request won the unique-index race. No uniqueness error escapes as a false
 * send failure, and the caller still validates the canonical exact identity.
 */
export async function insertOrReadNotesExtractTask(
  database: NotesExtractDatabase,
  input: {
    sourceNoteId: string;
    // `seq` may be the atomic MAX+1 allocation fragment (task-seq.ts);
    // drizzle's .values() accepts SQL per column even though $inferInsert
    // types the column as its plain value.
    values: Omit<typeof tasks.$inferInsert, "seq"> & { seq?: number | SQL<number> | null };
  },
): Promise<Readonly<{
  created: boolean;
  task: ExistingNotesExtractIdentity;
}>> {
  if (input.values.sourceNoteId !== input.sourceNoteId) {
    throw new TypeError("Source note identity does not match task values");
  }

  const inserted = await database
    .insert(tasks)
    .values(input.values)
    .onConflictDoNothing()
    .returning(identitySelection);
  if (inserted[0]) {
    return { created: true, task: inserted[0] };
  }

  const existing = await readNotesExtractIdentity(
    database,
    input.sourceNoteId,
  );
  if (!existing) {
    throw new Error("Task identity collision did not resolve to a Notes task");
  }
  return { created: false, task: existing };
}
