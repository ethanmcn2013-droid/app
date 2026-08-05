"use server";

import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  createTasksAssertion,
  createTasksExtractAssertionV2,
} from "@/modules/notes/server/notes-cross-product-assertion";

import { requireUser } from "@/modules/notes/server/notes-auth";
import { db } from "@/modules/notes/server/db/notes-client";
import {
  noteTaskSendOutbox,
  notes,
  type Note,
  type NoteTaskSendOutbox,
} from "@/modules/notes/server/db/notes-schema";
import { isDemoMode } from "@/lib/access-mode";
import {
  assertSelectionBelongsToNote,
  createApprovedTasksPayload,
  createAttemptedVersion,
  createRemoteConflict,
  createVersionConflict,
  nextUpdatedAt,
  normalizeOptionalWorkspaceId,
  validateApprovedBody,
  validateExpectedUpdatedAt,
  validateNoteBody,
  validateSourceSelection,
  validateStableNoteId,
} from "@/modules/notes/lib/notes-hybrid";
import { authorizeTasksWorkspace } from "@/modules/notes/server/tasks-personalization";
import {
  approvedBodySha256,
  canResumePendingTasksSend,
  makeTasksSendOperationId,
  makeTasksSendLeaseToken,
  parseTrustedLegacyTasksSendReceipt,
  parseTrustedTasksSendReceipt,
  replayedTasksSendReceipt,
  sameImmutableTasksSendRequest,
  shouldReleaseTasksSendReservation,
  TASKS_SEND_LEASE_MS,
  type TrustedTasksSendReceipt,
} from "@/modules/notes/server/notes-task-send-contract";
import {
  DEMO_REFERENCE_TIME,
  demoArchivedNotes,
  demoNotes,
  demoSearchNotes,
} from "@/modules/notes/server/demo/notes-demo";
import { recordSponsoredUse } from "@/lib/account/instrumentation/call-site";

function makeId() {
  return `n_${crypto.randomUUID().replace(/-/g, "")}`;
}

/** Fabricate a plausible NoteRead for demo-mode write actions. */
function makeDemoNote(overrides: Partial<NoteRead> = {}): NoteRead {
  const now = DEMO_REFERENCE_TIME;
  return {
    id: `demo-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
    body: "",
    createdAt: now,
    updatedAt: now,
    extractBody: null,
    promotedTaskId: null,
    archivedAt: null,
    reviewedAt: null,
    source: null,
    workspaceId: null,
    ...overrides,
  };
}

export type NoteRead = Pick<
  Note,
  | "id"
  | "body"
  | "createdAt"
  | "updatedAt"
  | "extractBody"
  | "promotedTaskId"
  | "archivedAt"
  | "reviewedAt"
  | "source"
  | "workspaceId"
>;

function noPendingTasksSend(userId: string, noteId: string) {
  return sql`NOT EXISTS (
    SELECT 1
    FROM ${noteTaskSendOutbox}
    WHERE ${noteTaskSendOutbox.userId} = ${userId}
      AND ${noteTaskSendOutbox.noteId} = ${noteId}
      AND ${noteTaskSendOutbox.status} = 'pending'
  )`;
}

/**
 * Legacy mutations that can rewrite the Tasks receipt projection must see no
 * durable send row at all. Pending rows protect an in-flight request;
 * completed rows permanently bind extractBody + promotedTaskId + workspaceId.
 */
function noTasksSendBinding(userId: string, noteId: string) {
  return sql`NOT EXISTS (
    SELECT 1
    FROM ${noteTaskSendOutbox}
    WHERE ${noteTaskSendOutbox.userId} = ${userId}
      AND ${noteTaskSendOutbox.noteId} = ${noteId}
  )`;
}

async function throwTasksSendBindingMutationError(
  userId: string,
  noteId: string,
  fallback: string,
): Promise<never> {
  const [binding] = await db
    .select({ status: noteTaskSendOutbox.status })
    .from(noteTaskSendOutbox)
    .where(
      and(
        eq(noteTaskSendOutbox.userId, userId),
        eq(noteTaskSendOutbox.noteId, noteId),
      ),
    )
    .limit(1);
  if (binding?.status === "completed") {
    throw new Error(
      "This note already has a completed Tasks receipt. Its approved extract, workspace, and Task link cannot be changed.",
    );
  }
  if (binding?.status === "pending") {
    throw new Error(
      "This note has an approved Tasks send still reconciling. Retry that send before changing its Tasks receipt.",
    );
  }
  throw new Error(fallback);
}

function refuseLegacyTasksSendWhenHybridEnabled(): void {
  if (process.env.NOTES_LEGACY_NOTEBOOK_ENABLED !== "1") {
    throw new Error(
      "This Tasks send flow was replaced. Refresh Notes and approve an exact selection.",
    );
  }
}

/**
 * Server action: create a note for the signed-in user.
 * Returns the created note so the client can update its UI without a
 * second round-trip.
 *
 * Privacy guardrail: raw note bodies are private account data. Shared
 * workspace, roadmap, task, and analytics surfaces must use future
 * creator-approved extract endpoints, not this raw note action.
 */
// Module-local, a "use server" file may only *export* async
// functions, so the client mirrors this ceiling via its own
// constant rather than importing this one.
const MAX_NOTE_BODY_CHARS = 10_000;

export async function createNote(
  body: string,
  requestedWorkspaceId?: string | null,
): Promise<NoteRead> {
  // demo mode never touches the DB — return a fabricated note so the client
  // can merge optimistically without a real write.
  if (isDemoMode()) {
    const now = Date.now();
    return makeDemoNote({
      id: `demo-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
      body: body.trim(),
      createdAt: now,
      updatedAt: now,
    });
  }
  const userId = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Note body is empty");
  }
  if (trimmed.length > MAX_NOTE_BODY_CHARS) {
    // A note is a thought, not a document. The textarea enforces the
    // same ceiling client-side; this is the trust-boundary backstop
    // for direct action calls and oversized pastes.
    throw new Error("Note is longer than 10,000 characters");
  }

  const now = Date.now();
  const id = makeId();
  let workspaceId: string | null = null;
  if (requestedWorkspaceId?.trim()) {
    const access = await authorizeTasksWorkspace(userId, requestedWorkspaceId);
    // Capture is the load-bearing action. If Tasks is unavailable or the
    // user's membership changed between render and save, keep the note
    // private and Unfiled instead of losing their words.
    if (access === "allowed") workspaceId = requestedWorkspaceId;
  }

  await db.insert(notes).values({
    id,
    userId,
    body: trimmed,
    createdAt: now,
    updatedAt: now,
    workspaceId,
  });

  // No revalidate: the client owns the optimistic merge and reconciles
  // against this return value. Revalidating thrashes the route cache
  // for every keystroke that ships.

  return {
    id,
    body: trimmed,
    createdAt: now,
    updatedAt: now,
    extractBody: null,
    promotedTaskId: null,
    archivedAt: null,
    reviewedAt: null,
    source: null,
    workspaceId,
  };
}

/**
 * Server action: list notes for the signed-in user, newest first.
 *
 * Notes are intentionally excluded from collaborative sharing surfaces:
 * this query is always scoped to the current Clerk user and must not be
 * reused for guest, public, workspace, roadmap, or analytics views.
 *
 * v1: no pagination, the stream is bounded by the user's own
 * notebook size. Pagination/virtualisation lands when a real user
 * crosses 500 notes.
 */
