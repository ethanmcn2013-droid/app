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
  executeProjectDriveFolderOperation,
  type ProjectDriveFolderOperationExecutionResult,
  type ProjectDriveFolderOperationLocator,
} from "./project-drive-folder-operation-executor";

type RepairDb = LibSQLDatabase<typeof schema>;
type ExecutionOutcome = ProjectDriveFolderOperationExecutionResult["outcome"];
type RepairableFolderOperationKind = "folder_provision" | "folder_rename";
type RepairableFolderOperationLocator = Extract<
  ProjectDriveFolderOperationLocator,
  Readonly<{ operationKind: RepairableFolderOperationKind }>
>;

const DEFAULT_REPAIR_LIMIT = 25;
const MAX_REPAIR_LIMIT = 50;
const ORDERING_BARRIER_STATUSES = [
  "pending",
  "running",
  "retry_wait",
  "manual_attention",
] as const;
const REPAIRABLE_OPERATION_KINDS = [
  "folder_provision",
  "folder_rename",
] as const;
const ORDERED_FOLDER_OPERATION_KINDS = [
  ...REPAIRABLE_OPERATION_KINDS,
  "storage_handover",
] as const;

type ReadyFolderCandidate = Readonly<{
  workspaceId: string;
  operationId: string;
  operationKind: RepairableFolderOperationKind;
}>;

export type ProjectDriveFolderRepairResult = Readonly<{
  scanned: number;
  attempted: number;
  completed: number;
  retryScheduled: number;
  manualAttention: number;
  skipped: number;
  failed: number;
}>;

