export const MAX_NOTE_BODY_CHARS = 10_000;
export const MAX_APPROVED_EXTRACT_CHARS = 280;

const STABLE_NOTE_ID = /^n_[0-9a-f]{32}$/;

export type NoteBodyVersion = Readonly<{
  body: string;
  updatedAt: number;
}>;

export type ApprovedTasksPayload = Readonly<{
  noteId: string;
  body: string;
  workspaceId: string;
}>;

export function validateStableNoteId(value: string): string {
  if (!STABLE_NOTE_ID.test(value)) {
    throw new TypeError("Note id must be n_ followed by 32 lowercase hex characters");
  }
  return value;
}

export function validateNoteBody(body: string): string {
  if (!body.trim()) throw new TypeError("Note body is empty");
  if (body.length > MAX_NOTE_BODY_CHARS) {
    throw new TypeError("Note is longer than 10,000 characters");
  }
  return body;
}

export function validateExpectedUpdatedAt(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Expected note version is invalid");
  }
  return value;
}

export function normalizeOptionalWorkspaceId(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 128) throw new TypeError("Workspace id is too long");
  return normalized;
}

export function validateRequiredWorkspaceId(value: string): string {
  const normalized = normalizeOptionalWorkspaceId(value);
  if (!normalized) throw new TypeError("Choose a Tasks workspace first");
  return normalized;
}

export function validateSourceSelection(value: string): string {
  if (!value.trim()) throw new TypeError("Select wording from the note first");
  if (value.length > MAX_NOTE_BODY_CHARS) {
    throw new TypeError("Selected wording is too long");
  }
  return value;
}

export function validateApprovedBody(value: string): string {
  if (!value.trim()) throw new TypeError("Approved action is empty");
  if (value.length > MAX_APPROVED_EXTRACT_CHARS) {
    throw new TypeError("Approved action is longer than 280 characters");
  }
  return value;
}

export function assertSelectionBelongsToNote(
  noteBody: string,
  sourceSelection: string,
): void {
  if (!noteBody.includes(sourceSelection)) {
    throw new TypeError("Selected wording is no longer present in this note");
  }
}

/**
 * The only JSON body permitted to cross from Notes to Tasks. Keeping this
 * constructor pure makes the raw-note privacy boundary directly testable.
 */
export function createApprovedTasksPayload(input: {
  noteId: string;
  approvedBody: string;
  workspaceId: string;
}): ApprovedTasksPayload {
  return {
    noteId: validateStableNoteId(input.noteId),
    body: validateApprovedBody(input.approvedBody),
    workspaceId: validateRequiredWorkspaceId(input.workspaceId),
  };
}

export function reconcileStableCapture(
  existing: Readonly<{ body: string; workspaceId: string | null }>,
  requested: Readonly<{ body: string; workspaceId: string | null }>,
): "match" | "mismatch" {
  return existing.body === requested.body &&
    existing.workspaceId === requested.workspaceId
    ? "match"
    : "mismatch";
}

export function nextUpdatedAt(now: number, previous: number): number {
  return Math.max(Math.trunc(now), previous + 1);
}

export function createAttemptedVersion(
  body: string,
  expectedUpdatedAt: number,
): NoteBodyVersion {
  return {
    body: validateNoteBody(body),
    updatedAt: validateExpectedUpdatedAt(expectedUpdatedAt),
  };
}

export function createVersionConflict<TRemote>(
  attemptedBody: string,
  expectedUpdatedAt: number,
  remote: TRemote,
): {
  status: "conflict";
  attempted: NoteBodyVersion;
  remote: TRemote;
} {
  return {
    status: "conflict",
    attempted: createAttemptedVersion(attemptedBody, expectedUpdatedAt),
    remote,
  };
}

export function createRemoteConflict<TRemote>(remote: TRemote): {
  status: "conflict";
  remote: TRemote;
} {
  return { status: "conflict", remote };
}

/** Quiet stream copy shared by desktop split view and mobile detail. */
export function presentNoteBody(body: string): {
  title: string;
  preview: string;
} {
  const [firstLine = "", ...rest] = body.split(/\r?\n/);
  const fullTitle = firstLine.trim();
  const title = fullTitle
    ? fullTitle.length > 88
      ? `${fullTitle.slice(0, 87).trimEnd()}…`
      : fullTitle
    : "Untitled note";
  return {
    title,
    preview: rest.join(" ").replace(/\s+/g, " ").trim(),
  };
}
