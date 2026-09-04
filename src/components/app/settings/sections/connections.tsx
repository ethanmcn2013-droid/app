"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isDemoMode } from "@/lib/access-mode";
import { projectDriveUiEnabled, type ProjectDriveStatus } from "@/lib/project-drive-ui";
import { getProjectDriveStatusAction } from "@/server/actions/project-drive-status";
import { ConnectionsView, driveButton } from "./connections-view";
import { ConnectionsReview } from "./connections-review";
import { DriveHandoverView } from "./drive-handover-view";
import { driveHandoverOutcomeCopy, type DriveHandoverRead } from "@/lib/project-drive-handover-ui";
import { changeProjectDriveOwnerAction, getProjectDriveHandoverAction } from "@/server/actions/project-drive-handover-ui";

export function ConnectionsSection({ projectId, canManage }: { projectId: string | null; canManage: boolean }) {
  if (!projectDriveUiEnabled()) return null;
  if (isDemoMode()) return <ConnectionsReview />;
  if (!projectId || !canManage) return <p className="text-[13px] text-ink-soft">A board owner can manage Connections and check Google Drive access. Ask them if you cannot open a file.</p>;
  return <LiveConnections key={projectId} projectId={projectId} />;
}

function LiveConnections({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<ProjectDriveStatus | null>(null);
  const [handover, setHandover] = useState<DriveHandoverRead>({ state: "unavailable", choices: [], continuation: null });
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const sequence = useRef({ value: 0 });
  const locked = useRef(false);
  const load = useCallback(() => {
    const request = ++sequence.current.value;
    return Promise.all([getProjectDriveStatusAction(projectId), getProjectDriveHandoverAction(projectId)]).then(([result, ownerChange]) => {
      if (request !== sequence.current.value) return;
      setHandover(ownerChange.kind === "ready" ? ownerChange.handover : { state: "unavailable", choices: [], continuation: null });
      if (result.kind === "ready") { setStatus(result.status); }
      else setMessage("Connections could not be loaded. Check again.");
    }).catch(() => {
      if (request === sequence.current.value) setMessage("Connections could not be loaded. Check again.");
    }).finally(() => { if (request === sequence.current.value) setBusy(false); });
  }, [projectId]);
  const refresh = useCallback(async () => {
    setBusy(true);
    // A previous Google check must never look current during a new check.
    setStatus(null);
    await load();
  }, [load]);
  useEffect(() => { const gate = sequence.current; void load(); return () => { gate.value++; }; }, [load]);

  async function changeOwner(targetOwnerUserId: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage(null);
    try { setMessage(driveHandoverOutcomeCopy[await changeProjectDriveOwnerAction(projectId, targetOwnerUserId)]); }
    catch { setMessage(driveHandoverOutcomeCopy.unavailable); }
    finally { await refresh(); locked.current = false; }
  }

  async function act(kind: "connect" | "enable" | "disconnect") {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const actions = await import("@/server/actions/connections");
      if (kind === "connect") {
        const result = await actions.beginGoogleDriveConnectionAction(projectId);
        window.location.assign(result.url);
        return;
      }
      if (kind === "enable") {
        const result = await actions.enableGoogleDriveForProjectAction(projectId);
        setMessage(result.status === "active" ? "Board folder set up. Google access is checked below." : "Setup is not complete. The current state is shown below; existing files have not moved.");
      } else {
        const result = await actions.disconnectGoogleDriveConnectionAction(projectId);
        setMessage(result.revocationConfirmed ? "Your Drive was disconnected." : "Disconnect is not yet confirmed by Google. Check again before reconnecting.");
      }
      setConfirmation(false);
    } catch { setMessage("The change could not be confirmed. Check the current connection before trying again."); }
    finally { await refresh(); locked.current = false; }
  }
  if (!status) return <section aria-label="Connections"><h2 className="text-[22px] font-semibold text-ink">Connections</h2><p role="status" className="my-4 text-[13px] text-ink-soft">{busy ? "Loading connection and Google access…" : message}</p>{!busy ? <button className={driveButton} onClick={() => void refresh()}>Check again</button> : null}</section>;
  return <ConnectionsView status={status} busy={busy} message={message} confirmation={confirmation} onRefresh={() => void refresh()} onConnect={() => void act("connect")} onEnable={() => void act("enable")} onDisconnect={() => setConfirmation(true)} onCancelDisconnect={() => setConfirmation(false)} onConfirmDisconnect={() => void act("disconnect")} handover={<DriveHandoverView read={handover} busy={busy} onSubmit={target => void changeOwner(target)} />} />;
}
