"use server";

import { isDemoMode } from "@/lib/access-mode";
import { projectDriveUiEnabled, type DriveStatusResult } from "@/lib/project-drive-ui";

/** Explicit Project authority; no ambient cookie, provider errors or credential DTOs. */
export async function getProjectDriveStatusAction(projectId: string): Promise<DriveStatusResult> {
  if (isDemoMode()) return { kind: "review" };
  if (!projectDriveUiEnabled()) return { kind: "disabled" };
  try {
    // Demo/flag-off never even import the DB/provider dependency graph.
    const { authorizeProjectDrive } = await import("@/server/connections/project-drive-authz");
    const authorization = await authorizeProjectDrive(projectId, "manageProject");
    const [{ db }, { readProjectDriveUiStatus }, { getGoogleDriveConnectionSummary }, { listCurrentWorkspaceDrivePermissions }] = await Promise.all([
      import("@/server/db"), import("@/server/connections/project-drive-ui-status"),
      import("@/server/connections/drive-connections"), import("@/server/connections/drive-grants"),
    ]);
    const status = await readProjectDriveUiStatus(authorization, {
      database: db, connection: getGoogleDriveConnectionSummary,
      permissions: listCurrentWorkspaceDrivePermissions, now: () => new Date(),
    });
    await authorizeProjectDrive(projectId, "manageProject");
    return { kind: "ready", status };
  } catch { return { kind: "unavailable" }; }
}
