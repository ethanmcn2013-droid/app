import { createHash } from "node:crypto";

export const MAX_APPROVED_NOTES_EXTRACT_CHARS = 280;

export type ExistingNotesExtractIdentity = Readonly<{
  id: string;
  workspaceId: string | null;
  sourceNoteExtractBody: string | null;
  sourceNoteExtractSha256: string | null;
}>;

export type NotesExtractReplayDecision =
  | Readonly<{ kind: "match" }>
  | Readonly<{ kind: "workspace-mismatch" }>
  | Readonly<{ kind: "legacy-unverifiable" }>
  | Readonly<{ kind: "body-mismatch" }>;

/** Validate emptiness and length without normalizing accepted wording. */
export function validateExactApprovedBody(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError("Missing required field: body");
  }
  if (value.length > MAX_APPROVED_NOTES_EXTRACT_CHARS) {
    throw new TypeError("body is longer than 280 characters");
  }
  return value;
}

export function approvedBodySha256(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/**
 * A Notes retry is safe only when every assertion-bound identity dimension
 * still matches. Null exact-replay fields are legacy and fail closed.
 */
export function classifyNotesExtractReplay(
  existing: ExistingNotesExtractIdentity,
  requested: Readonly<{
    workspaceId: string;
    body: string;
    bodySha256: string;
  }>,
): NotesExtractReplayDecision {
  if (existing.workspaceId !== requested.workspaceId) {
    return { kind: "workspace-mismatch" };
  }
  if (
    existing.sourceNoteExtractBody === null ||
    existing.sourceNoteExtractSha256 === null
  ) {
    return { kind: "legacy-unverifiable" };
  }
  if (
    existing.sourceNoteExtractSha256 !== requested.bodySha256 ||
    existing.sourceNoteExtractBody !== requested.body
  ) {
    return { kind: "body-mismatch" };
  }
  return { kind: "match" };
}
