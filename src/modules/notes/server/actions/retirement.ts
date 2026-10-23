"use server";

import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/modules/notes/server/notes-auth";
import { db } from "@/modules/notes/server/db/notes-client";
import { notes } from "@/modules/notes/server/db/notes-schema";
import { notesRetirementEnabled } from "@/modules/notes/lib/notes-retirement";
import { isDemoMode } from "@/lib/access-mode";
import { demoArchivedNotes, demoNotes } from "@/modules/notes/server/demo/notes-demo";

/** Owner-only, independent of Project membership and promotion state. Active
 * rows remain readable during a partial cutover and are never labelled archived. */
export async function listNotesForRetirement() {
  if (!notesRetirementEnabled()) throw new Error("Notes archive is not enabled.");
  const userId = await requireUser();
  if (isDemoMode()) return [...demoNotes(), ...demoArchivedNotes()];
  return db.select({
    id: notes.id, body: notes.body, createdAt: notes.createdAt, updatedAt: notes.updatedAt,
    extractBody: notes.extractBody, promotedTaskId: notes.promotedTaskId,
    archivedAt: notes.archivedAt, workspaceId: notes.workspaceId, source: notes.source,
  }).from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.createdAt), desc(notes.id));
}
