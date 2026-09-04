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
  loading: "Checking earlier uploads…",
  unavailable: "Earlier uploads could not be checked. Try again before adding another file.",
  pending: "An earlier Drive upload is unconfirmed. Check for updates before attaching another copy. If it is still incomplete, finish in the original tab if it is open. Keep the existing entry; a closed tab cannot resume sending this file.",
};
