"use client";

import { useId, useState } from "react";
import type { DriveHandoverRead } from "@/lib/project-drive-handover-ui";
import { driveButton } from "./connections-view";

const stateCopy: Record<DriveHandoverRead["state"], string> = {
  ready: "Choose another board owner who has connected Google Drive. Their connection will be checked before the change.",
  in_progress: "A storage owner change is already in progress. Continue that saved change or check its status again.",
  needs_attention: "The saved change needs attention. Another change cannot be started here. Ask for help resolving it, then check again.",
  uploads_pending: "An earlier Drive upload is unconfirmed. Finish it in its original tab before changing the storage owner. If that tab is closed, ask for help checking the existing upload.",
  not_connected: "Set up a board folder before changing its storage owner.",
  archived: "This board is archived. Storage changes are unavailable.",
  unavailable: "Storage owner choices could not be checked. Check again; no choices are confirmed here.",
};

export function DriveHandoverView({ read, busy, onSubmit }: {
  read: DriveHandoverRead;
  busy: boolean;
  onSubmit: (targetOwnerUserId: string) => void;
}) {
  const selectId = useId();
  const [selected, setSelected] = useState("");
  const [confirmation, setConfirmation] = useState(false);
  const target = read.state === "in_progress" ? read.continuation : read.state === "ready" ? read.choices.find(choice => choice.userId === selected) : null;
  return <section aria-label="Change storage owner" className="rounded-xl border border-line-soft bg-bg-elevated p-5">
    <h3 className="text-[16px] font-semibold text-ink">Change storage owner</h3>
    <p className="mt-2">{stateCopy[read.state]}</p>
    <p className="mt-2">The new owner’s Drive will hold future files. Existing files stay with their original owner; their ownership and location do not change.</p>
    {read.state === "ready" ? read.choices.length ? <div className="mt-3">
      <label htmlFor={selectId} className="block font-medium text-ink">New storage owner</label>
      <select id={selectId} className={`${driveButton} mt-2 w-full min-w-0 max-w-full bg-bg-elevated`} disabled={busy || confirmation} value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">Choose an owner</option>
        {read.choices.map(choice => <option key={choice.userId} value={choice.userId}>{choice.name}</option>)}
      </select>
    </div> : <p className="mt-3 text-ink">Another board owner needs to connect their Google Drive first. Then check again to choose them.</p> : null}
    {read.state === "in_progress" && target ? <p className="mt-3 break-words font-medium text-ink">Saved change: {target.name}</p> : null}
    {target && !confirmation ? <button className={`${driveButton} mt-3`} disabled={busy} onClick={() => setConfirmation(true)}>{read.state === "in_progress" ? "Continue saved change" : "Review owner change"}</button> : null}
    {target && confirmation ? <div className="mt-4 rounded-lg border border-line p-4" role="group" aria-label="Confirm storage owner change">
      <p className="break-words font-medium text-ink">Use {target.name}’s Drive for future files?</p>
      <p className="mt-2">They will own and can see those files, which use their Drive space. Existing files stay where they are. Access for future uploads must finish being set up.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button autoFocus className={driveButton} disabled={busy} onClick={() => setConfirmation(false)}>Go back</button>
        <button className={driveButton} disabled={busy} onClick={() => onSubmit(target.userId)}>{busy ? "Checking change…" : "Confirm owner change"}</button>
      </div>
    </div> : null}
  </section>;
}
