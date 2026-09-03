import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  keyRingFromEnv,
  open,
  providerTokenAadContext,
  type KeyRing,
} from "@/server/crypto/secret-box";
import { db } from "@/server/db";
import {
  providerConnections,
  workspaceStorage,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  googleDriveOAuthClientFromEnv,
} from "./drive-connections";
import {
  isGoogleDriveProviderError,
  refreshGoogleDriveAccessToken,
  type GoogleFetch,
  type GoogleOAuthClient,
} from "./google-drive";
import { assertExactGoogleDriveScopeSet } from "./google-drive-scopes";
import type { AuthorizedProjectDriveContext } from "./project-drive-authz";

const GOOGLE_DRIVE_PROVIDER = "google_drive" as const;

type AccessDb = LibSQLDatabase<typeof schema>;

export type ProjectDriveStorageSelector =
  | Readonly<{ kind: "current" }>
  | Readonly<{ kind: "generation"; storageGenerationId: string }>;

/**
 * A durable, server-derived storage receipt used by repair and erasure work.
 * This is deliberately separate from a user authorization context: callers
 * must obtain every field from stored rows, never from a browser payload.
 */
export type ProjectDriveStorageReceipt = Readonly<{
  workspaceId: string;
  storageGenerationId: string;
  connectionId: string;
  folderId: string;
}>;

export type ProjectDriveStorageSession = Readonly<{
  accessToken: string;
  credential: Readonly<{
    id: string;
    ownerUserId: string;
    providerAccountId: string;
    providerAccountEmail: string | null;
    rootFolderId: string;
  }>;
  /** Root recorded on the credential generation that owns this folder. */
  storageRootFolderId: string;
  storage: Readonly<{
    id: string;
    workspaceId: string;
    connectionId: string;
    folderId: string;
    folderWebViewLink: string;
    state: "active" | "needs_reauth" | "folder_missing" | "quota_full";
    isCurrent: boolean;
  }>;
}>;

export type ProjectDriveProvisioningSession = Readonly<{
  accessToken: string;
  credential: Readonly<{
    id: string;
    ownerUserId: string;
    providerAccountId: string;
    providerAccountEmail: string | null;
    rootFolderId: string;
  }>;
}>;

export type ProjectDriveAccessErrorCode =
  | "storage-not-found"
  | "storage-ambiguous"
  | "connection-not-found"
  | "connection-ambiguous"
  | "connection-not-current"
  | "needs-reauth"
  | "unexpected-scope-set";

export class ProjectDriveAccessError extends Error {
  readonly code: ProjectDriveAccessErrorCode;

  constructor(code: ProjectDriveAccessErrorCode) {
    const messages: Record<ProjectDriveAccessErrorCode, string> = {
      "storage-not-found": "This project does not have that Drive folder.",
      "storage-ambiguous": "This project’s Drive folder needs attention.",
      "connection-not-found": "The storage owner must reconnect Google Drive.",
      "connection-ambiguous": "The storage owner’s Drive connection needs attention.",
      "connection-not-current": "That Drive connection is no longer current.",
      "needs-reauth": "The storage owner must reconnect Google Drive.",
      "unexpected-scope-set": "The Drive connection has an unexpected permission set.",
    };
    super(messages[code]);
    this.name = "ProjectDriveAccessError";
    this.code = code;
  }
}

export type ProjectDriveAccessServiceDependencies = Readonly<{
  database: AccessDb;
  fetchImpl: GoogleFetch;
  keyRing: KeyRing;
  oauthClient: Pick<GoogleOAuthClient, "clientId" | "clientSecret">;
  now: () => Date;
}>;

function canonicalId(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(`${label} must be a canonical id`);
  }
  return value;
}

function invalidGrant(error: unknown): boolean {
  return (
    isGoogleDriveProviderError(error) &&
    error.operation === "access-token-refresh" &&
    error.reason === "invalid_grant"
  );
}

/**
 * Injectable request-local token seam. The access token is visible only to
 * the callback and is never returned by a folder/grant service or persisted.
 */