export async function listNotes(): Promise<NoteRead[]> {
  // Demo/Review: serve the in-memory seed; never reach the real DB.
  if (isDemoMode()) return demoNotes();

  const userId = await requireUser();

  const rows = await db
    .select({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
      archivedAt: notes.archivedAt,
      reviewedAt: notes.reviewedAt,
      source: notes.source,
      workspaceId: notes.workspaceId,
    })
    .from(notes)
    .where(and(eq(notes.userId, userId), isNull(notes.archivedAt)))
    .orderBy(desc(notes.createdAt));

  return rows;
}

/**
 * Server action: full-text search across the user's notes via FTS5.
 *
 * Replaces the client-side substring filter (N-2, 2026-05-14). The
 * notes_fts virtual table is kept in sync with the notes table via
 * INSERT/UPDATE/DELETE triggers (see drizzle/0001_fts5_search.sql).
 *
 * Query handling:
 *   - Empty / whitespace → returns [] (caller falls back to the full
 *     listNotes() stream).
 *   - Single-token queries: appended with * to enable prefix matching
 *     so "wedd" matches "wedding". Multi-token queries pass through
 *     verbatim, FTS5 implicit AND between tokens.
 *   - Special MATCH chars (",", AND/OR/NOT) sanitised so a user typing
 *     a literal comma doesn't crash the query.
 *
 * Privacy guardrail: same as listNotes, every row is filtered to
 * the current Clerk user. notes_fts.user_id is UNINDEXED but stored,
 * so the WHERE filter happens before MATCH ranking.
 *
 * Returns notes ordered by FTS5 rank, most-relevant first. Capped at
 * 100 results, Notes's stream UX shows a few results at a time, so
 * paging beyond that is unnecessary.
 */
export async function searchNotes(query: string): Promise<NoteRead[]> {
  if (isDemoMode()) return demoSearchNotes(query);

  const userId = await requireUser();
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Sanitise: drop quote delimiters, parentheses, punctuation,
  // FTS5 operator chars (* ^), and standalone boolean keywords that
  // would otherwise alter MATCH semantics in surprising ways. The
  // search box is not a query-DSL prompt, keep it intent-only.
  const stripped = trimmed
    .replace(/["'(),:.;\\*^]+/g, " ")
    .replace(/\b(AND|OR|NOT|NEAR)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return [];

  // Single-token: prefix-match so live-typing surfaces results.
  // Multi-token: AND-match via FTS5's implicit space-AND.
  const match = stripped.includes(" ") ? stripped : `${stripped}*`;

  const rows = await db.all<{
    id: string;
    body: string;
    created_at: number;
    updated_at: number;
    extract_body: string | null;
    promoted_task_id: string | null;
    archived_at: number | null;
    reviewed_at: number | null;
    source: string | null;
    workspace_id: string | null;
  }>(sql`
    SELECT n.id, n.body, n.created_at, n.updated_at, n.extract_body, n.promoted_task_id, n.archived_at, n.reviewed_at, n.source, n.workspace_id
    FROM notes_fts fts
    JOIN notes n ON n.rowid = fts.rowid
    WHERE fts.user_id = ${userId}
      AND n.archived_at IS NULL
      AND notes_fts MATCH ${match}
    ORDER BY fts.rank
    LIMIT 100
  `);

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    extractBody: r.extract_body,
    promotedTaskId: r.promoted_task_id,
    archivedAt: r.archived_at,
    reviewedAt: r.reviewed_at,
    source: r.source,
    workspaceId: r.workspace_id,
  }));
}

/**
 * Server action: delete a note the user owns.
 */
export async function deleteNote(id: string): Promise<void> {
  // demo mode never touches the DB — silently no-op; in-memory seed is unchanged.
  if (isDemoMode()) return;
  const userId = await requireUser();

  await db.transaction(async (tx) => {
    const pending = await tx
      .select({ operationId: noteTaskSendOutbox.operationId })
      .from(noteTaskSendOutbox)
      .where(
        and(
          eq(noteTaskSendOutbox.userId, userId),
          eq(noteTaskSendOutbox.noteId, id),
          eq(noteTaskSendOutbox.status, "pending"),
        ),
      )
      .limit(1);
    if (pending[0]) {
      throw new Error(
        "This note has an approved Tasks send still reconciling. Retry that send before deleting it.",
      );
    }

    // A completed outbox contains creator-approved private text. Remove it in
    // the same transaction as the note instead of relying on FK enforcement.
    await tx
      .delete(noteTaskSendOutbox)
      .where(
        and(
          eq(noteTaskSendOutbox.userId, userId),
          eq(noteTaskSendOutbox.noteId, id),
        ),
      );
    await tx
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)));
  });

  revalidatePath("/app/notes", "page");
}

/**
 * Move one owned note into a currently-authorized canonical workspace, or
 * return it to Unfiled. This is deliberately single-note: Notes never offers
 * a mass owner/workspace reassignment seam.
 */
export async function setNoteWorkspace(
  noteId: string,
  requestedWorkspaceId: string | null,
): Promise<NoteRead> {
  // demo mode never touches the DB — return a fabricated note reflecting the requested change.
  if (isDemoMode()) {
    const now = Date.now();
    return makeDemoNote({ id: noteId, updatedAt: now, workspaceId: requestedWorkspaceId?.trim() || null });
  }
  const userId = await requireUser();
  const workspaceId = requestedWorkspaceId?.trim() || null;

  if (workspaceId) {
    const access = await authorizeTasksWorkspace(userId, workspaceId);
    if (access === "unavailable") {
      throw new Error("Workspaces are unavailable right now. Your note is still private.");
    }
    if (access !== "allowed") {
      throw new Error("That workspace is no longer available to your account.");
    }
  }

  const now = Date.now();
  const result = await db
    .update(notes)
    .set({ workspaceId, updatedAt: now })
    .where(
      and(
        eq(notes.id, noteId),
        eq(notes.userId, userId),
        noTasksSendBinding(userId, noteId),
      ),
    )
    .returning({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
      archivedAt: notes.archivedAt,
      reviewedAt: notes.reviewedAt,
      source: notes.source,
      workspaceId: notes.workspaceId,
    });

  const row = result[0];
  if (!row) {
    await throwTasksSendBindingMutationError(userId, noteId, "Note not found");
  }
  return row;
}

/**
 * Server action: draft an action extract from a note. The creator
 * authors the action wording deliberately, Notes never auto-detects
 * todos from raw note bodies (PRODUCT.md §8 refusal).
 *
 * The extract_body lives alongside the raw note. The cross-repo write
 * to Signal Tasks (and population of promoted_task_id) runs through
 * sendExtractToTasks below.
 */
export async function setNoteExtract(
  id: string,
  body: string
): Promise<NoteRead> {
  // demo mode never touches the DB — return a fabricated note with the extract applied.
  if (isDemoMode()) {
    const now = Date.now();
    return makeDemoNote({ id, extractBody: body.trim(), updatedAt: now });
  }
  const userId = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Action body is empty");
  }
  if (trimmed.length > 280) {
    throw new Error("Action is longer than 280 characters");
  }

  const now = Date.now();

  const result = await db
    .update(notes)
    .set({ extractBody: trimmed, updatedAt: now })
    .where(
      and(
        eq(notes.id, id),
        eq(notes.userId, userId),
        noTasksSendBinding(userId, id),
      ),
    )
    .returning({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
      archivedAt: notes.archivedAt,
      reviewedAt: notes.reviewedAt,
      source: notes.source,
      workspaceId: notes.workspaceId,
    });

  const row = result[0];
  if (!row) {
    await throwTasksSendBindingMutationError(userId, id, "Note not found");
  }

  return row;
}

/**
 * Server action: clear the drafted extract from a note. The raw note
 * body is untouched. If the extract had already been written to Tasks
 * (promoted_task_id non-null), the Task is not deleted from Tasks —
 * Notes owns the extract draft, not the resulting Task.
 */
