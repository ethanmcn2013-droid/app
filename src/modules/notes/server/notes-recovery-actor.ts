import { createHash } from "node:crypto";

/** Opaque account namespace, shared by the rendered notebook and its replay fence. */
export function notesRecoveryActorScope(userId: string): string {
  return createHash("sha256").update(`signal-notes:${userId}`).digest("hex").slice(0, 24);
}

export function assertNotesRecoveryActor(userId: string, expectedScope?: string): void {
  if (expectedScope !== undefined && expectedScope !== notesRecoveryActorScope(userId)) {
    throw new Error("Your account changed. Reopen Notes before saving. Your writing is kept for the original account.");
  }
}
