"use client";

import { useState } from "react";
import type { DriveUploadView } from "@/lib/project-drive-upload-machine";
import { DriveUploadRow } from "./drive-upload-row";
import { DriveReloadNotice } from "./drive-reload-notice";

const states: Record<string, DriveUploadView> = {
  uploading: { phase: "uploading", confirmedBytes: 60, message: "Sending to Google Drive…" },
  paused: { phase: "paused", confirmedBytes: 60, message: "Upload not confirmed. Retry checks the same file in Drive. Keep this task open; do not attach a second copy." },
  fallback: { phase: "fallback", confirmedBytes: 0, message: "Drive access is incomplete for this board. Use Signal Studio for this file." },
  complete: { phase: "complete", confirmedBytes: 100, message: "Attached in Google Drive." },
  cancelled: { phase: "cancelled", confirmedBytes: 0, message: "Cancelled before a file was sent." },
};

/** Local review only. Reuses the production status row without any upload ports. */
export function DriveUploadReview() {
  const [selected, setSelected] = useState("uploading");
  const [native, setNative] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [recovery, setRecovery] = useState<"complete" | "pending" | "unavailable">("pending");
  return <div className="mb-3 rounded-lg border border-line-soft p-3">
    <p className="text-[12px] text-ink-soft">Fictional upload review. No file is sent or saved.</p>
    <label className="my-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">Upload review state<select className="min-h-[44px] rounded border border-line px-2" value={selected} onChange={(event) => { setSelected(event.target.value); setNative(false); }}>
      <option value="uploading">Uploading</option><option value="paused">Unconfirmed</option><option value="fallback">Signal Studio fallback</option><option value="complete">Complete</option><option value="reloaded">Pending after reload</option>
    </select></label>
    {selected === "reloaded" ? <>
      <label className="my-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">Review check result<select className="min-h-[44px] rounded border border-line px-2" value={recovery} onChange={event => { setRecovery(event.target.value as typeof recovery); setRefreshed(false); }}>
        <option value="pending">Still incomplete</option><option value="complete">Finished in Google Drive</option><option value="unavailable">Could not check</option>
      </select></label>
      <p className="mb-2 text-[13px] font-medium text-ink">Supplier brief.pdf · Google Drive</p>
      {refreshed && recovery === "complete" ? <ul><DriveUploadRow name="Supplier brief.pdf" size={100} state={states.complete} onRetry={() => {}} onNative={() => {}} onCancel={() => {}} /></ul>
        : <DriveReloadNotice state="pending" canCheckGoogle recovery={refreshed ? recovery : null} onRefresh={() => setRefreshed(true)} />}
      {refreshed ? <p className="text-[12px] text-ink-soft">Review only. No request was made.</p> : null}
    </> : <ul><DriveUploadRow name="Supplier brief.pdf" size={100} state={native ? { ...states.complete, message: "Attached in Signal Studio. Review only." } : states[selected]} onRetry={() => setSelected("complete")} onNative={() => { setNative(true); setSelected("complete"); }} onCancel={() => setSelected(selected === "fallback" ? "cancelled" : "paused")} /></ul>}
  </div>;
}
