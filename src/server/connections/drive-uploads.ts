import "server-only";

import {
  and,
  eq,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { allowedMimeTypes } from "@/lib/upload-validation";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-limit";
import {
  driveUploadSessionAadContext,
  keyRingFromEnv,
  open,
  seal,
  type KeyRing,
} from "@/server/crypto/secret-box";
import { db } from "@/server/db";
import {
  driveFolderGrants,
  meta,
  providerConnections,
  resources,
  tasks,
  users,
  workspaceMembers,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  createGoogleDriveResumableUploadSession,
  findGoogleDriveFilesByAppProperty,
  getGoogleDriveAbout,
  getGoogleDriveFile,
  isGoogleDriveProviderError,
  queryGoogleDriveResumableUploadSession,
  type GoogleDriveFile,
  type GoogleDriveStorageQuota,
  type GoogleFetch,
} from "./google-drive";
import {
  withAuthorizedProjectDriveSession,
  type ProjectDriveAccessService,
  type ProjectDriveStorageSession,
} from "./project-drive-access";
import {
  assertProjectDriveCapability,
  type AuthorizedProjectDriveContext,
} from "./project-drive-authz";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";

export const DRIVE_RESOURCE_MARKER = "signalResourceId" as const;

const CLAIM_LEASE_SECONDS = 5 * 60;
const MAX_MARKER_PAGES = 10;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type UploadDb = LibSQLDatabase<typeof schema>;
type DriveResource = typeof resources.$inferSelect;

export type DriveUploadFallbackReason =
  | "no-current-storage"
  | "storage-unavailable"
  | "member-access-incomplete"
  | "quota-full"
  | "provider-unavailable";

export type DriveUploadPauseReason =
  | "claim-busy"
  | "member-access-incomplete"
  | "provider-unavailable"
  | "storage-changed";

export type DriveUploadSessionResult =
  | Readonly<{
      kind: "drive-session";
      resourceId: string;
      sessionUrl: string;
      /** Pass directly to uploadToGoogleDriveResumableSession.startOffset. */
      startOffset: number;
    }>
  | Readonly<{
      kind: "complete";
      resourceId: string;
      fileId: string;
      webViewLink: string;
      outcome: "adopted" | "existing";
    }>
  | Readonly<{
      kind: "signal-native";
      reason: DriveUploadFallbackReason;
    }>
  | Readonly<{
      kind: "paused";
      resourceId: string;
      reason: DriveUploadPauseReason;
    }>;

export type FinalizeDriveUploadResult = Readonly<{
  resourceId: string;
  fileId: string;
  webViewLink: string;
  outcome: "finalized" | "existing";
}>;

export type DriveUploadRequest = Readonly<{
  resourceId: string;
  taskId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}>;

export type DriveUploadErrorCode =
  | "invalid-input"
  | "not-found"
  | "request-conflict"
  | "marker-ambiguous"
  | "marker-invalid"
  | "file-invalid"
  | "quota-invalid";

export class DriveUploadError extends Error {
  readonly code: DriveUploadErrorCode;

  constructor(code: DriveUploadErrorCode) {
    const messages: Record<DriveUploadErrorCode, string> = {
      "invalid-input": "That upload request is invalid.",
      "not-found": "That upload is not available.",
      "request-conflict": "That upload request no longer matches this file.",
      "marker-ambiguous": "More than one matching Drive file needs review.",
      "marker-invalid": "The matching Drive file is not in this project folder.",
      "file-invalid": "Google Drive did not return the expected file.",
      "quota-invalid": "Google Drive did not return a usable storage total.",
    };
    super(messages[code]);
    this.name = "DriveUploadError";
    this.code = code;
  }
}

export type DriveUploadServiceDependencies = Readonly<{
  database: UploadDb;
  access: Pick<ProjectDriveAccessService, "withStorageSession">;
  fetchImpl: GoogleFetch;
  keyRing: KeyRing;
  /** Test seam only; production uses SQLite/libSQL `unixepoch()`. */
  databaseNowSeconds?: () => SQL<number>;
}>;

type NormalizedRequest = Readonly<{
  resourceId: string;
  taskId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}>;

type CurrentStorage = Readonly<{
  id: string;
  workspaceId: string;
  ownerUserId: string;
  state: "active" | "needs_reauth" | "folder_missing" | "quota_full";
}>;

type ClaimLease = Readonly<{
  row: DriveResource;
  ownsMint: boolean;
  leaseStamp: number | null;
}>;

type MintExpectation =
  | Readonly<{ kind: "lease"; refreshedAt: number }>
  | Readonly<{
      kind: "session";
      storedPath: string;
      refreshedAt: number | null;
    }>;

function databaseNowSeconds(source?: () => SQL<number>): SQL<number> {
  return source?.() ?? sql<number>`unixepoch()`;
}

function normalizeRequest(input: DriveUploadRequest): NormalizedRequest {
  if (!UUID_PATTERN.test(input.resourceId)) {
    throw new DriveUploadError("invalid-input");
  }
  if (
    typeof input.taskId !== "string" ||
    input.taskId.length === 0 ||
    input.taskId !== input.taskId.trim() ||
    /[\u0000-\u001f\u007f]/.test(input.taskId)
  ) {
    throw new DriveUploadError("invalid-input");
  }
  const name = input.name.trim();
  if (
    name.length === 0 ||
    name.length > 255 ||
    /[\\/\u0000-\u001f\u007f]/.test(name)
  ) {
    throw new DriveUploadError("invalid-input");
  }
  const mimeType = input.mimeType.split(";", 1)[0]?.trim().toLowerCase();
  if (!mimeType || !allowedMimeTypes().includes(mimeType)) {
    throw new DriveUploadError("invalid-input");
  }
  if (
    !Number.isSafeInteger(input.sizeBytes) ||
    input.sizeBytes <= 0 ||
    input.sizeBytes > MAX_UPLOAD_BYTES
  ) {
    throw new DriveUploadError("invalid-input");
  }
  return Object.freeze({
    resourceId: input.resourceId,
    taskId: input.taskId,
    name,
    mimeType,
    sizeBytes: input.sizeBytes,
  });
}

function exactDecimalBytes(
  value: string | null,
  errorCode: "quota-invalid" | "file-invalid" = "quota-invalid",
): bigint | null {
  if (value === null) return null;
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) {
    throw new DriveUploadError(errorCode);
  }
  return BigInt(value);
}