export async function clearNoteExtract(id: string): Promise<NoteRead> {
  // demo mode never touches the DB — return a fabricated note with the extract cleared.
  if (isDemoMode()) {
    return makeDemoNote({ id, extractBody: null, updatedAt: Date.now() });
  }
  const userId = await requireUser();
  const now = Date.now();

  const result = await db
    .update(notes)
    .set({ extractBody: null, updatedAt: now })
    .where(
      and(
        eq(notes.id, id),
        eq(notes.userId, userId),
        noTasksSendBinding(userId, id),
      ),
    )
    .returning({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
      archivedAt: notes.archivedAt,
      reviewedAt: notes.reviewedAt,
      source: notes.source,
      workspaceId: notes.workspaceId,
    });

  const row = result[0];
  if (!row) {
    await throwTasksSendBindingMutationError(userId, id, "Note not found");
  }

  return row;
}

/**
 * Cross-repo Notes -> Tasks write (Cycle 9.4b second half,
 * 2026-05-12). Calls the Tasks endpoint with the drafted extract,
 * stores the resulting taskId on the note, returns the destination
 * workspace name + deep link so the UI can label "Sent to [workspace]
 *, open in Tasks."
 *
 * Privacy guardrail: only extract_body crosses the boundary. The raw
 * note body never leaves Notes.
 *
 * Idempotency: Tasks keys on (subject, noteId), a repeat call returns
 * the same task instead of creating a duplicate. Safe to retry.
 */
export type ExtractSendResult = TrustedTasksSendReceipt;

export async function sendExtractToTasks(
  noteId: string,
  workspaceId: string,
): Promise<{ note: NoteRead; result: ExtractSendResult }> {
  refuseLegacyTasksSendWhenHybridEnabled();
  // demo mode never touches the DB — cross-repo sends are unavailable in demo.
  refuseDemoMutation();
  const userId = await requireUser();
  const tasksUrlRaw =
    process.env.TASKS_API_URL ??
    (process.env.VERCEL_ENV === "production"
      ? "https://tasks.signalstudio.ie"
      : null);
  if (!tasksUrlRaw) {
    // Refuse the silent prod default outside production, a
    // misconfigured preview env would otherwise write into prod
    // Tasks. Local dev / preview must set TASKS_API_URL explicitly.
    throw new Error(
      "Cross-repo send is not configured (TASKS_API_URL missing)"
    );
  }
  const tasksUrl = tasksUrlRaw.replace(/\/+$/, "");
  const secret = process.env.NOTES_TO_TASKS_SECRET;
  if (!secret) {
    throw new Error(
      "Cross-repo send is not configured (NOTES_TO_TASKS_SECRET missing)"
    );
  }
  if (!workspaceId.trim()) throw new Error("Choose a Tasks workspace first");

  // Read the note's extract so the network call sees the freshest
  // creator-authored wording, not whatever the client passed.
  const [note] = await db
    .select({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
    })
    .from(notes)
    .where(
      and(
        eq(notes.id, noteId),
        eq(notes.userId, userId),
        noTasksSendBinding(userId, noteId),
      ),
    )
    .limit(1);

  if (!note) {
    await throwTasksSendBindingMutationError(userId, noteId, "Note not found");
  }
  const extract = note.extractBody?.trim() ?? "";
  if (!extract) {
    throw new Error("Draft an action first");
  }

  let response: Response;
  try {
    response = await fetch(`${tasksUrl}/api/notes-extract`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createTasksAssertion(
          userId,
          noteId,
          workspaceId,
          secret,
        )}`,
      },
      body: JSON.stringify({ noteId, body: extract, workspaceId }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("Tasks timed out, try again in a moment");
    }
    throw err;
  }

  if (!response.ok) {
    let detail = `Tasks returned ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) detail = data.error;
    } catch {
      // ignore, keep the status-code fallback
    }
    throw new Error(detail);
  }

  const result = parseTrustedLegacyTasksSendReceipt(await response.json());

  // Persist the task id and archive the note Notes-side (RW-3a D1
  // semantics). The note leaves the active stream; listArchivedNotes()
  // surfaces it in the "In Tasks" section. The task in Tasks is
  // independent, it is never deleted by un-promote.
  const now2 = Date.now();
  const updated = await db
    .update(notes)
    .set({ promotedTaskId: result.taskId, archivedAt: now2, updatedAt: now2 })
    .where(
      and(
        eq(notes.id, noteId),
        eq(notes.userId, userId),
        noTasksSendBinding(userId, noteId),
      ),
    )
    .returning({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
      archivedAt: notes.archivedAt,
      reviewedAt: notes.reviewedAt,
      source: notes.source,
      workspaceId: notes.workspaceId,
    });

  const noteRow = updated[0];
  if (!noteRow) {
    await throwTasksSendBindingMutationError(
      userId,
      noteId,
      "Note vanished between send and store",
    );
  }

  // Revalidation is best-effort: a Turso hiccup here must not surface
  // as an unhandled SC render error to the user (D2 hardening).
  try {
    revalidatePath("/app/notes", "page");
  } catch {
    // Non-fatal, the extract was sent and archived; the client
    // will see the updated state on next natural refresh.
  }
  return { note: noteRow, result };
}

/**
 * RW-3a: Direct promote, the note body's first line becomes the task
 * title without requiring an intermediate "Draft action" step.
 *
 * This is the gesture path (long-press on touch; hover ghost button on
 * pointer). It sets extractBody to the first line of the note body,
 * then fires the same cross-repo write as sendExtractToTasks, and
 * archives the note (D1 semantics). The two-step "Draft action → Send
 * to Tasks" flow in the open-note panel remains unchanged as an escape
 * hatch for notes that need reshaping before becoming tasks.
 *
 * Privacy guardrail: only the first line (extract) crosses the boundary,
 * never the full raw note body. Same as sendExtractToTasks.
 *
 * Idempotency: Tasks keys on (userId, noteId), repeat calls return the
 * same task, not a duplicate. Safe to retry after a network failure.
 */
