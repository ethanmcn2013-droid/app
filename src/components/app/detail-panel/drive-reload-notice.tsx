"use client";

import { driveReloadCopy, type DriveReloadState } from "@/lib/project-drive-reload";

/** Read-only recovery boundary: never offers byte sending, deletion or fallback. */
export function DriveReloadNotice({ state, onRefresh }: { state: Exclude<DriveReloadState, null>; onRefresh: () => void }) {
  return <div className="mb-3 rounded-lg border border-line-soft p-3 text-[12px] leading-relaxed text-ink-soft">
    <p role="status">{driveReloadCopy[state]}</p>
    {state !== "loading" ? <>
      <p className="mt-2">Shows the latest progress saved in Signal Studio. It does not restart the upload.</p>
      <button className="mt-2 min-h-[44px] rounded-md border border-line px-3 font-medium text-ink" onClick={onRefresh}>Check for updates</button>
    </> : null}
  </div>;
}
