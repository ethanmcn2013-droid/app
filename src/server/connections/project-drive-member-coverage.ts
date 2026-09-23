import "server-only";

import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  driveFolderGrants,
  projectDriveOperations,
  users,
  workspaceMembers,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { byWorkspace } from "@/server/db/tenant";
import { normalizeProjectDriveGranteeEmail } from "./project-drive-operation-key";

type CoverageDb = Pick<LibSQLDatabase<typeof schema>, "select">;

export type ProjectDriveMemberCoverage = Readonly<{
  coverage: "complete" | "pending" | "incomplete";
  pendingMemberCount: number;
  memberGapCount: number;
  missingUserIdentityCount: number;
  storageOwnerIsOwner: boolean;
}>;

function normalizedEmailOrNull(value: string | null): string | null {
  if (!value) return null;
  try {
    return normalizeProjectDriveGranteeEmail(value);
  } catch {
    return null;
  }
}

function isPendingGrantStatus(status: string): boolean {
  return status === "pending" || status === "running" || status === "retry_wait";
}

/**
 * Derive D14 access truth from the current member email and the exact
 * generation-scoped writer receipt. A receipt for an old email, a reader
 * permission, or a permission awaiting revocation is a gap, never coverage.
 * An exact durable create still in flight is pending rather than complete.
 */
export async function readProjectDriveMemberCoverage(
  database: CoverageDb,
  input: Readonly<{
    workspaceId: string;
    storageGenerationId: string;
    storageOwnerUserId: string;
  }>,
): Promise<ProjectDriveMemberCoverage> {
  const members = await database
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      liveUserId: users.id,
      email: users.email,
    })
    .from(workspaceMembers)
    .leftJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, input.workspaceId));
  const grants = await database
    .select({
      userId: driveFolderGrants.userId,
      grantedEmail: driveFolderGrants.grantedEmail,
      role: driveFolderGrants.role,
      revokePending: driveFolderGrants.revokePending,
    })
    .from(driveFolderGrants)
    .where(
      and(
        eq(driveFolderGrants.workspaceId, input.workspaceId),
        eq(
          driveFolderGrants.storageGenerationId,
          input.storageGenerationId,
        ),
      ),
    );
  const operations = await database
    .select({
      subjectUserId: projectDriveOperations.subjectUserId,
      granteeEmail: projectDriveOperations.granteeEmail,
      grantRole: projectDriveOperations.grantRole,
      status: projectDriveOperations.status,
    })
    .from(projectDriveOperations)
    .where(
      byWorkspace(
        projectDriveOperations.workspaceId,
        input.workspaceId,
        eq(projectDriveOperations.operationKind, "grant_create"),
        eq(
          projectDriveOperations.storageGenerationId,
          input.storageGenerationId,
        ),
      ),
    );

  const storageOwner = members.find(
    (member) => member.userId === input.storageOwnerUserId,
  );
  let pendingMemberCount = 0;
  let memberGapCount = 0;
  let missingUserIdentityCount = 0;
  for (const member of members) {
    if (!member.liveUserId) {
      missingUserIdentityCount += 1;
      memberGapCount += 1;
      continue;
    }
    if (member.userId === input.storageOwnerUserId) continue;
    const email = normalizedEmailOrNull(member.email);
    if (!email) {
      memberGapCount += 1;
      continue;
    }
    const grant = grants.find(
      (candidate) =>
        candidate.userId === member.userId &&
        candidate.grantedEmail === email &&
        candidate.role === "writer" &&
        !candidate.revokePending,
    );
    if (grant) continue;
    const intent = operations.find(
      (candidate) =>
        candidate.subjectUserId === member.userId &&
        candidate.granteeEmail === email &&
        candidate.grantRole === "writer",
    );
    if (intent && isPendingGrantStatus(intent.status)) {
      pendingMemberCount += 1;
    } else {
      memberGapCount += 1;
    }
  }

  return Object.freeze({
    coverage:
      memberGapCount > 0
        ? "incomplete"
        : pendingMemberCount > 0
          ? "pending"
          : "complete",
    pendingMemberCount,
    memberGapCount,
    missingUserIdentityCount,
    storageOwnerIsOwner: storageOwner?.role === "owner",
  });
}
