"use server";

import { isDemoMode } from "@/lib/access-mode";
import { projectDriveUiEnabled } from "@/lib/project-drive-ui";
import type { DriveUploadRecoveryResult } from "@/lib/project-drive-upload-recovery";

/** The stored task owns the Project. The service also binds the original uploader
 * and re-proves authority inside the existing completion transaction. */
export async function recoverDriveUploadAction(taskId: string, resourceId: string): Promise<DriveUploadRecoveryResult> {
  if (isDemoMode()) return "review";
  if (!projectDriveUiEnabled()) return "disabled";
  try {
    const [{ getCurrentUser }, { scopeForTask }, { authorizeProjectDrive }] = await Promise.all([
      import("@/server/auth"), import("@/server/actions/project-authz"), import("@/server/connections/project-drive-authz"),
    ]);
    const scope = await scopeForTask(taskId, await getCurrentUser(), "createOrEditTasks");
    if (!scope.ok) return "unavailable";
    const authorization = await authorizeProjectDrive(scope.ws, "createOrEditTasks");
    const { recoverProjectDriveUpload } = await import("@/server/connections/drive-uploads");
    const result = await recoverProjectDriveUpload(authorization, { taskId, resourceId });
    await authorizeProjectDrive(scope.ws, "createOrEditTasks");
    return result;
  } catch { return "unavailable"; }
}
