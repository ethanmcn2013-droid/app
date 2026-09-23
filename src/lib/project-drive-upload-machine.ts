import type { DriveUploadSessionResult, FinalizeDriveUploadResult } from "@/server/connections/drive-uploads";
import type { DriveResumableUploadOptions, DriveResumableUploadResult } from "./drive-resumable-upload";

export type DriveUploadView = Readonly<{
  phase: "checking" | "uploading" | "confirming" | "paused" | "fallback" | "native" | "native-uncertain" | "complete" | "cancelled";
  confirmedBytes: number;
  message: string;
}>;
export type DriveUploadPorts = {
  create: (taskId: string, input: { resourceId: string; name: string; mimeType: string; sizeBytes: number }) => Promise<DriveUploadSessionResult>;
  upload: (options: DriveResumableUploadOptions) => Promise<DriveResumableUploadResult>;
  finalize: (resourceId: string, fileId: string) => Promise<FinalizeDriveUploadResult>;
  native: (taskId: string, file: File) => Promise<unknown>;
};

const fallbackCopy = {
  "no-current-storage": "This board has no Drive folder. Use Signal Studio for this file.",
  "storage-unavailable": "The board’s Drive is unavailable. Use Signal Studio for this file.",
  "member-access-incomplete": "Drive access is incomplete for this board. Use Signal Studio for this file.",
  "quota-full": "The storage owner’s Drive is full. Use Signal Studio for this file.",
  "provider-unavailable": "Google Drive is unavailable. Use Signal Studio for this file.",
};

/** One in-memory claim, one immutable file and task, no persisted capability URL.
 * All retries ask the server to probe the same claim before sending more bytes.
 */
export function createDriveUploadAttempt(taskId: string, resourceId: string, file: File, ports: DriveUploadPorts, changed: (state: DriveUploadView) => void) {
  let view: DriveUploadView = { phase: "checking", confirmedBytes: 0, message: "Checking where this file can go…" };
  let running = false;
  let uncertain = false;
  let disposed = false;
  let abort: AbortController | null = null;
  const emit = (phase: DriveUploadView["phase"], message: string, confirmedBytes = view.confirmedBytes) => {
    view = { phase, message, confirmedBytes };
    if (!disposed) changed(view);
  };
  const pause = () => emit("paused", "Upload not confirmed. Retry checks the same file in Drive. Keep this task open; do not attach a second copy.");
  async function run() {
    if (running || disposed || ["complete", "cancelled", "native-uncertain"].includes(view.phase)) return;
    running = true;
    abort = new AbortController();
    emit("checking", "Checking the same file with Google Drive…");
    try {
      const permit = await ports.create(taskId, { resourceId, name: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size });
      if (permit.kind === "complete") { emit("complete", "Attached in Google Drive.", file.size); return; }
      if (permit.kind === "signal-native") {
        // Once any delegation or lost create reply is possible, fail closed even
        // if a later response suggests fallback. No second storage authority.
        if (uncertain) { pause(); return; }
        emit(abort.signal.aborted ? "cancelled" : "fallback", abort.signal.aborted ? "Cancelled before a file was sent." : fallbackCopy[permit.reason]);
        return;
      }
      uncertain = true;
      if (permit.kind === "paused" || abort.signal.aborted) { pause(); return; }
      emit("uploading", "Sending to Google Drive…", permit.startOffset);
      const result = await ports.upload({ sessionUrl: permit.sessionUrl, startOffset: permit.startOffset, file, signal: abort.signal, onProgress: (bytes) => emit("uploading", "Sending to Google Drive…", bytes) });
      if (result.kind !== "complete") { pause(); return; }
      emit("confirming", "File received by Google. Confirming attachment…", file.size);
      await ports.finalize(resourceId, result.fileId);
      emit("complete", "Attached in Google Drive.", file.size);
    } catch {
      uncertain = true;
      pause();
    } finally { running = false; }
  }
  async function useNative() {
    if (running || disposed || uncertain || view.phase !== "fallback") return;
    running = true;
    emit("native", "Sending to Signal Studio…");
    try { await ports.native(taskId, file); emit("complete", "Attached in Signal Studio.", file.size); }
    catch { emit("native-uncertain", "Signal Studio could not confirm the upload. Refresh Resources before attaching this file again."); }
    finally { running = false; }
  }
  function cancel() {
    if (view.phase === "fallback") emit("cancelled", "Cancelled before a file was sent.");
    else if (view.phase === "checking" || view.phase === "uploading") {
      abort?.abort();
      // Aborting a request cannot prove Google discarded the file.
      emit("paused", "Sending stopped. Google may already have the file. Retry checks the same upload; nothing was deleted.");
    }
  }
  return { run, useNative, cancel, snapshot: () => view, dispose: () => { disposed = true; abort?.abort(); } };
}
