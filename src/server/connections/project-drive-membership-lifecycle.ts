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
import { prepareAccountFencedProjectDriveOperationInTransaction } from "./project-drive-operation-orchestrator";

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

export type ExistingMemberDriveGrantIntentResult = Readonly<{
  /** Every member except the storage owner. */
  memberCount: number;
  /** Valid current emails with an exact durable writer intent. */
  grantIntentCount: number;
  createdIntentCount: number;
  /** Members whose current user row has no usable email. */
  coverageGapCount: number;
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

/**
 * Bind a newly materialized folder generation to every member already on the
 * Project. The folder row must have been inserted in the caller's immediate
 * transaction before this helper runs.
 *
 * A valid current `users.email` receives one exact writer intent through the
 * same account-fenced prepare seam as every other provider operation. Missing
 * or malformed emails remain memberships and are counted as an explicit
 * coverage gap; D14 makes that gap select Signal-native storage for new
 * uploads until it is repaired. No provider request occurs in this helper.
 */
export async function prepareExistingMemberDriveGrantIntents(
  transaction: ProjectDriveMembershipTransaction,
  input: Readonly<{
    workspaceId: string;
    storageGenerationId: string;
  }>,
  dependencies: ProjectDriveMembershipIntentDependencies = {},
): Promise<ExistingMemberDriveGrantIntentResult> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const storageGenerationId = canonicalId(
    input.storageGenerationId,
    "storageGenerationId",
  );
  const storageRows = await transaction
    .select({
      storageGenerationId: workspaceStorage.id,
      storageOwnerUserId: providerConnections.userId,
      storageOwnerRole: workspaceMembers.role,
      provider: providerConnections.provider,
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
        eq(workspaceStorage.id, storageGenerationId),
        eq(workspaceStorage.isCurrent, true),
      ),
    )
    .limit(2);
  if (
    storageRows.length !== 1 ||
    storageRows[0].provider !== "google_drive" ||
    storageRows[0].storageOwnerRole !== "owner"
  ) {
    throw new ProjectDriveMembershipLifecycleError("storage-invalid");
  }

  const storageOwnerUserId = storageRows[0].storageOwnerUserId;
  const memberRows = await transaction
    .select({ userId: workspaceMembers.userId, email: users.email })
    .from(workspaceMembers)
    .leftJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId));
  if (!memberRows.some((member) => member.userId === storageOwnerUserId)) {
    throw new ProjectDriveMembershipLifecycleError("storage-invalid");
  }

  let grantIntentCount = 0;
  let createdIntentCount = 0;
  let coverageGapCount = 0;
  for (const member of memberRows) {
    if (member.userId === storageOwnerUserId) continue;
    let granteeEmail: string;
    try {
      if (!member.email) throw new TypeError("missing member email");
      granteeEmail = normalizeProjectDriveGranteeEmail(member.email);
    } catch {
      coverageGapCount += 1;
      continue;
    }
    const prepared =
      await prepareAccountFencedProjectDriveOperationInTransaction(
        transaction,
        {
          operationKind: "grant_create",
          workspaceId,
          storageGenerationId,
          subjectUserId: member.userId,
          granteeEmail,
          grantRole: "writer",
        },
        dependencies,
      );
    if (prepared.outcome === "conflict") {
      throw new ProjectDriveMembershipLifecycleError("operation-conflict");
    }
    grantIntentCount += 1;
    if (prepared.outcome === "prepared") createdIntentCount += 1;
  }

  return Object.freeze({
    memberCount: memberRows.length - 1,
    grantIntentCount,
    createdIntentCount,
    coverageGapCount,
  });
}
