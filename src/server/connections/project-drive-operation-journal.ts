import "server-only";

import { randomUUID } from "node:crypto";
import {
  and,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import {
  projectDriveOperations,
  type ProjectDriveOperationErrorCode,
  type ProjectDriveOperationKind,
  type ProjectDriveOperationStatus,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { byWorkspace } from "@/server/db/tenant";
import {
  normalizeProjectDriveGranteeEmail,
  projectDriveOperationDedupeKey,
  type ProjectDriveOperationKeyInput,
} from "./project-drive-operation-key";
import {
  GOOGLE_DRIVE_OPERATION_CLAIMABLE_STATUSES,
} from "./project-drive-operation-lifecycle";

const DEFAULT_LEASE_MS = 60_000;
const MIN_LEASE_MS = 1_000;
const MAX_LEASE_MS = 15 * 60_000;
const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 24 * 60 * 60_000;

const ERROR_CODES = new Set<ProjectDriveOperationErrorCode>([
  "ambiguous_provider_result",
  "cannot_invite_non_google_user",
  "connection_not_current",
  "folder_missing",
  "grant_not_found",
  "network_error",
  "permission_denied",
  "provider_conflict",
  "provider_unavailable",
  "quota_full",
  "rate_limited",
  "reauth_required",
  "repair_incomplete",
  "workspace_changed",
]);

type OperationDb = LibSQLDatabase<typeof schema>;
export type ProjectDriveOperationJournalDatabase = Pick<
  OperationDb,
  "insert" | "select" | "update"
>;
type OperationRow = typeof projectDriveOperations.$inferSelect;
type OperationInsert = typeof projectDriveOperations.$inferInsert;

type OperationIdentityColumns = Readonly<{
  connectionId: string | null;
  storageGenerationId: string | null;
  targetStorageGenerationId: string | null;
  subjectUserId: string | null;
  granteeEmail: string | null;
  grantRole: "writer" | "reader" | null;
  workspaceRevision: number | null;
}>;

export type ProjectDriveOperationPrepareInput = ProjectDriveOperationKeyInput;

export type ProjectDriveFolderReceipt = Readonly<{
  providerFolderId: string;
  providerFolderWebViewLink: string;
}>;

export type ProjectDrivePermissionReceipt = Readonly<{
  providerPermissionId: string;
}>;

export type ProjectDriveOperationReceipt =
  | ProjectDriveFolderReceipt
  | ProjectDrivePermissionReceipt
  | Readonly<Record<string, never>>;

export type ProjectDriveOperationView = Readonly<{
  operationId: string;
  workspaceId: string;
  operationKind: ProjectDriveOperationKind;
  status: ProjectDriveOperationStatus;
  attemptCount: number;
  nextAttemptAt: Date | null;
  leaseExpiresAt: Date | null;
  lastErrorCode: ProjectDriveOperationErrorCode | null;
  completedAt: Date | null;
  receipt: ProjectDriveFolderReceipt | ProjectDrivePermissionReceipt | null;
}>;

type ClaimBase = Readonly<{
  operationId: string;
  workspaceId: string;
  attemptFence: number;
  leaseExpiresAt: Date;
}>;

export type ProjectDriveOperationClaim = ClaimBase &
  (
    | Readonly<{
        operationKind: "folder_provision";
        connectionId: string;
        targetStorageGenerationId: string;
      }>
    | Readonly<{
        operationKind: "grant_create";
        storageGenerationId: string;
        subjectUserId: string;
        granteeEmail: string;
        grantRole: "writer" | "reader";
      }>
    | Readonly<{
        operationKind: "folder_rename";
        storageGenerationId: string;
        workspaceRevision: number;
      }>
    | Readonly<{
        operationKind: "project_delete";
      }>
    | Readonly<{
        operationKind: "storage_handover";
        connectionId: string;
        storageGenerationId: string;
        targetStorageGenerationId: string;
      }>
  );

export type ProjectDriveOperationCompleteInput =
  | Readonly<{
      workspaceId: string;
      operationId: string;
      attemptFence: number;
      operationKind: "folder_provision" | "storage_handover";
      receipt: ProjectDriveFolderReceipt;
    }>
  | Readonly<{
      workspaceId: string;
      operationId: string;
      attemptFence: number;
      operationKind: "grant_create";
      receipt: ProjectDrivePermissionReceipt;
    }>
  | Readonly<{
      workspaceId: string;
      operationId: string;
      attemptFence: number;
      operationKind: "folder_rename" | "project_delete";
      receipt: Readonly<Record<string, never>>;
    }>;

export type ProjectDriveOperationFailureInput = Readonly<{
  workspaceId: string;
  operationId: string;
  attemptFence: number;
  errorCode: ProjectDriveOperationErrorCode;
}>;

export type ProjectDriveOperationFenceInput = Readonly<{
  workspaceId: string;
  operationId: string;
  attemptFence: number;
}>;

export type ProjectDriveOperationRetryInput =
  ProjectDriveOperationFailureInput &
    Readonly<{ retryAfterMs: number }>;

export type ProjectDriveOperationRearmInput =
  | Readonly<{
      workspaceId: string;
      operationId: string;
      operationKind: "grant_create";
      previousAttemptFence: number;
      previousReceipt: ProjectDrivePermissionReceipt;
    }>
  | Readonly<{
      workspaceId: string;
      operationId: string;
      operationKind: "project_delete";
      previousAttemptFence: 0;
      previousReceipt: Readonly<Record<string, never>>;
    }>;

export type ProjectDriveOperationJournalDependencies = Readonly<{
  database: ProjectDriveOperationJournalDatabase;
  randomOperationId?: () => string;
  leaseDurationMs?: number;
  /** Test seam only; production defaults to SQLite/libSQL `unixepoch()`. */
  databaseNowSeconds?: () => SQL<Date>;
}>;

export type ProjectDriveOperationConflict = Readonly<{
  outcome: "conflict";
}>;

const NEUTRAL_CONFLICT: ProjectDriveOperationConflict = Object.freeze({
  outcome: "conflict",
});

export class ProjectDriveOperationInputError extends Error {
  readonly code:
    | "invalid-error-code"
    | "invalid-identifier"
    | "invalid-receipt"
    | "invalid-shape"
    | "invalid-timing";

  constructor(code: ProjectDriveOperationInputError["code"]) {
    const messages: Record<ProjectDriveOperationInputError["code"], string> = {
      "invalid-error-code": "The operation error code is not supported.",
      "invalid-identifier": "The operation identifier is invalid.",
      "invalid-receipt": "The operation receipt is invalid.",
      "invalid-shape": "The operation input does not have the required shape.",
      "invalid-timing": "The operation timing is outside the allowed bounds.",
    };
    super(messages[code]);
    this.name = "ProjectDriveOperationInputError";
    this.code = code;
  }
}

export class ProjectDriveOperationIntegrityError extends Error {
  constructor() {
    super("The operation journal row does not match its declared kind.");
    this.name = "ProjectDriveOperationIntegrityError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactKeys(
  value: unknown,
  expected: readonly string[],
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ProjectDriveOperationInputError("invalid-shape");
  }
  const keys = Object.keys(value).sort();
  const allowed = [...expected].sort();
  if (
    keys.length !== allowed.length ||
    keys.some((key, index) => key !== allowed[index])
  ) {
    throw new ProjectDriveOperationInputError("invalid-shape");
  }
}

function requiredIdentifier(value: unknown): string {
  if (typeof value !== "string") {
    throw new ProjectDriveOperationInputError("invalid-identifier");
  }
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    normalized.includes("://")
  ) {
    throw new ProjectDriveOperationInputError("invalid-identifier");
  }
  return normalized;
}

function requiredPositiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new ProjectDriveOperationInputError("invalid-identifier");
  }
  return value as number;
}

