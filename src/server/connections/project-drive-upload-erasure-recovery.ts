import "server-only";

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit";
import {
  driveUploadSessionAadContext,
  keyRingFromEnv,
  open,
  type KeyRing,
} from "@/server/crypto/secret-box";
import { db } from "@/server/db";
import {
  meta,
  providerConnections,
  resources,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  findGoogleDriveFilesByAppProperty,
  queryGoogleDriveResumableUploadSession,
  type GoogleDriveFile,
  type GoogleFetch,
} from "./google-drive";
import {
  withProjectDriveReceiptSession,
  type ProjectDriveAccessService,
} from "./project-drive-access";
import {
  GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE,
  googleDriveAccountErasureFenceKey,
} from "./project-drive-operation-lifecycle";
import type { PendingDelegatedDriveUploadReceipt } from "./project-drive-upload-receipts";

const DRIVE_RESOURCE_MARKER = "signalResourceId" as const;
const MAX_MARKER_PAGES = 10;

type RecoveryDb = LibSQLDatabase<typeof schema>;

export type ProjectDriveUploadErasureRecoveryResult =
  | Readonly<{
      outcome: "resolved";
      resolution: "completed" | "adopted" | "absent";
    }>
  | Readonly<{
      outcome: "blocked";
      reason: "active" | "ambiguous" | "receipt-changed";
    }>;

export type ProjectDriveUploadErasureRecoveryDependencies = Readonly<{
  database: RecoveryDb;
  access: Pick<ProjectDriveAccessService, "withReceiptStorageSession">;
  fetchImpl: GoogleFetch;
  keyRing: KeyRing;
  /** Test seam only. Production timestamps are evaluated by SQLite/libSQL. */
  databaseNowSeconds?: () => SQL<number>;
}>;

type ExactFileReceipt = Readonly<{
  fileId: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink: string;
}>;

class RecoveryConflict extends Error {}

