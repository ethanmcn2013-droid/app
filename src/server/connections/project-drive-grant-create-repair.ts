import "server-only";

import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lt,
  lte,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/server/db";
import { projectDriveOperations } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { byWorkspace } from "@/server/db/tenant";
import {
  executeProjectDriveGrantOperation,
  type ProjectDriveGrantOperationExecutionResult,
  type ProjectDriveGrantOperationLocator,
} from "./project-drive-grant-operation-executor";

type RepairDb = LibSQLDatabase<typeof schema>;
type ExecutionOutcome = ProjectDriveGrantOperationExecutionResult["outcome"];

const DEFAULT_REPAIR_LIMIT = 25;
const MAX_REPAIR_LIMIT = 50;
const ACTIVE_STATUSES = ["pending", "running", "retry_wait"] as const;

type ReadyGrantCandidate = Readonly<{
  workspaceId: string;
  storageGenerationId: string;
  operationId: string;
}>;

export type ProjectDriveGrantCreateRepairResult = Readonly<{
  scanned: number;
  attempted: number;
  completed: number;
  repairPending: number;
  retryScheduled: number;
  manualAttention: number;
  skipped: number;
  failed: number;
}>;

export type ProjectDriveGrantCreateRepairDependencies = Readonly<{
  database: RepairDb;
  executeGrant: (
    locator: ProjectDriveGrantOperationLocator,
  ) => Promise<Readonly<{ outcome: ExecutionOutcome }>>;
  /** Test-only database clock. Production uses SQLite/libSQL time. */
  databaseNowSeconds?: () => SQL<Date>;
}>;

function databaseNowSeconds(source?: () => SQL<Date>): SQL<Date> {
  return source?.() ?? sql<Date>`unixepoch()`;
}

function normalizedLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_REPAIR_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_REPAIR_LIMIT) {
    throw new RangeError(`limit must be an integer from 1 to ${MAX_REPAIR_LIMIT}`);
  }
  return limit;
}

function groupKey(candidate: ReadyGrantCandidate): string {
  return JSON.stringify([
    candidate.workspaceId,
    candidate.storageGenerationId,
  ]);
}

/**
 * Drain a bounded batch of durable grant-create intents.
 *
 * The queue only supplies exact journal locators. The existing executor owns
 * every account-erasure, tenant, membership, storage, credential and claim
 * fence, and keeps provider I/O between short writer transactions. The
 * predecessor condition makes the oldest live intent the head of each exact
 * workspace/storage generation. A second worker either sees that head's live
 * lease or loses its exact claim and stops that generation. Recovery after an
 * expired lease remains governed by the executor's list-first idempotency.
 */
