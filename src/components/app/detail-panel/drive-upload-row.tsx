"use client";

import type { DriveUploadView } from "@/lib/project-drive-upload-machine";

export function DriveUploadRow({ name, size, state, onRetry, onNative, onCancel }: {
  name: string; size: number; state: DriveUploadView; onRetry: () => void; onNative: () => void; onCancel: () => void;
}) {
  const button = "min-h-[44px] rounded-md border border-line px-3 text-[12px] font-medium text-ink hover:bg-bg-sunken focus-visible:outline-2 focus-visible:outline-brand";
  return <li className="rounded-lg border border-line-soft p-3">
    <p className="break-all text-[13px] font-medium text-ink">{name}</p>
    <p role="status" className="mt-1 text-[12px] leading-relaxed text-ink-soft">{state.message}</p>
    {state.phase === "uploading" ? <div className="mt-2"><progress aria-label={`Confirmed upload progress for ${name}`} max={size || 1} value={state.confirmedBytes} className="h-[4px] w-full accent-brand" /><p className="text-[11px] tabular-nums text-ink-soft">{Math.floor(state.confirmedBytes / (size || 1) * 100)}% received</p></div> : null}
    <div className="mt-2 flex flex-wrap gap-2">
      {state.phase === "paused" ? <button className={button} onClick={onRetry}>Retry same upload</button> : null}
      {state.phase === "fallback" ? <button className={button} onClick={onNative}>Use Signal Studio</button> : null}
      {["checking", "uploading", "fallback"].includes(state.phase) ? <button className={button} onClick={onCancel}>{state.phase === "fallback" ? "Cancel" : "Stop sending"}</button> : null}
    </div>
  </li>;
}
