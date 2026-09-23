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
 * Revoke observed Google credentials before deleting any owner data. Keep
 * their exact rows for retry if the provider fails or a connection changes
 * during that wait. The short transaction below contains no provider calls.
 *
 * The orchestrator supplies its strict, idempotent revoker. A direct caller
 * without one may erase only an account with no stored credentials. Retain
 * the legacy result shape, but never return credentials: custody stays in
 * Notes until revocation and the fenced deletion both succeed.
 */
export async function eraseForUser(
  clerkId: string,
  options?: { revokeTokens: (tokens: string[]) => Promise<void> },
): Promise<
  | { ok: true; refreshTokens: string[] }
  | { ok: false; error: string; refreshTokens: string[] }
> {
  try {
    const connections = await db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, clerkId));
    const refreshTokens = [
      ...new Set(connections.map((row) => row.refreshToken).filter(Boolean)),
    ];
    if (refreshTokens.length > 0) {
      // The retained schema names future providers, but the available
      // revoker proves only Google's postcondition. Never guess another one.
      if (
        !options?.revokeTokens ||
        connections.some((row) => row.refreshToken && row.provider !== "google")
      ) {
        throw new Error("Calendar revocation unavailable");
      }
      await options.revokeTokens(refreshTokens);
    }

    // This table has no unique key. Compare the complete multiset, including
    // tokens, metadata and duplicate rows, without depending on query order.
    const snapshot = (rows: typeof connections) =>
      JSON.stringify(rows.map((row) => JSON.stringify(row)).sort());
    const observed = snapshot(connections);
    await db.transaction(async (tx) => {
      const current = await tx
        .select()
        .from(calendarConnections)
        .where(eq(calendarConnections.userId, clerkId));
      if (snapshot(current) !== observed) {
        throw new Error("Calendar connections changed during erasure");
      }

      // Pending outbox rows carry creator-approved text. Delete explicitly
      // before notes; do not depend on SQLite FK enforcement being enabled.
      await tx
        .delete(noteTaskSendOutbox)
        .where(eq(noteTaskSendOutbox.userId, clerkId));
      await tx.delete(notes).where(eq(notes.userId, clerkId));
      await tx
        .delete(spawnedCalendarEvents)
        .where(eq(spawnedCalendarEvents.userId, clerkId));
      await tx
        .delete(calendarConnections)
        .where(eq(calendarConnections.userId, clerkId));
      await tx
        .delete(userPreferences)
        .where(eq(userPreferences.userId, clerkId));
    }, { behavior: "immediate" });

    return { ok: true, refreshTokens: [] };
  } catch {
    // Driver/provider messages can contain credential-bearing SQL or bodies.
    return { ok: false, error: "Notes erasure incomplete", refreshTokens: [] };
  }
}
