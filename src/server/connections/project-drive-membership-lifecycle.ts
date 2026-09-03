import "server-only";

import { and, eq, inArray, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  driveFolderGrants,
  meta,
  providerConnections,
  users,
  workspaceMembers,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  createProjectDriveOperationJournal,
  type ProjectDriveOperationView,
} from "./project-drive-operation-journal";
import { normalizeProjectDriveGranteeEmail } from "./project-drive-operation-key";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";

type MembershipDb = LibSQLDatabase<typeof schema>;
export type ProjectDriveMembershipTransaction = Parameters<
  Parameters<MembershipDb["transaction"]>[0]
>[0];

export type ProjectDriveMembershipIntentDependencies = Readonly<{
  randomOperationId?: () => string;
  databaseNowSeconds?: () => SQL<Date>;
}>;

export type ProjectDriveMembershipIntentResult =
  | Readonly<{ kind: "not-configured" | "storage-owner" }>
  | Readonly<{
      kind: "grant-intent";
      created: boolean;
      operation: ProjectDriveOperationView;
    }>;

export class ProjectDriveMembershipLifecycleError extends Error {
  readonly code:
    | "account-erasure-in-progress"
    | "member-email-mismatch"
    | "membership-missing"
    | "operation-conflict"
    | "storage-invalid";

  constructor(code: ProjectDriveMembershipLifecycleError["code"]) {
    super(`project-drive-membership: ${code}`);
    this.name = "ProjectDriveMembershipLifecycleError";
    this.code = code;
  }
}

function canonicalId(value: string, field: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(`${field} must be a canonical id`);
  }
  return value;
}

/**
 * Compose a freshly accepted Project membership with its Drive grant intent.
 *
 * The caller must insert (or confirm) the membership in the same immediate
 * transaction before calling this helper. If this Project already has a
 * storage generation, the membership and the exact generation/email/role
 * intent then commit or roll back together. Provider I/O deliberately does
 * not happen here; a grant executor drains the durable intent after commit.
 */
