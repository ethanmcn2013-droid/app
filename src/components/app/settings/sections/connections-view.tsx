"use client";

import type { ProjectDriveStatus } from "@/lib/project-drive-ui";
import { useRef, type ReactNode } from "react";

export const driveButton = "inline-flex min-h-[34px] items-center justify-center rounded-[var(--v3-radius)] border border-[color:var(--v3-border)] bg-[var(--v3-surface)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--v3-text)] shadow-[var(--v3-shadow-1)] transition-colors hover:border-[color:var(--v3-border-strong)] hover:bg-[var(--v3-hover)] focus-visible:rounded-[var(--v3-radius)]! disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-[44px]";

const setupCopy: Record<ProjectDriveStatus["setup"], string> = {
  not_connected: "New files stay in Signal Studio until a storage owner connects Drive and sets up this board.",
  active: "This board has a Drive folder. The destination and access are checked again when you attach a file.",
  setting_up: "Access is still being set up. New files can use Signal Studio while this finishes.",
  fallback: "Some members are missing the access needed for new Drive uploads. New files can use Signal Studio.",
  needs_attention: "This board’s Drive needs attention. New files can use Signal Studio; existing Drive files stay where they are.",
  unavailable: "The board’s storage could not be confirmed. Check again before making a change.",
  archived: "This board is archived. Storage changes are unavailable.",
};
const accessLabel = { owner: "Owns folder", writer: "Can edit", reader: "Can view", unconfirmed: "Access not confirmed" };

