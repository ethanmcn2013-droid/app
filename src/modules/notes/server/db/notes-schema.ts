import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Locked schema (PRODUCT.md §6), one row per note, plus the
 * one-way approved extraction edge to Signal Tasks.
 *
 * v1 surface: { id, body, created_at, updated_at, extract_body?,
 * promoted_task_id? }. No tags, no folders, no metadata.
 * v1 search: client-side substring filter over all notes (acceptable up to ~500 notes per user).
 * The (user_id, created_at) index drives the stream.
 *
 * Privacy guardrail: body is private to the owner. Collaborative views
 * should store/read approved extracts, never raw note rows. Only the
 * extract_body (creator-authored, deliberate) ever leaves Notes.
 *
 * extract_body holds the creator-authored action wording, never the
 * raw note body, never auto-detected. Set by setNoteExtract, cleared
 * by clearNoteExtract. promoted_task_id is filled in by the cross-repo
 * write (Cycle 9.4b, shipped) once the action lands as a Task. Both
 * null = no extract drafted.
 *
 * archived_at (Unix ms, nullable), RW-3a D1 promote semantics.
 *   NULL     = note is in the active stream (listNotes returns it).
 *   non-null = note has been promoted and archived from the stream.
 * listNotes() filters WHERE archived_at IS NULL; listArchivedNotes()
 * returns the complement. unPromoteNote() clears both this and
 * promoted_task_id only for legacy receipts without a durable outbox row;
 * completed Hybrid receipts remain bound until the note is explicitly deleted.
 */

export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    extractBody: text("extract_body"),
    promotedTaskId: text("promoted_task_id"),
    archivedAt: integer("archived_at", { mode: "number" }),
    /**
     * Optional projection of the canonical Signal Tasks workspace id.
     *
     * Notes never owns or copies Workspace membership. A null value is the
     * normal, durable "Unfiled" state. Every write of a non-null id is
     * authorized against Tasks using the current Clerk subject before this
     * projection is stored.
     */
    workspaceId: text("workspace_id"),
    /**
     * N·24 (Pattern 4), calendar-spawned note provenance.
     *   NULL       = ordinary capture (textarea, paste, email, clipper…)
     *   "calendar" = spawned 5 minutes pre-event by the calendar worker.
     *
     * One nullable column, no enum table: the only values we care about
     * are "calendar" and "absent". The stream row reads this to decide
     * whether to render the `from calendar` provenance pill, gated by
     * `updatedAt === createdAt` so the pill disappears the moment the
     * user edits.
     *
     * Refusal anchor (PRODUCT.md §8): a note with source="calendar" is
     * a *scaffold* only, title + attendees. No auto-detected action
     * items, no summaries, no meeting body. The line stays clean.
     *
     * Capture provenance joined this column 2026-08-05 (Notes world-class
     * redesign). Values now read: NULL or "typed" = written in the
     * composer, "voice" = spoken and turned into text, "photo" = read
     * from a picture, "email" = arrived by capture address, "calendar" =
     * the pre-event scaffold above. NULL is preserved as typed so no
     * existing row needs a backfill.
     */
    source: text("source"),
    /**
     * When the owner last made a deliberate decision about this note in
     * Review: kept it, or sent it on. NULL = it has never been through
     * Review, which is what puts it in the queue.
     *
     * Additive and nullable on purpose. Every note written before this
     * column existed reads as "not yet reviewed", which is true, and the
     * queue simply starts full rather than starting wrong. Deleting is
     * also a decision, but it removes the row, so it needs no marker.
     */
    reviewedAt: integer("reviewed_at", { mode: "number" }),
  },
  (table) => ({
    userCreated: index("notes_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    userWorkspaceCreated: index("notes_user_workspace_created_idx").on(
      table.userId,
      table.workspaceId,
      table.createdAt,
    ),
    // Drives the Review queue count in the local header, which is read on
    // every Notes render. Without it the count is a full user scan.
    userReviewed: index("notes_user_reviewed_idx").on(
      table.userId,
      table.reviewedAt,
      table.createdAt,
    ),
  })
);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

/**
 * Durable, owner-scoped reservation for the deliberate Notes -> Tasks edge.
 *
 * The request fields are immutable while pending. A pending row means Tasks
 * may already have accepted the request even when Notes did not receive the
 * response, so edits and deletion of the source note are blocked until an
 * exact retry reconciles the receipt. The approved wording is intentionally
 * stored here: it is the only private text authorized to cross products.
 *
 * On completion, the duplicate source selection and approved wording are
 * scrubbed from this table; the note holds the approved extract and this row
 * retains only its SHA-256 + task receipt metadata. The note's approved
 * extract, Task id, and workspace projection become one immutable receipt
 * binding at that point, including while the product flag is rolled back to
 * the legacy notebook. One row per (user, note) is enough because a note has
 * one durable Tasks receipt. Account and note deletion explicitly remove both
 * sides as a defense in depth even though the FK also cascades when enabled.
 */