export async function prepareCurrentMemberDriveGrantIntent(
  transaction: ProjectDriveMembershipTransaction,
  input: Readonly<{
    workspaceId: string;
    memberUserId: string;
    verifiedEmail: string;
  }>,
  dependencies: ProjectDriveMembershipIntentDependencies = {},
): Promise<ProjectDriveMembershipIntentResult> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const memberUserId = canonicalId(input.memberUserId, "memberUserId");
  const verifiedEmail = normalizeProjectDriveGranteeEmail(input.verifiedEmail);

  const memberships = await transaction
    .select({
      role: workspaceMembers.role,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, memberUserId),
      ),
    )
    .limit(2);
  if (memberships.length !== 1) {
    throw new ProjectDriveMembershipLifecycleError("membership-missing");
  }
  const storedEmail = memberships[0].email
    ? normalizeProjectDriveGranteeEmail(memberships[0].email)
    : null;
  if (storedEmail !== verifiedEmail) {
    throw new ProjectDriveMembershipLifecycleError("member-email-mismatch");
  }

  const storageRows = await transaction
    .select({
      storageGenerationId: workspaceStorage.id,
      storageOwnerUserId: providerConnections.userId,
      storageOwnerRole: workspaceMembers.role,
    })
    .from(workspaceStorage)
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, workspaceStorage.connectionId),
    )
    .leftJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaceStorage.workspaceId),
        eq(workspaceMembers.userId, providerConnections.userId),
      ),
    )
    .where(
      and(
        eq(workspaceStorage.workspaceId, workspaceId),
        eq(workspaceStorage.isCurrent, true),
      ),
    )
    .limit(2);
  if (storageRows.length === 0) return Object.freeze({ kind: "not-configured" });
  if (storageRows.length !== 1 || storageRows[0].storageOwnerRole !== "owner") {
    throw new ProjectDriveMembershipLifecycleError("storage-invalid");
  }
  const storage = storageRows[0];
  if (storage.storageOwnerUserId === memberUserId) {
    return Object.freeze({ kind: "storage-owner" });
  }

  const relatedUserIds = [memberUserId, storage.storageOwnerUserId];
  const liveUsers = await transaction
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, relatedUserIds));
  const fences = await transaction
    .select({ key: meta.key })
    .from(meta)
    .where(
      inArray(
        meta.key,
        relatedUserIds.map(googleDriveAccountErasureFenceKey),
      ),
    );
  if (liveUsers.length !== relatedUserIds.length || fences.length > 0) {
    throw new ProjectDriveMembershipLifecycleError(
      "account-erasure-in-progress",
    );
  }

  const journal = createProjectDriveOperationJournal({
    database: transaction,
    ...dependencies,
  });
  const prepared = await journal.prepare({
    operationKind: "grant_create",
    workspaceId,
    storageGenerationId: storage.storageGenerationId,
    subjectUserId: memberUserId,
    granteeEmail: verifiedEmail,
    grantRole: "writer",
  });
  if (prepared.outcome === "conflict") {
    throw new ProjectDriveMembershipLifecycleError("operation-conflict");
  }
  if (prepared.outcome === "existing") {
    const existing = prepared.operation;
    if (existing.status === "succeeded") {
      if (
        existing.attemptCount < 1 ||
        !existing.receipt ||
        !("providerPermissionId" in existing.receipt)
      ) {
        throw new ProjectDriveMembershipLifecycleError("operation-conflict");
      }
      const grants = await transaction
        .select({
          permissionId: driveFolderGrants.permissionId,
          grantedEmail: driveFolderGrants.grantedEmail,
          role: driveFolderGrants.role,
          revokePending: driveFolderGrants.revokePending,
        })
        .from(driveFolderGrants)
        .where(
          and(
            eq(
              driveFolderGrants.storageGenerationId,
              storage.storageGenerationId,
            ),
            eq(driveFolderGrants.workspaceId, workspaceId),
            eq(driveFolderGrants.userId, memberUserId),
          ),
        )
        .limit(2);
      if (grants.length > 0) {
        const [grant] = grants;
        if (
          grants.length !== 1 ||
          grant.permissionId !== existing.receipt.providerPermissionId ||
          grant.grantedEmail !== verifiedEmail ||
          grant.role !== "writer" ||
          grant.revokePending
        ) {
          throw new ProjectDriveMembershipLifecycleError(
            "operation-conflict",
          );
        }
        return Object.freeze({
          kind: "grant-intent",
          created: false,
          operation: existing,
        });
      }
      const rearmed = await journal.rearmLifecycleOperation({
        workspaceId,
        operationId: existing.operationId,
        operationKind: "grant_create",
        previousAttemptFence: existing.attemptCount,
        previousReceipt: existing.receipt,
      });
      if (rearmed.outcome === "conflict") {
        throw new ProjectDriveMembershipLifecycleError("operation-conflict");
      }
      return Object.freeze({
        kind: "grant-intent",
        created: true,
        operation: rearmed.operation,
      });
    }
    if (existing.status === "cancelled") {
      if (
        existing.attemptCount !== 0 ||
        existing.lastErrorCode !== null ||
        existing.receipt !== null
      ) {
        throw new ProjectDriveMembershipLifecycleError("operation-conflict");
      }
      const restarted = await journal.restartCancelledUnstartedGrant({
        workspaceId,
        operationId: existing.operationId,
      });
      if (restarted.outcome === "conflict") {
        throw new ProjectDriveMembershipLifecycleError("operation-conflict");
      }
      return Object.freeze({
        kind: "grant-intent",
        created: true,
        operation: restarted.operation,
      });
    }
  }
  return Object.freeze({
    kind: "grant-intent",
    created: prepared.outcome === "prepared",
    operation: prepared.operation,
  });
}
