import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type {
  ProjectDriveFolderRepairResult,
} from "@/server/connections/project-drive-folder-repair";
import type { ProjectDriveGrantCreateRepairResult } from "@/server/connections/project-drive-grant-create-repair";
import type { ProjectDriveGrantRepairResult } from "@/server/connections/project-drive-grant-repair";
import type { NativeByteCleanupResult } from "@/server/attachments/native-byte-cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type RepairSelection = Readonly<{
  revocations: boolean;
  grantCreates: boolean;
  folderOperations: boolean;
  nativeBytes: boolean;
}>;

type RepairResult = Readonly<{
  revocations: ProjectDriveGrantRepairResult;
  grantCreates: ProjectDriveGrantCreateRepairResult;
  folderOperations: ProjectDriveFolderRepairResult;
  nativeBytes: NativeByteCleanupResult;
}>;

type RepairRunner = (selection: RepairSelection) => Promise<RepairResult>;

const EMPTY_REVOCATIONS: ProjectDriveGrantRepairResult = Object.freeze({
  scanned: 0,
  attempted: 0,
  repaired: 0,
  skipped: 0,
  failed: 0,
});

const EMPTY_GRANT_CREATES: ProjectDriveGrantCreateRepairResult = Object.freeze({
  scanned: 0,
  attempted: 0,
  completed: 0,
  repairPending: 0,
  retryScheduled: 0,
  manualAttention: 0,
  skipped: 0,
  failed: 0,
});

const EMPTY_FOLDER_OPERATIONS: ProjectDriveFolderRepairResult = Object.freeze({
  scanned: 0,
  attempted: 0,
  completed: 0,
  retryScheduled: 0,
  manualAttention: 0,
  skipped: 0,
  failed: 0,
});

const EMPTY_NATIVE_BYTES: NativeByteCleanupResult = Object.freeze({
  scanned: 0,
  attempted: 0,
  cleaned: 0,
  retryScheduled: 0,
  skipped: 0,
  failed: 0,
});

function folderOperationCounts(
  result: ProjectDriveFolderRepairResult,
): ProjectDriveFolderRepairResult {
  return Object.freeze({
    scanned: result.scanned,
    attempted: result.attempted,
    completed: result.completed,
    retryScheduled: result.retryScheduled,
    manualAttention: result.manualAttention,
    skipped: result.skipped,
    failed: result.failed,
  });
}

function nativeByteCounts(
  result: NativeByteCleanupResult,
): NativeByteCleanupResult {
  return Object.freeze({
    scanned: result.scanned,
    attempted: result.attempted,
    cleaned: result.cleaned,
    retryScheduled: result.retryScheduled,
    skipped: result.skipped,
    failed: result.failed,
  });
}

function bearerMatches(provided: string, expected: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(provided.padEnd(expected.length, "\0"));
  const right = encoder.encode(expected.padEnd(provided.length, "\0"));
  const width = Math.max(left.length, right.length);
  const paddedLeft = new Uint8Array(width);
  const paddedRight = new Uint8Array(width);
  paddedLeft.set(left);
  paddedRight.set(right);
  return timingSafeEqual(paddedLeft, paddedRight) && provided.length === expected.length;
}

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return bearerMatches(provided, expected);
}

async function defaultRepairRunner(
  selection: RepairSelection,
): Promise<RepairResult> {
  let revocations = EMPTY_REVOCATIONS;
  let grantCreates = EMPTY_GRANT_CREATES;
  let folderOperations = EMPTY_FOLDER_OPERATIONS;
  let nativeBytes = EMPTY_NATIVE_BYTES;
  if (selection.revocations) {
    const { repairPendingProjectDriveGrants } = await import(
      "@/server/connections/project-drive-grant-repair"
    );
    revocations = await repairPendingProjectDriveGrants();
  }
  if (selection.grantCreates) {
    const { repairReadyProjectDriveGrantCreates } = await import(
      "@/server/connections/project-drive-grant-create-repair"
    );
    // Keep both sides of permission maintenance sequential. A revocation and
    // a create must not race one another merely because they share a cron.
    grantCreates = await repairReadyProjectDriveGrantCreates();
  }
  if (selection.folderOperations) {
    const { repairReadyProjectDriveFolderOperations } = await import(
      "@/server/connections/project-drive-folder-repair"
    );
    folderOperations = await repairReadyProjectDriveFolderOperations();
  }
  if (selection.nativeBytes) {
    const { repairPendingNativeAttachmentBytes } = await import(
      "@/server/attachments/native-byte-cleanup"
    );
    nativeBytes = await repairPendingNativeAttachmentBytes();
  }
  return Object.freeze({
    revocations,
    grantCreates,
    folderOperations,
    nativeBytes,
  });
}

export function createProjectDriveGrantRepairRoute(
  repair: RepairRunner = defaultRepairRunner,
) {
  return async function projectDriveGrantRepairRoute(request: Request) {
    if (!authorized(request)) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }
    const selection = Object.freeze({
      revocations:
        process.env.SIGNAL_PROJECT_DRIVE_REVOKE_REPAIR_ENABLED === "true",
      grantCreates:
        process.env.SIGNAL_PROJECT_DRIVE_GRANT_CREATE_REPAIR_ENABLED === "true",
      folderOperations:
        process.env.SIGNAL_PROJECT_DRIVE_FOLDER_REPAIR_ENABLED === "true",
      nativeBytes:
        process.env.SIGNAL_PROJECT_DRIVE_NATIVE_BYTE_REPAIR_ENABLED === "true",
    });
    if (
      !selection.revocations &&
      !selection.grantCreates &&
      !selection.folderOperations &&
      !selection.nativeBytes
    ) {
      return NextResponse.json({ ok: true, skipped: "flag-off" });
    }

    const result = await repair(selection);
    return NextResponse.json({
      ok:
        result.revocations.failed === 0 &&
        result.grantCreates.failed === 0 &&
        result.folderOperations.failed === 0 &&
        result.nativeBytes.failed === 0,
      // Preserve the original revoke-repair counters for existing operators.
      // Each newer drain stays namespaced and likewise exposes counts only.
      ...result.revocations,
      grantCreates: result.grantCreates,
      folderOperations: folderOperationCounts(result.folderOperations),
      nativeBytes: nativeByteCounts(result.nativeBytes),
    });
  };
}

export const GET = createProjectDriveGrantRepairRoute();
