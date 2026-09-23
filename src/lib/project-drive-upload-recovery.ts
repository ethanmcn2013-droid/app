/** No provider identifiers, credentials, byte offsets or resumable capabilities. */
export type DriveUploadRecoveryResult = "complete" | "pending" | "unavailable" | "review" | "disabled";

export const driveRecoveryCopy = {
  checking: "Checking the existing upload…",
  complete: "Upload confirmed in Google Drive.",
  pending: "The upload is still unconfirmed. Keep the existing entry and finish in the original tab if it is open.",
  unavailable: "The upload could not be checked. Keep its existing entry and try again later.",
} as const;

export type RecoverableDriveRow = Readonly<{
  id: string; taskId: string; storage: string; accessState: string; addedByUserId: string | null;
}>;

export function pendingOwnDriveUploads(rows: readonly RecoverableDriveRow[], taskId: string, actorId: string, mountedIds: readonly string[]) {
  return rows.filter(row => row.taskId === taskId && row.storage === "google_drive" &&
    row.accessState === "pending" && row.addedByUserId === actorId && !mountedIds.includes(row.id));
}

/** A click checks only saved claims. It never holds a File or upload capability. */
export function createDriveRecoveryController(taskId: string, ports: {
  recover: (taskId: string, resourceId: string) => Promise<DriveUploadRecoveryResult>;
  refresh: () => Promise<void>;
  changed: (state: keyof typeof driveRecoveryCopy | null) => void;
}) {
  let running = false;
  let disposed = false;
  return {
    async check(rows: readonly RecoverableDriveRow[], actorId: string, mountedIds: readonly string[]) {
      if (running || disposed) return;
      running = true;
      ports.changed("checking");
      let outcome: keyof typeof driveRecoveryCopy | null = null;
      try {
        const pending = pendingOwnDriveUploads(rows, taskId, actorId, mountedIds);
        const ids = [...new Set(pending.map(row => row.id))];
        for (const id of ids) {
          if (disposed) return;
          const result = await ports.recover(taskId, id);
          if (result !== "complete" && result !== "pending") outcome = "unavailable";
          else if (outcome !== "unavailable") outcome = result === "pending" || outcome === "pending" ? "pending" : "complete";
        }
      } catch { outcome = "unavailable"; }
      finally {
        if (!disposed) {
          try { await ports.refresh(); } catch { outcome = "unavailable"; }
          if (!disposed) ports.changed(outcome);
        }
        running = false;
      }
    },
    dispose() { disposed = true; },
  };
}
