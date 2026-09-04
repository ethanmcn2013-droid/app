"use client";

import { driveReloadCopy, type DriveReloadState } from "@/lib/project-drive-reload";
import { driveRecoveryCopy } from "@/lib/project-drive-upload-recovery";

/** Completion checks never offer byte sending, deletion or fallback. */
export function DriveReloadNotice({ state, onRefresh, canCheckGoogle = false, recovery = null }: {
  state: Exclude<DriveReloadState, null>; onRefresh: () => void; canCheckGoogle?: boolean;
  recovery?: keyof typeof driveRecoveryCopy | null;
}) {
  return <div className="mb-3 rounded-lg border border-line-soft p-3 text-[12px] leading-relaxed text-ink-soft">
    <p role="status">{driveReloadCopy[state]}</p>
    {state !== "loading" ? <>
      <p className="mt-2">{canCheckGoogle ? "Checks Google Drive for finished files you uploaded and adds any confirmed files here. It does not restart the upload." : "Shows the latest progress saved in Signal Studio. Only the person who uploaded a file can check it in Google Drive."}</p>
      {recovery ? <p role="status" className="mt-2">{driveRecoveryCopy[recovery]}</p> : null}
      <button disabled={recovery === "checking"} className="mt-2 min-h-[44px] rounded-md border border-line px-3 font-medium text-ink" onClick={onRefresh}>{recovery === "checking" ? "Checking…" : "Check for updates"}</button>
    </> : null}
  </div>;
}