function boundedDuration(
  value: unknown,
  minimum: number,
  maximum: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum ||
    (value as number) % 1_000 !== 0
  ) {
    throw new ProjectDriveOperationInputError("invalid-timing");
  }
  return value as number;
}

function databaseNowSeconds(
  source?: () => SQL<Date>,
): SQL<Date> {
  return source?.() ?? sql<Date>`unixepoch()`;
}

function normalizedErrorCode(value: unknown): ProjectDriveOperationErrorCode {
  if (typeof value !== "string" || !ERROR_CODES.has(value as ProjectDriveOperationErrorCode)) {
    throw new ProjectDriveOperationInputError("invalid-error-code");
  }
  return value as ProjectDriveOperationErrorCode;
}

function stableProviderId(value: unknown): string {
  if (typeof value !== "string") {
    throw new ProjectDriveOperationInputError("invalid-receipt");
  }
  const normalized = value.trim();
  if (
    normalized.length < 1 ||
    normalized.length > 1_024 ||
    /[\u0000-\u001f\u007f]/.test(normalized) ||
    normalized.includes("://")
  ) {
    throw new ProjectDriveOperationInputError("invalid-receipt");
  }
  return normalized;
}

function stableWebViewLink(value: unknown): string {
  if (typeof value !== "string") {
    throw new ProjectDriveOperationInputError("invalid-receipt");
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 2_048) {
    throw new ProjectDriveOperationInputError("invalid-receipt");
  }
  try {
    const url = new URL(normalized);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      throw new ProjectDriveOperationInputError("invalid-receipt");
    }
  } catch (error) {
    if (error instanceof ProjectDriveOperationInputError) throw error;
    throw new ProjectDriveOperationInputError("invalid-receipt");
  }
  return normalized;
}