export const noteTaskSendOutbox = sqliteTable(
  "note_task_send_outbox",
  {
    operationId: text("operation_id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    sourceSelection: text("source_selection").notNull(),
    approvedBody: text("approved_body").notNull(),
    approvedBodySha256: text("approved_body_sha256").notNull(),
    workspaceId: text("workspace_id").notNull(),
    baseUpdatedAt: integer("base_updated_at", { mode: "number" }).notNull(),
    reservedUpdatedAt: integer("reserved_updated_at", {
      mode: "number",
    }).notNull(),
    status: text("status")
      .$type<"pending" | "completed">()
      .notNull()
      .default("pending"),
    taskId: text("task_id"),
    leaseToken: text("lease_token"),
    leaseExpiresAt: integer("lease_expires_at", { mode: "number" }),
    attemptCount: integer("attempt_count", { mode: "number" })
      .notNull()
      .default(1),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer("completed_at", { mode: "number" }),
  },
  (table) => ({
    userNoteUnique: uniqueIndex("note_task_send_outbox_user_note_uq").on(
      table.userId,
      table.noteId,
    ),
    userStatus: index("note_task_send_outbox_user_status_idx").on(
      table.userId,
      table.status,
      table.updatedAt,
    ),
    noteLookup: index("note_task_send_outbox_note_idx").on(table.noteId),
    approvedHashShape: check(
      "note_task_send_outbox_approved_hash_ck",
      sql`length(${table.approvedBodySha256}) = 64 AND ${table.approvedBodySha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
    reservationVersion: check(
      "note_task_send_outbox_version_ck",
      sql`${table.reservedUpdatedAt} > ${table.baseUpdatedAt}`,
    ),
    lifecycle: check(
      "note_task_send_outbox_lifecycle_ck",
      sql`(
          ${table.status} = 'pending'
          AND ${table.taskId} IS NULL
          AND ${table.completedAt} IS NULL
          AND (
            (${table.leaseToken} IS NULL AND ${table.leaseExpiresAt} IS NULL)
            OR
            (${table.leaseToken} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL)
          )
        ) OR (
          ${table.status} = 'completed'
          AND ${table.taskId} IS NOT NULL
          AND ${table.completedAt} IS NOT NULL
          AND ${table.leaseToken} IS NULL
          AND ${table.leaseExpiresAt} IS NULL
        )`,
    ),
    attemptCountPositive: check(
      "note_task_send_outbox_attempt_count_ck",
      sql`${table.attemptCount} >= 1`,
    ),
  }),
);

export type NoteTaskSendOutbox = typeof noteTaskSendOutbox.$inferSelect;
export type NewNoteTaskSendOutbox = typeof noteTaskSendOutbox.$inferInsert;

/**
 * Retained N·24 (Pattern 4) calendar OAuth connection schema.
 *
 * The original design intended Google first, later providers, a five-minute
 * poller and pre-event scaffolds. The current repository
 * has no calendar connection writer or polling worker; this table is retained
 * for existing data and GDPR export/erasure. Live population is unverified.
 *
 * Refresh tokens here have no application-layer encryption; the historical
 * PRODUCT.md §11 (3) reference records that follow-up, not implemented protection.
 * Export omits credentials. Erasure retains them until provider revocation
 * succeeds. The lookup index below is not a uniqueness constraint.
 */
export const calendarConnections = sqliteTable(
  "calendar_connections",
  {
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(), // "google" in v1
    calendarId: text("calendar_id").notNull(), // Google calendar id ("primary" usually)
    refreshToken: text("refresh_token").notNull(),
    /**
     * Historical polling checkpoint, retained as data. No current worker or
     * observed synchronization is implied by the column's presence.
     */
    lastSyncedAt: integer("last_synced_at", { mode: "number" }),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    userProviderCal: index("calendar_connections_user_idx").on(
      table.userId,
      table.provider,
      table.calendarId
    ),
  })
);

export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type NewCalendarConnection = typeof calendarConnections.$inferInsert;

/**
 * N·24 (Pattern 4), idempotency ledger for calendar-spawned notes.
 *
 * One row per (user, provider, calendarEventId, occurrenceStart). The
 * occurrence start is included so recurring events spawn once per
 * occurrence, not once per series. Two devices racing to spawn the
 * same event → one wins on UNIQUE, the other no-ops.
 *
 * `note_id` references the spawned note. If the user deletes the
 * note the ledger row stays, that is the signal "this event was
 * already handled; don't re-spawn".
 */
export const spawnedCalendarEvents = sqliteTable(
  "spawned_calendar_events",
  {
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    calendarEventId: text("calendar_event_id").notNull(),
    occurrenceStart: integer("occurrence_start", { mode: "number" }).notNull(),
    noteId: text("note_id").notNull(),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    userEventOccurrenceIdx: index(
      "spawned_calendar_events_user_event_occurrence_idx"
    ).on(
      table.userId,
      table.provider,
      table.calendarEventId,
      table.occurrenceStart
    ),
  })
);

export type SpawnedCalendarEvent = typeof spawnedCalendarEvents.$inferSelect;
export type NewSpawnedCalendarEvent = typeof spawnedCalendarEvents.$inferInsert;

/**
 * Per-user preferences. v1 holds only the email-to-capture slug
 * (N-1, 2026-05-14). Row is lazy-created the first time the user
 * asks for their capture address, never on signup.
 */
export const userPreferences = sqliteTable(
  "user_preferences",
  {
    userId: text("user_id").primaryKey(),
    captureSlug: text("capture_slug").notNull().unique(),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    captureSlugIdx: index("user_preferences_capture_slug_idx").on(
      table.captureSlug,
    ),
  })
);

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