export async function promoteNoteToTasks(
  noteId: string,
  workspaceId: string,
): Promise<{ note: NoteRead; result: ExtractSendResult }> {
  refuseLegacyTasksSendWhenHybridEnabled();
  // demo mode never touches the DB — cross-repo sends are unavailable in demo.
  refuseDemoMutation();
  const userId = await requireUser();

  const tasksUrlRaw =
    process.env.TASKS_API_URL ??
    (process.env.VERCEL_ENV === "production"
      ? "https://tasks.signalstudio.ie"
      : null);
  if (!tasksUrlRaw) {
    throw new Error(
      "Cross-repo send is not configured (TASKS_API_URL missing)"
    );
  }
  const tasksUrl = tasksUrlRaw.replace(/\/+$/, "");
  const secret = process.env.NOTES_TO_TASKS_SECRET;
  if (!secret) {
    throw new Error(
      "Cross-repo send is not configured (NOTES_TO_TASKS_SECRET missing)"
    );
  }
  if (!workspaceId.trim()) throw new Error("Choose a Tasks workspace first");

  // Read the note fresh, confirms ownership, gets the latest body.
  const [note] = await db
    .select({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
      archivedAt: notes.archivedAt,
      reviewedAt: notes.reviewedAt,
      source: notes.source,
      workspaceId: notes.workspaceId,
    })
    .from(notes)
    .where(
      and(
        eq(notes.id, noteId),
        eq(notes.userId, userId),
        noTasksSendBinding(userId, noteId),
      ),
    )
    .limit(1);

  if (!note) {
    await throwTasksSendBindingMutationError(userId, noteId, "Note not found");
  }
  if (note.archivedAt !== null) {
    throw new Error("Note is already promoted");
  }

  // Derive the task title from the first non-empty line of the body.
  // This is the gesture path: the jot IS the task, no rephrasing needed.
  const firstLine = note.body.trim().split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) {
    throw new Error("Note body is empty");
  }
  // Cap at 280 chars (same ceiling as extract_body).
  const taskTitle = firstLine.length > 280 ? firstLine.slice(0, 280) : firstLine;

  // Cross-repo write, same endpoint + auth as sendExtractToTasks.
  // extractBody is written ONLY after a successful Tasks response,
  // consolidated into the final archive update below. Writing it here
  // (before the fetch) was P0-1: a failed fetch left the note with
  // extractBody set but no promotedTaskId/archivedAt, corrupting it
  // permanently in listNotes().
  let response: Response;
  try {
    response = await fetch(`${tasksUrl}/api/notes-extract`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createTasksAssertion(
          userId,
          noteId,
          workspaceId,
          secret,
        )}`,
      },
      body: JSON.stringify({ noteId, body: taskTitle, workspaceId }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("Tasks timed out, try again in a moment");
    }
    throw err;
  }

  if (!response.ok) {
    let detail = `Tasks returned ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) detail = data.error;
    } catch {
      // ignore, keep the status-code fallback
    }
    throw new Error(detail);
  }

  const result = parseTrustedLegacyTasksSendReceipt(await response.json());

  // Archive the note (D1 semantics) and persist the taskId + extractBody
  // in a single atomic write. All three fields are written together so a
  // Tasks-fetch failure (above) leaves the note completely untouched.
  const archiveTs = Date.now();
  const updated = await db
    .update(notes)
    .set({
      extractBody: taskTitle,
      promotedTaskId: result.taskId,
      archivedAt: archiveTs,
      updatedAt: archiveTs,
    })
    .where(
      and(
        eq(notes.id, noteId),
        eq(notes.userId, userId),
        noTasksSendBinding(userId, noteId),
      ),
    )
    .returning({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
      archivedAt: notes.archivedAt,
      reviewedAt: notes.reviewedAt,
      source: notes.source,
      workspaceId: notes.workspaceId,
    });

  const noteRow = updated[0];
  if (!noteRow) {
    await throwTasksSendBindingMutationError(
      userId,
      noteId,
      "Note vanished between promote and archive",
    );
  }

  // Revalidation is best-effort: a Turso hiccup here must not surface
  // as an unhandled SC render error to the user (D2 hardening).
  try {
    revalidatePath("/app/notes", "page");
  } catch {
    // Non-fatal, the promote completed; client sees state on next refresh.
  }
  return { note: noteRow, result };
}

/**
 * RW-3a: List promoted (archived) notes for the "In Tasks" section.
 *
 * Returns notes where archived_at IS NOT NULL AND promoted_task_id IS
 * NOT NULL, ordered newest-archived first. These are the notes Niamh
 * can find below the active stream, always, never hidden in a dump.
 */
export async function listArchivedNotes(): Promise<NoteRead[]> {
  if (isDemoMode()) return demoArchivedNotes();

  const userId = await requireUser();

  const rows = await db
    .select({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
      archivedAt: notes.archivedAt,
      reviewedAt: notes.reviewedAt,
      source: notes.source,
      workspaceId: notes.workspaceId,
    })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        isNotNull(notes.archivedAt),
        isNotNull(notes.promotedTaskId)
      )
    )
    .orderBy(desc(notes.archivedAt));

  return rows;
}

/**
 * RW-3a: Un-promote a note, clear archived_at and promoted_task_id,
 * returning the note to the active stream.
 *
 * The task in Tasks is NOT deleted, it was intentionally created and
 * Tasks owns it. This action only severs the Notes-side archive state.
 * Copy in the UI: "Note returned here. The task stays in Tasks."
 *
 * Un-promote is undoable via the existing undo-toast pattern (6s
 * window, same as delete). No confirm dialog, reversibility is built
 * into the model.
 */
export async function unPromoteNote(noteId: string): Promise<NoteRead> {
  // demo mode never touches the DB — return a fabricated note with archive state cleared.
  if (isDemoMode()) {
    return makeDemoNote({ id: noteId, archivedAt: null, promotedTaskId: null, updatedAt: Date.now() });
  }
  const userId = await requireUser();

  const now = Date.now();
  const result = await db
    .update(notes)
    .set({ archivedAt: null, promotedTaskId: null, updatedAt: now })
    .where(
      and(
        eq(notes.id, noteId),
        eq(notes.userId, userId),
        isNotNull(notes.archivedAt),
        noTasksSendBinding(userId, noteId),
      )
    )
    .returning({
      id: notes.id,
      body: notes.body,
      createdAt: notes.createdAt,
      updatedAt: notes.updatedAt,
      extractBody: notes.extractBody,
      promotedTaskId: notes.promotedTaskId,
      archivedAt: notes.archivedAt,
      reviewedAt: notes.reviewedAt,
      source: notes.source,
      workspaceId: notes.workspaceId,
    });

  const row = result[0];
  if (!row) {
    await throwTasksSendBindingMutationError(
      userId,
      noteId,
      "Note not found or not promoted",
    );
  }

  revalidatePath("/app/notes", "page");
  return row;
}

export type CreateNoteIdempotentInput = {
  id: string;
  body: string;
  workspaceId: string | null;
  /**
   * How this note was captured. Absent means the composer, which is what
   * every note written before capture provenance existed was.
   */
  source?: NoteCaptureSource | null;
};

/**
 * The capture routes Notes records. Deliberately a closed union here even
 * though the column has no CHECK: the server is the only writer, so the
 * union is the constraint, and nothing else can drift a value in.
 *
 * "calendar" is not in this union because Notes never creates a calendar
 * note through capture; the calendar worker owns that value.
 */
export type NoteCaptureSource = "typed" | "voice" | "photo" | "email";

const CAPTURE_SOURCES: readonly NoteCaptureSource[] = [
  "typed",
  "voice",
  "photo",
  "email",
];

function normalizeCaptureSource(
  value: NoteCaptureSource | null | undefined,
): NoteCaptureSource | null {
  if (!value) return null;
  if (!CAPTURE_SOURCES.includes(value)) {
    throw new TypeError("Unknown capture source");
  }
  // Typed is the default reading of an absent value, so storing it would add
  // a row's worth of nothing. Keep NULL as the one representation.
  return value === "typed" ? null : value;
}

export type SetNoteReviewedInput = {
  id: string;
  reviewed: boolean;
};

export type UpdateNoteWithVersionInput = {
  id: string;
  body: string;
  expectedUpdatedAt: number;
};

export type UpdateNoteWithVersionResult =
  | { status: "saved"; note: NoteRead }
  | {
      status: "conflict";
      attempted: { body: string; updatedAt: number };
      remote: NoteRead;
    };

export type DeleteNoteWithVersionInput = {
  id: string;
  expectedUpdatedAt: number;
};

export type DeleteNoteWithVersionResult =
  | { status: "deleted"; id: string }
  | { status: "conflict"; remote: NoteRead };

export type SendApprovedExtractInput = {
  noteId: string;
  sourceSelection: string;
  approvedBody: string;
  workspaceId: string;
  expectedUpdatedAt: number;
};

export type SendApprovedExtractResult =
  | { status: "sent"; note: NoteRead; result: ExtractSendResult }
  | { status: "conflict"; remote: NoteRead };

export type PendingApprovedTasksSendRead = Pick<
  NoteTaskSendOutbox,
  | "operationId"
  | "noteId"
  | "sourceSelection"
  | "approvedBody"
  | "workspaceId"
  | "baseUpdatedAt"
  | "reservedUpdatedAt"
  | "createdAt"
