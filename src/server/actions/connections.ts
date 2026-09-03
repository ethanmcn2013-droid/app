"use server";

import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/access-mode";
import {
  disconnectGoogleDriveConnection,
  getGoogleDriveConnectionSummary,
  type DisconnectedGoogleDriveConnection,
  type GoogleDriveConnectionSummary,
} from "@/server/connections/drive-connections";
import { authorizeProjectDrive } from "@/server/connections/project-drive-authz";
import {
  ARCHIVED_PROJECT_DRIVE_FOLDER_SETUP_STATE,
  DEMO_PROJECT_DRIVE_FOLDER_SETUP_STATE,
  enableProjectGoogleDriveStorage,
  type ProjectDriveFolderSetupState,
} from "@/server/connections/project-drive-folder-management";

const EMPTY_SUMMARY: GoogleDriveConnectionSummary = Object.freeze({
  connected: false,
  accountEmail: null,
  status: null,
  connectedAt: null,
  rootFolderUrl: null,
  projectUsesThisAccount: false,
  affectedProjectCount: 0,
});

/** Return the same-origin route that starts a freshly authorized OAuth flow. */
export async function beginGoogleDriveConnectionAction(
  projectId: string,
): Promise<Readonly<{ url: string }>> {
  if (isDemoMode()) return { url: "/app/settings?drive=review" };
  const authorization = await authorizeProjectDrive(
    projectId,
    "manageProject",
  );
  return {
    url: `/api/connections/google/start?projectId=${encodeURIComponent(authorization.projectId)}`,
  };
}

/** Read only the caller's own current connection and this Project's use of it. */
export async function getGoogleDriveConnectionSummaryAction(
  projectId: string,
): Promise<GoogleDriveConnectionSummary> {
  if (isDemoMode()) return EMPTY_SUMMARY;
  const authorization = await authorizeProjectDrive(
    projectId,
    "manageProject",
  );
  return getGoogleDriveConnectionSummary(authorization);
}

/**
 * Explicitly enable Google Drive for one Project. OAuth consent by itself
 * creates only the caller's private connection/root and never selects board
 * storage (D15).
 */
export async function enableGoogleDriveForProjectAction(
  projectId: string,
): Promise<ProjectDriveFolderSetupState> {
  if (isDemoMode()) return DEMO_PROJECT_DRIVE_FOLDER_SETUP_STATE;
  const authorization = await authorizeProjectDrive(
    projectId,
    "manageProject",
  );
  if (authorization.archived) {
    return ARCHIVED_PROJECT_DRIVE_FOLDER_SETUP_STATE;
  }
  const result = await enableProjectGoogleDriveStorage(authorization);
  revalidatePath("/app/settings");
  return result;
}

/**
 * Retire and revoke the caller's current Drive credential. Folder/resource
 * history stays; affected Projects fall back to Signal-native storage.
 */
export async function disconnectGoogleDriveConnectionAction(
  projectId: string,
): Promise<DisconnectedGoogleDriveConnection> {
  if (isDemoMode()) {
    return {
      disconnected: false,
      affectedProjectCount: 0,
      revocationConfirmed: true,
    };
  }
  const authorization = await authorizeProjectDrive(
    projectId,
    "manageProject",
  );
  const result = await disconnectGoogleDriveConnection(authorization);
  revalidatePath("/app/settings");
  return result;
}
