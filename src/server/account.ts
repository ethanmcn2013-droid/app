import "server-only";
import { db } from "@/server/db";
import { deleteUnifiedAccountDataWith, defaultRevokeGoogleTokens } from "@/server/account-unified-erasure";
import { exportUnifiedAccountDataWith } from "@/server/account-unified-export";
import {
  exportForUser as exportNotesForUser,
  eraseForUser as eraseNotesForUser,
} from "@/modules/notes/server/notes-gdpr";
import {
  exportForUser as exportTimelineForUser,
  eraseForUser as eraseTimelineForUser,
} from "@/modules/timeline/server/timeline-gdpr";
import {
  exportForUser as exportSignalForUser,
  eraseForUser as eraseSignalForUser,
} from "@/modules/signal/server/signal-gdpr";
import { revokeExactDriveFolderGrant } from "@/server/connections/project-drive-erasure-grants";
import { revokeGoogleToken } from "@/server/connections/google-drive";

/**
 * GDPR Art. 20 data portability — unified Signal Studio export.
 *
 * Binds the production Tasks DB singleton and real per-module export
 * functions. Called by GET /api/account/export.
 *
 * The injectable core (`exportUnifiedAccountDataWith`) is in
 * `account-unified-export.ts` so it can be exercised in tests without
 * real Turso credentials.
 */
export async function exportAccountForUser(clerkId: string) {
  return exportUnifiedAccountDataWith(db, clerkId, {
    exportNotes: exportNotesForUser,
    exportTimeline: exportTimelineForUser,
    exportSignal: exportSignalForUser,
  });
}

/**
 * GDPR right-to-erasure — unified Signal Studio deletion.
 *
 * Binds the production Tasks DB singleton, real per-module erase
 * functions, and the real Google revocation fetch. Called by
 * POST /api/account/delete BEFORE the Clerk admin delete.
 *
 * The injectable core (`deleteUnifiedAccountDataWith`) is in
 * `account-unified-erasure.ts` so it can be exercised in tests without
 * real Turso credentials or network access.
 *
 * Idempotent: re-running after a partial failure is safe.
 */
export async function deleteAccountForUser(clerkId: string): Promise<void> {
  await deleteUnifiedAccountDataWith(db, clerkId, {
    eraseNotes: eraseNotesForUser,
    eraseTimeline: eraseTimelineForUser,
    eraseSignal: eraseSignalForUser,
    revokeDriveFolderGrant: revokeExactDriveFolderGrant,
    revokeTokens: defaultRevokeGoogleTokens,
    revokeProjectDriveRefreshToken: revokeGoogleToken,
  });
}
