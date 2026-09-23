/** Private recovery identities. Project IDs here are bindings, never authority. */
export type RecoveredEdit = {
  body: string;
  expectedUpdatedAt: number;
  workspaceId: string | null;
  queued: boolean;
};

export function notebookRecoveryKey(actorScope: string, workspaceId: string | null): string {
  return `${actorScope}:${encodeURIComponent(workspaceId ?? "")}`;
}

export function recoveredEditForNote(
  value: unknown,
  note: { workspaceId: string | null },
): RecoveredEdit | null {
  if (!value || typeof value !== "object") return null;
  const edit = value as Partial<RecoveredEdit>;
  return typeof edit.body === "string" &&
    typeof edit.expectedUpdatedAt === "number" && Number.isFinite(edit.expectedUpdatedAt) &&
    edit.workspaceId === note.workspaceId && typeof edit.queued === "boolean"
    ? edit as RecoveredEdit : null;
}

/** A reply to an older save must not erase writing entered while it was pending. */
export function editAfterSave(
  current: RecoveredEdit | null,
  attempted: { body: string; expectedUpdatedAt: number },
  saved: { body: string; updatedAt: number },
): RecoveredEdit | null {
  if (!current || current.body === saved.body) return null;
  if (current.expectedUpdatedAt !== attempted.expectedUpdatedAt) return current;
  return { ...current, expectedUpdatedAt: saved.updatedAt, queued: false };
}