export type ProjectDriveFolderRepairDependencies = Readonly<{
  database: RepairDb;
  executeFolder: (
    locator: RepairableFolderOperationLocator,
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

function isRepairableOperationKind(
  value: string,
): value is RepairableFolderOperationKind {
  return value === "folder_provision" || value === "folder_rename";
}

/**
 * Drain a bounded batch of durable folder-provision and folder-rename intents.
 *
 * The scan is advisory: the existing account-fenced executor owns the DB-clock
 * claim CAS, provider idempotency, relationship reproof and completion fence.
 * Storage handover is deliberately not repairable here because its actor's
 * manageProject authority is locator state, not durable journal state. A live
 * handover still acts as a workspace ordering barrier so this worker cannot
 * skip across an operation that only an authorized interactive caller may
 * resume. Provider work remains inside the existing executor and outside its
 * writer transactions.
 */
export function createProjectDriveFolderRepairService(
  dependencies: ProjectDriveFolderRepairDependencies,
) {
  const predecessor = alias(
    projectDriveOperations,
    "project_drive_folder_predecessor",
  );

  function readyHeadPredicate(now: SQL<Date>) {
    return and(
      inArray(
        projectDriveOperations.operationKind,
        REPAIRABLE_OPERATION_KINDS,
      ),
      lte(projectDriveOperations.createdAt, now),
      isNull(projectDriveOperations.providerFolderId),
      isNull(projectDriveOperations.providerFolderWebViewLink),
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
              eq(predecessor.workspaceId, projectDriveOperations.workspaceId),
              inArray(
                predecessor.operationKind,
                ORDERED_FOLDER_OPERATION_KINDS,
              ),
              inArray(predecessor.status, ORDERING_BARRIER_STATUSES),
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

  function candidatesFromRows(
    rows: ReadonlyArray<{
      workspaceId: string;
      operationId: string;
      operationKind: string;
    }>,
  ): ReadyFolderCandidate[] {
    return rows.flatMap((row) =>
      isRepairableOperationKind(row.operationKind)
        ? [
            Object.freeze({
              workspaceId: row.workspaceId,
              operationId: row.operationId,
              operationKind: row.operationKind,
            }),
          ]
        : [],
    );
  }

  async function listReadyHeads(limit: number): Promise<ReadyFolderCandidate[]> {
    const now = databaseNowSeconds(dependencies.databaseNowSeconds);
    // isolation-ok: this scheduled queue scan is intentionally cross-tenant.
    // It projects only exact journal locators; the account-fenced executor
    // re-proves the workspace tuple and owns every mutation.
    const rows = await dependencies.database
      .select({
        workspaceId: projectDriveOperations.workspaceId,
        operationId: projectDriveOperations.id,
        operationKind: projectDriveOperations.operationKind,
      })
      .from(projectDriveOperations)
      .where(readyHeadPredicate(now))
      .orderBy(
        asc(projectDriveOperations.createdAt),
        asc(projectDriveOperations.id),
      )
      .limit(limit);
    return candidatesFromRows(rows);
  }

  async function nextReadyHead(
    candidate: ReadyFolderCandidate,
  ): Promise<ReadyFolderCandidate | null> {
    const now = databaseNowSeconds(dependencies.databaseNowSeconds);
    const rows = await dependencies.database
      .select({
        workspaceId: projectDriveOperations.workspaceId,
        operationId: projectDriveOperations.id,
        operationKind: projectDriveOperations.operationKind,
      })
      .from(projectDriveOperations)
      .where(
        byWorkspace(
          projectDriveOperations.workspaceId,
          candidate.workspaceId,
          readyHeadPredicate(now),
        ),
      )
      .orderBy(
        asc(projectDriveOperations.createdAt),
        asc(projectDriveOperations.id),
      )
      .limit(1);
    return candidatesFromRows(rows)[0] ?? null;
  }

  return Object.freeze({
    async repairReady(
      input: Readonly<{ limit?: number }> = {},
    ): Promise<ProjectDriveFolderRepairResult> {
      const limit = normalizedLimit(input.limit);
      const queue = await listReadyHeads(limit);
      const queuedWorkspaces = new Set(
        queue.map((candidate) => candidate.workspaceId),
      );
      let scanned = queue.length;
      let attempted = 0;
      let completed = 0;
      let retryScheduled = 0;
      let manualAttention = 0;
      let skipped = 0;
      let failed = 0;

      while (queue.length > 0 && attempted < limit) {
        const candidate = queue.shift()!;
        queuedWorkspaces.delete(candidate.workspaceId);
        attempted += 1;

        let outcome: ExecutionOutcome;
        try {
          const result = await dependencies.executeFolder(candidate);
          outcome = result.outcome;
        } catch {
          // The journal row remains the retry authority. Never expose an
          // opaque provider, connection or workspace failure from this job.
          failed += 1;
          continue;
        }

        let canAdvanceWorkspace = false;
        switch (outcome) {
          case "completed":
            completed += 1;
            canAdvanceWorkspace = true;
            break;
          case "manual_attention":
            manualAttention += 1;
            break;
          case "retry_scheduled":
            retryScheduled += 1;
            break;
          case "conflict":
            // A competing worker or fresher relationship truth owns the head.
            // Never skip forward within this workspace during the same run.
            skipped += 1;
            break;
        }

        if (
          !canAdvanceWorkspace ||
          attempted >= limit ||
          scanned >= limit
        ) {
          continue;
        }
        const next = await nextReadyHead(candidate);
        if (
          !next ||
          next.operationId === candidate.operationId ||
          queuedWorkspaces.has(next.workspaceId)
        ) {
          continue;
        }
        queue.push(next);
        queuedWorkspaces.add(next.workspaceId);
        scanned += 1;
      }

      return Object.freeze({
        scanned,
        attempted,
        completed,
        retryScheduled,
        manualAttention,
        skipped,
        failed,
      });
    },
  });
}

export async function repairReadyProjectDriveFolderOperations(
  input: Readonly<{ limit?: number }> = {},
): Promise<ProjectDriveFolderRepairResult> {
  return createProjectDriveFolderRepairService({
    database: db,
    executeFolder: executeProjectDriveFolderOperation,
  }).repairReady(input);
}
