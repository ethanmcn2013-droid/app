import { eq } from "drizzle-orm";
import {
  calendarConnections,
  noteTaskSendOutbox,
  notes,
  spawnedCalendarEvents,
  userPreferences,
} from "./db/notes-schema";
import { db } from "./db/notes-client";

/**
 * GDPR Art. 20 (data portability) — Notes module.
 *
 * Returns everything Notes holds for the user keyed by their Clerk userId.
 *
 * SECURITY: `calendar_connections.refresh_token` is DELIBERATELY OMITTED.
 * It is a live OAuth credential (long-lived Google refresh token), not user
 * content. Exporting it into a downloadable file would let a leaked export
 * mint new Google calendar access tokens. Provider + calendar id + sync
 * timestamps are exported; the token itself is not.
 *
 * May be called from the GDPR orchestrator in src/server/ via the boundary-
 * approved import path (check-module-boundaries.mjs gdprOrchestrators list).
 */
export async function exportForUser(clerkId: string): Promise<{
  available: true;
  notes: (typeof notes.$inferSelect)[];
  noteTaskSendOutbox: {
    operationId: string;
    noteId: string;
    sourceSelection: string;
    approvedBody: string;
    approvedBodySha256: string;
    workspaceId: string;
    baseUpdatedAt: number;
    reservedUpdatedAt: number;
    status: "pending" | "completed";
    taskId: string | null;
    createdAt: number;
    updatedAt: number;
    completedAt: number | null;
  }[];
  calendarConnections: {
    provider: string;
    calendarId: string;
    lastSyncedAt: number | null;
    createdAt: number;
    updatedAt: number;
  }[];
  spawnedCalendarEvents: (typeof spawnedCalendarEvents.$inferSelect)[];
  preferences: typeof userPreferences.$inferSelect | null;
}> {
  const [noteRows, taskSendRows, connectionRows, spawnedRows, prefsRows] =
    await Promise.all([
      db.select().from(notes).where(eq(notes.userId, clerkId)),
      db
        .select({
          operationId: noteTaskSendOutbox.operationId,
          noteId: noteTaskSendOutbox.noteId,
          sourceSelection: noteTaskSendOutbox.sourceSelection,
          approvedBody: noteTaskSendOutbox.approvedBody,
          approvedBodySha256: noteTaskSendOutbox.approvedBodySha256,
          workspaceId: noteTaskSendOutbox.workspaceId,
          baseUpdatedAt: noteTaskSendOutbox.baseUpdatedAt,
          reservedUpdatedAt: noteTaskSendOutbox.reservedUpdatedAt,
          status: noteTaskSendOutbox.status,
          taskId: noteTaskSendOutbox.taskId,
          createdAt: noteTaskSendOutbox.createdAt,
          updatedAt: noteTaskSendOutbox.updatedAt,
          completedAt: noteTaskSendOutbox.completedAt,
        })
        .from(noteTaskSendOutbox)
        .where(eq(noteTaskSendOutbox.userId, clerkId)),
      db
        .select({
          provider: calendarConnections.provider,
          calendarId: calendarConnections.calendarId,
          lastSyncedAt: calendarConnections.lastSyncedAt,
          createdAt: calendarConnections.createdAt,
          updatedAt: calendarConnections.updatedAt,
        })
        .from(calendarConnections)
        .where(eq(calendarConnections.userId, clerkId)),
      db
        .select()
        .from(spawnedCalendarEvents)
        .where(eq(spawnedCalendarEvents.userId, clerkId)),
      db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, clerkId)),
    ]);

  return {
    available: true,
    notes: noteRows,
    noteTaskSendOutbox: taskSendRows,
    // Token-free by design: see the security note above.
    calendarConnections: connectionRows,
    spawnedCalendarEvents: spawnedRows,
    preferences: prefsRows[0] ?? null,
  };
}

/**
 * GDPR right-to-erasure — Notes module.
 *
 * Hard-deletes every row keyed to `clerkId` across all five user-keyed
 * Notes tables and returns the Google OAuth refresh tokens that were stored
 * so the orchestrator can revoke them at Google AFTER the DB rows are gone.
 *
 * Returns `{ ok: true, refreshTokens }` on success.
 * Returns `{ ok: false, error, refreshTokens }` if a DB call throws, so the
 * orchestrator can retain token custody, attempt every other product eraser,
 * and then fail closed before identity deletion.
 *
 * Idempotent: a retry after partial failure is safe (all deletes are no-ops
 * once the rows are gone).
 */
export async function eraseForUser(clerkId: string): Promise<
  | { ok: true; refreshTokens: string[] }
  | { ok: false; error: string; refreshTokens: string[] }
> {
  // Collect tokens BEFORE deleting so a deletion failure never loses the
  // pointer needed to revoke the credential at Google.
  let refreshTokens: string[] = [];
  try {
    const connections = await db
      .select({ refreshToken: calendarConnections.refreshToken })
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, clerkId));
    refreshTokens = connections
      .map((c) => c.refreshToken)
      .filter((t): t is string => Boolean(t));

    // Pending outbox rows carry creator-approved text — delete explicitly
    // before notes; production must not rely on SQLite FK enforcement.
    await db
      .delete(noteTaskSendOutbox)
      .where(eq(noteTaskSendOutbox.userId, clerkId));
    await db.delete(notes).where(eq(notes.userId, clerkId));
    await db
      .delete(spawnedCalendarEvents)
      .where(eq(spawnedCalendarEvents.userId, clerkId));
    await db
      .delete(calendarConnections)
      .where(eq(calendarConnections.userId, clerkId));
    await db
      .delete(userPreferences)
      .where(eq(userPreferences.userId, clerkId));

    return { ok: true, refreshTokens };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error, refreshTokens };
  }
}
