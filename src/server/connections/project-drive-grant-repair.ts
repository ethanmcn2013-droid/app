import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import {
  driveFolderGrants,
  meta,
  providerConnections,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  revokeExactDriveFolderGrant,
  type ExactDriveGrantReceipt,
} from "./project-drive-erasure-grants";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";

type RepairDb = LibSQLDatabase<typeof schema>;
type RepairTransaction = Parameters<Parameters<RepairDb["transaction"]>[0]>[0];

const DEFAULT_REPAIR_LIMIT = 25;
const MAX_REPAIR_LIMIT = 50;

type PendingGrantSnapshot = ExactDriveGrantReceipt &
  Readonly<{
    grantedEmail: string;
    role: "writer" | "reader";
    grantedAt: Date;
    storageOwnerUserId: string;
  }>;

type PendingGrantCandidate = Readonly<{
  storageGenerationId: string;
  workspaceId: string;
  userId: string;
  permissionId: string;
  grantedEmail: string;
  role: "writer" | "reader";
  grantedAt: Date;
}>;

export type ProjectDriveGrantRepairResult = Readonly<{
  scanned: number;
  attempted: number;
  repaired: number;
  skipped: number;
  failed: number;
}>;

export type ProjectDriveGrantRepairDependencies = Readonly<{
  database: RepairDb;
  revokeExactGrant: (receipt: ExactDriveGrantReceipt) => Promise<void>;
}>;

function normalizedLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_REPAIR_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_REPAIR_LIMIT) {
    throw new RangeError(`limit must be an integer from 1 to ${MAX_REPAIR_LIMIT}`);
  }
  return limit;
}

function sameCandidate(
  row: typeof driveFolderGrants.$inferSelect,
  candidate: PendingGrantCandidate,
): boolean {
  return (
    row.storageGenerationId === candidate.storageGenerationId &&
    row.workspaceId === candidate.workspaceId &&
    row.userId === candidate.userId &&
    row.permissionId === candidate.permissionId &&
    row.grantedEmail === candidate.grantedEmail &&
    row.role === candidate.role &&
    row.grantedAt.getTime() === candidate.grantedAt.getTime() &&
    row.revokePending
  );
}

async function accountErasureIsActive(
  transaction: RepairTransaction,
  userIds: readonly string[],
): Promise<boolean> {
  const keys = [...new Set(userIds)].map(googleDriveAccountErasureFenceKey);
  if (keys.length === 0) return false;
  const rows = await transaction
    .select({ key: meta.key })
    .from(meta)
    .where(inArray(meta.key, keys))
    .limit(1);
  return rows.length > 0;
}

async function prepareCandidate(
  database: RepairDb,
  candidate: PendingGrantCandidate,
): Promise<
  | Readonly<{ outcome: "ready"; snapshot: PendingGrantSnapshot }>
  | Readonly<{ outcome: "skipped" }>
  | Readonly<{ outcome: "blocked" }>
> {
  return database.transaction(
    async (transaction) => {
      const [grant] = await transaction
        .select()
        .from(driveFolderGrants)
        .where(
          and(
            eq(
              driveFolderGrants.storageGenerationId,
              candidate.storageGenerationId,
            ),
            eq(driveFolderGrants.workspaceId, candidate.workspaceId),
            eq(driveFolderGrants.userId, candidate.userId),
            eq(driveFolderGrants.permissionId, candidate.permissionId),
            eq(driveFolderGrants.revokePending, true),
          ),
        )
        .limit(1);
      if (!grant || !sameCandidate(grant, candidate)) {
        return Object.freeze({ outcome: "skipped" as const });
      }

      const [storage] = await transaction
        .select({
          connectionId: workspaceStorage.connectionId,
          folderId: workspaceStorage.folderId,
        })
        .from(workspaceStorage)
        .where(
          and(
            eq(workspaceStorage.id, grant.storageGenerationId),
            eq(workspaceStorage.workspaceId, grant.workspaceId),
          ),
        )
        .limit(1);
      if (!storage) {
        // Keep the exact grant receipt for manual recovery if relational
        // integrity was damaged. Guessing a folder is never safe.
        return Object.freeze({ outcome: "blocked" as const });
      }

      const [connection] = await transaction
        .select({ ownerUserId: providerConnections.userId })
        .from(providerConnections)
        .where(eq(providerConnections.id, storage.connectionId))
        .limit(1);
      if (!connection) {
        return Object.freeze({ outcome: "blocked" as const });
      }
      if (
        await accountErasureIsActive(transaction, [
          grant.userId,
          connection.ownerUserId,
        ])
      ) {
        // Account erasure owns this receipt while its durable fence exists.
        return Object.freeze({ outcome: "skipped" as const });
      }

      return Object.freeze({
        outcome: "ready" as const,
        snapshot: Object.freeze({
          storageGenerationId: grant.storageGenerationId,
          workspaceId: grant.workspaceId,
          connectionId: storage.connectionId,
          folderId: storage.folderId,
          userId: grant.userId,
          permissionId: grant.permissionId,
          grantedEmail: grant.grantedEmail,
          role: grant.role,
          grantedAt: grant.grantedAt,
          storageOwnerUserId: connection.ownerUserId,
        }),
      });
    },
    { behavior: "immediate" },
  );
}