>;

export type ApprovedTasksSendRecoveryRead =
  | { status: "pending"; send: PendingApprovedTasksSendRead }
  | { status: "completed"; note: NoteRead; result: ExtractSendResult }
  | { status: "none" };

const hybridNoteSelection = {
  id: notes.id,
  body: notes.body,
  createdAt: notes.createdAt,
  updatedAt: notes.updatedAt,
  extractBody: notes.extractBody,
  promotedTaskId: notes.promotedTaskId,
  archivedAt: notes.archivedAt,
  reviewedAt: notes.reviewedAt,
  source: notes.source,
  workspaceId: notes.workspaceId,
};

const tasksSendOutboxSelection = {
  operationId: noteTaskSendOutbox.operationId,
  noteId: noteTaskSendOutbox.noteId,
  userId: noteTaskSendOutbox.userId,
  sourceSelection: noteTaskSendOutbox.sourceSelection,
  approvedBody: noteTaskSendOutbox.approvedBody,
  approvedBodySha256: noteTaskSendOutbox.approvedBodySha256,
  workspaceId: noteTaskSendOutbox.workspaceId,
  baseUpdatedAt: noteTaskSendOutbox.baseUpdatedAt,
  reservedUpdatedAt: noteTaskSendOutbox.reservedUpdatedAt,
  status: noteTaskSendOutbox.status,
  taskId: noteTaskSendOutbox.taskId,
  leaseToken: noteTaskSendOutbox.leaseToken,
  leaseExpiresAt: noteTaskSendOutbox.leaseExpiresAt,
  attemptCount: noteTaskSendOutbox.attemptCount,
  createdAt: noteTaskSendOutbox.createdAt,
  updatedAt: noteTaskSendOutbox.updatedAt,
  completedAt: noteTaskSendOutbox.completedAt,
};

const pendingApprovedTaskSendSelection = {
  operationId: noteTaskSendOutbox.operationId,
  noteId: noteTaskSendOutbox.noteId,
  sourceSelection: noteTaskSendOutbox.sourceSelection,
  approvedBody: noteTaskSendOutbox.approvedBody,
  workspaceId: noteTaskSendOutbox.workspaceId,
  baseUpdatedAt: noteTaskSendOutbox.baseUpdatedAt,
  reservedUpdatedAt: noteTaskSendOutbox.reservedUpdatedAt,
  createdAt: noteTaskSendOutbox.createdAt,
};

function refuseDemoMutation(): void {
  if (isDemoMode()) {
    throw new Error("Review mode keeps changes on this device only");
  }
}

async function readOwnedNote(
  userId: string,
  noteId: string,
): Promise<NoteRead | null> {
  const [row] = await db
    .select(hybridNoteSelection)
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .limit(1);
  return row ?? null;
}

async function requireAuthorizedTasksWorkspace(
  userId: string,
  workspaceId: string,
): Promise<void> {
  const access = await authorizeTasksWorkspace(userId, workspaceId);
  if (access === "unavailable") {
    throw new Error(
      "Tasks workspaces are unavailable right now. Nothing was sent.",
    );
  }
  if (access !== "allowed") {
    throw new Error(
      "That Tasks workspace is no longer available to your account.",
    );
  }
}

function tasksApiUrl(): string {
  const raw =
    process.env.TASKS_API_URL ??
    (process.env.VERCEL_ENV === "production"
      ? "https://tasks.signalstudio.ie"
      : null);
  if (!raw) {
    throw new Error("Cross-repo send is not configured (TASKS_API_URL missing)");
  }
  return raw.replace(/\/+$/, "");
}

function tasksSecret(): string {
  const value = process.env.NOTES_TO_TASKS_SECRET;
  if (!value) {
    throw new Error(
      "Cross-repo send is not configured (NOTES_TO_TASKS_SECRET missing)",
    );
  }
  return value;
}

async function releaseRejectedTasksSend(
  userId: string,
  reservation: NoteTaskSendOutbox,
  leaseToken: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const leaseNow = Date.now();
    const [pending] = await tx
      .select(tasksSendOutboxSelection)
      .from(noteTaskSendOutbox)
      .where(
        and(
          eq(noteTaskSendOutbox.operationId, reservation.operationId),
          eq(noteTaskSendOutbox.userId, userId),
          eq(noteTaskSendOutbox.noteId, reservation.noteId),
          eq(noteTaskSendOutbox.status, "pending"),
          eq(noteTaskSendOutbox.leaseToken, leaseToken),
          sql`${noteTaskSendOutbox.leaseExpiresAt} > ${leaseNow}`,
        ),
      )
      .limit(1);
    if (!pending) return;

    const released = await tx
      .update(notes)
      // The reservation changed no user content. Restore the content version
      // the caller supplied so a corrected retry does not manufacture a body
      // conflict. A client that observed the reservation version safely loses
      // its CAS and receives this latest row.
      .set({ updatedAt: pending.baseUpdatedAt })
      .where(
        and(
          eq(notes.id, pending.noteId),
          eq(notes.userId, userId),
          eq(notes.updatedAt, pending.reservedUpdatedAt),
          isNull(notes.archivedAt),
          isNull(notes.promotedTaskId),
        ),
      )
      .returning({ id: notes.id });
    if (!released[0]) {
      throw new Error("The rejected Tasks send could not release its source note");
    }
    const removed = await tx
      .delete(noteTaskSendOutbox)
      .where(
        and(
          eq(noteTaskSendOutbox.operationId, pending.operationId),
          eq(noteTaskSendOutbox.status, "pending"),
          eq(noteTaskSendOutbox.leaseToken, leaseToken),
        ),
      )
      .returning({ operationId: noteTaskSendOutbox.operationId });
    if (!removed[0]) {
      throw new Error("The rejected Tasks send reservation changed unexpectedly");
    }
  });
}

async function clearTasksSendLease(
  userId: string,
  operationId: string,
  leaseToken: string,
): Promise<void> {
  await db
    .update(noteTaskSendOutbox)
    .set({
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(noteTaskSendOutbox.operationId, operationId),
        eq(noteTaskSendOutbox.userId, userId),
        eq(noteTaskSendOutbox.status, "pending"),
        eq(noteTaskSendOutbox.leaseToken, leaseToken),
      ),
    );
}

/**
 * Hybrid capture seam. The client owns the stable id so an offline retry or a
 * lost response reconciles to the same owned row instead of duplicating text.
 * Accepted note bodies are stored byte-for-byte; trim is emptiness-only.
 */
export async function createNoteIdempotent(
  input: CreateNoteIdempotentInput,
): Promise<NoteRead> {
  refuseDemoMutation();
  const id = validateStableNoteId(input.id);
  const body = validateNoteBody(input.body);
  const requestedWorkspaceId = normalizeOptionalWorkspaceId(input.workspaceId);
  const source = normalizeCaptureSource(input.source);
  const userId = await requireUser();
  // Capture is the load-bearing private action. A stale membership or a
  // temporarily unavailable sister product must never hold the writing
  // hostage, so an unconfirmed destination falls back to Unfiled.
  const workspaceId = requestedWorkspaceId &&
    (await authorizeTasksWorkspace(userId, requestedWorkspaceId)) === "allowed"
      ? requestedWorkspaceId
      : null;

  const now = Date.now();
  const inserted = await db
    .insert(notes)
    .values({
      id,
      userId,
      body,
      createdAt: now,
      updatedAt: now,
      workspaceId,
      source,
    })
    .onConflictDoNothing()
    .returning(hybridNoteSelection);

  if (inserted[0]) {
    // Only a real insert counts. The replay path below reconciles a lost
    // response and writes nothing, so it must not look like new work.
    await recordSponsoredUse(
      {
        product: "notes",
        kind: "note_created",
        objectKey: id,
        subjectId: userId,
        workspaceId,
        occurredAt: now,
      },
      true,
    );
    return inserted[0];
  }

  // Reconcile only through the signed-in owner scope. A collision belonging
  // to another account is deliberately indistinguishable from any other id
  // collision and never discloses row contents.
  const existing = await readOwnedNote(userId, id);
  if (!existing) throw new Error("Capture id is already in use");
  // The server may deliberately have fallen back to Unfiled on the first
  // attempt. Exact body + exact stable identity is therefore sufficient to
  // reconcile a lost response even if Tasks membership recovered meanwhile.
  if (existing.body !== body) {
    throw new Error("Capture id already belongs to different note content");
  }
  return existing;
}