function hasQuotaFor(
  quota: GoogleDriveStorageQuota,
  sizeBytes: number,
): boolean {
  const limit = exactDecimalBytes(quota.limit);
  if (limit === null) return true;
  const usage = exactDecimalBytes(quota.usage);
  if (usage === null) throw new DriveUploadError("quota-invalid");
  return usage + BigInt(sizeBytes) <= limit;
}

function assertRequestMatches(
  row: DriveResource,
  authorization: AuthorizedProjectDriveContext,
  input: NormalizedRequest,
): void {
  if (
    row.workspaceId !== authorization.projectId ||
    row.taskId !== input.taskId ||
    row.kind !== "upload" ||
    row.provider !== "drive" ||
    row.storage !== "drive" ||
    row.title !== input.name ||
    row.mimeType !== input.mimeType ||
    row.sizeBytes !== input.sizeBytes ||
    row.addedByUserId !== authorization.actorUserId
  ) {
    throw new DriveUploadError("request-conflict");
  }
}

function sessionContext(row: Pick<DriveResource, "workspaceId" | "storageGenerationId" | "id">): string {
  if (!row.storageGenerationId) throw new DriveUploadError("request-conflict");
  return driveUploadSessionAadContext(
    row.workspaceId,
    row.storageGenerationId,
    row.id,
  );
}

function completeResult(
  row: DriveResource,
  outcome: "adopted" | "existing",
): DriveUploadSessionResult {
  if (!row.externalId || !row.url) throw new DriveUploadError("file-invalid");
  return Object.freeze({
    kind: "complete" as const,
    resourceId: row.id,
    fileId: row.externalId,
    webViewLink: row.url,
    outcome,
  });
}

function safeWebViewLink(value: string | null): string {
  if (!value) throw new DriveUploadError("file-invalid");
  try {
    const parsed = new URL(value);
    if (
      parsed.origin !== "https://drive.google.com" ||
      parsed.username !== "" ||
      parsed.password !== ""
    ) {
      throw new Error("not a trusted Drive origin");
    }
    return parsed.toString();
  } catch {
    throw new DriveUploadError("file-invalid");
  }
}

function exactFileReceipt(
  file: GoogleDriveFile,
  input: NormalizedRequest,
  folderId: string,
): Readonly<{
  fileId: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink: string;
}> {
  const exactParent = file.parents.length === 1 && file.parents[0] === folderId;
  const exactMarker =
    file.appProperties[DRIVE_RESOURCE_MARKER] === input.resourceId;
  if (
    file.trashed !== false ||
    !exactParent ||
    !exactMarker ||
    !file.name ||
    file.mimeType !== input.mimeType ||
    file.size === null
  ) {
    throw new DriveUploadError("file-invalid");
  }
  const size = exactDecimalBytes(file.size, "file-invalid");
  if (
    size === null ||
    size !== BigInt(input.sizeBytes) ||
    size > BigInt(MAX_UPLOAD_BYTES)
  ) {
    throw new DriveUploadError("file-invalid");
  }
  return Object.freeze({
    fileId: file.id,
    title: file.name,
    mimeType: file.mimeType,
    sizeBytes: Number(size),
    webViewLink: safeWebViewLink(file.webViewLink),
  });
}