export function createProjectDriveAccessService(
  deps: ProjectDriveAccessServiceDependencies,
) {
  async function lineageIds(input: {
    ownerUserId: string;
    providerAccountId: string;
  }): Promise<string[]> {
    const rows = await deps.database
      .select({ id: providerConnections.id })
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.userId, input.ownerUserId),
          eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
          eq(providerConnections.providerAccountId, input.providerAccountId),
        ),
      );
    return rows.map((row) => row.id);
  }

  async function markNeedsReauth(input: {
    connectionId: string;
    ownerUserId: string;
    providerAccountId: string;
  }): Promise<void> {
    const ids = await lineageIds(input);
    await deps.database.transaction(async (tx) => {
      await tx
        .update(providerConnections)
        .set({ status: "needs_reauth", lastErrorAt: deps.now() })
        .where(eq(providerConnections.id, input.connectionId));
      if (ids.length > 0) {
        // isolation-ok: ids are derived from one storage owner's exact
        // provider-account lineage. An invalid grant affects every folder
        // generation whose credential came from that lineage.
        await tx
          .update(workspaceStorage)
          .set({ state: "needs_reauth" })
          .where(inArray(workspaceStorage.connectionId, ids));
      }
    });
  }

  async function refreshCredential<T>(
    connection: typeof providerConnections.$inferSelect,
    operation: (input: {
      accessToken: string;
      credential: ProjectDriveProvisioningSession["credential"];
    }) => Promise<T>,
  ): Promise<T> {
    if (connection.status !== "active" || !connection.isCurrent) {
      throw new ProjectDriveAccessError("needs-reauth");
    }
    try {
      assertExactGoogleDriveScopeSet(connection.scopes);
    } catch {
      throw new ProjectDriveAccessError("unexpected-scope-set");
    }

    let refreshToken: string | null = open(
      connection.refreshTokenCipher,
      providerTokenAadContext(connection.id),
      deps.keyRing,
    );

    let accessToken: string | null = null;
    try {
      let refreshed: Awaited<ReturnType<typeof refreshGoogleDriveAccessToken>>;
      try {
        refreshed = await refreshGoogleDriveAccessToken(
          {
            clientId: deps.oauthClient.clientId,
            clientSecret: deps.oauthClient.clientSecret,
            refreshToken,
          },
          deps.fetchImpl,
        );
      } catch (error) {
        if (invalidGrant(error)) {
          await markNeedsReauth({
            connectionId: connection.id,
            ownerUserId: connection.userId,
            providerAccountId: connection.providerAccountId,
          });
          throw new ProjectDriveAccessError("needs-reauth");
        }
        await deps.database
          .update(providerConnections)
          .set({ lastErrorAt: deps.now() })
          .where(eq(providerConnections.id, connection.id));
        throw error;
      }
      accessToken = refreshed.accessToken;
      await deps.database
        .update(providerConnections)
        .set({ lastUsedAt: deps.now(), lastErrorAt: null })
        .where(eq(providerConnections.id, connection.id));
      return await operation({
        accessToken,
        credential: Object.freeze({
          id: connection.id,
          ownerUserId: connection.userId,
          providerAccountId: connection.providerAccountId,
          providerAccountEmail: connection.providerAccountEmail,
          rootFolderId: connection.rootFolderId,
        }),
      });
    } finally {
      // Strings cannot be zeroed in JavaScript; dropping the only local
      // references is the strongest available discard boundary.
      accessToken = null;
      refreshToken = null;
    }
  }

  async function newestCredentialInLineage(
    bound: typeof providerConnections.$inferSelect,
  ): Promise<typeof providerConnections.$inferSelect> {
    const rows = await deps.database
      .select()
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.userId, bound.userId),
          eq(providerConnections.provider, bound.provider),
          eq(providerConnections.providerAccountId, bound.providerAccountId),
          eq(providerConnections.isCurrent, true),
        ),
      )
      .orderBy(desc(providerConnections.connectedAt))
      .limit(2);
    if (rows.length === 0) throw new ProjectDriveAccessError("connection-not-found");
    if (rows.length !== 1) throw new ProjectDriveAccessError("connection-ambiguous");
    return rows[0];
  }

  async function withStorageSession<T>(
    authorization: AuthorizedProjectDriveContext,
    selector: ProjectDriveStorageSelector,
    operation: (session: ProjectDriveStorageSession) => Promise<T>,
  ): Promise<T> {
    return withResolvedStorageSession(
      authorization.projectId,
      selector,
      null,
      operation,
    );
  }

  async function withResolvedStorageSession<T>(
    workspaceId: string,
    selector: ProjectDriveStorageSelector,
    expectedReceipt: ProjectDriveStorageReceipt | null,
    operation: (session: ProjectDriveStorageSession) => Promise<T>,
  ): Promise<T> {
    const canonicalWorkspaceId = canonicalId(workspaceId, "workspaceId");
    const storageRows = await deps.database
      .select()
      .from(workspaceStorage)
      .where(
        selector.kind === "current"
          ? and(
              eq(workspaceStorage.workspaceId, canonicalWorkspaceId),
              eq(workspaceStorage.isCurrent, true),
            )
          : and(
              eq(workspaceStorage.workspaceId, canonicalWorkspaceId),
              eq(
                workspaceStorage.id,
                canonicalId(
                  selector.storageGenerationId,
                  "storageGenerationId",
                ),
              ),
            ),
      )
      .limit(2);
    if (storageRows.length === 0) {
      throw new ProjectDriveAccessError("storage-not-found");
    }
    if (storageRows.length !== 1) {
      throw new ProjectDriveAccessError("storage-ambiguous");
    }
    const storage = storageRows[0];
    if (
      expectedReceipt &&
      (storage.id !== expectedReceipt.storageGenerationId ||
        storage.connectionId !== expectedReceipt.connectionId ||
        storage.folderId !== expectedReceipt.folderId)
    ) {
      throw new ProjectDriveAccessError("storage-not-found");
    }
    const [bound] = await deps.database
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, storage.connectionId))
      .limit(1);
    if (!bound) throw new ProjectDriveAccessError("connection-not-found");
    const credential = await newestCredentialInLineage(bound);

    return refreshCredential(credential, ({ accessToken, credential: current }) =>
      operation(
        Object.freeze({
          accessToken,
          credential: current,
          storageRootFolderId: bound.rootFolderId,
          storage: Object.freeze({ ...storage }),
        }),
      ),
    );
  }

  /**
   * Resolve an exact persisted receipt for internal repair/erasure work.
   * The four-way equality check happens before token refresh or provider I/O,
   * so a stale or cross-Project receipt cannot steer a privileged request.
   */
  async function withReceiptStorageSession<T>(
    receipt: ProjectDriveStorageReceipt,
    operation: (session: ProjectDriveStorageSession) => Promise<T>,
  ): Promise<T> {
    const canonicalReceipt = Object.freeze({
      workspaceId: canonicalId(receipt.workspaceId, "workspaceId"),
      storageGenerationId: canonicalId(
        receipt.storageGenerationId,
        "storageGenerationId",
      ),
      connectionId: canonicalId(receipt.connectionId, "connectionId"),
      folderId: canonicalId(receipt.folderId, "folderId"),
    });
    return withResolvedStorageSession(
      canonicalReceipt.workspaceId,
      {
        kind: "generation",
        storageGenerationId: canonicalReceipt.storageGenerationId,
      },
      canonicalReceipt,
      operation,
    );
  }

  async function withProvisioningSession<T>(
    authorization: AuthorizedProjectDriveContext,
    operation: (session: ProjectDriveProvisioningSession) => Promise<T>,
  ): Promise<T> {
    const connections = await deps.database
      .select()
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.userId, authorization.actorUserId),
          eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
          eq(providerConnections.isCurrent, true),
        ),
      )
      .orderBy(desc(providerConnections.connectedAt))
      .limit(2);
    if (connections.length === 0) {
      throw new ProjectDriveAccessError("connection-not-found");
    }
    if (connections.length !== 1) {
      throw new ProjectDriveAccessError("connection-ambiguous");
    }
    return refreshCredential(connections[0], ({ accessToken, credential }) =>
      operation(Object.freeze({ accessToken, credential })),
    );
  }

  /**
   * Resolve the exact credential generation pinned in a durable operation.
   * Unlike the interactive provisioning path, this never substitutes a newer
   * connection from the same account lineage: changing the credential makes
   * the operation stale and requires a new intent.
   */
  async function withConnectionSession<T>(
    connectionId: string,
    operation: (session: ProjectDriveProvisioningSession) => Promise<T>,
  ): Promise<T> {
    const canonicalConnectionId = canonicalId(connectionId, "connectionId");
    const connections = await deps.database
      .select()
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.id, canonicalConnectionId),
          eq(providerConnections.provider, GOOGLE_DRIVE_PROVIDER),
        ),
      )
      .limit(2);
    if (connections.length === 0) {
      throw new ProjectDriveAccessError("connection-not-found");
    }
    if (connections.length !== 1) {
      throw new ProjectDriveAccessError("connection-ambiguous");
    }
    if (!connections[0].isCurrent) {
      throw new ProjectDriveAccessError("connection-not-current");
    }
    return refreshCredential(connections[0], ({ accessToken, credential }) =>
      operation(Object.freeze({ accessToken, credential })),
    );
  }

  return Object.freeze({
    withStorageSession,
    withReceiptStorageSession,
    withProvisioningSession,
    withConnectionSession,
  });
}