/**
 * Owner-scoped compare-and-swap save. Neither version is normalized: on a
 * conflict the client receives its exact attempted body and the exact remote
 * row so it can retain both until the creator resolves them.
 */
export async function updateNoteWithVersion(
  input: UpdateNoteWithVersionInput,
): Promise<UpdateNoteWithVersionResult> {
  refuseDemoMutation();
  const id = validateStableNoteId(input.id);
  const attempted = createAttemptedVersion(input.body, input.expectedUpdatedAt);
  const userId = await requireUser();
  const updatedAt = nextUpdatedAt(Date.now(), attempted.updatedAt);

  const updated = await db
    .update(notes)
    .set({ body: attempted.body, updatedAt })
    .where(
      and(
        eq(notes.id, id),
        eq(notes.userId, userId),
        eq(notes.updatedAt, attempted.updatedAt),
        isNull(notes.archivedAt),
        noPendingTasksSend(userId, id),
      ),
    )
    .returning(hybridNoteSelection);

  if (updated[0]) {
    // Only the compare-and-swap that actually wrote counts. The lost-response
    // retry below returns "saved" without writing, and an autosave timer means
    // this path fires often; the day-bucketed event id collapses a day of
    // saves on one note into a single edit.
    await recordSponsoredUse(
      {
        product: "notes",
        kind: "note_materially_edited",
        objectKey: id,
        subjectId: userId,
        workspaceId: updated[0].workspaceId,
        occurredAt: updatedAt,
      },
      true,
    );
    return { status: "saved", note: updated[0] };
  }

  const remote = await readOwnedNote(userId, id);
  if (!remote) throw new Error("Note not found");
  const [pending] = await db
    .select({ operationId: noteTaskSendOutbox.operationId })
    .from(noteTaskSendOutbox)
    .where(
      and(
        eq(noteTaskSendOutbox.userId, userId),
        eq(noteTaskSendOutbox.noteId, id),
        eq(noteTaskSendOutbox.status, "pending"),
      ),
    )
    .limit(1);
  if (pending) {
    return createVersionConflict(attempted.body, attempted.updatedAt, remote);
  }
  // A response may have been lost after an earlier identical CAS succeeded.
  // Treat that retry as saved instead of manufacturing a conflict.
  if (remote.body === attempted.body && remote.archivedAt === null) {
    return { status: "saved", note: remote };
  }
  return createVersionConflict(attempted.body, attempted.updatedAt, remote);
}

/**
 * Owner-scoped compare-and-swap delete for the hybrid notebook. A pending
 * approved send deliberately makes the CAS fail: the latest remote row is
 * returned intact so the UI never removes text while Tasks may be accepting
 * it. Completed outbox text is deleted atomically with the source note.
 */
export async function deleteNoteWithVersion(
  input: DeleteNoteWithVersionInput,
): Promise<DeleteNoteWithVersionResult> {
  refuseDemoMutation();
  const id = validateStableNoteId(input.id);
  const expectedUpdatedAt = validateExpectedUpdatedAt(input.expectedUpdatedAt);
  const userId = await requireUser();

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select(hybridNoteSelection)
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);
    if (!current) throw new Error("Note not found");

    const [pending] = await tx
      .select({ operationId: noteTaskSendOutbox.operationId })
      .from(noteTaskSendOutbox)
      .where(
        and(
          eq(noteTaskSendOutbox.userId, userId),
          eq(noteTaskSendOutbox.noteId, id),
          eq(noteTaskSendOutbox.status, "pending"),
        ),
      )
      .limit(1);
    if (pending || current.updatedAt !== expectedUpdatedAt) {
      return { status: "conflict" as const, remote: current };
    }

    const deleted = await tx
      .delete(notes)
      .where(
        and(
          eq(notes.id, id),
          eq(notes.userId, userId),
          eq(notes.updatedAt, expectedUpdatedAt),
          noPendingTasksSend(userId, id),
        ),
      )
      .returning({ id: notes.id });

    if (deleted[0]) {
      await tx
        .delete(noteTaskSendOutbox)
        .where(
          and(
            eq(noteTaskSendOutbox.userId, userId),
            eq(noteTaskSendOutbox.noteId, id),
          ),
        );
      return { status: "deleted" as const, id };
    }

    // A late writer won after our first read. Returning the latest row keeps
    // the user's private text recoverable instead of flattening this to 404.
    const [remote] = await tx
      .select(hybridNoteSelection)
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);
    if (!remote) throw new Error("Note not found");
    return { status: "conflict" as const, remote };
  });
}

/**
 * Record that the owner has decided about this note in Review.
 *
 * Owner-scoped and deliberately not version-checked. This writes one
 * boolean-shaped fact about the person's own attention, not about the note's
 * content, so a concurrent edit elsewhere must not make the decision fail or
 * silently roll a body back. `updatedAt` is left alone for the same reason:
 * bumping it would invalidate an open editor's version and cost someone their
 * in-flight text to record that they had glanced at it.
 *
 * Reversible on purpose. Undo after "Keep in Notes" calls this with
 * `reviewed: false`, which returns the note to the queue exactly where it was.
 */
export async function setNoteReviewed(
  input: SetNoteReviewedInput,
): Promise<NoteRead> {
  refuseDemoMutation();
  const noteId = validateStableNoteId(input.id);
  const userId = await requireUser();
  const [row] = await db
    .update(notes)
    .set({ reviewedAt: input.reviewed ? Date.now() : null })
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .returning(hybridNoteSelection);
  if (!row) throw new Error("Note not found");
  return row;
}

/**
 * Hybrid compatibility restore. Only archive visibility changes: the durable
 * Tasks receipt, approved extract, and workspace projection stay attached.
 */
export async function restoreArchivedNoteForHybrid(
  noteIdInput: string,
): Promise<NoteRead> {
  refuseDemoMutation();
  const noteId = validateStableNoteId(noteIdInput);
  const userId = await requireUser();
  const now = Date.now();
  const [row] = await db
    .update(notes)
    .set({
      archivedAt: null,
      updatedAt: sql`MAX(${notes.updatedAt} + 1, ${now})`,
    })
    .where(
      and(
        eq(notes.id, noteId),
        eq(notes.userId, userId),
        isNotNull(notes.archivedAt),
        noPendingTasksSend(userId, noteId),
      ),
    )
    .returning(hybridNoteSelection);
  if (!row) throw new Error("Note not found or not archived");
  return row;
}

/**
 * Owner-only recovery projection. Pending exact wording is returned solely so
 * a refreshed client can render and retry the immutable request; it is never
 * joined into collaborative or analytics surfaces.
 */
export async function listPendingApprovedTaskSendsForHybrid(): Promise<
  PendingApprovedTasksSendRead[]
