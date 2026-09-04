export type DriveReloadState = "loading" | "unavailable" | "pending" | null;

/** Metadata cannot prove that reselected bytes match a partially sent file. */
export function driveReloadState(
  rows: readonly { id: string; storage: string; accessState: string }[] | null,
  loadFailed: boolean,
  mountedClaimIds: readonly string[],
): DriveReloadState {
  if (loadFailed) return "unavailable";
  if (rows === null) return "loading";
  return rows.some(row => row.storage === "google_drive" && row.accessState === "pending" && !mountedClaimIds.includes(row.id)) ? "pending" : null;
}

export const driveReloadCopy: Record<Exclude<DriveReloadState, null>, string> = {
  loading: "Checking saved Resources before starting another upload…",
  unavailable: "Saved Resources could not be checked. Refresh them before starting another upload.",
  pending: "An earlier Drive upload is unconfirmed. Keep its existing entry. The uploader should return to the original tab if it is still open. This page cannot verify that a reselected file has the same contents. If the original tab is closed, ask for help checking the existing upload before attaching another copy. Refresh saved status after it is resolved.",
};
