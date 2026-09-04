"use client";

import { driveReloadCopy, type DriveReloadState } from "@/lib/project-drive-reload";

/** Read-only recovery boundary: never offers byte sending, deletion or fallback. */
export function DriveReloadNotice({ state, onRefresh }: { state: Exclude<DriveReloadState, null>; onRefresh: () => void }) {
  return <div className="mb-3 rounded-lg border border-line-soft p-3 text-[12px] leading-relaxed text-ink-soft">
    <p role="status">{driveReloadCopy[state]}</p>
    {state !== "loading" ? <>
      <p className="mt-2">Refreshing reads saved Resources. It does not send a file or check Google directly.</p>
      <button className="mt-2 min-h-[44px] rounded-md border border-line px-3 font-medium text-ink" onClick={onRefresh}>Refresh saved status</button>
    </> : null}
  </div>;
}