function canonicalId(value: string): boolean {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function nullableEqual<T>(
  column: Parameters<typeof isNull>[0],
  value: T | null,
) {
  return value === null ? isNull(column) : eq(column, value);
}

function exactResourcePredicate(
  receipt: PendingDelegatedDriveUploadReceipt,
) {
  return and(
    eq(resources.id, receipt.resourceId),
    eq(resources.workspaceId, receipt.workspaceId),
    eq(resources.taskId, receipt.taskId),
    eq(resources.kind, "upload"),
    eq(resources.provider, "drive"),
    eq(resources.storage, "drive"),
    eq(resources.storageGenerationId, receipt.storageGenerationId),
    eq(resources.storedPath, receipt.sessionCipher),
    eq(resources.title, receipt.title),
    eq(resources.mimeType, receipt.mimeType),
    eq(resources.sizeBytes, receipt.sizeBytes),
    eq(resources.addedByUserId, receipt.actorUserId),
    eq(resources.addedAt, receipt.addedAt),
    nullableEqual(resources.refreshedAt, receipt.refreshedAt),
    nullableEqual(resources.externalId, receipt.externalId),
    nullableEqual(resources.url, receipt.url),
    nullableEqual(resources.thumbnail, receipt.thumbnail),
    eq(resources.accessState, "pending"),
    eq(resources.countsAgainstStorage, receipt.countsAgainstStorage),
  );
}

function receiptShapeIsRecoverable(
  accountUserId: string,
  receipt: PendingDelegatedDriveUploadReceipt,
): boolean {
  return (
    canonicalId(accountUserId) &&
    (receipt.actorUserId === accountUserId ||
      receipt.storageOwnerUserId === accountUserId) &&
    [
      receipt.resourceId,
      receipt.workspaceId,
      receipt.taskId,
      receipt.storageGenerationId,
      receipt.connectionId,
      receipt.folderId,
      receipt.actorUserId,
      receipt.storageOwnerUserId,
    ].every(canonicalId) &&
    receipt.sessionCipher.length > 0 &&
    receipt.externalId === null &&
    receipt.url === null &&
    receipt.countsAgainstStorage === 0 &&
    typeof receipt.mimeType === "string" &&
    receipt.mimeType.length > 0 &&
    Number.isSafeInteger(receipt.sizeBytes) &&
    receipt.sizeBytes > 0 &&
    receipt.sizeBytes <= MAX_UPLOAD_BYTES
  );
}

function exactFileReceipt(
  file: GoogleDriveFile,
  receipt: PendingDelegatedDriveUploadReceipt,
): ExactFileReceipt | null {
  if (
    !canonicalId(file.id) ||
    file.trashed !== false ||
    file.parents.length !== 1 ||
    file.parents[0] !== receipt.folderId ||
    file.appProperties[DRIVE_RESOURCE_MARKER] !== receipt.resourceId ||
    !file.name ||
    file.mimeType !== receipt.mimeType ||
    file.size === null ||
    !/^(?:0|[1-9][0-9]*)$/.test(file.size)
  ) {
    return null;
  }
  const size = BigInt(file.size);
  if (
    size !== BigInt(receipt.sizeBytes) ||
    size > BigInt(MAX_UPLOAD_BYTES) ||
    !file.webViewLink
  ) {
    return null;
  }
  let webViewLink: string;
  try {
    const parsed = new URL(file.webViewLink);
    if (
      parsed.origin !== "https://drive.google.com" ||
      parsed.username !== "" ||
      parsed.password !== ""
    ) {
      return null;
    }
    webViewLink = parsed.toString();
  } catch {
    return null;
  }
  return Object.freeze({
    fileId: file.id,
    title: file.name,
    mimeType: file.mimeType,
    sizeBytes: Number(size),
    webViewLink,
  });
}

async function exactFenceAndStorageStillExist(
  database: Pick<RecoveryDb, "select">,
  accountUserId: string,
  receipt: PendingDelegatedDriveUploadReceipt,
): Promise<boolean> {
  const fences = await database
    .select({ key: meta.key })
    .from(meta)
    .where(
      and(
        eq(meta.key, googleDriveAccountErasureFenceKey(accountUserId)),
        eq(meta.value, GOOGLE_DRIVE_ACCOUNT_ERASURE_FENCE_VALUE),
      ),
    )
    .limit(2);
  const storageRows = await database
    .select({ id: workspaceStorage.id })
    .from(workspaceStorage)
    .innerJoin(
      providerConnections,
      eq(providerConnections.id, workspaceStorage.connectionId),
    )
    .where(
      and(
        eq(workspaceStorage.id, receipt.storageGenerationId),
        eq(workspaceStorage.workspaceId, receipt.workspaceId),
        eq(workspaceStorage.connectionId, receipt.connectionId),
        eq(workspaceStorage.folderId, receipt.folderId),
        eq(providerConnections.userId, receipt.storageOwnerUserId),
      ),
    )
    .limit(2);
  return fences.length === 1 && storageRows.length === 1;
}

async function exactReceiptStillExists(
  database: RecoveryDb,
  accountUserId: string,
  receipt: PendingDelegatedDriveUploadReceipt,
): Promise<boolean> {
  if (!(await exactFenceAndStorageStillExist(database, accountUserId, receipt))) {
    return false;
  }
  const rows = await database
    .select({ id: resources.id })
    .from(resources)
    .where(exactResourcePredicate(receipt))
    .limit(2);
  return rows.length === 1;
}

async function applyRecovery(
  deps: ProjectDriveUploadErasureRecoveryDependencies,
  accountUserId: string,
  receipt: PendingDelegatedDriveUploadReceipt,
  resolution:
    | Readonly<{ kind: "file"; file: ExactFileReceipt }>
    | Readonly<{ kind: "absent" }>,
): Promise<void> {
  await deps.database.transaction(async (tx) => {
    const changed =
      resolution.kind === "file"
        ? await tx
            .update(resources)
            .set({
              externalId: resolution.file.fileId,
              storedPath: null,
              title: resolution.file.title,
              url: resolution.file.webViewLink,
              mimeType: resolution.file.mimeType,
              sizeBytes: resolution.file.sizeBytes,
              accessState: "ok",
              refreshedAt:
                deps.databaseNowSeconds?.() ?? sql<number>`unixepoch()`,
            })
            .where(exactResourcePredicate(receipt))
            .returning({ id: resources.id })
        : await tx
            .delete(resources)
            .where(exactResourcePredicate(receipt))
            .returning({ id: resources.id });

    // Mutate first to take SQLite's writer slot, then prove both the exact
    // erasure fence and immutable storage ownership in the same transaction.
    // Throwing rolls the tentative mutation back.
    if (
      changed.length !== 1 ||
      !(await exactFenceAndStorageStillExist(
        tx,
        accountUserId,
        receipt,
      ))
    ) {
      throw new RecoveryConflict();
    }
  });
}

async function globallyMarkedFiles(
  accessToken: string,
  receipt: PendingDelegatedDriveUploadReceipt,
  fetchImpl: GoogleFetch,
): Promise<readonly GoogleDriveFile[] | null> {
  const matches: GoogleDriveFile[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_MARKER_PAGES; page += 1) {
    const result = await findGoogleDriveFilesByAppProperty(
      accessToken,
      {
        key: DRIVE_RESOURCE_MARKER,
        value: receipt.resourceId,
        includeTrashed: true,
        pageToken,
        pageSize: 100,
      },
      fetchImpl,
    );
    matches.push(...result.files);
    if (matches.length > 1) return null;
    pageToken = result.nextPageToken;
    if (!pageToken) return Object.freeze(matches);
  }
  // A continuation token means the global search was not exhaustive.
  return null;
}

/**
 * Recovery-only resolver for the exact resumable session already stored in a
 * pending row. It cannot mint a replacement session or delete provider bytes.
 * Provider I/O completes before the exact-row/fence transaction is opened.
 */
export function createProjectDriveUploadErasureRecoveryService(
  deps: ProjectDriveUploadErasureRecoveryDependencies,
) {
  async function recover(
    accountUserId: string,
    receipt: PendingDelegatedDriveUploadReceipt,
  ): Promise<ProjectDriveUploadErasureRecoveryResult> {
    if (
      !receiptShapeIsRecoverable(accountUserId, receipt) ||
      !(await exactReceiptStillExists(deps.database, accountUserId, receipt))
    ) {
      return Object.freeze({
        outcome: "blocked" as const,
        reason: "receipt-changed" as const,
      });
    }

    let sessionUrl: string | null = null;
    try {
      sessionUrl = open(
        receipt.sessionCipher,
        driveUploadSessionAadContext(
          receipt.workspaceId,
          receipt.storageGenerationId,
          receipt.resourceId,
        ),
        deps.keyRing,
      );
      const providerResolution = await deps.access.withReceiptStorageSession(
        {
          workspaceId: receipt.workspaceId,
          storageGenerationId: receipt.storageGenerationId,
          connectionId: receipt.connectionId,
          folderId: receipt.folderId,
        },
        async (storageSession) => {
          if (
            storageSession.storage.id !== receipt.storageGenerationId ||
            storageSession.storage.workspaceId !== receipt.workspaceId ||
            storageSession.storage.connectionId !== receipt.connectionId ||
            storageSession.storage.folderId !== receipt.folderId ||
            storageSession.credential.ownerUserId !==
              receipt.storageOwnerUserId
          ) {
            return Object.freeze({ kind: "ambiguous" as const });
          }
          const status = await queryGoogleDriveResumableUploadSession(
            sessionUrl!,
            receipt.sizeBytes,
            deps.fetchImpl,
          );
          if (status.kind === "incomplete") {
            return Object.freeze({ kind: "active" as const });
          }
          if (status.kind === "complete") {
            const file = exactFileReceipt(status.file, receipt);
            return file
              ? Object.freeze({ kind: "completed" as const, file })
              : Object.freeze({ kind: "ambiguous" as const });
          }

          const matches = await globallyMarkedFiles(
            storageSession.accessToken,
            receipt,
            deps.fetchImpl,
          );
          if (matches === null || matches.length > 1) {
            return Object.freeze({ kind: "ambiguous" as const });
          }
          if (matches.length === 0) {
            return Object.freeze({ kind: "absent" as const });
          }
          const file = exactFileReceipt(matches[0], receipt);
          return file
            ? Object.freeze({ kind: "adopted" as const, file })
            : Object.freeze({ kind: "ambiguous" as const });
        },
      );

      if (providerResolution.kind === "active") {
        return Object.freeze({
          outcome: "blocked" as const,
          reason: "active" as const,
        });
      }
      if (providerResolution.kind === "ambiguous") {
        return Object.freeze({
          outcome: "blocked" as const,
          reason: "ambiguous" as const,
        });
      }

      try {
        await applyRecovery(
          deps,
          accountUserId,
          receipt,
          providerResolution.kind === "absent"
            ? { kind: "absent" }
            : { kind: "file", file: providerResolution.file },
        );
      } catch (error) {
        if (error instanceof RecoveryConflict) {
          return Object.freeze({
            outcome: "blocked" as const,
            reason: "receipt-changed" as const,
          });
        }
        throw error;
      }
      return Object.freeze({
        outcome: "resolved" as const,
        resolution: providerResolution.kind,
      });
    } catch {
      // Transport, token refresh, crypto, malformed provider data, and DB
      // uncertainty all retain evidence. Never attach the caught value: it may
      // contain a bearer session or provider response body.
      return Object.freeze({
        outcome: "blocked" as const,
        reason: "ambiguous" as const,
      });
    } finally {
      sessionUrl = null;
    }
  }

  return Object.freeze({ recover });
}

export async function recoverPendingDelegatedDriveUploadForErasure(
  accountUserId: string,
  receipt: PendingDelegatedDriveUploadReceipt,
): Promise<ProjectDriveUploadErasureRecoveryResult> {
  return createProjectDriveUploadErasureRecoveryService({
    database: db,
    access: { withReceiptStorageSession: withProjectDriveReceiptSession },
    fetchImpl: fetch,
    keyRing: keyRingFromEnv(),
  }).recover(accountUserId, receipt);
}
