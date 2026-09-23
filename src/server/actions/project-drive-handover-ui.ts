"use server";

import { isDemoMode } from "@/lib/access-mode";
import { projectDriveUiEnabled } from "@/lib/project-drive-ui";
import type { DriveHandoverOutcome, DriveHandoverReadResult } from "@/lib/project-drive-handover-ui";

export async function getProjectDriveHandoverAction(projectId: string): Promise<DriveHandoverReadResult> {
  if (isDemoMode()) return { kind: "review" };
  if (!projectDriveUiEnabled()) return { kind: "disabled" };
  try {
    const { authorizeProjectDrive } = await import("@/server/connections/project-drive-authz");
    const authorization = await authorizeProjectDrive(projectId, "manageProject");
    const [{ db }, { readProjectDriveHandoverUi }] = await Promise.all([import("@/server/db"), import("@/server/connections/project-drive-handover-ui")]);
    const handover = await readProjectDriveHandoverUi(authorization, db);
    await authorizeProjectDrive(projectId, "manageProject");
    return { kind: "ready", handover };
  } catch { return { kind: "unavailable" }; }
}

export async function changeProjectDriveOwnerAction(projectId: string, targetOwnerUserId: string): Promise<DriveHandoverOutcome> {
  if (isDemoMode()) return "demo";
  if (!projectDriveUiEnabled()) return "disabled";
  try {
    const { authorizeProjectDrive } = await import("@/server/connections/project-drive-authz");
    const authorization = await authorizeProjectDrive(projectId, "manageProject");
    const [{ db }, { requestProjectDriveUiHandover }, { handoverProjectGoogleDriveStorage }] = await Promise.all([
      import("@/server/db"), import("@/server/connections/project-drive-handover-ui"), import("@/server/connections/project-drive-storage-handover"),
    ]);
    const outcome = await requestProjectDriveUiHandover(authorization, targetOwnerUserId, { database: db, handover: handoverProjectGoogleDriveStorage });
    await authorizeProjectDrive(projectId, "manageProject");
    return outcome;
  } catch { return "unavailable"; }
}
