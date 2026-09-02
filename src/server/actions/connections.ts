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
  const authorization = await authorizeProjectDrive(projectId);
  return {
    url: `/api/connections/google/start?projectId=${encodeURIComponent(authorization.projectId)}`,
  };
}

/** Read only the caller's own current connection and this Project's use of it. */
export async function getGoogleDriveConnectionSummaryAction(
  projectId: string,
): Promise<GoogleDriveConnectionSummary> {
  if (isDemoMode()) return EMPTY_SUMMARY;
  const authorization = await authorizeProjectDrive(projectId);
  return getGoogleDriveConnectionSummary(authorization);
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
  const authorization = await authorizeProjectDrive(projectId);
  const result = await disconnectGoogleDriveConnection(authorization);
  revalidatePath("/app/settings");
  return result;
}