function canonicalPrepareInput(
  input: ProjectDriveOperationPrepareInput,
): ProjectDriveOperationPrepareInput {
  if (!isRecord(input)) {
    throw new ProjectDriveOperationInputError("invalid-shape");
  }

  switch (input.operationKind) {
    case "folder_provision":
      assertExactKeys(input, [
        "operationKind",
        "workspaceId",
        "connectionId",
        "targetStorageGenerationId",
      ]);
      return {
        operationKind: "folder_provision",
        workspaceId: requiredIdentifier(input.workspaceId),
        connectionId: requiredIdentifier(input.connectionId),
        targetStorageGenerationId: requiredIdentifier(
          input.targetStorageGenerationId,
        ),
      };
    case "grant_create":
      assertExactKeys(input, [
        "operationKind",
        "workspaceId",
        "storageGenerationId",
        "subjectUserId",
        "granteeEmail",
        "grantRole",
      ]);
      if (input.grantRole !== "writer" && input.grantRole !== "reader") {
        throw new ProjectDriveOperationInputError("invalid-shape");
      }
      if (typeof input.granteeEmail !== "string") {
        throw new ProjectDriveOperationInputError("invalid-identifier");
      }
      let granteeEmail: string;
      try {
        granteeEmail = normalizeProjectDriveGranteeEmail(input.granteeEmail);
      } catch {
        throw new ProjectDriveOperationInputError("invalid-identifier");
      }
      return {
        operationKind: "grant_create",
        workspaceId: requiredIdentifier(input.workspaceId),
        storageGenerationId: requiredIdentifier(input.storageGenerationId),
        subjectUserId: requiredIdentifier(input.subjectUserId),
        granteeEmail,
        grantRole: input.grantRole,
      };
    case "folder_rename":
      assertExactKeys(input, [
        "operationKind",
        "workspaceId",
        "storageGenerationId",
        "workspaceRevision",
      ]);
      return {
        operationKind: "folder_rename",
        workspaceId: requiredIdentifier(input.workspaceId),
        storageGenerationId: requiredIdentifier(input.storageGenerationId),
        workspaceRevision: requiredPositiveInteger(input.workspaceRevision),
      };
    case "project_delete":
      assertExactKeys(input, ["operationKind", "workspaceId"]);
      return {
        operationKind: "project_delete",
        workspaceId: requiredIdentifier(input.workspaceId),
      };
    case "storage_handover": {
      assertExactKeys(input, [
        "operationKind",
        "workspaceId",
        "connectionId",
        "storageGenerationId",
        "targetStorageGenerationId",
      ]);
      const storageGenerationId = requiredIdentifier(
        input.storageGenerationId,
      );
      const targetStorageGenerationId = requiredIdentifier(
        input.targetStorageGenerationId,
      );
      if (storageGenerationId === targetStorageGenerationId) {
        throw new ProjectDriveOperationInputError("invalid-shape");
      }
      return {
        operationKind: "storage_handover",
        workspaceId: requiredIdentifier(input.workspaceId),
        connectionId: requiredIdentifier(input.connectionId),
        storageGenerationId,
        targetStorageGenerationId,
      };
    }
    default:
      throw new ProjectDriveOperationInputError("invalid-shape");
  }
}

function identityColumns(
  input: ProjectDriveOperationPrepareInput,
): OperationIdentityColumns {
  const empty: OperationIdentityColumns = {
    connectionId: null,
    storageGenerationId: null,
    targetStorageGenerationId: null,
    subjectUserId: null,
    granteeEmail: null,
    grantRole: null,
    workspaceRevision: null,
  };
  switch (input.operationKind) {
    case "folder_provision":
      return {
        ...empty,
        connectionId: input.connectionId,
        targetStorageGenerationId: input.targetStorageGenerationId,
      };
    case "grant_create":
      return {
        ...empty,
        storageGenerationId: input.storageGenerationId,
        subjectUserId: input.subjectUserId,
        granteeEmail: input.granteeEmail,
        grantRole: input.grantRole,
      };
    case "folder_rename":
      return {
        ...empty,
        storageGenerationId: input.storageGenerationId,
        workspaceRevision: input.workspaceRevision,
      };
    case "project_delete":
      return empty;
    case "storage_handover":
      return {
        ...empty,
        connectionId: input.connectionId,
        storageGenerationId: input.storageGenerationId,
        targetStorageGenerationId: input.targetStorageGenerationId,
      };
  }
}

function rowMatchesInput(
  row: OperationRow,
  input: ProjectDriveOperationPrepareInput,
  dedupeKey: string,
): boolean {
  const expected = identityColumns(input);
  return (
    row.workspaceId === input.workspaceId &&
    row.operationKind === input.operationKind &&
    row.dedupeKey === dedupeKey &&
    row.connectionId === expected.connectionId &&
    row.storageGenerationId === expected.storageGenerationId &&
    row.targetStorageGenerationId === expected.targetStorageGenerationId &&
    row.subjectUserId === expected.subjectUserId &&
    row.granteeEmail === expected.granteeEmail &&
    row.grantRole === expected.grantRole &&
    row.workspaceRevision === expected.workspaceRevision
  );
}