async function finishCandidate(
  database: RepairDb,
  snapshot: PendingGrantSnapshot,
): Promise<boolean> {
  return database.transaction(
    async (transaction) => {
      if (
        await accountErasureIsActive(transaction, [
          snapshot.userId,
          snapshot.storageOwnerUserId,
        ])
      ) {
        // The provider mutation was idempotent. Leave evidence for erasure;
        // a later repair sees 404 and clears it once that fence is gone.
        return false;
      }
      const [current] = await transaction
        .select()
        .from(driveFolderGrants)
        .where(
          and(
            eq(
              driveFolderGrants.storageGenerationId,
              snapshot.storageGenerationId,
            ),
            eq(driveFolderGrants.workspaceId, snapshot.workspaceId),
            eq(driveFolderGrants.userId, snapshot.userId),
            eq(driveFolderGrants.permissionId, snapshot.permissionId),
            eq(driveFolderGrants.revokePending, true),
          ),
        )
        .limit(1);
      if (!current || !sameCandidate(current, snapshot)) return false;

      const deleted = await transaction
        .delete(driveFolderGrants)
        .where(
          and(
            eq(
              driveFolderGrants.storageGenerationId,
              snapshot.storageGenerationId,
            ),
            eq(driveFolderGrants.workspaceId, snapshot.workspaceId),
            eq(driveFolderGrants.userId, snapshot.userId),
            eq(driveFolderGrants.permissionId, snapshot.permissionId),
            eq(driveFolderGrants.grantedEmail, snapshot.grantedEmail),
            eq(driveFolderGrants.role, snapshot.role),
            eq(driveFolderGrants.grantedAt, snapshot.grantedAt),
            eq(driveFolderGrants.revokePending, true),
          ),
        )
        .returning({ userId: driveFolderGrants.userId });
      return deleted.length === 1;
    },
    { behavior: "immediate" },
  );
}

/**
 * Drain a bounded batch of exact Drive permission receipts.
 *
 * Every provider call sits between two short writer transactions. The first
 * proves current database truth and account-erasure ownership; the second
 * deletes only the byte-for-byte receipt that was actually revoked. Provider
 * 404 is handled by the injected idempotent revoker as success.
 */
export function createProjectDriveGrantRepairService(
  dependencies: ProjectDriveGrantRepairDependencies,
) {
  return Object.freeze({
    async repairPending(
      input: Readonly<{ limit?: number }> = {},
    ): Promise<ProjectDriveGrantRepairResult> {
      // isolation-ok: this scheduled queue scan is intentionally cross-tenant
      // and projects only provider receipt metadata. Every candidate is then
      // re-proved by its exact workspace/generation tuple in an immediate
      // transaction before any provider call.
      const candidates = await dependencies.database
        .select({
          storageGenerationId: driveFolderGrants.storageGenerationId,
          workspaceId: driveFolderGrants.workspaceId,
          userId: driveFolderGrants.userId,
          permissionId: driveFolderGrants.permissionId,
          grantedEmail: driveFolderGrants.grantedEmail,
          role: driveFolderGrants.role,
          grantedAt: driveFolderGrants.grantedAt,
        })
        .from(driveFolderGrants)
        .where(eq(driveFolderGrants.revokePending, true))
        .orderBy(asc(driveFolderGrants.grantedAt))
        .limit(normalizedLimit(input.limit));

      let attempted = 0;
      let repaired = 0;
      let skipped = 0;
      let failed = 0;
      for (const candidate of candidates) {
        const prepared = await prepareCandidate(
          dependencies.database,
          candidate,
        );
        if (prepared.outcome === "skipped") {
          skipped += 1;
          continue;
        }
        if (prepared.outcome === "blocked") {
          failed += 1;
          continue;
        }

        attempted += 1;
        try {
          // Never move this provider I/O into either database transaction.
          await dependencies.revokeExactGrant(prepared.snapshot);
          if (
            await finishCandidate(
              dependencies.database,
              prepared.snapshot,
            )
          ) {
            repaired += 1;
          } else {
            skipped += 1;
          }
        } catch {
          // The exact receipt and revokePending flag stay durable. Provider
          // bodies, access tokens, and opaque transport errors never escape.
          failed += 1;
        }
      }

      return Object.freeze({
        scanned: candidates.length,
        attempted,
        repaired,
        skipped,
        failed,
      });
    },
  });
}

export async function repairPendingProjectDriveGrants(
  input: Readonly<{ limit?: number }> = {},
): Promise<ProjectDriveGrantRepairResult> {
  return createProjectDriveGrantRepairService({
    database: db,
    revokeExactGrant: revokeExactDriveFolderGrant,
  }).repairPending(input);
}
