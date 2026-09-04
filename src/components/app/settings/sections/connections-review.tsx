"use client";

import { useState } from "react";
import type { ProjectDriveStatus } from "@/lib/project-drive-ui";
import { ConnectionsView, driveButton } from "./connections-view";

/** Fixture-only module: no actions, provider or DB imports; controls change local state. */
export function ConnectionsReview() {
  const [state, setState] = useState("connected");
  const [confirmation, setConfirmation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const absent = state === "not-connected";
  const status: ProjectDriveStatus = {
    ownerName: absent ? null : "Orla Murphy",
    folderUrl: null,
    setup: absent ? "not_connected" : state === "setting-up" ? "setting_up" : state === "attention" ? "fallback" : "active",
    ownConnection: { connected: !absent, needsReconnect: state === "unavailable", accountEmail: absent ? null : "orla@example.test", affectedProjectCount: 2 },
    access: {
      state: absent ? "not_connected" : state === "unavailable" ? "unavailable" : "checked",
      checkedAt: "2026-09-04T10:15:00.000Z",
      people: [
        { name: "Orla Murphy", email: "orla@example.test", access: "owner" },
        { name: "Maeve Byrne", email: "maeve@example.test", access: "writer" },
        { name: "Alex Chen", email: "alex@example.test", access: state === "attention" || state === "setting-up" ? "unconfirmed" : "writer" },
      ], otherPermissionCount: 0,
    },
  };
  return <div>
    <div className="mb-5 rounded-lg border border-line p-3 text-[12px] text-ink-soft">
      <p>Fictional review data. These controls never contact Google or save changes.</p>
      <label className="mt-2 flex flex-wrap items-center gap-2">Review state<select className={driveButton} value={state} onChange={(event) => { setState(event.target.value); setMessage(null); }}>
        <option value="connected">Connected</option><option value="not-connected">Not connected</option><option value="setting-up">Setting up</option><option value="attention">Access needs attention</option><option value="unavailable">Google unavailable</option><option value="loading">Loading</option><option value="error">Load failed</option>
      </select></label>
    </div>
    {state === "loading" ? <p role="status">Loading connection and Google access…</p> : state === "error" ? <p role="alert">Connections could not be loaded. Choose another review state to continue.</p> : <ConnectionsView status={status} busy={false} message={message} confirmation={confirmation} onRefresh={() => setMessage("Review data refreshed. No Google request was made.")} onConnect={() => setMessage("Review only. A real connection opens Google’s consent screen.")} onEnable={() => setState("setting-up")} onDisconnect={() => setConfirmation(true)} onCancelDisconnect={() => setConfirmation(false)} onConfirmDisconnect={() => { setConfirmation(false); setState("not-connected"); setMessage("Review only. No account was disconnected."); }} />}
  </div>;
}