export function createProjectDriveGrantCreateRepairService(
  dependencies: ProjectDriveGrantCreateRepairDependencies,
) {
  const predecessor = alias(
    projectDriveOperations,
    "project_drive_grant_predecessor",
  );

  function readyHeadPredicate(now: SQL<Date>) {
    return and(
      eq(projectDriveOperations.operationKind, "grant_create"),
      isNull(projectDriveOperations.providerPermissionId),
      or(
        eq(projectDriveOperations.status, "pending"),
        and(
          eq(projectDriveOperations.status, "retry_wait"),
          lte(projectDriveOperations.nextAttemptAt, now),
        ),
        and(
          eq(projectDriveOperations.status, "running"),
          lte(projectDriveOperations.leaseExpiresAt, now),
        ),
      ),
      notExists(
        dependencies.database
          .select({ operationId: predecessor.id })
          .from(predecessor)
          .where(
            and(
              eq(predecessor.operationKind, "grant_create"),
              eq(predecessor.workspaceId, projectDriveOperations.workspaceId),
              eq(
                predecessor.storageGenerationId,
                projectDriveOperations.storageGenerationId,
              ),
              inArray(predecessor.status, ACTIVE_STATUSES),
              or(
                lt(predecessor.createdAt, projectDriveOperations.createdAt),
                and(
                  eq(
                    predecessor.createdAt,
                    projectDriveOperations.createdAt,
                  ),
                  lt(predecessor.id, projectDriveOperations.id),
                ),
              ),
            ),
          ),
      ),
    );
  }

  async function listReadyHeads(limit: number): Promise<ReadyGrantCandidate[]> {
    const now = databaseNowSeconds(dependencies.databaseNowSeconds);
    // isolation-ok: this scheduled queue scan is intentionally cross-tenant.
    // It projects only exact journal locators, then delegates every mutation
    // to the account-fenced executor which re-proves the workspace tuple.
    return dependencies.database
      .select({
        workspaceId: projectDriveOperations.workspaceId,
        storageGenerationId: projectDriveOperations.storageGenerationId,
        operationId: projectDriveOperations.id,
      })
      .from(projectDriveOperations)
      .where(readyHeadPredicate(now))
      .orderBy(
        asc(projectDriveOperations.createdAt),
        asc(projectDriveOperations.id),
      )
      .limit(limit)
      .then((rows) =>
        rows.flatMap((row) =>
          row.storageGenerationId
            ? [
                Object.freeze({
                  workspaceId: row.workspaceId,
                  storageGenerationId: row.storageGenerationId,
                  operationId: row.operationId,
                }),
              ]
            : [],
        ),
      );
  }

  async function nextReadyHead(
    candidate: ReadyGrantCandidate,
  ): Promise<ReadyGrantCandidate | null> {
    const now = databaseNowSeconds(dependencies.databaseNowSeconds);
    const [row] = await dependencies.database
      .select({
        workspaceId: projectDriveOperations.workspaceId,
        storageGenerationId: projectDriveOperations.storageGenerationId,
        operationId: projectDriveOperations.id,
      })
      .from(projectDriveOperations)
      .where(
        byWorkspace(
          projectDriveOperations.workspaceId,
          candidate.workspaceId,
          eq(
            projectDriveOperations.storageGenerationId,
            candidate.storageGenerationId,
          ),
          readyHeadPredicate(now),
        ),
      )
      .orderBy(
        asc(projectDriveOperations.createdAt),
        asc(projectDriveOperations.id),
      )
      .limit(1);
    if (!row?.storageGenerationId) return null;
    return Object.freeze({
      workspaceId: row.workspaceId,
      storageGenerationId: row.storageGenerationId,
      operationId: row.operationId,
    });
  }

  return Object.freeze({
    async repairReady(
      input: Readonly<{ limit?: number }> = {},
    ): Promise<ProjectDriveGrantCreateRepairResult> {
      const limit = normalizedLimit(input.limit);
      const queue = await listReadyHeads(limit);
      const queuedGroups = new Set(queue.map(groupKey));
      let scanned = queue.length;
      let attempted = 0;
      let completed = 0;
      let repairPending = 0;
      let retryScheduled = 0;
      let manualAttention = 0;
      let skipped = 0;
      let failed = 0;

      while (queue.length > 0 && attempted < limit) {
        const candidate = queue.shift()!;
        const key = groupKey(candidate);
        queuedGroups.delete(key);
        attempted += 1;

        let outcome: ExecutionOutcome;
        try {
          const result = await dependencies.executeGrant({
            workspaceId: candidate.workspaceId,
            operationId: candidate.operationId,
          });
          outcome = result.outcome;
        } catch {
          // The journal row remains the only retry authority. Never emit an
          // opaque provider or credential error from this scheduled surface.
          failed += 1;
          continue;
        }

        let canAdvanceGeneration = false;
        switch (outcome) {
          case "completed":
            completed += 1;
            canAdvanceGeneration = true;
            break;
          case "repair_pending":
            repairPending += 1;
            canAdvanceGeneration = true;
            break;
          case "manual_attention":
            manualAttention += 1;
            canAdvanceGeneration = true;
            break;
          case "retry_scheduled":
            retryScheduled += 1;
            break;
          case "conflict":
            // Another worker or fresher domain truth owns this exact intent.
            // Do not skip forward within its folder during this run.
            skipped += 1;
            break;
        }

        if (
          !canAdvanceGeneration ||
          attempted >= limit ||
          scanned >= limit
        ) {
          continue;
        }
        const next = await nextReadyHead(candidate);
        if (
          !next ||
          next.operationId === candidate.operationId ||
          queuedGroups.has(groupKey(next))
        ) {
          continue;
        }
        queue.push(next);
        queuedGroups.add(groupKey(next));
        scanned += 1;
      }

      return Object.freeze({
        scanned,
        attempted,
        completed,
        repairPending,
        retryScheduled,
        manualAttention,
        skipped,
        failed,
      });
    },
  });
}

export async function repairReadyProjectDriveGrantCreates(
  input: Readonly<{ limit?: number }> = {},
): Promise<ProjectDriveGrantCreateRepairResult> {
  return createProjectDriveGrantCreateRepairService({
    database: db,
    executeGrant: executeProjectDriveGrantOperation,
  }).repairReady(input);
}