/** Custodian thesis: name the accountable person first; evidence remains distinct. */
export function ConnectionsView({ status, busy, message, onRefresh, onConnect, onEnable, onRestore, onDisconnect, confirmation, onCancelDisconnect, onConfirmDisconnect, onRetryDisconnect, handover }: {
  status: ProjectDriveStatus;
  busy: boolean;
  message: string | null;
  onRefresh: () => void;
  onConnect: () => void;
  onEnable: () => void;
  onRestore: () => void;
  onDisconnect: () => void;
  confirmation: boolean;
  onCancelDisconnect: () => void;
  onConfirmDisconnect: () => void;
  onRetryDisconnect: () => void;
  handover: ReactNode;
}) {
  const disconnectButton = useRef<HTMLButtonElement>(null);
  const hasGap = status.access.people.some((person) => person.access === "unconfirmed" || person.access === "reader");
  return <section aria-label="Google Drive connection" className="space-y-4 text-[13px] leading-relaxed text-[color:var(--v3-text-2)]">
    <header>
      <h2 className="text-[18px] font-semibold leading-7 tracking-[-0.015em] text-[color:var(--v3-text)]">A home for this board’s files</h2>
      <p className="mt-1 max-w-[620px] text-[13.5px]">Keep attaching from Resources. One storage owner’s Google Drive can hold the files for this board.</p>
    </header>
    <div className="rounded-[var(--v3-radius-lg)] border border-[color:color-mix(in_srgb,var(--v3-accent)_22%,var(--v3-border))] bg-[color-mix(in_srgb,var(--v3-accent)_5%,var(--v3-surface))] p-5 shadow-[var(--v3-shadow-1)]">
      <p className="text-[12.5px] font-medium text-[color:var(--v3-text-2)]">Storage owner</p>
      <p className="mt-1 break-words text-[20px] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--v3-text)]">{status.ownerName ?? "Not chosen yet"}</p>
      <p className="mt-3">{setupCopy[status.setup]}</p>
      <p className="mt-3">{status.ownerName ? "The storage owner owns and can see every file attached to this Drive folder. Those files use their Google Drive space." : "If you use Drive for this board, the storage owner will own and be able to see its Drive files. Those files use their Google Drive space."}</p>
      {status.folderUrl ? <a className="mt-3 inline-flex min-h-[44px] items-center font-medium text-[color:var(--v3-accent)] underline underline-offset-4" href={status.folderUrl} target="_blank" rel="noreferrer">Open board folder <span className="sr-only">in a new tab</span></a> : null}
    </div>
    <section aria-labelledby="drive-access-heading" className="rounded-[var(--v3-radius-lg)] border border-[color:var(--v3-border)] bg-[var(--v3-surface)] p-5 shadow-[var(--v3-shadow-1)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 id="drive-access-heading" className="max-w-[340px] text-[14px] font-semibold text-[color:var(--v3-text)]">Who can open this board’s files</h3>
        <button className={driveButton} disabled={busy} onClick={onRefresh}>Check again</button>
      </div>
      {status.pendingRemovals.currentFolder > 0 || status.pendingRemovals.previousFolders > 0 ? <div role="status" aria-label="Pending access removal" className="mt-3 rounded-[var(--v3-radius)] border border-[color:color-mix(in_srgb,var(--v3-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--v3-warning)_9%,transparent)] p-3 text-[color:var(--v3-text)]">
        <p className="font-medium">Access removal is pending</p>
        {status.pendingRemovals.currentFolder > 0 ? <p className="mt-2">Removal of some access to this board’s current Drive folder is still unconfirmed.</p> : null}
        {status.pendingRemovals.previousFolders > 0 ? <p className="mt-2">Removal of some access to this board’s previous Drive folders is still unconfirmed.</p> : null}
        <p className="mt-2">People may still be able to open those files.</p>
      </div> : null}
      {status.access.state === "checked" ? <>
        <p className="mt-2 text-[12px]">Google access checked at <time dateTime={status.access.checkedAt!}>{status.access.checkedAt?.slice(11, 16)} UTC</time>. Access can change in Google Drive.</p>
        {hasGap ? <p className="mt-3 rounded-[var(--v3-radius)] border border-[color:color-mix(in_srgb,var(--v3-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--v3-warning)_9%,transparent)] p-3 text-[color:var(--v3-text)]">Some members do not have confirmed editing access. Board membership alone does not give Google Drive access.</p> : null}
        <ul className="mt-3 divide-y divide-[color:var(--v3-border)]">
          {status.access.people.map((person, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0 flex-1 basis-[180px]"><p className="break-words font-medium text-[color:var(--v3-text)]">{person.name}</p>{person.email ? <p className="break-all text-[12px]">{person.email}</p> : null}</div>
            <span className="text-[12px] font-medium text-[color:var(--v3-text)]">{accessLabel[person.access]}</span>
          </li>)}
        </ul>
        {status.access.people.length === 0 ? <p className="mt-3">No current board members were returned.</p> : null}
        {status.access.otherPermissionCount > 0 ? <p className="mt-3">Google also reports {status.access.otherPermissionCount} other access {status.access.otherPermissionCount === 1 ? "entry" : "entries"}. Review these in the board folder’s sharing settings.</p> : null}
      </> : <p className="mt-3" role="status">{status.access.state === "not_connected" ? "Set up a board folder to check access with Google." : "Google access could not be checked. No current permissions are confirmed here. Check again or ask the storage owner to reconnect."}</p>}
    </section>
    <section className="rounded-[var(--v3-radius-lg)] border border-[color:var(--v3-border)] bg-[var(--v3-surface)] p-5 shadow-[var(--v3-shadow-1)]" aria-labelledby="own-drive-heading">
      <h3 id="own-drive-heading" className="text-[14px] font-semibold text-[color:var(--v3-text)]">Your Google Drive</h3>
      <p className="mt-2 break-all">{status.ownConnection.accountEmail ?? "No Google account connected."}</p>
      <p className="mt-2">Connecting your account does not change where this board’s files go. Setting up the board folder is a separate step.</p>
      {status.ownConnection.revocationPending ? <p role="status" className="mt-3 rounded-[var(--v3-radius)] border border-[color:color-mix(in_srgb,var(--v3-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--v3-warning)_9%,transparent)] p-3 text-[color:var(--v3-text)]">Google has not confirmed your previous disconnect. Your Drive is no longer used for new files. Check the disconnect before reconnecting.</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={driveButton} disabled={busy || status.setup === "archived" || status.ownConnection.revocationPending} onClick={onConnect}>{status.ownConnection.connected || status.ownConnection.needsReconnect ? "Reconnect Google Drive" : "Connect Google Drive"}</button>
        {status.ownConnection.revocationPending ? <button className={driveButton} disabled={busy} onClick={onRetryDisconnect}>Check disconnect</button> : null}
        {status.setup === "not_connected" && status.ownConnection.connected && !status.ownConnection.needsReconnect ? <button className={driveButton} disabled={busy} onClick={onEnable}>Use my Drive for this board</button> : null}
        {status.setup === "needs_attention" && status.canRestore ? <button className={driveButton} disabled={busy} onClick={onRestore}>Check and restore this board’s Drive</button> : null}
        {status.ownConnection.connected ? <button ref={disconnectButton} className={driveButton} disabled={busy} onClick={onDisconnect}>Disconnect my Drive</button> : null}
      </div>
      {confirmation ? <div className="mt-4 rounded-[var(--v3-radius)] border border-[color:var(--v3-border)] bg-[var(--v3-sunken)] p-4" role="group" aria-label="Confirm Drive disconnect">
        <p className="font-medium text-[color:var(--v3-text)]">Disconnect your Google Drive?</p>
        <p className="mt-2">This affects {status.ownConnection.affectedProjectCount} {status.ownConnection.affectedProjectCount === 1 ? "board" : "boards"} using your account. Future files can use Signal Studio. Existing files stay in Drive; access may change when Signal’s sharing is removed.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button autoFocus className={driveButton} disabled={busy} onClick={() => { onCancelDisconnect(); disconnectButton.current?.focus(); }}>Keep connected</button><button className={driveButton} disabled={busy} onClick={onConfirmDisconnect}>Confirm disconnect</button></div>
      </div> : null}
    </section>
    {handover}
    {busy || message ? <p role="status" className="rounded-[var(--v3-radius)] border border-[color:var(--v3-border)] bg-[var(--v3-sunken)] p-3 text-[color:var(--v3-text)]">{busy ? "Checking the connection…" : message}</p> : null}
  </section>;
}
