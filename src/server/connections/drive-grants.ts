import "server-only";

import { and, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import {
  driveFolderGrants,
  users,
  workspaceMembers,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import type { GoogleFetch } from "./google-drive";
import {
  withAuthorizedProjectDriveSession,
  type ProjectDriveAccessService,
  type ProjectDriveStorageSession,
} from "./project-drive-access";
import {
  assertProjectDriveCapability,
  type AuthorizedProjectDriveContext,
} from "./project-drive-authz";

const GOOGLE_DRIVE_API_ORIGIN = "https://www.googleapis.com";

type GrantDb = LibSQLDatabase<typeof schema>;

export type DriveGrantRole = "writer" | "reader";

export type GrantTarget = Readonly<{
  fileId: string;
  workspaceFolderId: string;
  rootFolderId: string;
  type: string;
  role: string;
}>;

/** Refuse a dangerous target before every permission mutation. */
export function assertGrantTarget(input: GrantTarget): void {
  if (input.fileId === input.rootFolderId) {
    throw new DriveGrantError("root-folder-target");
  }
  if (input.fileId !== input.workspaceFolderId) {
    throw new DriveGrantError("foreign-folder-target");
  }
  if (input.type !== "user") {
    throw new DriveGrantError("unsupported-grantee-type");
  }
  if (input.role !== "writer" && input.role !== "reader") {
    throw new DriveGrantError("unsupported-role");
  }
}

export type DriveGrantErrorCode =
  | "root-folder-target"
  | "foreign-folder-target"
  | "unsupported-grantee-type"
  | "unsupported-role"
  | "member-not-found"
  | "member-email-unavailable"
  | "storage-owner"
  | "grant-conflict"
  | "grant-not-found"
  | "provider-error"
  | "malformed-response";

export type DriveGrantProviderOperation =
  | "permission-list"
  | "permission-create"
  | "permission-delete";

export class DriveGrantError extends Error {
  readonly code: DriveGrantErrorCode;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly reason: string | null;
  readonly operation: DriveGrantProviderOperation | null;

  constructor(
    code: DriveGrantErrorCode,
    details: Readonly<{
      status?: number | null;
      retryable?: boolean;
      reason?: string | null;
      operation?: DriveGrantProviderOperation | null;
    }> = {},
  ) {
    const messages: Record<DriveGrantErrorCode, string> = {
      "root-folder-target": "The private Drive root can never be shared.",
      "foreign-folder-target": "A grant can only target this project’s folder.",
      "unsupported-grantee-type": "Only named people can receive Drive access.",
      "unsupported-role": "That Drive role is not supported.",
      "member-not-found": "That person is not a current project member.",
      "member-email-unavailable": "That member does not have a usable email address.",
      "storage-owner": "The storage owner already owns this Drive folder.",
      "grant-conflict": "An existing Drive grant needs attention first.",
      "grant-not-found": "The recorded Drive grant is no longer present.",
      "provider-error": "Google Drive could not update access.",
      "malformed-response": "Google Drive returned an invalid access receipt.",
    };
    super(messages[code]);
    this.name = "DriveGrantError";
    this.code = code;
    this.status = details.status ?? null;
    this.retryable = details.retryable ?? false;
    this.reason = safeReason(details.reason);
    this.operation = details.operation ?? null;
  }
}

type FolderPermissionMutationQueue = Readonly<{
  run<T>(folderId: string, operation: () => Promise<T>): Promise<T>;
}>;

/** Google explicitly forbids concurrent permission mutations on one file. */
export function createFolderPermissionMutationQueue(): FolderPermissionMutationQueue {
  const tails = new Map<string, Promise<void>>();
  return Object.freeze({
    async run<T>(folderId: string, operation: () => Promise<T>): Promise<T> {
      const prior = tails.get(folderId) ?? Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      const tail = prior.catch(() => {}).then(() => current);
      tails.set(folderId, tail);
      await prior.catch(() => {});
      try {
        return await operation();
      } finally {
        release();
        if (tails.get(folderId) === tail) tails.delete(folderId);
      }
    },
  });
}

const processPermissionMutations = createFolderPermissionMutationQueue();

export type DriveGrantServiceDependencies = Readonly<{
  database: GrantDb;
  access: Pick<ProjectDriveAccessService, "withStorageSession">;
  fetchImpl: GoogleFetch;
  now: () => Date;
  mutationQueue?: FolderPermissionMutationQueue;
}>;

export type CreatedDriveGrant = Readonly<{
  storageGenerationId: string;
  workspaceId: string;
  userId: string;
  permissionId: string;
  grantedEmail: string;
  role: DriveGrantRole;
  outcome: "created" | "existing";
}>;

export type RevokedDriveGrant = Readonly<{
  revoked: boolean;
  alreadyAbsent: boolean;
}>;

export type LiveDrivePermission = Readonly<{
  permissionId: string;
  type: string;
  role: string;
  emailAddress: string | null;
  displayName: string | null;
  deleted: boolean;
  source: "signal-grant" | "storage-owner" | "external";
  signalUserId: string | null;
}>;

function safeReason(value: string | null | undefined): string | null {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value)
    ? value
    : null;
}

function normalizeEmail(value: string | null): string {
  const email = value?.trim().toLowerCase() ?? "";
  if (
    email.length < 3 ||
    email.length > 320 ||
    email.indexOf("@") < 1 ||
    email.endsWith("@")
  ) {
    throw new DriveGrantError("member-email-unavailable");
  }
  return email;
}

function providerReason(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const top = body as Record<string, unknown>;
  if (typeof top.error === "string") return safeReason(top.error);
  const nested =
    top.error && typeof top.error === "object" && !Array.isArray(top.error)
      ? (top.error as Record<string, unknown>)
      : null;
  const errors = Array.isArray(nested?.errors) ? nested.errors : [];
  const first =
    errors[0] && typeof errors[0] === "object" && !Array.isArray(errors[0])
      ? (errors[0] as Record<string, unknown>)
      : null;
  return safeReason(
    typeof first?.reason === "string"
      ? first.reason
      : typeof nested?.status === "string"
        ? nested.status
        : null,
  );
}

async function responseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function permissionFetch(
  accessToken: string,
  url: URL,
  init: RequestInit,
  fetchImpl: GoogleFetch,
  operation: DriveGrantProviderOperation,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    return await fetchImpl(url, {
      ...init,
      headers,
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new DriveGrantError("provider-error", {
      retryable: true,
      operation,
    });
  }
}

function permissionUrl(folderId: string, permissionId?: string): URL {
  const suffix = permissionId
    ? `/permissions/${encodeURIComponent(permissionId)}`
    : "/permissions";
  return new URL(
    `/drive/v3/files/${encodeURIComponent(folderId)}${suffix}`,
    GOOGLE_DRIVE_API_ORIGIN,
  );
}

function assertSessionGrantTarget(
  session: ProjectDriveStorageSession,
  role: DriveGrantRole,
): void {
  const target = {
    fileId: session.storage.folderId,
    workspaceFolderId: session.storage.folderId,
    type: "user",
    role,
  } as const;
  assertGrantTarget({
    ...target,
    rootFolderId: session.storageRootFolderId,
  });
  if (session.credential.rootFolderId !== session.storageRootFolderId) {
    assertGrantTarget({
      ...target,
      rootFolderId: session.credential.rootFolderId,
    });
  }
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredPermissionReceipt(
  body: unknown,
  expected: { role: DriveGrantRole; email: string },
): { id: string } {
  const record = recordOf(body);
  if (
    !record ||
    typeof record.id !== "string" ||
    record.id.length === 0 ||
    record.id.length > 1_024 ||
    record.id !== record.id.trim() ||
    /[\u0000-\u001f\u007f]/.test(record.id) ||
    record.id.includes("://") ||
    record.type !== "user" ||
    record.role !== expected.role ||
    typeof record.emailAddress !== "string" ||
    record.emailAddress.trim().toLowerCase() !== expected.email
  ) {
    throw new DriveGrantError("malformed-response");
  }
  return { id: record.id };
}

type ExactPermissionCandidate = Readonly<{
  id: string;
  type: string;
  role: string;
  email: string | null;
  deleted: boolean;
}>;

export type RecoveredDriveGrant = Readonly<{
  permissionId: string;
  outcome: "adopted" | "created";
}>;

const MAX_PERMISSION_PAGES = 10;

function canonicalPermissionId(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new DriveGrantError("grant-conflict");
  }
  return value;
}

async function listExactPermissionCandidates(
  session: ProjectDriveStorageSession,
  grantedEmail: string,
  fetchImpl: GoogleFetch,
): Promise<readonly ExactPermissionCandidate[]> {
  const matches: ExactPermissionCandidate[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PERMISSION_PAGES; page += 1) {
    const url = permissionUrl(session.storage.folderId);
    url.searchParams.set(
      "fields",
      "nextPageToken,permissions(id,type,role,emailAddress,deleted)",
    );
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await permissionFetch(
      session.accessToken,
      url,
      { method: "GET" },
      fetchImpl,
      "permission-list",
    );
    const body = await responseJson(response);
    if (!response.ok) {
      throw new DriveGrantError("provider-error", {
        status: response.status,
        retryable: retryableStatus(response.status),
        reason: providerReason(body),
        operation: "permission-list",
      });
    }
    const record = recordOf(body);
    if (!record || !Array.isArray(record.permissions)) {
      throw new DriveGrantError("malformed-response", {
        operation: "permission-list",
      });
    }
    for (const value of record.permissions) {
      const permission = recordOf(value);
      if (
        !permission ||
        typeof permission.id !== "string" ||
        permission.id.length === 0 ||
        permission.id.length > 1_024 ||
        permission.id !== permission.id.trim() ||
        /[\u0000-\u001f\u007f]/.test(permission.id) ||
        permission.id.includes("://") ||
        typeof permission.type !== "string" ||
        typeof permission.role !== "string"
      ) {
        throw new DriveGrantError("malformed-response", {
          operation: "permission-list",
        });
      }
      const email =
        typeof permission.emailAddress === "string"
          ? permission.emailAddress.trim().toLowerCase()
          : null;
      if (permission.deleted === true) continue;
      if (permission.type === "user" && !email) {
        // A live named-user permission without a correlatable address makes
        // duplicate prevention impossible. Fail closed instead of POSTing a
        // second permission whose identity we cannot compare.
        throw new DriveGrantError("malformed-response", {
          operation: "permission-list",
        });
      }
      if (email !== grantedEmail) continue;
      matches.push(
        Object.freeze({
          id: permission.id,
          type: permission.type,
          role: permission.role,
          email,
          deleted: false,
        }),
      );
    }
    if (
      record.nextPageToken !== undefined &&
      typeof record.nextPageToken !== "string"
    ) {
      throw new DriveGrantError("malformed-response", {
        operation: "permission-list",
      });
    }
    pageToken =
      typeof record.nextPageToken === "string" && record.nextPageToken.length > 0
        ? record.nextPageToken
        : null;
    if (!pageToken) return Object.freeze(matches);
  }
  throw new DriveGrantError("malformed-response", {
    operation: "permission-list",
  });
}

/**
 * Recover or create the exact named-user permission for a claimed journal
 * operation. Every attempt lists first, so a worker crash after Google's POST
 * can adopt the prior success instead of blindly creating a duplicate.
 *
 * `beforeCreate` is deliberately mandatory and runs after discovery, directly
 * before the only provider mutation. The executor uses it to re-acquire the
 * database writer slot and recheck the pinned membership, email, generation,
 * and account fences without holding a transaction across provider I/O.
 */
export async function recoverOrCreateExactDriveUserPermission(
  session: ProjectDriveStorageSession,
  input: Readonly<{
    granteeEmail: string;
    role: DriveGrantRole;
    sendNotificationEmail: boolean;
    expectedPermissionId?: string | null;
    beforeCreate: () => Promise<void>;
  }>,
  fetchImpl: GoogleFetch,
  mutationQueue: FolderPermissionMutationQueue = processPermissionMutations,
): Promise<RecoveredDriveGrant> {
  const grantedEmail = normalizeEmail(input.granteeEmail);
  const expectedPermissionId = canonicalPermissionId(
    input.expectedPermissionId,
  );
  if (typeof input.sendNotificationEmail !== "boolean") {
    throw new TypeError("sendNotificationEmail must be explicit");
  }
  if (typeof input.beforeCreate !== "function") {
    throw new TypeError("beforeCreate must be provided");
  }

  const target = {
    fileId: session.storage.folderId,
    workspaceFolderId: session.storage.folderId,
    type: "user",
    role: input.role,
  } as const;
  assertGrantTarget({ ...target, rootFolderId: session.storageRootFolderId });
  if (session.credential.rootFolderId !== session.storageRootFolderId) {
    assertGrantTarget({
      ...target,
      rootFolderId: session.credential.rootFolderId,
    });
  }

  return mutationQueue.run(session.storage.folderId, async () => {
    assertGrantTarget({ ...target, rootFolderId: session.storageRootFolderId });
    if (session.credential.rootFolderId !== session.storageRootFolderId) {
      assertGrantTarget({
        ...target,
        rootFolderId: session.credential.rootFolderId,
      });
    }

    const candidates = await listExactPermissionCandidates(
      session,
      grantedEmail,
      fetchImpl,
    );
    const exact = candidates.filter(
      (candidate) =>
        candidate.type === "user" && candidate.role === input.role,
    );

    if (expectedPermissionId) {
      if (
        candidates.length === 1 &&
        exact.length === 1 &&
        exact[0].id === expectedPermissionId
      ) {
        return Object.freeze({
          permissionId: expectedPermissionId,
          outcome: "adopted" as const,
        });
      }
      if (candidates.length === 0) {
        throw new DriveGrantError("grant-not-found");
      }
      throw new DriveGrantError("grant-conflict");
    }

    if (candidates.length === 1 && exact.length === 1) {
      return Object.freeze({
        permissionId: exact[0].id,
        outcome: "adopted" as const,
      });
    }
    if (candidates.length > 0) {
      throw new DriveGrantError("grant-conflict");
    }

    await input.beforeCreate();
    // Keep the guard in this exported mutation function immediately before
    // the POST as a source-enforced backstop against future refactors.
    assertGrantTarget({ ...target, rootFolderId: session.storageRootFolderId });
    if (session.credential.rootFolderId !== session.storageRootFolderId) {
      assertGrantTarget({
        ...target,
        rootFolderId: session.credential.rootFolderId,
      });
    }
    const url = permissionUrl(session.storage.folderId);
    url.searchParams.set(
      "sendNotificationEmail",
      String(input.sendNotificationEmail),
    );
    url.searchParams.set("fields", "id,type,role,emailAddress");
    const response = await permissionFetch(
      session.accessToken,
      url,
      {
        method: "POST",
        body: JSON.stringify({
          type: "user",
          role: input.role,
          emailAddress: grantedEmail,
        }),
      },
      fetchImpl,
      "permission-create",
    );
    const body = await responseJson(response);
    if (!response.ok) {
      throw new DriveGrantError("provider-error", {
        status: response.status,
        retryable: retryableStatus(response.status),
        reason: providerReason(body),
        operation: "permission-create",
      });
    }
    try {
      const receipt = requiredPermissionReceipt(body, {
        role: input.role,
        email: grantedEmail,
      });
      return Object.freeze({
        permissionId: receipt.id,
        outcome: "created" as const,
      });
    } catch (error) {
      if (error instanceof DriveGrantError) {
        throw new DriveGrantError(error.code, {
          operation: "permission-create",
        });
      }
      throw error;
    }
  });
}

export function createDriveGrantService(deps: DriveGrantServiceDependencies) {
  const mutationQueue = deps.mutationQueue ?? processPermissionMutations;

  async function create(
    authorization: AuthorizedProjectDriveContext,
    input: Readonly<{
      memberUserId: string;
      role: DriveGrantRole;
      sendNotificationEmail: boolean;
    }>,
  ): Promise<CreatedDriveGrant> {
    assertProjectDriveCapability(authorization, "manageProject");
    if (typeof input.sendNotificationEmail !== "boolean") {
      throw new TypeError("sendNotificationEmail must be explicit");
    }
    const [member] = await deps.database
      .select({ id: users.id, email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, authorization.projectId),
          eq(workspaceMembers.userId, input.memberUserId),
        ),
      )
      .limit(1);
    if (!member) throw new DriveGrantError("member-not-found");
    const grantedEmail = normalizeEmail(member.email);

    return deps.access.withStorageSession(
      authorization,
      { kind: "current" },
      async (session) => {
        if (!session.storage.isCurrent) {
          throw new DriveGrantError("foreign-folder-target");
        }
        if (member.id === session.credential.ownerUserId) {
          throw new DriveGrantError("storage-owner");
        }
        assertSessionGrantTarget(session, input.role);

        return mutationQueue.run(session.storage.folderId, async () => {
          // Re-assert inside the serialized provider critical section so no
          // future refactor can separate validation from the mutation.
          assertSessionGrantTarget(session, input.role);
          // Read inside the same per-folder critical section as the provider
          // mutation. Two local callers must never create duplicate live
          // permissions before the receipt primary key rejects the loser.
          const [existing] = await deps.database
            .select()
            .from(driveFolderGrants)
            .where(
              and(
                eq(
                  driveFolderGrants.storageGenerationId,
                  session.storage.id,
                ),
                eq(driveFolderGrants.workspaceId, authorization.projectId),
                eq(driveFolderGrants.userId, member.id),
              ),
            )
            .limit(1);
          if (existing) {
            if (
              existing.grantedEmail !== grantedEmail ||
              existing.role !== input.role ||
              existing.revokePending
            ) {
              throw new DriveGrantError("grant-conflict");
            }
            return Object.freeze({
              storageGenerationId: existing.storageGenerationId,
              workspaceId: existing.workspaceId,
              userId: existing.userId,
              permissionId: existing.permissionId,
              grantedEmail: existing.grantedEmail,
              role: existing.role,
              outcome: "existing" as const,
            });
          }
          const url = permissionUrl(session.storage.folderId);
          url.searchParams.set(
            "sendNotificationEmail",
            String(input.sendNotificationEmail),
          );
          url.searchParams.set("fields", "id,type,role,emailAddress");
          const response = await permissionFetch(
            session.accessToken,
            url,
            {
              method: "POST",
              body: JSON.stringify({
                type: "user",
                role: input.role,
                emailAddress: grantedEmail,
              }),
            },
            deps.fetchImpl,
            "permission-create",
          );
          const body = await responseJson(response);
          if (!response.ok) {
            throw new DriveGrantError("provider-error", {
              status: response.status,
              retryable: retryableStatus(response.status),
              reason: providerReason(body),
              operation: "permission-create",
            });
          }
          const receipt = requiredPermissionReceipt(body, {
            role: input.role,
            email: grantedEmail,
          });
          await deps.database.insert(driveFolderGrants).values({
            storageGenerationId: session.storage.id,
            workspaceId: authorization.projectId,
            userId: member.id,
            permissionId: receipt.id,
            grantedEmail,
            role: input.role,
            grantedAt: deps.now(),
            revokePending: false,
          });
          return Object.freeze({
            storageGenerationId: session.storage.id,
            workspaceId: authorization.projectId,
            userId: member.id,
            permissionId: receipt.id,
            grantedEmail,
            role: input.role,
            outcome: "created" as const,
          });
        });
      },
    );
  }

  async function revoke(
    authorization: AuthorizedProjectDriveContext,
    input: Readonly<{ storageGenerationId: string; memberUserId: string }>,
  ): Promise<RevokedDriveGrant> {
    assertProjectDriveCapability(authorization, "manageProject");
    const [grant] = await deps.database
      .select()
      .from(driveFolderGrants)
      .where(
        and(
          eq(
            driveFolderGrants.storageGenerationId,
            input.storageGenerationId,
          ),
          eq(driveFolderGrants.workspaceId, authorization.projectId),
          eq(driveFolderGrants.userId, input.memberUserId),
        ),
      )
      .limit(1);
    if (!grant) {
      return Object.freeze({ revoked: true, alreadyAbsent: true });
    }

    try {
      return await deps.access.withStorageSession(
        authorization,
        {
          kind: "generation",
          storageGenerationId: grant.storageGenerationId,
        },
        async (session) =>
          mutationQueue.run(session.storage.folderId, async () => {
            assertSessionGrantTarget(session, grant.role);
            const response = await permissionFetch(
              session.accessToken,
              permissionUrl(session.storage.folderId, grant.permissionId),
              { method: "DELETE" },
              deps.fetchImpl,
              "permission-delete",
            );
            if (!response.ok && response.status !== 404) {
              const body = await responseJson(response);
              throw new DriveGrantError("provider-error", {
                status: response.status,
                retryable: retryableStatus(response.status),
                reason: providerReason(body),
                operation: "permission-delete",
              });
            }
            await deps.database
              .delete(driveFolderGrants)
              .where(
                and(
                  eq(
                    driveFolderGrants.storageGenerationId,
                    grant.storageGenerationId,
                  ),
                  eq(
                    driveFolderGrants.workspaceId,
                    authorization.projectId,
                  ),
                  eq(driveFolderGrants.userId, grant.userId),
                  eq(driveFolderGrants.permissionId, grant.permissionId),
                ),
              );
            return Object.freeze({
              revoked: true,
              alreadyAbsent: response.status === 404,
            });
          }),
      );
    } catch (error) {
      // The exact receipt remains durable until provider deletion and the
      // matching local delete have both succeeded. Token/storage/provider/DB
      // failures all leave an explicit retry signal for the operation worker.
      await deps.database
        .update(driveFolderGrants)
        .set({ revokePending: true })
        .where(
          and(
            eq(
              driveFolderGrants.storageGenerationId,
              grant.storageGenerationId,
            ),
            eq(driveFolderGrants.workspaceId, authorization.projectId),
            eq(driveFolderGrants.userId, grant.userId),
            eq(driveFolderGrants.permissionId, grant.permissionId),
          ),
        );
      throw error;
    }
  }

  async function listLive(
    authorization: AuthorizedProjectDriveContext,
  ): Promise<readonly LiveDrivePermission[]> {
    assertProjectDriveCapability(authorization, "manageProject");
    return deps.access.withStorageSession(
      authorization,
      { kind: "current" },
      async (session) => {
        const known = await deps.database
          .select()
          .from(driveFolderGrants)
          .where(
            and(
              eq(
                driveFolderGrants.storageGenerationId,
                session.storage.id,
              ),
              eq(driveFolderGrants.workspaceId, authorization.projectId),
            ),
          );
        const knownByPermission = new Map(
          known.map((row) => [row.permissionId, row]),
        );
        const output: LiveDrivePermission[] = [];
        let pageToken: string | null = null;
        for (let page = 0; page < 10; page += 1) {
          const url = permissionUrl(session.storage.folderId);
          url.searchParams.set(
            "fields",
            "nextPageToken,permissions(id,type,role,emailAddress,displayName,deleted)",
          );
          url.searchParams.set("pageSize", "100");
          if (pageToken) url.searchParams.set("pageToken", pageToken);
          const response = await permissionFetch(
            session.accessToken,
            url,
            { method: "GET" },
            deps.fetchImpl,
            "permission-list",
          );
          const body = await responseJson(response);
          if (!response.ok) {
            throw new DriveGrantError("provider-error", {
              status: response.status,
              retryable: retryableStatus(response.status),
              reason: providerReason(body),
              operation: "permission-list",
            });
          }
          const record = recordOf(body);
          if (!record || !Array.isArray(record.permissions)) {
            throw new DriveGrantError("malformed-response");
          }
          for (const value of record.permissions) {
            const permission = recordOf(value);
            if (
              !permission ||
              typeof permission.id !== "string" ||
              typeof permission.type !== "string" ||
              typeof permission.role !== "string"
            ) {
              throw new DriveGrantError("malformed-response");
            }
            const signal = knownByPermission.get(permission.id) ?? null;
            const source = signal
              ? "signal-grant"
              : permission.id === session.credential.providerAccountId
                ? "storage-owner"
                : "external";
            output.push(
              Object.freeze({
                permissionId: permission.id,
                type: permission.type,
                role: permission.role,
                emailAddress:
                  typeof permission.emailAddress === "string"
                    ? permission.emailAddress
                    : null,
                displayName:
                  typeof permission.displayName === "string"
                    ? permission.displayName
                    : null,
                deleted: permission.deleted === true,
                source,
                signalUserId: signal?.userId ?? null,
              }),
            );
          }
          pageToken =
            typeof record.nextPageToken === "string"
              ? record.nextPageToken
              : null;
          if (!pageToken) return Object.freeze(output);
        }
        throw new DriveGrantError("malformed-response");
      },
    );
  }

  return Object.freeze({ create, revoke, listLive });
}

/**
 * Delete one exact named-user permission behind the same root/folder guard as
 * every interactive grant mutation. Internal erasure and repair callers pass
 * only a stored session and permission receipt; the session resolver proves
 * those receipts against database truth before this transport boundary.
 */
export async function deleteExactDriveUserPermission(
  session: ProjectDriveStorageSession,
  input: Readonly<{ permissionId: string; role: DriveGrantRole }>,
  fetchImpl: GoogleFetch,
): Promise<Readonly<{ alreadyAbsent: boolean }>> {
  const target = {
    fileId: session.storage.folderId,
    workspaceFolderId: session.storage.folderId,
    type: "user",
    role: input.role,
  } as const;
  assertGrantTarget({
    ...target,
    rootFolderId: session.storageRootFolderId,
  });
  if (session.credential.rootFolderId !== session.storageRootFolderId) {
    assertGrantTarget({
      ...target,
      rootFolderId: session.credential.rootFolderId,
    });
  }
  const response = await permissionFetch(
    session.accessToken,
    permissionUrl(session.storage.folderId, input.permissionId),
    { method: "DELETE" },
    fetchImpl,
    "permission-delete",
  );
  if (!response.ok && response.status !== 404) {
    const body = await responseJson(response);
    throw new DriveGrantError("provider-error", {
      status: response.status,
      retryable: retryableStatus(response.status),
      reason: providerReason(body),
      operation: "permission-delete",
    });
  }
  return Object.freeze({ alreadyAbsent: response.status === 404 });
}

function defaultGrantService() {
  return createDriveGrantService({
    database: db,
    fetchImpl: fetch,
    now: () => new Date(),
    access: { withStorageSession: withAuthorizedProjectDriveSession },
  });
}

export async function createCurrentWorkspaceDriveGrant(
  authorization: AuthorizedProjectDriveContext,
  input: Readonly<{
    memberUserId: string;
    role: DriveGrantRole;
    sendNotificationEmail: boolean;
  }>,
): Promise<CreatedDriveGrant> {
  return defaultGrantService().create(authorization, input);
}

export async function revokeStoredWorkspaceDriveGrant(
  authorization: AuthorizedProjectDriveContext,
  input: Readonly<{ storageGenerationId: string; memberUserId: string }>,
): Promise<RevokedDriveGrant> {
  return defaultGrantService().revoke(authorization, input);
}

export async function listCurrentWorkspaceDrivePermissions(
  authorization: AuthorizedProjectDriveContext,
): Promise<readonly LiveDrivePermission[]> {
  return defaultGrantService().listLive(authorization);
}