> {
  if (isDemoMode()) return [];
  const userId = await requireUser();
  return db
    .select(pendingApprovedTaskSendSelection)
    .from(noteTaskSendOutbox)
    .where(
      and(
        eq(noteTaskSendOutbox.userId, userId),
        eq(noteTaskSendOutbox.status, "pending"),
      ),
    )
    .orderBy(desc(noteTaskSendOutbox.createdAt));
}

/**
 * Owner-only recovery after an in-session Server Action failure. A response
 * can be lost after the receipt transaction commits, so callers must
 * distinguish a still-pending immutable retry from an already-completed send.
 */
export async function getApprovedTaskSendRecoveryForHybrid(
  noteIdInput: string,
): Promise<ApprovedTasksSendRecoveryRead> {
  if (isDemoMode()) return { status: "none" };
  const noteId = validateStableNoteId(noteIdInput);
  const userId = await requireUser();

  return db.transaction(async (tx) => {
    const [outbox] = await tx
      .select(tasksSendOutboxSelection)
      .from(noteTaskSendOutbox)
      .where(
        and(
          eq(noteTaskSendOutbox.userId, userId),
          eq(noteTaskSendOutbox.noteId, noteId),
        ),
      )
      .limit(1);
    if (!outbox) return { status: "none" as const };

    if (outbox.status === "pending") {
      return {
        status: "pending" as const,
        send: {
          operationId: outbox.operationId,
          noteId: outbox.noteId,
          sourceSelection: outbox.sourceSelection,
          approvedBody: outbox.approvedBody,
          workspaceId: outbox.workspaceId,
          baseUpdatedAt: outbox.baseUpdatedAt,
          reservedUpdatedAt: outbox.reservedUpdatedAt,
          createdAt: outbox.createdAt,
        },
      };
    }

    const [note] = await tx
      .select(hybridNoteSelection)
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .limit(1);
    if (
      !note ||
      !outbox.taskId ||
      note.promotedTaskId !== outbox.taskId ||
      note.workspaceId !== outbox.workspaceId ||
      !note.extractBody ||
      approvedBodySha256(note.extractBody) !== outbox.approvedBodySha256
    ) {
      throw new Error("The durable Tasks receipt is inconsistent");
    }

    return {
      status: "completed" as const,
      note,
      result: replayedTasksSendReceipt(outbox.taskId),
    };
  });
}

/**
 * Deliberate Notes -> Tasks edge for the hybrid notebook. The selected source
 * must still exist in the current note, the editable approved wording is
 * preserved exactly, and only the three-field safe payload crosses products.
 * Unlike the legacy promote action, the private note remains in the stream.
 */
