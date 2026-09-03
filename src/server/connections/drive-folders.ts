import "server-only";

import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import { workspaces, workspaceStorage } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { byWorkspace } from "@/server/db/tenant";
import {
  createGoogleDriveFolder,
  findGoogleDriveFilesByAppProperty,
  getGoogleDriveFile,
  isGoogleDriveProviderError,
  renameGoogleDriveFile,
  type GoogleDriveFile,
  type GoogleDriveProviderError,
  type GoogleFetch,
} from "./google-drive";
import {
  projectDriveAccessServiceFromEnv,
  type ProjectDriveAccessService,
  type ProjectDriveProvisioningSession,
  type ProjectDriveStorageReceipt,
  type ProjectDriveStorageSession,
} from "./project-drive-access";
import {
  assertProjectDriveCapability,
  type AuthorizedProjectDriveContext,
} from "./project-drive-authz";
import type { ProjectDriveOperationClaim } from "./project-drive-operation-journal";

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
export const DRIVE_FOLDER_WORKSPACE_MARKER = "signalWorkspaceId" as const;
export const DRIVE_FOLDER_GENERATION_MARKER =
  "signalStorageGenerationId" as const;

type FolderDb = LibSQLDatabase<typeof schema>;

export type DriveFolderErrorCode =
  | "invalid-input"
  | "folder-ambiguous"
  | "folder-invalid"
  | "folder-missing"
  | "storage-conflict";

export class DriveFolderError extends Error {
  readonly code: DriveFolderErrorCode;

  constructor(code: DriveFolderErrorCode) {
    const messages: Record<DriveFolderErrorCode, string> = {
      "invalid-input": "The Drive folder request is invalid.",
      "folder-ambiguous": "More than one matching Drive folder needs review.",
      "folder-invalid": "The matching Drive folder is not safe to adopt.",
      "folder-missing": "The project’s Drive folder could not be found.",
      "storage-conflict": "This project already has a different Drive folder.",
    };
    super(messages[code]);
    this.name = "DriveFolderError";
    this.code = code;
  }
}

export type WorkspaceDriveFolder = Readonly<{
  storageGenerationId: string;
  folderId: string;
  folderWebViewLink: string;
  connectionId: string;
  outcome: "created" | "adopted" | "existing" | "renamed";
}>;

export type ProjectDriveFolderRenameResult = WorkspaceDriveFolder &
  Readonly<{ folderName: string }>;

export type DriveFolderProviderError = GoogleDriveProviderError;

export function isDriveFolderProviderError(
  error: unknown,
): error is DriveFolderProviderError {
  return isGoogleDriveProviderError(error);
}

export type DriveFolderServiceDependencies = Readonly<{
  database: FolderDb;
  access: Pick<
    ProjectDriveAccessService,
    | "withStorageSession"
    | "withProvisioningSession"
    | "withConnectionSession"
    | "withReceiptStorageSession"
  >;
  fetchImpl: GoogleFetch;
}>;

export type ProjectDriveFolderProvisionClaim = Extract<
  ProjectDriveOperationClaim,
  Readonly<{ operationKind: "folder_provision" }>
>;

export type ProjectDriveStorageHandoverClaim = Extract<
  ProjectDriveOperationClaim,
  Readonly<{ operationKind: "storage_handover" }>
>;

export type ProjectDriveFolderCreationClaim =
  | ProjectDriveFolderProvisionClaim
  | ProjectDriveStorageHandoverClaim;

export type ProjectDriveFolderRenameClaim = Extract<
  ProjectDriveOperationClaim,
  Readonly<{ operationKind: "folder_rename" }>
>;

function canonicalText(value: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new DriveFolderError("invalid-input");
  }
  return value;
}

function folderReceipt(
  file: GoogleDriveFile,
  expected: {
    workspaceId: string;
    storageGenerationId: string;
    rootFolderId: string;
  },
): { id: string; webViewLink: string } {
  const exactParent =
    file.parents.length === 1 && file.parents[0] === expected.rootFolderId;
  const exactMarkers =
    file.appProperties[DRIVE_FOLDER_WORKSPACE_MARKER] ===
      expected.workspaceId &&
    file.appProperties[DRIVE_FOLDER_GENERATION_MARKER] ===
      expected.storageGenerationId;
  if (
    file.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE ||
    file.trashed !== false ||
    !exactParent ||
    !exactMarkers ||
    !file.webViewLink
  ) {
    throw new DriveFolderError("folder-invalid");
  }
  return { id: file.id, webViewLink: file.webViewLink };
}

