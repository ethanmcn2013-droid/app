"use client";

import type { ProjectDriveStatus } from "@/lib/project-drive-ui";

export const driveButton = "min-h-[44px] rounded-md border border-line px-3 py-2 text-[13px] font-medium text-ink hover:bg-bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50";

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
export function ConnectionsView({ status, busy, message, onRefresh, onConnect, onEnable, onDisconnect, confirmation, onCancelDisconnect, onConfirmDisconnect }: {
  status: ProjectDriveStatus;
  busy: boolean;
  message: string | null;
  onRefresh: () => void;
  onConnect: () => void;
  onEnable: () => void;
  onDisconnect: () => void;
  confirmation: boolean;
  onCancelDisconnect: () => void;
  onConfirmDisconnect: () => void;
}) {
  const hasGap = status.access.people.some((person) => person.access === "unconfirmed" || person.access === "reader");
  return <section aria-label="Google Drive connection" className="space-y-5 text-[13px] leading-relaxed text-ink-soft">
    <header>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Connections</p>
      <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-ink">A home for this board’s files</h2>
      <p className="mt-2 max-w-[560px]">Keep attaching from Resources. One storage owner’s Google Drive can hold the files for this board.</p>
    </header>
    <div className="rounded-xl border border-line-soft bg-brand/[0.06] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-quiet">Storage owner</p>
      <p className="mt-2 break-words text-[24px] font-semibold leading-tight tracking-tight text-ink">{status.ownerName ?? "Not chosen yet"}</p>
      <p className="mt-3">{setupCopy[status.setup]}</p>
      {status.ownerName ? <p className="mt-3">The storage owner owns and can see every file attached to this Drive folder. Those files use their Google Drive space.</p> : null}
      {status.folderUrl ? <a className="mt-3 inline-flex min-h-[44px] items-center font-medium text-brand underline underline-offset-4" href={status.folderUrl} target="_blank" rel="noreferrer">Open board folder <span className="sr-only">in a new tab</span></a> : null}
    </div>
    <section aria-labelledby="drive-access-heading" className="rounded-xl border border-line-soft bg-bg-elevated p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 id="drive-access-heading" className="max-w-[340px] text-[16px] font-semibold text-ink">Who can open this board’s files</h3>
        <button className={driveButton} disabled={busy} onClick={onRefresh}>Check again</button>
      </div>
      {status.access.state === "checked" ? <>
        <p className="mt-2 text-[12px]">Google access checked at <time dateTime={status.access.checkedAt!}>{status.access.checkedAt?.slice(11, 16)} UTC</time>. Access can change in Google Drive.</p>
        {hasGap ? <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-ink">Some members do not have confirmed editing access. Board membership alone does not give Google Drive access.</p> : null}
        <ul className="mt-3 divide-y divide-line-soft">
          {status.access.people.map((person, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0 flex-1 basis-[180px]"><p className="break-words font-medium text-ink">{person.name}</p>{person.email ? <p className="break-all text-[12px]">{person.email}</p> : null}</div>
            <span className="text-[12px] font-medium text-ink">{accessLabel[person.access]}</span>
          </li>)}
        </ul>
        {status.access.people.length === 0 ? <p className="mt-3">No current board members were returned.</p> : null}
        {status.access.otherPermissionCount > 0 ? <p className="mt-3">Google also reports {status.access.otherPermissionCount} other access {status.access.otherPermissionCount === 1 ? "entry" : "entries"}. Review these in the board folder’s sharing settings.</p> : null}
      </> : <p className="mt-3" role="status">{status.access.state === "not_connected" ? "Set up a board folder to check access with Google." : "Google access could not be checked. No current permissions are confirmed here. Check again or ask the storage owner to reconnect."}</p>}
    </section>
    <section className="rounded-xl border border-line-soft bg-bg-elevated p-5" aria-labelledby="own-drive-heading">
      <h3 id="own-drive-heading" className="text-[16px] font-semibold text-ink">Your Google Drive</h3>
      <p className="mt-2 break-all">{status.ownConnection.accountEmail ?? "No Google account connected."}</p>
      <p className="mt-2">Connecting your account does not change where this board’s files go. Setting up the board folder is a separate step.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={driveButton} disabled={busy || status.setup === "archived"} onClick={onConnect}>{status.ownConnection.connected || status.ownConnection.needsReconnect ? "Reconnect Google Drive" : "Connect Google Drive"}</button>
        {status.setup === "not_connected" && status.ownConnection.connected && !status.ownConnection.needsReconnect ? <button className={driveButton} disabled={busy} onClick={onEnable}>Use my Drive for this board</button> : null}
        {status.ownConnection.connected ? <button className={driveButton} disabled={busy} onClick={onDisconnect}>Disconnect my Drive</button> : null}
      </div>
      {confirmation ? <div className="mt-4 rounded-lg border border-line p-4" role="group" aria-label="Confirm Drive disconnect">
        <p className="font-medium text-ink">Disconnect your Google Drive?</p>
        <p className="mt-2">This affects {status.ownConnection.affectedProjectCount} {status.ownConnection.affectedProjectCount === 1 ? "board" : "boards"} using your account. Future files can use Signal Studio. Existing files stay in Drive; access may change when Signal’s sharing is removed.</p>
        <div className="mt-3 flex flex-wrap gap-2"><button autoFocus className={driveButton} disabled={busy} onClick={onCancelDisconnect}>Keep connected</button><button className={driveButton} disabled={busy} onClick={onConfirmDisconnect}>Confirm disconnect</button></div>
      </div> : null}
    </section>
    <p>Changing storage owner is not available here yet. Existing files remain with their original owner and are not moved to a new Drive.</p>
    {busy || message ? <p role="status" className="rounded-md border border-line-soft p-3 text-ink">{busy ? "Checking the connection…" : message}</p> : null}
  </section>;
}
