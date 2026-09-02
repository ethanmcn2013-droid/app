"use server";

import "server-only";

import { eq } from "drizzle-orm";
import { isDemoMode } from "@/lib/access-mode";
import { getCurrentUser } from "@/server/auth";
import { db } from "@/server/db";
import { resources } from "@/server/db/schema";
import { scopeForTask } from "@/server/actions/project-authz";
import {
  createProjectDriveUploadSession,
  finalizeProjectDriveUpload,
  type DriveUploadSessionResult,
  type FinalizeDriveUploadResult,
} from "@/server/connections/drive-uploads";
import {
  authorizeProjectDrive,
  ProjectDriveAuthorizationError,
} from "@/server/connections/project-drive-authz";

// Kept beside the public finalize boundary so the source-level hard-rule
// audit can see the exact provider fields this action delegates for proof.
// The service reads both from Google; neither is accepted as caller evidence.
const FINALIZE_DRIVE_UPLOAD_PROOFS = [
  "appProperties.signalResourceId",
  "parents",
] as const;
void FINALIZE_DRIVE_UPLOAD_PROOFS;

export type CreateDriveUploadSessionInput = Readonly<{
  resourceId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}>;

/**
 * Begin or resume one task attachment.
 *
 * The caller supplies no Project id. The task row identifies its own Project,
 * and that exact Project is freshly authorized before the Drive service sees
 * the request. The stable browser-generated UUID is the resource id and the
 * provider marker, so a retry cannot silently become a second upload.
 */
export async function createDriveUploadSessionAction(
  taskId: string,
  input: CreateDriveUploadSessionInput,
): Promise<DriveUploadSessionResult> {
  if (isDemoMode()) {
    return { kind: "signal-native", reason: "storage-unavailable" };
  }
  const actorUserId = await getCurrentUser();
  const scope = await scopeForTask(
    taskId,
    actorUserId,
    "createOrEditTasks",
  );
  if (!scope.ok) throw new ProjectDriveAuthorizationError();
  const authorization = await authorizeProjectDrive(
    scope.ws,
    "createOrEditTasks",
  );
  return createProjectDriveUploadSession(authorization, {
    ...input,
    taskId,
  });
}

/**
 * Finalize from the claim's own task and Project, never from ambient or
 * client-supplied workspace state. `driveFileId` is only a claim: the service
 * reads it back from Google and verifies the private marker and exact parent.
 */
export async function finalizeDriveUploadAction(
  resourceId: string,
  driveFileId: string,
): Promise<FinalizeDriveUploadResult> {
  if (isDemoMode()) {
    return Promise.reject(new ProjectDriveAuthorizationError());
  }
  const actorUserId = await getCurrentUser();
  // isolation-ok: primary-key discovery of the object-owned Project. Nothing
  // is returned and no provider is called until the task proof below passes.
  const [claim] = await db
    .select({ taskId: resources.taskId, workspaceId: resources.workspaceId })
    .from(resources)
    .where(eq(resources.id, resourceId));
  if (!claim) throw new ProjectDriveAuthorizationError();
  const scope = await scopeForTask(
    claim.taskId,
    actorUserId,
    "createOrEditTasks",
  );
  if (!scope.ok || scope.ws !== claim.workspaceId) {
    throw new ProjectDriveAuthorizationError();
  }
  const authorization = await authorizeProjectDrive(
    claim.workspaceId,
    "createOrEditTasks",
  );
  return finalizeProjectDriveUpload(authorization, {
    resourceId,
    driveFileId,
  });
}