async function markedFolder(
  session: ProjectDriveProvisioningSession,
  input: { workspaceId: string; storageGenerationId: string },
  fetchImpl: GoogleFetch,
): Promise<GoogleDriveFile | null> {
  const matches: GoogleDriveFile[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const result = await findGoogleDriveFilesByAppProperty(
      session.accessToken,
      {
        key: DRIVE_FOLDER_GENERATION_MARKER,
        value: input.storageGenerationId,
        includeTrashed: true,
        pageToken,
        pageSize: 100,
      },
      fetchImpl,
    );
    matches.push(...result.files);
    if (matches.length > 1) throw new DriveFolderError("folder-ambiguous");
    pageToken = result.nextPageToken;
    if (!pageToken) return matches[0] ?? null;
  }
  throw new DriveFolderError("folder-ambiguous");
}

async function markedFolders(
  session: ProjectDriveProvisioningSession,
  input: {
    storageGenerationId: string;
    rootFolderId?: string;
    folderOnly?: boolean;
  },
  fetchImpl: GoogleFetch,
): Promise<readonly GoogleDriveFile[]> {
  const matches: GoogleDriveFile[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const result = await findGoogleDriveFilesByAppProperty(
      session.accessToken,
      {
        key: DRIVE_FOLDER_GENERATION_MARKER,
        value: input.storageGenerationId,
        includeTrashed: true,
        ...(input.rootFolderId ? { parentId: input.rootFolderId } : {}),
        ...(input.folderOnly ? { mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE } : {}),
        pageToken,
        pageSize: 100,
      },
      fetchImpl,
    );
    matches.push(...result.files);
    if (matches.length > 1) throw new DriveFolderError("folder-ambiguous");
    pageToken = result.nextPageToken;
    if (!pageToken) return Object.freeze(matches);
  }
  throw new DriveFolderError("folder-ambiguous");
}

/**
 * Recovery first searches the exact marker/parent/MIME tuple, then audits the
 * generation marker globally. The second query prevents a same-generation
 * object in another root, Project, MIME, or trash state from being hidden by
 * the narrow query and accidentally followed by a duplicate create.
 */
async function durableMarkedFolder(
  session: ProjectDriveProvisioningSession,
  input: {
    workspaceId: string;
    storageGenerationId: string;
    rootFolderId: string;
  },
  fetchImpl: GoogleFetch,
): Promise<GoogleDriveFile | null> {
  const exact = await markedFolders(
    session,
    {
      storageGenerationId: input.storageGenerationId,
      rootFolderId: input.rootFolderId,
      folderOnly: true,
    },
    fetchImpl,
  );
  const global = await markedFolders(
    session,
    { storageGenerationId: input.storageGenerationId },
    fetchImpl,
  );
  if (global.length === 0 && exact.length === 0) return null;
  if (
    global.length !== 1 ||
    exact.length !== 1 ||
    global[0].id !== exact[0].id
  ) {
    throw new DriveFolderError("folder-invalid");
  }
  folderReceipt(exact[0], input);
  return exact[0];
}

function verifyStoredFolder(
  session: ProjectDriveStorageSession,
  file: GoogleDriveFile,
): { id: string; webViewLink: string } {
  return folderReceipt(file, {
    workspaceId: session.storage.workspaceId,
    storageGenerationId: session.storage.id,
    rootFolderId: session.storageRootFolderId,
  });
}

