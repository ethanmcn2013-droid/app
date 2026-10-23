/** Server-owned rollout switch. Never derive retirement from a URL or client preference. */
export function notesRetirementEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.NOTES_RETIREMENT_ARCHIVE_ENABLED === "1" || env.NOTES_RETIREMENT_ARCHIVE_ENABLED === "true";
}

export function assertNotesWritable(env: Readonly<Record<string, string | undefined>> = process.env): void {
  if (notesRetirementEnabled(env)) throw new Error("Notes is read-only. Your existing notes are still available in the archive.");
}