export async function sendApprovedExtractToTasks(
  input: SendApprovedExtractInput,
): Promise<SendApprovedExtractResult> {
  refuseDemoMutation();
  const noteId = validateStableNoteId(input.noteId);
  const sourceSelection = validateSourceSelection(input.sourceSelection);
  const approvedBody = validateApprovedBody(input.approvedBody);
  const workspaceId = createApprovedTasksPayload({
    noteId,
    approvedBody,
    workspaceId: input.workspaceId,
  }).workspaceId;
  const expectedUpdatedAt = validateExpectedUpdatedAt(input.expectedUpdatedAt);
  const userId = await requireUser();
  const payload = createApprovedTasksPayload({
    noteId,
    approvedBody,
    workspaceId,
  });
  const approvedSha256 = approvedBodySha256(approvedBody);
  const immutableRequest = {
    noteId,
    userId,
    sourceSelection,
    approvedBody,
    approvedBodySha256: approvedSha256,
    workspaceId,
  };

  // Resolve configuration before reserving. A missing secret is definitive,
  // so it must not leave the note locked behind a send that never started.
  const base = tasksApiUrl();
  const secret = tasksSecret();

  // A previously authorized pending request can resume without a second
  // catalogue dependency. New requests still prove current membership before
  // the CAS reservation is written.
  const [preexistingOutbox] = await db
    .select(tasksSendOutboxSelection)
    .from(noteTaskSendOutbox)
    .where(
      and(
        eq(noteTaskSendOutbox.userId, userId),
        eq(noteTaskSendOutbox.noteId, noteId),
      ),
    )
    .limit(1);
  if (!preexistingOutbox) {
    await requireAuthorizedTasksWorkspace(userId, workspaceId);
  }

  type Reservation =
    | { kind: "conflict"; remote: NoteRead }
    | { kind: "receipt"; note: NoteRead; taskId: string }
    | {
        kind: "pending";
        note: NoteRead;
        outbox: NoteTaskSendOutbox;
        resumed: boolean;
        leaseToken: string;
      };

  const reservation: Reservation = await db.transaction(async (tx) => {
    const [current] = await tx
      .select(hybridNoteSelection)
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .limit(1);
    if (!current) throw new Error("Note not found");

    const [existing] = await tx
      .select(tasksSendOutboxSelection)
      .from(noteTaskSendOutbox)
      .where(
        and(
          eq(noteTaskSendOutbox.userId, userId),
          eq(noteTaskSendOutbox.noteId, noteId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === "completed") {
        if (
          !existing.taskId ||
          existing.approvedBodySha256 !== approvedSha256 ||
          existing.workspaceId !== workspaceId ||
          current.promotedTaskId !== existing.taskId ||
          current.extractBody !== approvedBody ||
          current.workspaceId !== workspaceId
        ) {
          throw new Error("The durable Tasks receipt is inconsistent");
        }
        return {
          kind: "receipt" as const,
          note: current,
          taskId: existing.taskId,
        };
      }
      if (!sameImmutableTasksSendRequest(existing, immutableRequest)) {
        throw new Error(
          "A different approved Tasks send is still reconciling for this note",
        );
      }

      // A lost response may leave the client holding either the base version
      // or the reservation version. No other version may resume this request.
      if (
        !canResumePendingTasksSend(
          existing,
          immutableRequest,
          expectedUpdatedAt,
        )
      ) {
        return { kind: "conflict" as const, remote: current };
      }
      if (
        current.updatedAt !== existing.reservedUpdatedAt ||
        current.archivedAt !== null ||
        current.promotedTaskId !== null
      ) {
        throw new Error("The pending Tasks send no longer matches its source note");
      }
      assertSelectionBelongsToNote(current.body, sourceSelection);

      const leaseNow = Date.now();
      if (
        existing.leaseToken !== null &&
        existing.leaseExpiresAt !== null &&
        existing.leaseExpiresAt > leaseNow
      ) {
        throw new Error(
          "This exact Tasks send is already being reconciled in another tab. Wait a moment, then retry.",
        );
      }
      const leaseToken = makeTasksSendLeaseToken();
      const [leased] = await tx
        .update(noteTaskSendOutbox)
        .set({
          leaseToken,
          leaseExpiresAt: leaseNow + TASKS_SEND_LEASE_MS,
          attemptCount: sql`${noteTaskSendOutbox.attemptCount} + 1`,
          updatedAt: leaseNow,
        })
        .where(
          and(
            eq(noteTaskSendOutbox.operationId, existing.operationId),
            eq(noteTaskSendOutbox.userId, userId),
            eq(noteTaskSendOutbox.noteId, noteId),
            eq(noteTaskSendOutbox.status, "pending"),
            sql`(
              ${noteTaskSendOutbox.leaseToken} IS NULL
              OR ${noteTaskSendOutbox.leaseExpiresAt} <= ${leaseNow}
            )`,
          ),
        )
        .returning(tasksSendOutboxSelection);
      if (!leased) {
        throw new Error(
          "This exact Tasks send is already being reconciled in another tab. Wait a moment, then retry.",
        );
      }
      return {
        kind: "pending" as const,
        note: current,
        outbox: leased,
        resumed: true,
        leaseToken,
      };
    }

    // Compatibility: a receipt written before the outbox migration remains
    // locally replayable, but no new network call is permitted for it.
    if (
      current.promotedTaskId &&
      current.extractBody === approvedBody &&
      current.workspaceId === workspaceId &&
      current.archivedAt === null
    ) {
      return {
        kind: "receipt" as const,
        note: current,
        taskId: current.promotedTaskId,
      };
    }
    if (current.updatedAt !== expectedUpdatedAt) {
      return { kind: "conflict" as const, remote: current };
    }
    if (current.archivedAt !== null) {
      throw new Error("This note is archived and cannot be sent");
    }
    if (current.promotedTaskId) {
      throw new Error("This note was already sent with different approved wording");
    }
    assertSelectionBelongsToNote(current.body, sourceSelection);

    const reservedUpdatedAt = nextUpdatedAt(Date.now(), expectedUpdatedAt);
    const reserved = await tx
      .update(notes)
      .set({ updatedAt: reservedUpdatedAt })
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.userId, userId),
          eq(notes.updatedAt, expectedUpdatedAt),
          isNull(notes.archivedAt),
          isNull(notes.promotedTaskId),
        ),
      )
      .returning(hybridNoteSelection);
    if (!reserved[0]) {
      const [remote] = await tx
        .select(hybridNoteSelection)
        .from(notes)
        .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
        .limit(1);
      if (!remote) throw new Error("Note not found");
      return { kind: "conflict" as const, remote };
    }

    const now = Date.now();
    const leaseToken = makeTasksSendLeaseToken();
    const inserted = await tx
      .insert(noteTaskSendOutbox)
      .values({
        operationId: makeTasksSendOperationId(),
        ...immutableRequest,
        baseUpdatedAt: expectedUpdatedAt,
        reservedUpdatedAt,
        status: "pending",
        leaseToken,
        leaseExpiresAt: now + TASKS_SEND_LEASE_MS,
        attemptCount: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning(tasksSendOutboxSelection);
    if (!inserted[0]) throw new Error("Could not reserve the Tasks send");
    return {
      kind: "pending" as const,
      note: reserved[0],
      outbox: inserted[0],
      resumed: false,
      leaseToken,
    };
  });

  if (reservation.kind === "conflict") {
    return createRemoteConflict(reservation.remote);
  }
  if (reservation.kind === "receipt") {
    return {
      status: "sent",
      note: reservation.note,
      result: replayedTasksSendReceipt(reservation.taskId),
    };
  }

  let response: Response;
  try {
    response = await fetch(`${base}/api/notes-extract/v2`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${createTasksExtractAssertionV2(
          userId,
          noteId,
          workspaceId,
          approvedSha256,
          secret,
        )}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    await clearTasksSendLease(
      userId,
      reservation.outbox.operationId,
      reservation.leaseToken,
    );
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Tasks timed out, try again in a moment");
    }
    throw error;
  }

  if (!response.ok) {
    let detail = `Tasks returned ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) detail = data.error;
    } catch {
      // Keep the status-code fallback for a non-JSON upstream response.
    }
    if (
      shouldReleaseTasksSendReservation(response.status, reservation.resumed)
    ) {
      await releaseRejectedTasksSend(
        userId,
        reservation.outbox,
        reservation.leaseToken,
      );
    } else {
      await clearTasksSendLease(
        userId,
        reservation.outbox.operationId,
        reservation.leaseToken,
      );
    }
    // Timeouts, throttles, and server/proxy failures retain the durable
    // pending row; only the exact owner-visible retry may resume them.
    throw new Error(detail);
  }
  let result: TrustedTasksSendReceipt;
  try {
    result = parseTrustedTasksSendReceipt(
      await response.json(),
      approvedSha256,
    );
  } catch (error) {
    await clearTasksSendLease(
      userId,
      reservation.outbox.operationId,
      reservation.leaseToken,
    );
    throw error;
  }

  let finalized: { note: NoteRead; replayed: boolean };
  try {
    finalized = await db.transaction(async (tx) => {
    const [outbox] = await tx
      .select(tasksSendOutboxSelection)
      .from(noteTaskSendOutbox)
      .where(
        and(
          eq(noteTaskSendOutbox.operationId, reservation.outbox.operationId),
          eq(noteTaskSendOutbox.userId, userId),
          eq(noteTaskSendOutbox.noteId, noteId),
        ),
      )
      .limit(1);
    const [current] = await tx
      .select(hybridNoteSelection)
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
      .limit(1);
    if (!outbox || !current) {
      throw new Error("The pending Tasks receipt could not be reconciled");
    }
    if (outbox.status === "completed") {
      if (
        outbox.taskId !== result.taskId ||
        outbox.approvedBodySha256 !== approvedSha256 ||
        outbox.workspaceId !== workspaceId ||
        current.promotedTaskId !== result.taskId ||
        current.extractBody !== approvedBody
      ) {
        throw new Error("Tasks returned a different task for this note");
      }
      return { note: current, replayed: true };
    }
    if (!sameImmutableTasksSendRequest(outbox, immutableRequest)) {
      throw new Error("The pending Tasks request changed unexpectedly");
    }
    const completedAt = Date.now();
    if (
      outbox.leaseToken !== reservation.leaseToken ||
      outbox.leaseExpiresAt === null ||
      outbox.leaseExpiresAt <= completedAt
    ) {
      throw new Error(
        "The Tasks send attempt lease changed before its receipt was stored",
      );
    }
    if (
      current.updatedAt !== outbox.reservedUpdatedAt ||
      current.archivedAt !== null ||
      current.promotedTaskId !== null
    ) {
      throw new Error("The source note changed while Tasks was accepting it");
    }

    const finalUpdatedAt = nextUpdatedAt(completedAt, outbox.reservedUpdatedAt);
    const stored = await tx
      .update(notes)
      .set({
        extractBody: approvedBody,
        promotedTaskId: result.taskId,
        workspaceId,
        archivedAt: null,
        updatedAt: finalUpdatedAt,
      })
      .where(
        and(
          eq(notes.id, noteId),
          eq(notes.userId, userId),
          eq(notes.updatedAt, outbox.reservedUpdatedAt),
          isNull(notes.archivedAt),
          isNull(notes.promotedTaskId),
        ),
      )
      .returning(hybridNoteSelection);
    if (!stored[0]) {
      throw new Error("The source note changed while storing the Tasks receipt");
    }

    const completed = await tx
      .update(noteTaskSendOutbox)
      .set({
        status: "completed",
        taskId: result.taskId,
        // The note now holds the creator-approved extract. Do not retain a
        // second raw copy (or the private source selection) in the ledger.
        sourceSelection: "",
        approvedBody: "",
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: completedAt,
        completedAt,
      })
      .where(
        and(
          eq(noteTaskSendOutbox.operationId, outbox.operationId),
          eq(noteTaskSendOutbox.status, "pending"),
          eq(noteTaskSendOutbox.leaseToken, reservation.leaseToken),
          sql`${noteTaskSendOutbox.leaseExpiresAt} > ${completedAt}`,
        ),
      )
      .returning({ operationId: noteTaskSendOutbox.operationId });
    if (!completed[0]) {
      throw new Error("The Tasks receipt was already being finalized");
    }
    return { note: stored[0], replayed: false };
    });
  } catch (error) {
    await clearTasksSendLease(
      userId,
      reservation.outbox.operationId,
      reservation.leaseToken,
    );
    throw error;
  }

  return {
    status: "sent",
    note: finalized.note,
    result: finalized.replayed ? { ...result, created: false } : result,
  };
}