export function createDriveFolderService(deps: DriveFolderServiceDependencies) {
  async function provisionClaimed(
    claim: ProjectDriveFolderCreationClaim,
    folderName: string,
  ): Promise<WorkspaceDriveFolder> {
    const name = canonicalText(folderName);
    return deps.access.withConnectionSession(
      claim.connectionId,
      async (session) => {
        const expected = {
          workspaceId: canonicalText(claim.workspaceId),
          storageGenerationId: canonicalText(
            claim.targetStorageGenerationId,
          ),
          rootFolderId: session.credential.rootFolderId,
        };
        const match = await durableMarkedFolder(
          session,
          expected,
          deps.fetchImpl,
        );
        const providerOutcome = match ? "adopted" : "created";
        const file =
          match ??
          (await createGoogleDriveFolder(
            session.accessToken,
            {
              name,
              parentId: expected.rootFolderId,
              appProperties: {
                [DRIVE_FOLDER_WORKSPACE_MARKER]: expected.workspaceId,
                [DRIVE_FOLDER_GENERATION_MARKER]:
                  expected.storageGenerationId,
              },
            },
            deps.fetchImpl,
          ));
        const receipt = folderReceipt(file, expected);
        return Object.freeze({
          storageGenerationId: expected.storageGenerationId,
          folderId: receipt.id,
          folderWebViewLink: receipt.webViewLink,
          connectionId: session.credential.id,
          outcome: providerOutcome,
        });
      },
    );
  }

  async function pinnedRenameTarget(
    claim: ProjectDriveFolderRenameClaim,
  ): Promise<
    Readonly<{
      folderName: string;
      receipt: ProjectDriveStorageReceipt;
    }>
  > {
    const rows = await deps.database
      .select({
        folderName: workspaces.name,
        storageGenerationId: workspaceStorage.id,
        connectionId: workspaceStorage.connectionId,
        folderId: workspaceStorage.folderId,
      })
      .from(workspaces)
      .innerJoin(
        workspaceStorage,
        eq(workspaceStorage.workspaceId, workspaces.id),
      )
      .where(
        byWorkspace(
          workspaces.id,
          canonicalText(claim.workspaceId),
          eq(workspaces.revision, claim.workspaceRevision),
          eq(workspaceStorage.id, canonicalText(claim.storageGenerationId)),
          eq(workspaceStorage.isCurrent, true),
        ),
      )
      .limit(2);
    if (rows.length !== 1) throw new DriveFolderError("storage-conflict");
    return Object.freeze({
      folderName: canonicalText(rows[0].folderName),
      receipt: Object.freeze({
        workspaceId: claim.workspaceId,
        storageGenerationId: rows[0].storageGenerationId,
        connectionId: rows[0].connectionId,
        folderId: rows[0].folderId,
      }),
    });
  }

  async function renameClaimed(
    claim: ProjectDriveFolderRenameClaim,
  ): Promise<ProjectDriveFolderRenameResult> {
    const target = await pinnedRenameTarget(claim);
    return deps.access.withReceiptStorageSession(
      target.receipt,
      async (session) => {
        if (!session.storage.isCurrent) {
          throw new DriveFolderError("storage-conflict");
        }
        const before = await getGoogleDriveFile(
          session.accessToken,
          session.storage.folderId,
          deps.fetchImpl,
        );
        verifyStoredFolder(session, before);

        // This is intentionally the last database read before PATCH. A later
        // post-provider transaction repeats the same fence before completing
        // the journal, covering a Project rename that races the HTTP request.
        const stillCurrent = await pinnedRenameTarget(claim);
        if (
          stillCurrent.folderName !== target.folderName ||
          stillCurrent.receipt.connectionId !== target.receipt.connectionId ||
          stillCurrent.receipt.folderId !== target.receipt.folderId
        ) {
          throw new DriveFolderError("storage-conflict");
        }

        const after =
          before.name === target.folderName
            ? before
            : await renameGoogleDriveFile(
                session.accessToken,
                session.storage.folderId,
                target.folderName,
                deps.fetchImpl,
              );
        const receipt = verifyStoredFolder(session, after);
        return Object.freeze({
          storageGenerationId: session.storage.id,
          folderId: receipt.id,
          folderWebViewLink: receipt.webViewLink,
          connectionId: session.storage.connectionId,
          outcome: before.name === target.folderName ? "existing" : "renamed",
          folderName: target.folderName,
        });
      },
    );
  }

  async function verifyCurrent(
    authorization: AuthorizedProjectDriveContext,
  ): Promise<WorkspaceDriveFolder> {
    assertProjectDriveCapability(authorization, "manageProject");
    return deps.access.withStorageSession(
      authorization,
      { kind: "current" },
      async (session) => {
        let file: GoogleDriveFile;
        try {
          file = await getGoogleDriveFile(
            session.accessToken,
            session.storage.folderId,
            deps.fetchImpl,
          );
        } catch (error) {
          if (isGoogleDriveProviderError(error) && error.status === 404) {
            await deps.database
              .update(workspaceStorage)
              .set({ state: "folder_missing" })
              .where(
                and(
                  eq(workspaceStorage.id, session.storage.id),
                  eq(
                    workspaceStorage.workspaceId,
                    authorization.projectId,
                  ),
                ),
              );
            throw new DriveFolderError("folder-missing");
          }
          throw error;
        }
        const receipt = verifyStoredFolder(session, file);
        return Object.freeze({
          storageGenerationId: session.storage.id,
          folderId: receipt.id,
          folderWebViewLink: receipt.webViewLink,
          connectionId: session.storage.connectionId,
          outcome: "existing" as const,
        });
      },
    );
  }

  async function provision(
    authorization: AuthorizedProjectDriveContext,
    input: Readonly<{ storageGenerationId: string; folderName: string }>,
  ): Promise<WorkspaceDriveFolder> {
    assertProjectDriveCapability(authorization, "manageProject");
    const storageGenerationId = canonicalText(input.storageGenerationId);
    const folderName = canonicalText(input.folderName);
    const current = await deps.database
      .select()
      .from(workspaceStorage)
      .where(
        and(
          eq(workspaceStorage.workspaceId, authorization.projectId),
          eq(workspaceStorage.isCurrent, true),
        ),
      )
      .limit(2);
    if (current.length > 1) throw new DriveFolderError("storage-conflict");
    if (current.length === 1) {
      if (current[0].id !== storageGenerationId) {
        throw new DriveFolderError("storage-conflict");
      }
      return verifyCurrent(authorization);
    }

    return deps.access.withProvisioningSession(
      authorization,
      async (session) => {
        const expected = {
          workspaceId: authorization.projectId,
          storageGenerationId,
          rootFolderId: session.credential.rootFolderId,
        };
        const match = await markedFolder(
          session,
          { workspaceId: authorization.projectId, storageGenerationId },
          deps.fetchImpl,
        );
        const providerOutcome = match ? "adopted" : "created";
        const file =
          match ??
          (await createGoogleDriveFolder(
            session.accessToken,
            {
              name: folderName,
              parentId: session.credential.rootFolderId,
              appProperties: {
                [DRIVE_FOLDER_WORKSPACE_MARKER]: authorization.projectId,
                [DRIVE_FOLDER_GENERATION_MARKER]: storageGenerationId,
              },
            },
            deps.fetchImpl,
          ));
        const receipt = folderReceipt(file, expected);

        try {
          const persisted = await deps.database.transaction(async (tx) => {
            const [sameGeneration] = await tx
              .select()
              .from(workspaceStorage)
              .where(
                and(
                  eq(workspaceStorage.id, storageGenerationId),
                  eq(
                    workspaceStorage.workspaceId,
                    authorization.projectId,
                  ),
                ),
              )
              .limit(1);
            if (sameGeneration) {
              if (
                sameGeneration.folderId !== receipt.id ||
                sameGeneration.connectionId !== session.credential.id ||
                !sameGeneration.isCurrent
              ) {
                throw new DriveFolderError("storage-conflict");
              }
              return sameGeneration;
            }
            const currentRows = await tx
              .select({ id: workspaceStorage.id })
              .from(workspaceStorage)
              .where(
                and(
                  eq(
                    workspaceStorage.workspaceId,
                    authorization.projectId,
                  ),
                  eq(workspaceStorage.isCurrent, true),
                ),
              )
              .limit(1);
            if (currentRows.length > 0) {
              throw new DriveFolderError("storage-conflict");
            }
            await tx.insert(workspaceStorage).values({
              id: storageGenerationId,
              workspaceId: authorization.projectId,
              connectionId: session.credential.id,
              folderId: receipt.id,
              folderWebViewLink: receipt.webViewLink,
              state: "active",
              isCurrent: true,
            });
            return null;
          });
          void persisted;
        } catch (error) {
          if (error instanceof DriveFolderError) throw error;
          throw new DriveFolderError("storage-conflict");
        }

        return Object.freeze({
          storageGenerationId,
          folderId: receipt.id,
          folderWebViewLink: receipt.webViewLink,
          connectionId: session.credential.id,
          outcome: providerOutcome,
        });
      },
    );
  }

  async function renameCurrent(
    authorization: AuthorizedProjectDriveContext,
    folderName: string,
  ): Promise<WorkspaceDriveFolder> {
    assertProjectDriveCapability(authorization, "manageProject");
    const name = canonicalText(folderName);
    return deps.access.withStorageSession(
      authorization,
      { kind: "current" },
      async (session) => {
        if (!session.storage.isCurrent) {
          throw new DriveFolderError("storage-conflict");
        }
        const before = await getGoogleDriveFile(
          session.accessToken,
          session.storage.folderId,
          deps.fetchImpl,
        );
        verifyStoredFolder(session, before);
        const after = await renameGoogleDriveFile(
          session.accessToken,
          session.storage.folderId,
          name,
          deps.fetchImpl,
        );
        const receipt = verifyStoredFolder(session, after);
        return Object.freeze({
          storageGenerationId: session.storage.id,
          folderId: receipt.id,
          folderWebViewLink: receipt.webViewLink,
          connectionId: session.storage.connectionId,
          outcome: "renamed" as const,
        });
      },
    );
  }

  return Object.freeze({
    provision,
    provisionClaimed,
    verifyCurrent,
    renameCurrent,
    renameClaimed,
  });
}

function defaultFolderService() {
  return createDriveFolderService({
    database: db,
    fetchImpl: fetch,
    access: projectDriveAccessServiceFromEnv(),
  });
}

export async function provisionWorkspaceDriveFolder(
  authorization: AuthorizedProjectDriveContext,
  input: Readonly<{ storageGenerationId: string; folderName: string }>,
): Promise<WorkspaceDriveFolder> {
  return defaultFolderService().provision(authorization, input);
}

export async function verifyCurrentWorkspaceDriveFolder(
  authorization: AuthorizedProjectDriveContext,
): Promise<WorkspaceDriveFolder> {
  return defaultFolderService().verifyCurrent(authorization);
}

export async function renameCurrentWorkspaceDriveFolder(
  authorization: AuthorizedProjectDriveContext,
  folderName: string,
): Promise<WorkspaceDriveFolder> {
  return defaultFolderService().renameCurrent(authorization, folderName);
}
