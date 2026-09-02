import "server-only";

import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import { workspaceStorage } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  createGoogleDriveFolder,
  findGoogleDriveFilesByAppProperty,
  getGoogleDriveFile,
  isGoogleDriveProviderError,
  renameGoogleDriveFile,
  type GoogleDriveFile,
  type GoogleFetch,
} from "./google-drive";
import {
  withAuthorizedProjectDriveProvisioningSession,
  withAuthorizedProjectDriveSession,
  type ProjectDriveAccessService,
  type ProjectDriveProvisioningSession,
  type ProjectDriveStorageSession,
} from "./project-drive-access";
import {
  assertProjectDriveCapability,
  type AuthorizedProjectDriveContext,
} from "./project-drive-authz";

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

export type DriveFolderServiceDependencies = Readonly<{
  database: FolderDb;
  access: Pick<
    ProjectDriveAccessService,
    "withStorageSession" | "withProvisioningSession"
  >;
  fetchImpl: GoogleFetch;
}>;

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

  return Object.freeze({ provision, verifyCurrent, renameCurrent });
}

function defaultFolderService() {
  return createDriveFolderService({
    database: db,
    fetchImpl: fetch,
    access: {
      withStorageSession: withAuthorizedProjectDriveSession,
      withProvisioningSession: withAuthorizedProjectDriveProvisioningSession,
    },
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