export type ProjectDriveAccessService = ReturnType<
  typeof createProjectDriveAccessService
>;

export function projectDriveAccessServiceFromEnv() {
  const oauthClient = googleDriveOAuthClientFromEnv();
  return createProjectDriveAccessService({
    database: db,
    fetchImpl: fetch,
    keyRing: keyRingFromEnv(),
    oauthClient,
    now: () => new Date(),
  });
}

export async function withAuthorizedProjectDriveSession<T>(
  authorization: AuthorizedProjectDriveContext,
  selector: ProjectDriveStorageSelector,
  operation: (session: ProjectDriveStorageSession) => Promise<T>,
): Promise<T> {
  return projectDriveAccessServiceFromEnv().withStorageSession(
    authorization,
    selector,
    operation,
  );
}

export async function withAuthorizedProjectDriveProvisioningSession<T>(
  authorization: AuthorizedProjectDriveContext,
  operation: (session: ProjectDriveProvisioningSession) => Promise<T>,
): Promise<T> {
  return projectDriveAccessServiceFromEnv().withProvisioningSession(
    authorization,
    operation,
  );
}

export async function withProjectDriveReceiptSession<T>(
  receipt: ProjectDriveStorageReceipt,
  operation: (session: ProjectDriveStorageSession) => Promise<T>,
): Promise<T> {
  return projectDriveAccessServiceFromEnv().withReceiptStorageSession(
    receipt,
    operation,
  );
}