export function createDriveUploadService(deps: DriveUploadServiceDependencies) {
  async function assertUnfencedUploadLineages(
    database: Pick<UploadDb, "select">,
    authorization: AuthorizedProjectDriveContext,
    session: ProjectDriveStorageSession,
    requireCurrent: boolean,
  ): Promise<CurrentStorage> {
    const storageRows = await database
      .select({
        id: workspaceStorage.id,
        workspaceId: workspaceStorage.workspaceId,
        connectionId: workspaceStorage.connectionId,
        ownerUserId: providerConnections.userId,
        state: workspaceStorage.state,
        isCurrent: workspaceStorage.isCurrent,
      })
      .from(workspaceStorage)
      .innerJoin(
        providerConnections,
        eq(providerConnections.id, workspaceStorage.connectionId),
      )
      .where(
        and(
          eq(workspaceStorage.id, session.storage.id),
          eq(workspaceStorage.workspaceId, authorization.projectId),
        ),
      )
      .limit(2);
    if (
      storageRows.length !== 1 ||
      storageRows[0].connectionId !== session.storage.connectionId ||
      storageRows[0].ownerUserId !== session.credential.ownerUserId ||
      (requireCurrent &&
        (!storageRows[0].isCurrent || storageRows[0].state !== "active"))
    ) {
      throw new DriveUploadError("request-conflict");
    }

    const lineageUserIds = [
      ...new Set([
        authorization.actorUserId,
        storageRows[0].ownerUserId,
      ]),
    ];
    const liveMemberships = await database
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, authorization.projectId),
          inArray(workspaceMembers.userId, lineageUserIds),
        ),
      );
    const actorMembership = liveMemberships.find(
      (membership) => membership.userId === authorization.actorUserId,
    );
    const storageOwnerMembership = liveMemberships.find(
      (membership) => membership.userId === storageRows[0].ownerUserId,
    );
    const liveUsers = await database
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, lineageUserIds));
    const activeFences = await database
      .select({ key: meta.key })
      .from(meta)
      .where(
        inArray(
          meta.key,
          lineageUserIds.map(googleDriveAccountErasureFenceKey),
        ),
      );
    if (
      !actorMembership ||
      !storageOwnerMembership ||
      storageOwnerMembership.role !== "owner" ||
      liveUsers.length !== lineageUserIds.length ||
      activeFences.length > 0
    ) {
      // Neutral conflict: never reveal whether the actor or storage owner is
      // being erased or has just left. Callers run this inside the
      // claim/persist CAS, so membership removal and upload delegation have a
      // deterministic writer-order winner.
      throw new DriveUploadError("request-conflict");
    }
    return Object.freeze({
      id: storageRows[0].id,
      workspaceId: storageRows[0].workspaceId,
      ownerUserId: storageRows[0].ownerUserId,
      state: storageRows[0].state,
    });
  }

  async function currentStorage(
    authorization: AuthorizedProjectDriveContext,
  ): Promise<CurrentStorage | null> {
    const rows = await deps.database
      .select({
        id: workspaceStorage.id,
        workspaceId: workspaceStorage.workspaceId,
        ownerUserId: providerConnections.userId,
        state: workspaceStorage.state,
      })
      .from(workspaceStorage)
      .innerJoin(
        providerConnections,
        eq(providerConnections.id, workspaceStorage.connectionId),
      )
      .where(
        and(
          eq(workspaceStorage.workspaceId, authorization.projectId),
          eq(workspaceStorage.isCurrent, true),
        ),
      )
      .limit(2);
    if (rows.length !== 1) return null;
    return Object.freeze(rows[0]);
  }

  async function hasCompleteMemberCoverage(
    database: Pick<UploadDb, "select">,
    authorization: AuthorizedProjectDriveContext,
    storage: CurrentStorage,
  ): Promise<boolean> {
    const members = await database
      .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, authorization.projectId));
    const grants = await database
      .select({ userId: driveFolderGrants.userId })
      .from(driveFolderGrants)
      .where(
        and(
          eq(driveFolderGrants.workspaceId, authorization.projectId),
          eq(driveFolderGrants.storageGenerationId, storage.id),
          eq(driveFolderGrants.revokePending, false),
        ),
      );
    const owner = members.find((member) => member.userId === storage.ownerUserId);
    if (!owner || owner.role !== "owner") return false;
    const granted = new Set(grants.map((grant) => grant.userId));
    return members.every(
      (member) =>
        member.userId === storage.ownerUserId || granted.has(member.userId),
    );
  }

  async function loadClaim(resourceId: string): Promise<DriveResource | null> {
    const rows = await deps.database
      .select()
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(2);
    return rows.length === 1 ? rows[0] : null;
  }

  async function taskBelongsToAuthorizedProject(
    authorization: AuthorizedProjectDriveContext,
    taskId: string,
  ): Promise<boolean> {
    const rows = await deps.database
      .select({ workspaceId: tasks.workspaceId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(2);
    return (
      rows.length === 1 && rows[0].workspaceId === authorization.projectId
    );
  }

  async function markedFile(
    session: ProjectDriveStorageSession,
    resourceId: string,
  ): Promise<GoogleDriveFile | null> {
    const matches: GoogleDriveFile[] = [];
    let pageToken: string | null = null;
    for (let page = 0; page < MAX_MARKER_PAGES; page += 1) {
      const result = await findGoogleDriveFilesByAppProperty(
        session.accessToken,
        {
          key: DRIVE_RESOURCE_MARKER,
          value: resourceId,
          pageToken,
          pageSize: 100,
        },
        deps.fetchImpl,
      );
      matches.push(...result.files);
      if (matches.length > 1) throw new DriveUploadError("marker-ambiguous");
      pageToken = result.nextPageToken;
      if (!pageToken) return matches[0] ?? null;
    }
    throw new DriveUploadError("marker-ambiguous");
  }

  async function persistFile(
    authorization: AuthorizedProjectDriveContext,
    session: ProjectDriveStorageSession,
    row: DriveResource,
    input: NormalizedRequest,
    file: GoogleDriveFile,
  ): Promise<DriveResource> {
    assertRequestMatches(row, authorization, input);
    const receipt = exactFileReceipt(file, input, session.storage.folderId);
    return deps.database.transaction(async (tx) => {
      const [persisted] = await tx
        .update(resources)
        .set({
          externalId: receipt.fileId,
          storedPath: null,
          title: receipt.title,
          url: receipt.webViewLink,
          mimeType: receipt.mimeType,
          sizeBytes: receipt.sizeBytes,
          accessState: "ok",
          refreshedAt: databaseNowSeconds(deps.databaseNowSeconds),
        })
        .where(
          and(
            eq(resources.id, row.id),
            eq(resources.workspaceId, authorization.projectId),
            eq(resources.taskId, input.taskId),
            eq(resources.kind, "upload"),
            eq(resources.provider, "drive"),
            eq(resources.storage, "drive"),
            eq(resources.storageGenerationId, session.storage.id),
            eq(resources.addedByUserId, authorization.actorUserId),
            eq(resources.addedAt, row.addedAt),
            eq(resources.title, input.name),
            eq(resources.mimeType, input.mimeType),
            eq(resources.sizeBytes, input.sizeBytes),
            eq(resources.accessState, "pending"),
            eq(resources.countsAgainstStorage, 0),
            isNull(resources.externalId),
            isNull(resources.url),
            row.storedPath === null
              ? isNull(resources.storedPath)
              : eq(resources.storedPath, row.storedPath),
            row.refreshedAt === null
              ? isNull(resources.refreshedAt)
              : eq(resources.refreshedAt, row.refreshedAt),
          ),
        )
        .returning();
      if (!persisted) throw new DriveUploadError("request-conflict");

      // The exact pending-row update acquires the writer slot before checking
      // both account lineages. A concurrent removal/request change wins the
      // CAS; a concurrent erasure orders wholly before or after this receipt.
      await assertUnfencedUploadLineages(
        tx,
        authorization,
        session,
        false,
      );
      return persisted;
    });
  }

  async function acquireClaim(
    authorization: AuthorizedProjectDriveContext,
    session: ProjectDriveStorageSession,
    input: NormalizedRequest,
  ): Promise<ClaimLease> {
    return deps.database.transaction(async (tx) => {
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const inserted = await tx
        .insert(resources)
        .values({
          id: input.resourceId,
          workspaceId: authorization.projectId,
          taskId: input.taskId,
          kind: "upload",
          provider: "drive",
          storage: "drive",
          storageGenerationId: session.storage.id,
          storedPath: null,
          title: input.name,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          addedByUserId: authorization.actorUserId,
          addedAt: now,
          refreshedAt: now,
          accessState: "pending",
          countsAgainstStorage: 0,
        })
        .onConflictDoNothing({ target: resources.id })
        .returning({ refreshedAt: resources.refreshedAt });

      const readClaim = async (): Promise<DriveResource | null> => {
        const rows = await tx
          .select()
          .from(resources)
          .where(eq(resources.id, input.resourceId))
          .limit(2);
        return rows.length === 1 ? rows[0] : null;
      };
      let row = await readClaim();
      if (!row) throw new DriveUploadError("request-conflict");
      assertRequestMatches(row, authorization, input);
      if (row.storageGenerationId !== session.storage.id) {
        throw new DriveUploadError("request-conflict");
      }
      if (row.accessState === "ok") {
        return Object.freeze({ row, ownsMint: false, leaseStamp: null });
      }
      if (row.accessState !== "pending") {
        throw new DriveUploadError("request-conflict");
      }
      if (row.storedPath) {
        return Object.freeze({ row, ownsMint: false, leaseStamp: null });
      }
      if (inserted.length === 1) {
        const leaseStamp = inserted[0].refreshedAt;
        if (leaseStamp === null) {
          throw new DriveUploadError("request-conflict");
        }
        // The INSERT has acquired the SQLite writer slot before the shared
        // erasure fence is read. A concurrent erasure therefore orders either
        // wholly before this claim (and blocks it) or wholly after its commit.
        const claimStorage = await assertUnfencedUploadLineages(
          tx,
          authorization,
          session,
          true,
        );
        if (
          !(await hasCompleteMemberCoverage(
            tx,
            authorization,
            claimStorage,
          ))
        ) {
          throw new DriveUploadError("request-conflict");
        }
        return Object.freeze({ row, ownsMint: true, leaseStamp });
      }

      const claimed = await tx
        .update(resources)
        .set({ refreshedAt: now })
        .where(
          and(
            eq(resources.id, input.resourceId),
            eq(resources.workspaceId, authorization.projectId),
            eq(resources.taskId, input.taskId),
            eq(resources.storageGenerationId, session.storage.id),
            eq(resources.addedByUserId, authorization.actorUserId),
            eq(resources.accessState, "pending"),
            isNull(resources.storedPath),
            or(
              isNull(resources.refreshedAt),
              lte(
                resources.refreshedAt,
                sql<number>`(${now}) - ${CLAIM_LEASE_SECONDS}`,
              ),
            ),
          ),
        )
        .returning({ refreshedAt: resources.refreshedAt });
      if (claimed.length !== 1 || claimed[0].refreshedAt === null) {
        return Object.freeze({ row, ownsMint: false, leaseStamp: null });
      }
      const claimStorage = await assertUnfencedUploadLineages(
        tx,
        authorization,
        session,
        true,
      );
      if (
        !(await hasCompleteMemberCoverage(
          tx,
          authorization,
          claimStorage,
        ))
      ) {
        throw new DriveUploadError("request-conflict");
      }
      row = (await readClaim()) ?? row;
      return Object.freeze({
        row,
        ownsMint: true,
        leaseStamp: claimed[0].refreshedAt,
      });
    });
  }

  async function releaseUndelegatedClaim(
    authorization: AuthorizedProjectDriveContext,
    row: DriveResource,
    leaseStamp: number | null,
  ): Promise<void> {
    if (leaseStamp === null) return;
    await deps.database
      .delete(resources)
      .where(
        and(
          eq(resources.id, row.id),
          eq(resources.workspaceId, authorization.projectId),
          eq(resources.addedByUserId, authorization.actorUserId),
          eq(resources.accessState, "pending"),
          isNull(resources.storedPath),
          eq(resources.refreshedAt, leaseStamp),
        ),
      );
  }

  async function refreshDelegatedReceipt(
    authorization: AuthorizedProjectDriveContext,
    session: ProjectDriveStorageSession,
    row: DriveResource,
  ): Promise<DriveResource> {
    return deps.database.transaction(async (tx) => {
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const [refreshed] = await tx
        .update(resources)
        .set({
          refreshedAt: sql<number>`max((${now}), coalesce(${resources.refreshedAt}, 0))`,
        })
        .where(
          and(
            eq(resources.id, row.id),
            eq(resources.workspaceId, authorization.projectId),
            eq(resources.taskId, row.taskId),
            eq(resources.storageGenerationId, session.storage.id),
            eq(resources.addedByUserId, authorization.actorUserId),
            eq(resources.accessState, "pending"),
            eq(resources.storedPath, row.storedPath!),
          ),
        )
        .returning();
      if (!refreshed?.storedPath) {
        throw new DriveUploadError("request-conflict");
      }
      await assertUnfencedUploadLineages(
        tx,
        authorization,
        session,
        false,
      );
      return refreshed;
    });
  }

  async function mintSession(
    authorization: AuthorizedProjectDriveContext,
    session: ProjectDriveStorageSession,
    row: DriveResource,
    input: NormalizedRequest,
    expectation: MintExpectation,
  ): Promise<DriveUploadSessionResult> {
    const prepared = await deps.database.transaction(async (tx) => {
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const nextStamp =
        expectation.kind === "lease"
          ? now
          : sql<number>`CASE
              WHEN ${resources.refreshedAt} >= (${now})
                THEN ${resources.refreshedAt} + 1
              ELSE (${now})
            END`;
      const [claimed] = await tx
        .update(resources)
        .set({
          // The timestamp is both activity evidence and the row-local CAS
          // fence. A remint advances it even within one DB second so two
          // 404 observers cannot both mint. A fresh claim is already leased.
          refreshedAt: nextStamp,
        })
        .where(
          and(
            eq(resources.id, row.id),
            eq(resources.workspaceId, authorization.projectId),
            eq(resources.taskId, input.taskId),
            eq(resources.storageGenerationId, session.storage.id),
            eq(resources.addedByUserId, authorization.actorUserId),
            eq(resources.accessState, "pending"),
            expectation.kind === "lease"
              ? and(
                  isNull(resources.storedPath),
                  eq(resources.refreshedAt, expectation.refreshedAt),
                )
              : and(
                  eq(resources.storedPath, expectation.storedPath),
                  expectation.refreshedAt === null
                    ? isNull(resources.refreshedAt)
                    : eq(resources.refreshedAt, expectation.refreshedAt),
                ),
          ),
        )
        .returning();
      if (!claimed || claimed.refreshedAt === null) return null;
      assertRequestMatches(claimed, authorization, input);

      // This short transaction orders the claim against account erasure and
      // current-storage/grant changes. Provider I/O deliberately starts only
      // after the SQLite/libSQL writer transaction has committed.
      const claimStorage = await assertUnfencedUploadLineages(
        tx,
        authorization,
        session,
        expectation.kind === "lease",
      );
      if (
        expectation.kind === "lease" &&
        !(await hasCompleteMemberCoverage(
          tx,
          authorization,
          claimStorage,
        ))
      ) {
        throw new DriveUploadError("request-conflict");
      }
      return claimed;
    });
    if (!prepared || prepared.refreshedAt === null) {
      return Object.freeze({
        kind: "paused" as const,
        resourceId: row.id,
        reason: "claim-busy" as const,
      });
    }
    const preparedStamp = prepared.refreshedAt;

    let created: Awaited<
      ReturnType<typeof createGoogleDriveResumableUploadSession>
    >;
    try {
      created = await createGoogleDriveResumableUploadSession(
        session.accessToken,
        {
          name: input.name,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          parentId: session.storage.folderId,
          appProperties: { [DRIVE_RESOURCE_MARKER]: input.resourceId },
        },
        deps.fetchImpl,
      );
    } catch (error) {
      if (expectation.kind === "lease") {
        await releaseUndelegatedClaim(
          authorization,
          prepared,
          preparedStamp,
        );
      }
      throw error;
    }

    const cipher = seal(
      created.sessionUrl,
      sessionContext(prepared),
      deps.keyRing,
    );
    let persisted: DriveResource | null;
    try {
      persisted = await deps.database.transaction(async (tx) => {
        const now = databaseNowSeconds(deps.databaseNowSeconds);
        const [stored] = await tx
          .update(resources)
          .set({
            storedPath: cipher,
            refreshedAt: sql<number>`max((${now}), ${resources.refreshedAt})`,
          })
          .where(
            and(
              eq(resources.id, prepared.id),
              eq(resources.workspaceId, authorization.projectId),
              eq(resources.taskId, input.taskId),
              eq(resources.storageGenerationId, session.storage.id),
              eq(resources.addedByUserId, authorization.actorUserId),
              eq(resources.accessState, "pending"),
              expectation.kind === "lease"
                ? isNull(resources.storedPath)
                : eq(resources.storedPath, expectation.storedPath),
              eq(resources.refreshedAt, preparedStamp),
            ),
          )
          .returning();
        if (!stored?.storedPath) return null;

        // If erasure or handover won after the mint claim, roll back the
        // ciphertext write. The capability is never returned to a browser;
        // the unpersisted, empty provider session is left to expire.
        const persistStorage = await assertUnfencedUploadLineages(
          tx,
          authorization,
          session,
          expectation.kind === "lease",
        );
        if (
          expectation.kind === "lease" &&
          !(await hasCompleteMemberCoverage(
            tx,
            authorization,
            persistStorage,
          ))
        ) {
          throw new DriveUploadError("request-conflict");
        }
        return stored;
      });
    } catch (error) {
      if (expectation.kind === "lease") {
        await releaseUndelegatedClaim(
          authorization,
          prepared,
          preparedStamp,
        );
      }
      throw error;
    }
    if (!persisted) {
      if (expectation.kind === "lease") {
        await releaseUndelegatedClaim(
          authorization,
          prepared,
          preparedStamp,
        );
      }
      throw new DriveUploadError("request-conflict");
    }
    const sessionUrl = open(
      persisted.storedPath!,
      sessionContext(persisted),
      deps.keyRing,
    );
    return Object.freeze({
      kind: "drive-session" as const,
      resourceId: persisted.id,
      sessionUrl,
      startOffset: 0,
    });
  }

  async function resumeDelegated(
    authorization: AuthorizedProjectDriveContext,
    session: ProjectDriveStorageSession,
    row: DriveResource,
    input: NormalizedRequest,
  ): Promise<DriveUploadSessionResult> {
    const activeRow = await refreshDelegatedReceipt(
      authorization,
      session,
      row,
    );
    const sessionUrl = open(
      activeRow.storedPath!,
      sessionContext(activeRow),
      deps.keyRing,
    );
    let status: Awaited<ReturnType<typeof queryGoogleDriveResumableUploadSession>>;
    try {
      status = await queryGoogleDriveResumableUploadSession(
        sessionUrl,
        input.sizeBytes,
        deps.fetchImpl,
      );
    } catch (error) {
      if (isGoogleDriveProviderError(error)) {
        return Object.freeze({
          kind: "paused" as const,
          resourceId: activeRow.id,
          reason: "provider-unavailable" as const,
        });
      }
      throw error;
    }
    if (status.kind === "incomplete") {
      await refreshDelegatedReceipt(authorization, session, activeRow);
      return Object.freeze({
        kind: "drive-session" as const,
        resourceId: activeRow.id,
        sessionUrl,
        startOffset: status.nextOffset,
      });
    }
    if (status.kind === "complete") {
      const persisted = await persistFile(
        authorization,
        session,
        activeRow,
        input,
        status.file,
      );
      return completeResult(persisted, "adopted");
    }

    // A definitive 404 is only half the replacement proof. Search without a
    // parent filter so a same-marker file in the wrong folder is caught rather
    // than hidden by the query and followed by a duplicate mint.
    let match: GoogleDriveFile | null;
    try {
      match = await markedFile(session, input.resourceId);
    } catch (error) {
      if (error instanceof DriveUploadError) throw error;
      if (isGoogleDriveProviderError(error)) {
        return Object.freeze({
          kind: "paused" as const,
          resourceId: activeRow.id,
          reason: "provider-unavailable" as const,
        });
      }
      throw error;
    }
    if (match) {
      let persisted: DriveResource;
      try {
        persisted = await persistFile(
          authorization,
          session,
          activeRow,
          input,
          match,
        );
      } catch (error) {
        if (
          error instanceof DriveUploadError &&
          error.code === "file-invalid"
        ) {
          throw new DriveUploadError("marker-invalid");
        }
        throw error;
      }
      return completeResult(persisted, "adopted");
    }

    const about = await getGoogleDriveAbout(
      session.accessToken,
      deps.fetchImpl,
    );
    if (!hasQuotaFor(about.storageQuota, input.sizeBytes)) {
      await deps.database
        .update(workspaceStorage)
        .set({ state: "quota_full" })
        .where(
          and(
            eq(workspaceStorage.id, session.storage.id),
            eq(workspaceStorage.workspaceId, authorization.projectId),
            eq(workspaceStorage.isCurrent, true),
          ),
        );
      await deps.database
        .delete(resources)
        .where(
          and(
            eq(resources.id, activeRow.id),
            eq(resources.workspaceId, authorization.projectId),
            eq(resources.accessState, "pending"),
          ),
        );
      return Object.freeze({
        kind: "signal-native" as const,
        reason: "quota-full" as const,
      });
    }
    return mintSession(
      authorization,
      session,
      activeRow,
      input,
      {
        kind: "session",
        storedPath: activeRow.storedPath!,
        refreshedAt: activeRow.refreshedAt,
      },
    );
  }

  async function start(
    authorization: AuthorizedProjectDriveContext,
    request: DriveUploadRequest,
  ): Promise<DriveUploadSessionResult> {
    assertProjectDriveCapability(authorization, "createOrEditTasks");
    const input = normalizeRequest(request);
    if (!(await taskBelongsToAuthorizedProject(authorization, input.taskId))) {
      throw new DriveUploadError("not-found");
    }
    const before = await loadClaim(input.resourceId);
    if (before) assertRequestMatches(before, authorization, input);
    if (before?.accessState === "ok") return completeResult(before, "existing");
    const delegatedRow = before?.storedPath ? before : null;

    if (delegatedRow) {
      if (!delegatedRow.storageGenerationId) {
        throw new DriveUploadError("request-conflict");
      }
      try {
        return await deps.access.withStorageSession(
          authorization,
          {
            kind: "generation",
            storageGenerationId: delegatedRow.storageGenerationId,
          },
          async (session) => {
            if (
              session.storage.workspaceId !== authorization.projectId ||
              session.storage.id !== delegatedRow.storageGenerationId
            ) {
              throw new DriveUploadError("request-conflict");
            }
            // A delegated upload is permanently pinned to the folder
            // generation named by its claim. Handover may change "current",
            // but must never retarget an in-flight Google session.
            return resumeDelegated(
              authorization,
              session,
              delegatedRow,
              input,
            );
          },
        );
      } catch (error) {
        if (error instanceof DriveUploadError) throw error;
        return Object.freeze({
          kind: "paused" as const,
          resourceId: input.resourceId,
          reason: "provider-unavailable" as const,
        });
      }
    }

    const storage = await currentStorage(authorization);
    if (!storage) {
      return Object.freeze({
        kind: "signal-native" as const,
        reason: "no-current-storage" as const,
      });
    }
    if (
      storage.state !== "active" ||
      (before?.storageGenerationId && before.storageGenerationId !== storage.id)
    ) {
      return Object.freeze({
        kind: "signal-native" as const,
        reason: "storage-unavailable" as const,
      });
    }
    if (
      !(await hasCompleteMemberCoverage(
        deps.database,
        authorization,
        storage,
      ))
    ) {
      return Object.freeze({
        kind: "signal-native" as const,
        reason: "member-access-incomplete" as const,
      });
    }

    try {
      return await deps.access.withStorageSession(
        authorization,
        { kind: "current" },
        async (session) => {
          if (
            !session.storage.isCurrent ||
            session.storage.state !== "active" ||
            session.storage.id !== storage.id
          ) {
            return Object.freeze({
              kind: "signal-native" as const,
              reason: "storage-unavailable" as const,
            });
          }

          let about: Awaited<ReturnType<typeof getGoogleDriveAbout>>;
          try {
            about = await getGoogleDriveAbout(
              session.accessToken,
              deps.fetchImpl,
            );
          } catch {
            return Object.freeze({
              kind: "signal-native" as const,
              reason: "provider-unavailable" as const,
            });
          }
          if (!hasQuotaFor(about.storageQuota, input.sizeBytes)) {
            await deps.database
              .update(workspaceStorage)
              .set({ state: "quota_full" })
              .where(
                and(
                  eq(workspaceStorage.id, session.storage.id),
                  eq(workspaceStorage.workspaceId, authorization.projectId),
                  eq(workspaceStorage.isCurrent, true),
                ),
              );
            return Object.freeze({
              kind: "signal-native" as const,
              reason: "quota-full" as const,
            });
          }

          const lease = await acquireClaim(authorization, session, input);
          if (lease.row.accessState === "ok") {
            return completeResult(lease.row, "existing");
          }
          if (lease.row.storedPath) {
            try {
              return await resumeDelegated(
                authorization,
                session,
                lease.row,
                input,
              );
            } catch (error) {
              if (error instanceof DriveUploadError) throw error;
              return Object.freeze({
                kind: "paused" as const,
                resourceId: input.resourceId,
                reason: "provider-unavailable" as const,
              });
            }
          }
          if (!lease.ownsMint || lease.leaseStamp === null) {
            return Object.freeze({
              kind: "paused" as const,
              resourceId: input.resourceId,
              reason: "claim-busy" as const,
            });
          }

          let match: GoogleDriveFile | null;
          try {
            match = await markedFile(session, input.resourceId);
          } catch (error) {
            if (error instanceof DriveUploadError) throw error;
            await releaseUndelegatedClaim(
              authorization,
              lease.row,
              lease.leaseStamp,
            );
            return Object.freeze({
              kind: "signal-native" as const,
              reason: "provider-unavailable" as const,
            });
          }
          if (match) {
            let persisted: DriveResource;
            try {
              persisted = await persistFile(
                authorization,
                session,
                lease.row,
                input,
                match,
              );
            } catch (error) {
              if (
                error instanceof DriveUploadError &&
                error.code === "file-invalid"
              ) {
                throw new DriveUploadError("marker-invalid");
              }
              throw error;
            }
            return completeResult(persisted, "adopted");
          }

          try {
            return await mintSession(
              authorization,
              session,
              lease.row,
              input,
              { kind: "lease", refreshedAt: lease.leaseStamp },
            );
          } catch (error) {
            const persisted = await loadClaim(lease.row.id);
            if (!persisted?.storedPath) {
              await releaseUndelegatedClaim(
                authorization,
                lease.row,
                lease.leaseStamp,
              );
              if (isGoogleDriveProviderError(error)) {
                return Object.freeze({
                  kind: "signal-native" as const,
                  reason: "provider-unavailable" as const,
                });
              }
            }
            throw error;
          }
        },
      );
    } catch (error) {
      if (error instanceof DriveUploadError) throw error;
      return Object.freeze({
        kind: "signal-native" as const,
        reason: "provider-unavailable" as const,
      });
    }
  }

  async function finalize(
    authorization: AuthorizedProjectDriveContext,
    input: Readonly<{ resourceId: string; driveFileId: string }>,
  ): Promise<FinalizeDriveUploadResult> {
    assertProjectDriveCapability(authorization, "createOrEditTasks");
    if (
      !UUID_PATTERN.test(input.resourceId) ||
      typeof input.driveFileId !== "string" ||
      input.driveFileId.length === 0 ||
      input.driveFileId !== input.driveFileId.trim() ||
      /[\u0000-\u001f\u007f]/.test(input.driveFileId)
    ) {
      throw new DriveUploadError("invalid-input");
    }
    const row = await loadClaim(input.resourceId);
    if (
      !row ||
      row.workspaceId !== authorization.projectId ||
      row.addedByUserId !== authorization.actorUserId ||
      row.kind !== "upload" ||
      row.provider !== "drive" ||
      row.storage !== "drive" ||
      !row.storageGenerationId ||
      !row.mimeType ||
      row.sizeBytes === null ||
      !row.storedPath
    ) {
      throw new DriveUploadError("not-found");
    }
    if (!(await taskBelongsToAuthorizedProject(authorization, row.taskId))) {
      throw new DriveUploadError("not-found");
    }
    if (row.accessState === "ok") {
      if (row.externalId !== input.driveFileId || !row.url) {
        throw new DriveUploadError("not-found");
      }
      return Object.freeze({
        resourceId: row.id,
        fileId: row.externalId,
        webViewLink: row.url,
        outcome: "existing" as const,
      });
    }
    if (row.accessState !== "pending") {
      throw new DriveUploadError("not-found");
    }
    const request = normalizeRequest({
      resourceId: row.id,
      taskId: row.taskId,
      name: row.title,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
    });
    return deps.access.withStorageSession(
      authorization,
      {
        kind: "generation",
        storageGenerationId: row.storageGenerationId,
      },
      async (session) => {
        if (
          session.storage.workspaceId !== authorization.projectId ||
          session.storage.id !== row.storageGenerationId
        ) {
          throw new DriveUploadError("not-found");
        }
        const file = await getGoogleDriveFile(
          session.accessToken,
          input.driveFileId,
          deps.fetchImpl,
        );
        if (file.id !== input.driveFileId) {
          throw new DriveUploadError("file-invalid");
        }
        const persisted = await persistFile(
          authorization,
          session,
          row,
          request,
          file,
        );
        return Object.freeze({
          resourceId: persisted.id,
          fileId: persisted.externalId!,
          webViewLink: persisted.url!,
          outcome: "finalized" as const,
        });
      },
    );
  }

  async function remove(
    authorization: AuthorizedProjectDriveContext,
    resourceId: string,
  ): Promise<boolean> {
    assertProjectDriveCapability(authorization, "createOrEditTasks");
    if (!UUID_PATTERN.test(resourceId)) {
      throw new DriveUploadError("invalid-input");
    }
    const row = await loadClaim(resourceId);
    if (
      !row ||
      row.workspaceId !== authorization.projectId ||
      row.storage !== "drive" ||
      !(await taskBelongsToAuthorizedProject(authorization, row.taskId))
    ) {
      return false;
    }
    const deleted = await deps.database
      .delete(resources)
      .where(
        and(
          eq(resources.id, resourceId),
          eq(resources.workspaceId, authorization.projectId),
          eq(resources.storage, "drive"),
        ),
      )
      .returning({ id: resources.id });
    return deleted.length === 1;
  }

  return Object.freeze({ start, finalize, remove });
}

function defaultDriveUploadService() {
  return createDriveUploadService({
    database: db,
    access: { withStorageSession: withAuthorizedProjectDriveSession },
    fetchImpl: fetch,
    keyRing: keyRingFromEnv(),
  });
}

export async function createProjectDriveUploadSession(
  authorization: AuthorizedProjectDriveContext,
  input: DriveUploadRequest,
): Promise<DriveUploadSessionResult> {
  return defaultDriveUploadService().start(authorization, input);
}

export async function finalizeProjectDriveUpload(
  authorization: AuthorizedProjectDriveContext,
  input: Readonly<{ resourceId: string; driveFileId: string }>,
): Promise<FinalizeDriveUploadResult> {
  return defaultDriveUploadService().finalize(authorization, input);
}

export async function removeProjectDriveResource(
  authorization: AuthorizedProjectDriveContext,
  resourceId: string,
): Promise<boolean> {
  return defaultDriveUploadService().remove(authorization, resourceId);
}