function receiptFromRow(
  row: OperationRow,
): ProjectDriveFolderReceipt | ProjectDrivePermissionReceipt | null {
  if (
    (row.operationKind === "folder_provision" ||
      row.operationKind === "storage_handover") &&
    row.providerFolderId &&
    row.providerFolderWebViewLink
  ) {
    return Object.freeze({
      providerFolderId: row.providerFolderId,
      providerFolderWebViewLink: row.providerFolderWebViewLink,
    });
  }
  if (row.operationKind === "grant_create" && row.providerPermissionId) {
    return Object.freeze({
      providerPermissionId: row.providerPermissionId,
    });
  }
  return null;
}

function viewFromRow(row: OperationRow): ProjectDriveOperationView {
  return Object.freeze({
    operationId: row.id,
    workspaceId: row.workspaceId,
    operationKind: row.operationKind,
    status: row.status,
    attemptCount: row.attemptCount,
    nextAttemptAt: row.nextAttemptAt,
    leaseExpiresAt: row.leaseExpiresAt,
    lastErrorCode: row.lastErrorCode,
    completedAt: row.completedAt,
    receipt: receiptFromRow(row),
  });
}

function claimFromRow(row: OperationRow): ProjectDriveOperationClaim {
  if (!row.leaseExpiresAt || row.attemptCount < 1) {
    throw new ProjectDriveOperationIntegrityError();
  }
  const base: ClaimBase = {
    operationId: row.id,
    workspaceId: row.workspaceId,
    attemptFence: row.attemptCount,
    leaseExpiresAt: row.leaseExpiresAt,
  };
  switch (row.operationKind) {
    case "folder_provision":
      if (!row.connectionId || !row.targetStorageGenerationId) {
        throw new ProjectDriveOperationIntegrityError();
      }
      return Object.freeze({
        ...base,
        operationKind: "folder_provision",
        connectionId: row.connectionId,
        targetStorageGenerationId: row.targetStorageGenerationId,
      });
    case "grant_create":
      if (
        !row.storageGenerationId ||
        !row.subjectUserId ||
        !row.granteeEmail ||
        (row.grantRole !== "writer" && row.grantRole !== "reader")
      ) {
        throw new ProjectDriveOperationIntegrityError();
      }
      return Object.freeze({
        ...base,
        operationKind: "grant_create",
        storageGenerationId: row.storageGenerationId,
        subjectUserId: row.subjectUserId,
        granteeEmail: row.granteeEmail,
        grantRole: row.grantRole,
      });
    case "folder_rename":
      if (!row.storageGenerationId || !row.workspaceRevision) {
        throw new ProjectDriveOperationIntegrityError();
      }
      return Object.freeze({
        ...base,
        operationKind: "folder_rename",
        storageGenerationId: row.storageGenerationId,
        workspaceRevision: row.workspaceRevision,
      });
    case "project_delete":
      return Object.freeze({ ...base, operationKind: "project_delete" });
    case "storage_handover":
      if (
        !row.connectionId ||
        !row.storageGenerationId ||
        !row.targetStorageGenerationId
      ) {
        throw new ProjectDriveOperationIntegrityError();
      }
      return Object.freeze({
        ...base,
        operationKind: "storage_handover",
        connectionId: row.connectionId,
        storageGenerationId: row.storageGenerationId,
        targetStorageGenerationId: row.targetStorageGenerationId,
      });
  }
}

type CanonicalCompletion = Readonly<{
  workspaceId: string;
  operationId: string;
  attemptFence: number;
  operationKind: ProjectDriveOperationKind;
  providerFolderId: string | null;
  providerFolderWebViewLink: string | null;
  providerPermissionId: string | null;
}>;

function canonicalCompletion(
  input: ProjectDriveOperationCompleteInput,
): CanonicalCompletion {
  assertExactKeys(input, [
    "workspaceId",
    "operationId",
    "attemptFence",
    "operationKind",
    "receipt",
  ]);
  const base = {
    workspaceId: requiredIdentifier(input.workspaceId),
    operationId: requiredIdentifier(input.operationId),
    attemptFence: requiredPositiveInteger(input.attemptFence),
  };

  switch (input.operationKind) {
    case "folder_provision":
    case "storage_handover":
      assertExactKeys(input.receipt, [
        "providerFolderId",
        "providerFolderWebViewLink",
      ]);
      return {
        ...base,
        operationKind: input.operationKind,
        providerFolderId: stableProviderId(input.receipt.providerFolderId),
        providerFolderWebViewLink: stableWebViewLink(
          input.receipt.providerFolderWebViewLink,
        ),
        providerPermissionId: null,
      };
    case "grant_create":
      assertExactKeys(input.receipt, ["providerPermissionId"]);
      return {
        ...base,
        operationKind: "grant_create",
        providerFolderId: null,
        providerFolderWebViewLink: null,
        providerPermissionId: stableProviderId(
          input.receipt.providerPermissionId,
        ),
      };
    case "folder_rename":
    case "project_delete":
      assertExactKeys(input.receipt, []);
      return {
        ...base,
        operationKind: input.operationKind,
        providerFolderId: null,
        providerFolderWebViewLink: null,
        providerPermissionId: null,
      };
    default:
      throw new ProjectDriveOperationInputError("invalid-shape");
  }
}

function rowHasCompletion(row: OperationRow, input: CanonicalCompletion) {
  return (
    row.workspaceId === input.workspaceId &&
    row.id === input.operationId &&
    row.operationKind === input.operationKind &&
    row.attemptCount === input.attemptFence &&
    row.status === "succeeded" &&
    row.providerFolderId === input.providerFolderId &&
    row.providerFolderWebViewLink === input.providerFolderWebViewLink &&
    row.providerPermissionId === input.providerPermissionId
  );
}

function canonicalFailure(
  input: ProjectDriveOperationFailureInput,
): ProjectDriveOperationFailureInput {
  assertExactKeys(input, [
    "workspaceId",
    "operationId",
    "attemptFence",
    "errorCode",
  ]);
  return {
    workspaceId: requiredIdentifier(input.workspaceId),
    operationId: requiredIdentifier(input.operationId),
    attemptFence: requiredPositiveInteger(input.attemptFence),
    errorCode: normalizedErrorCode(input.errorCode),
  };
}

function canonicalFence(
  input: ProjectDriveOperationFenceInput,
): ProjectDriveOperationFenceInput {
  assertExactKeys(input, ["workspaceId", "operationId", "attemptFence"]);
  return {
    workspaceId: requiredIdentifier(input.workspaceId),
    operationId: requiredIdentifier(input.operationId),
    attemptFence: requiredPositiveInteger(input.attemptFence),
  };
}

function canonicalRearm(
  input: ProjectDriveOperationRearmInput,
): ProjectDriveOperationRearmInput {
  assertExactKeys(input, [
    "workspaceId",
    "operationId",
    "operationKind",
    "previousAttemptFence",
    "previousReceipt",
  ]);
  const base = {
    workspaceId: requiredIdentifier(input.workspaceId),
    operationId: requiredIdentifier(input.operationId),
  };
  switch (input.operationKind) {
    case "grant_create":
      assertExactKeys(input.previousReceipt, ["providerPermissionId"]);
      return {
        ...base,
        operationKind: "grant_create",
        previousAttemptFence: requiredPositiveInteger(
          input.previousAttemptFence,
        ),
        previousReceipt: {
          providerPermissionId: stableProviderId(
            input.previousReceipt.providerPermissionId,
          ),
        },
      };
    case "project_delete":
      assertExactKeys(input.previousReceipt, []);
      if (input.previousAttemptFence !== 0) {
        throw new ProjectDriveOperationInputError("invalid-shape");
      }
      return {
        ...base,
        operationKind: "project_delete",
        previousAttemptFence: 0,
        previousReceipt: {},
      };
    default:
      throw new ProjectDriveOperationInputError("invalid-shape");
  }
}

/**
 * Durable, provider-agnostic control plane for Project Drive operations.
 *
 * The journal deliberately never accepts raw provider responses, OAuth
 * credentials, access tokens, or resumable-session URLs. Callers pass only a
 * canonical operation identity before provider work and the minimal stable
 * receipt afterwards. Every state-changing worker call is fenced by the
 * monotonically increasing attempt count. Lease, due-time, and transition
 * comparisons use SQLite/libSQL `unixepoch()` inside the same statement as
 * the CAS, so a skewed application-host clock can never reclaim work early.
 */
export function createProjectDriveOperationJournal(
  deps: ProjectDriveOperationJournalDependencies,
) {
  const leaseDurationMs = boundedDuration(
    deps.leaseDurationMs ?? DEFAULT_LEASE_MS,
    MIN_LEASE_MS,
    MAX_LEASE_MS,
  );
  const randomOperationId = deps.randomOperationId ?? randomUUID;

  async function readByDedupe(workspaceId: string, dedupeKey: string) {
    const [row] = await deps.database
      .select()
      .from(projectDriveOperations)
      .where(
        byWorkspace(
          projectDriveOperations.workspaceId,
          workspaceId,
          eq(projectDriveOperations.dedupeKey, dedupeKey),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async function readById(workspaceId: string, operationId: string) {
    const [row] = await deps.database
      .select()
      .from(projectDriveOperations)
      .where(
        byWorkspace(
          projectDriveOperations.workspaceId,
          workspaceId,
          eq(projectDriveOperations.id, operationId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  return Object.freeze({
    async prepare(input: ProjectDriveOperationPrepareInput): Promise<
      | Readonly<{
          outcome: "prepared" | "existing";
          operation: ProjectDriveOperationView;
        }>
      | ProjectDriveOperationConflict
    > {
      const canonical = canonicalPrepareInput(input);
      const dedupeKey = projectDriveOperationDedupeKey(canonical);
      const prior = await readByDedupe(canonical.workspaceId, dedupeKey);
      if (prior) {
        if (!rowMatchesInput(prior, canonical, dedupeKey)) {
          return NEUTRAL_CONFLICT;
        }
        return Object.freeze({
          outcome: "existing",
          operation: viewFromRow(prior),
        });
      }
      const operationId = requiredIdentifier(randomOperationId());
      const identity = identityColumns(canonical);
      const values: OperationInsert = {
        id: operationId,
        workspaceId: canonical.workspaceId,
        operationKind: canonical.operationKind,
        status: "pending",
        dedupeKey,
        ...identity,
        providerFolderId: null,
        providerFolderWebViewLink: null,
        providerPermissionId: null,
        attemptCount: 0,
        lastAttemptAt: null,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        completedAt: null,
      };
      const inserted = await deps.database
        .insert(projectDriveOperations)
        .values(values)
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        return Object.freeze({
          outcome: "prepared",
          operation: viewFromRow(inserted[0]),
        });
      }

      const existing = await readByDedupe(canonical.workspaceId, dedupeKey);
      if (!existing || !rowMatchesInput(existing, canonical, dedupeKey)) {
        return NEUTRAL_CONFLICT;
      }
      return Object.freeze({
        outcome: "existing",
        operation: viewFromRow(existing),
      });
    },

    async claim(
      input: Readonly<{ workspaceId: string; operationId: string }>,
    ): Promise<
      | Readonly<{ outcome: "claimed"; claim: ProjectDriveOperationClaim }>
      | ProjectDriveOperationConflict
    > {
      assertExactKeys(input, ["workspaceId", "operationId"]);
      const workspaceId = requiredIdentifier(input.workspaceId);
      const operationId = requiredIdentifier(input.operationId);
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const leaseExpiresAt = sql<Date>`(${now}) + ${leaseDurationMs / 1_000}`;
      const [claimed] = await deps.database
        .update(projectDriveOperations)
        .set({
          status: "running",
          attemptCount: sql<number>`${projectDriveOperations.attemptCount} + 1`,
          lastAttemptAt: now,
          nextAttemptAt: null,
          leaseExpiresAt,
          lastErrorCode: null,
          updatedAt: now,
        })
        .where(
          byWorkspace(
            projectDriveOperations.workspaceId,
            workspaceId,
            eq(projectDriveOperations.id, operationId),
            lte(projectDriveOperations.createdAt, now),
            inArray(projectDriveOperations.status, [
              ...GOOGLE_DRIVE_OPERATION_CLAIMABLE_STATUSES,
            ]),
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
          ),
        )
        .returning();
      if (!claimed) return NEUTRAL_CONFLICT;
      return Object.freeze({
        outcome: "claimed",
        claim: claimFromRow(claimed),
      });
    },

    async complete(input: ProjectDriveOperationCompleteInput): Promise<
      | Readonly<{
          outcome: "completed";
          replayed: boolean;
          operation: ProjectDriveOperationView;
        }>
      | ProjectDriveOperationConflict
    > {
      const canonical = canonicalCompletion(input);
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const [completed] = await deps.database
        .update(projectDriveOperations)
        .set({
          status: "succeeded",
          providerFolderId: canonical.providerFolderId,
          providerFolderWebViewLink: canonical.providerFolderWebViewLink,
          providerPermissionId: canonical.providerPermissionId,
          nextAttemptAt: null,
          leaseExpiresAt: null,
          lastErrorCode: null,
          updatedAt: now,
          completedAt: now,
        })
        .where(
          byWorkspace(
            projectDriveOperations.workspaceId,
            canonical.workspaceId,
            eq(projectDriveOperations.id, canonical.operationId),
            eq(projectDriveOperations.operationKind, canonical.operationKind),
            eq(projectDriveOperations.status, "running"),
            eq(projectDriveOperations.attemptCount, canonical.attemptFence),
            lte(projectDriveOperations.lastAttemptAt, now),
            gt(projectDriveOperations.leaseExpiresAt, now),
            isNull(projectDriveOperations.providerFolderId),
            isNull(projectDriveOperations.providerFolderWebViewLink),
            isNull(projectDriveOperations.providerPermissionId),
          ),
        )
        .returning();
      if (completed) {
        return Object.freeze({
          outcome: "completed",
          replayed: false,
          operation: viewFromRow(completed),
        });
      }

      const existing = await readById(
        canonical.workspaceId,
        canonical.operationId,
      );
      if (!existing || !rowHasCompletion(existing, canonical)) {
        return NEUTRAL_CONFLICT;
      }
      return Object.freeze({
        outcome: "completed",
        replayed: true,
        operation: viewFromRow(existing),
      });
    },

    async scheduleRetry(input: ProjectDriveOperationRetryInput): Promise<
      | Readonly<{
          outcome: "retry_scheduled";
          operation: ProjectDriveOperationView;
        }>
      | ProjectDriveOperationConflict
    > {
      assertExactKeys(input, [
        "workspaceId",
        "operationId",
        "attemptFence",
        "errorCode",
        "retryAfterMs",
      ]);
      const failure = canonicalFailure({
        workspaceId: input.workspaceId,
        operationId: input.operationId,
        attemptFence: input.attemptFence,
        errorCode: input.errorCode,
      });
      const retryAfterMs = boundedDuration(
        input.retryAfterMs,
        MIN_RETRY_MS,
        MAX_RETRY_MS,
      );
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const nextAttemptAt = sql<Date>`(${now}) + ${retryAfterMs / 1_000}`;
      const [scheduled] = await deps.database
        .update(projectDriveOperations)
        .set({
          status: "retry_wait",
          nextAttemptAt,
          leaseExpiresAt: null,
          lastErrorCode: failure.errorCode,
          updatedAt: now,
        })
        .where(
          byWorkspace(
            projectDriveOperations.workspaceId,
            failure.workspaceId,
            eq(projectDriveOperations.id, failure.operationId),
            eq(projectDriveOperations.status, "running"),
            eq(projectDriveOperations.attemptCount, failure.attemptFence),
            lte(projectDriveOperations.lastAttemptAt, now),
            gt(projectDriveOperations.leaseExpiresAt, now),
            isNull(projectDriveOperations.providerFolderId),
            isNull(projectDriveOperations.providerFolderWebViewLink),
            isNull(projectDriveOperations.providerPermissionId),
          ),
        )
        .returning();
      if (!scheduled) return NEUTRAL_CONFLICT;
      return Object.freeze({
        outcome: "retry_scheduled",
        operation: viewFromRow(scheduled),
      });
    },

    async markManualAttention(
      input: ProjectDriveOperationFailureInput,
    ): Promise<
      | Readonly<{
          outcome: "manual_attention";
          operation: ProjectDriveOperationView;
        }>
      | ProjectDriveOperationConflict
    > {
      const failure = canonicalFailure(input);
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const [marked] = await deps.database
        .update(projectDriveOperations)
        .set({
          status: "manual_attention",
          nextAttemptAt: null,
          leaseExpiresAt: null,
          lastErrorCode: failure.errorCode,
          updatedAt: now,
        })
        .where(
          byWorkspace(
            projectDriveOperations.workspaceId,
            failure.workspaceId,
            eq(projectDriveOperations.id, failure.operationId),
            eq(projectDriveOperations.status, "running"),
            eq(projectDriveOperations.attemptCount, failure.attemptFence),
            lte(projectDriveOperations.lastAttemptAt, now),
            gt(projectDriveOperations.leaseExpiresAt, now),
            isNull(projectDriveOperations.providerFolderId),
            isNull(projectDriveOperations.providerFolderWebViewLink),
            isNull(projectDriveOperations.providerPermissionId),
          ),
        )
        .returning();
      if (!marked) return NEUTRAL_CONFLICT;
      return Object.freeze({
        outcome: "manual_attention",
        operation: viewFromRow(marked),
      });
    },

    /**
     * Explicitly returns an operator-reviewed row to the claim queue.
     * `manual_attention` is a durable fence, not a terminal sink: only this
     * exact attempt can requeue it, and the next claim receives a new fence.
     */
    async requeueManualAttention(
      input: ProjectDriveOperationFenceInput,
    ): Promise<
      | Readonly<{
          outcome: "requeued";
          operation: ProjectDriveOperationView;
        }>
      | ProjectDriveOperationConflict
    > {
      const fence = canonicalFence(input);
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const [requeued] = await deps.database
        .update(projectDriveOperations)
        .set({
          status: "pending",
          nextAttemptAt: null,
          leaseExpiresAt: null,
          updatedAt: now,
        })
        .where(
          byWorkspace(
            projectDriveOperations.workspaceId,
            fence.workspaceId,
            eq(projectDriveOperations.id, fence.operationId),
            eq(projectDriveOperations.status, "manual_attention"),
            eq(projectDriveOperations.attemptCount, fence.attemptFence),
            lte(projectDriveOperations.lastAttemptAt, now),
            lte(projectDriveOperations.updatedAt, now),
            isNull(projectDriveOperations.providerFolderId),
            isNull(projectDriveOperations.providerFolderWebViewLink),
            isNull(projectDriveOperations.providerPermissionId),
          ),
        )
        .returning();
      if (!requeued) return NEUTRAL_CONFLICT;
      return Object.freeze({
        outcome: "requeued",
        operation: viewFromRow(requeued),
      });
    },

    /**
     * Starts a new lifecycle cycle without weakening the unique dedupe key.
     *
     * Migration 0029 has no lifecycle-cycle column. The safe no-migration
     * alternative is an explicit terminal-state CAS which rotates the row's
     * primary operation id. The unchanged dedupe key still finds the logical
     * operation, while the new id is an unambiguous lifecycle intent and makes
     * every worker from the prior cycle stale. A
     * caller may rearm a successful grant only after it has proved the exact
     * permission was revoked and removed the domain receipt, in the same
     * database transaction. A cancelled, never-started project deletion can
     * likewise be restarted. Other kinds cannot be rearmed because their
     * generation/revision identity must change instead.
     */
    async rearmLifecycleOperation(
      input: ProjectDriveOperationRearmInput,
    ): Promise<
      | Readonly<{
          outcome: "rearmed";
          operation: ProjectDriveOperationView;
        }>
      | ProjectDriveOperationConflict
    > {
      const canonical = canonicalRearm(input);
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const nextOperationId = requiredIdentifier(randomOperationId());
      if (nextOperationId === canonical.operationId) {
        throw new ProjectDriveOperationInputError("invalid-identifier");
      }
      const terminalPredicate =
        canonical.operationKind === "grant_create"
          ? and(
              eq(projectDriveOperations.operationKind, "grant_create"),
              eq(projectDriveOperations.status, "succeeded"),
              eq(
                projectDriveOperations.attemptCount,
                canonical.previousAttemptFence,
              ),
              eq(
                projectDriveOperations.providerPermissionId,
                canonical.previousReceipt.providerPermissionId,
              ),
              isNull(projectDriveOperations.providerFolderId),
              isNull(projectDriveOperations.providerFolderWebViewLink),
            )
          : and(
              eq(projectDriveOperations.operationKind, "project_delete"),
              eq(projectDriveOperations.status, "cancelled"),
              eq(projectDriveOperations.attemptCount, 0),
              isNull(projectDriveOperations.lastAttemptAt),
              isNull(projectDriveOperations.providerFolderId),
              isNull(projectDriveOperations.providerFolderWebViewLink),
              isNull(projectDriveOperations.providerPermissionId),
            );
      const [rearmed] = await deps.database
        .update(projectDriveOperations)
        .set({
          id: nextOperationId,
          status: "pending",
          attemptCount: 0,
          lastAttemptAt: null,
          nextAttemptAt: null,
          leaseExpiresAt: null,
          lastErrorCode: null,
          providerFolderId: null,
          providerFolderWebViewLink: null,
          providerPermissionId: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        })
        .where(
          byWorkspace(
            projectDriveOperations.workspaceId,
            canonical.workspaceId,
            eq(projectDriveOperations.id, canonical.operationId),
            terminalPredicate,
            lte(projectDriveOperations.updatedAt, now),
          ),
        )
        .returning();
      if (rearmed) {
        return Object.freeze({
          outcome: "rearmed",
          operation: viewFromRow(rearmed),
        });
      }
      return NEUTRAL_CONFLICT;
    },

    async cancelUnstarted(
      input: Readonly<{ workspaceId: string; operationId: string }>,
    ): Promise<
      | Readonly<{
          outcome: "cancelled";
          replayed: boolean;
          operation: ProjectDriveOperationView;
        }>
      | ProjectDriveOperationConflict
    > {
      assertExactKeys(input, ["workspaceId", "operationId"]);
      const workspaceId = requiredIdentifier(input.workspaceId);
      const operationId = requiredIdentifier(input.operationId);
      const now = databaseNowSeconds(deps.databaseNowSeconds);
      const [cancelled] = await deps.database
        .update(projectDriveOperations)
        .set({
          status: "cancelled",
          updatedAt: now,
          completedAt: now,
        })
        .where(
          byWorkspace(
            projectDriveOperations.workspaceId,
            workspaceId,
            eq(projectDriveOperations.id, operationId),
            eq(projectDriveOperations.status, "pending"),
            eq(projectDriveOperations.attemptCount, 0),
            isNull(projectDriveOperations.lastAttemptAt),
            isNull(projectDriveOperations.providerFolderId),
            isNull(projectDriveOperations.providerFolderWebViewLink),
            isNull(projectDriveOperations.providerPermissionId),
            lte(projectDriveOperations.createdAt, now),
          ),
        )
        .returning();
      if (cancelled) {
        return Object.freeze({
          outcome: "cancelled",
          replayed: false,
          operation: viewFromRow(cancelled),
        });
      }

      const existing = await readById(workspaceId, operationId);
      if (
        !existing ||
        existing.status !== "cancelled" ||
        existing.attemptCount !== 0 ||
        existing.lastAttemptAt !== null ||
        existing.providerFolderId !== null ||
        existing.providerFolderWebViewLink !== null ||
        existing.providerPermissionId !== null
      ) {
        return NEUTRAL_CONFLICT;
      }
      return Object.freeze({
        outcome: "cancelled",
        replayed: true,
        operation: viewFromRow(existing),
      });
    },
  });
}

export const projectDriveOperationJournal = createProjectDriveOperationJournal({
  database: db,
});
