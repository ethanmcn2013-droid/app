import "server-only";

import { createHash } from "node:crypto";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import {
  attachments,
  meta,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import { claimPathname } from "@/lib/attachment-claim";
import {
  assertProjectNotDeleting,
  ProjectDeletionInProgressError,
} from "@/server/projects/project-deletion-fence";
import { googleDriveAccountErasureFenceKey } from "@/server/connections/project-drive-operation-lifecycle";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-lifecycle";
import {
  stageNativeByteCleanupReceipts,
  stageNativeByteCleanupTargets,
  type NativeByteCleanupTarget,
} from "./native-byte-cleanup";

type NativeUploadDb = LibSQLDatabase<typeof schema>;
type NativeUploadWriter = Pick<
  NativeUploadDb,
  "delete" | "get" | "insert" | "select" | "update"
>;

const CLAIM_VERSION = 1 as const;
/**
 * Keep deletion fenced after a signed writer stops admitting new requests.
 * A PUT admitted immediately before expiry may still be in flight, and the
 * database/provider clocks need not turn over on the same millisecond.
 */
export const NATIVE_UPLOAD_IN_FLIGHT_DRAIN_MS = 30 * 60_000;
export const NATIVE_UPLOAD_CLAIM_META_PREFIX =
  "native-upload:claim:v1:";

type NativeUploadClaimReceipt = Readonly<{
  version: typeof CLAIM_VERSION;
  workspaceId: string;
  attachmentId: string;
  pathname: string;
  authorityExpiresAt: number;
  custodyExpiresAt: number;
  state: "pending" | "rejected";
  cleanupTarget: Extract<
    NativeByteCleanupTarget,
    { kind: "blob-pathname" | "disk-key" }
  >;
}>;

export type NativeUploadClaimInput = Readonly<{
  workspaceId: string;
  attachmentId: string;
  pathname: string;
  /** Exact expiry used by the authority that can write this pathname. */
  authorityExpiresAt: number;
  /** Backend authority fixed when the write capability is created. */
  cleanupTargetKind: "blob-pathname" | "disk-key";
}>;

export type NativeUploadFinalizationInput = Omit<
  NativeUploadClaimInput,
  "authorityExpiresAt" | "cleanupTargetKind"
> &
  Readonly<{
    uploaderUserId: string;
    finalStoredPath: string;
    mimeType: string;
    sizeBytes: number;
  }>;

export type NativeUploadFinalizationOutcome =
  | "completed"
  | "already-completed"
  | "lost";

export class NativeUploadInProgressError extends Error {
  readonly code = "native-upload-in-progress" as const;

  constructor() {
    super("A Signal-native attachment upload is in progress.");
    this.name = "NativeUploadInProgressError";
  }
}

export class NativeUploadClaimStartError extends Error {
  readonly code:
    | "account-erasure-in-progress"
    | "parent-changed"
    | "project-deleting";

  constructor(code: NativeUploadClaimStartError["code"]) {
    super("The attachment upload cannot start right now.");
    this.name = "NativeUploadClaimStartError";
    this.code = code;
  }
}

function canonicalId(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.includes("://")
  ) {
    throw new TypeError(`${label} must be a canonical id`);
  }
  return value;
}

function canonicalPath(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 16_384 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(`${label} must be an exact non-empty locator`);
  }
  return value;
}

function workspaceDigest(workspaceId: string): string {
  return createHash("sha256")
    .update(JSON.stringify(["native-upload-claim", CLAIM_VERSION, workspaceId]))
    .digest("hex");
}

export function nativeUploadClaimPrefix(workspaceIdInput: string): string {
  const workspaceId = canonicalId(workspaceIdInput, "workspaceId");
  return `${NATIVE_UPLOAD_CLAIM_META_PREFIX}${workspaceDigest(workspaceId)}:`;
}

export function nativeUploadClaimKey(
  workspaceIdInput: string,
  attachmentIdInput: string,
): string {
  const workspaceId = canonicalId(workspaceIdInput, "workspaceId");
  const attachmentId = canonicalId(attachmentIdInput, "attachmentId");
  return `${nativeUploadClaimPrefix(workspaceId)}${attachmentId}`;
}

function canonicalClaim(
  input: NativeUploadClaimInput &
    Readonly<{
      state?: NativeUploadClaimReceipt["state"];
      custodyExpiresAt?: number;
    }>,
): NativeUploadClaimReceipt {
  if (
    !Number.isSafeInteger(input.authorityExpiresAt) ||
    input.authorityExpiresAt <= 0 ||
    input.authorityExpiresAt >
      Number.MAX_SAFE_INTEGER - NATIVE_UPLOAD_IN_FLIGHT_DRAIN_MS
  ) {
    throw new TypeError("authorityExpiresAt must be a positive epoch millisecond");
  }
  const custodyExpiresAt =
    input.authorityExpiresAt + NATIVE_UPLOAD_IN_FLIGHT_DRAIN_MS;
  if (
    input.custodyExpiresAt !== undefined &&
    input.custodyExpiresAt !== custodyExpiresAt
  ) {
    throw new TypeError("native upload custody deadline is invalid");
  }
  const pathname = canonicalPath(input.pathname, "pathname");
  if (
    input.cleanupTargetKind !== "blob-pathname" &&
    input.cleanupTargetKind !== "disk-key"
  ) {
    throw new TypeError("cleanupTargetKind must identify one exact backend");
  }
  if (
    input.state !== undefined &&
    input.state !== "pending" &&
    input.state !== "rejected"
  ) {
    throw new TypeError("native upload claim state is invalid");
  }
  return Object.freeze({
    version: CLAIM_VERSION,
    workspaceId: canonicalId(input.workspaceId, "workspaceId"),
    attachmentId: canonicalId(input.attachmentId, "attachmentId"),
    pathname,
    authorityExpiresAt: input.authorityExpiresAt,
    custodyExpiresAt,
    state: input.state ?? "pending",
    cleanupTarget: Object.freeze({
      kind: input.cleanupTargetKind,
      locator: pathname,
    }),
  });
}

function parseClaim(value: string): NativeUploadClaimReceipt {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new TypeError("invalid native upload claim receipt");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("invalid native upload claim receipt");
  }
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== CLAIM_VERSION) {
    throw new TypeError("invalid native upload claim receipt");
  }
  const cleanupTarget = candidate.cleanupTarget;
  if (
    !cleanupTarget ||
    typeof cleanupTarget !== "object" ||
    Array.isArray(cleanupTarget)
  ) {
    throw new TypeError("invalid native upload claim receipt");
  }
  const claim = canonicalClaim({
    workspaceId: candidate.workspaceId as string,
    attachmentId: candidate.attachmentId as string,
    pathname: candidate.pathname as string,
    authorityExpiresAt: candidate.authorityExpiresAt as number,
    custodyExpiresAt: candidate.custodyExpiresAt as number,
    state: candidate.state as NativeUploadClaimReceipt["state"],
    cleanupTargetKind: (cleanupTarget as { kind?: unknown })
      .kind as NativeUploadClaimInput["cleanupTargetKind"],
  });
  if ((cleanupTarget as { locator?: unknown }).locator !== claim.pathname) {
    throw new TypeError("invalid native upload claim receipt");
  }
  return claim;
}

/**
 * Re-prove the claim's parent and both account-erasure fence layers in the
 * same immediate writer transaction that will persist upload authority.
 */
export async function assertNativeUploadClaimCanStart(
  transaction: NativeUploadWriter,
  input: Readonly<{
    workspaceId: string;
    taskId: string;
    actorUserId: string;
  }>,
): Promise<void> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const taskId = canonicalId(input.taskId, "taskId");
  const actorUserId = canonicalId(input.actorUserId, "actorUserId");
  try {
    await assertProjectNotDeleting(transaction, workspaceId);
  } catch (error) {
    if (error instanceof ProjectDeletionInProgressError) {
      throw new NativeUploadClaimStartError("project-deleting");
    }
    throw error;
  }

  const [parent] = await transaction
    .select({ ownerUserId: workspaces.ownerUserId })
    .from(tasks)
    .innerJoin(workspaces, eq(workspaces.id, tasks.workspaceId))
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.workspaceId, workspaceId),
        eq(workspaces.id, workspaceId),
      ),
    )
    .limit(1);
  if (!parent?.ownerUserId) {
    throw new NativeUploadClaimStartError("parent-changed");
  }

  const userIds = [...new Set([actorUserId, parent.ownerUserId])];
  const memberships = await transaction
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        inArray(workspaceMembers.userId, userIds),
      ),
    );
  const actorMembership = memberships.find(
    (membership) => membership.userId === actorUserId,
  );
  const ownerMembership = memberships.find(
    (membership) => membership.userId === parent.ownerUserId,
  );
  if (
    !actorMembership ||
    (actorMembership.role !== "owner" && actorMembership.role !== "member") ||
    ownerMembership?.role !== "owner"
  ) {
    throw new NativeUploadClaimStartError("parent-changed");
  }

  const identities = await transaction
    .select({ id: users.id, clerkId: users.clerkId })
    .from(users)
    .where(inArray(users.id, userIds));
  if (
    !userIds.every((id) =>
      identities.some(
        (identity) => identity.id === id && Boolean(identity.clerkId),
      ),
    )
  ) {
    throw new NativeUploadClaimStartError("parent-changed");
  }

  const fenceKeys = [
    ...userIds.map(googleDriveAccountErasureFenceKey),
    ...identities.map((identity) =>
      accountDeletionTombstoneKey(identity.clerkId!),
    ),
  ];
  const [fence] = await transaction
    .select({ key: meta.key })
    .from(meta)
    .where(inArray(meta.key, fenceKeys))
    .limit(1);
  if (fence) {
    throw new NativeUploadClaimStartError("account-erasure-in-progress");
  }
}

/**
 * Pair a not-yet-materialized attachment row with a durable in-flight marker.
 * The caller owns the immediate transaction that inserted the row; deletion
 * can therefore commit its tombstone either before both writes or after both,
 * never between them.
 */
export async function recordNativeUploadClaimInTransaction(
  transaction: NativeUploadWriter,
  input: NativeUploadClaimInput,
): Promise<void> {
  const claim = canonicalClaim(input);
  const [attachment] = await transaction
    .select({
      taskId: attachments.taskId,
      uploaderUserId: attachments.uploaderUserId,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.id, claim.attachmentId),
        eq(attachments.workspaceId, claim.workspaceId),
        eq(attachments.storedPath, claim.pathname),
      ),
    )
    .limit(1);
  if (!attachment) {
    throw new NativeUploadClaimStartError("parent-changed");
  }
  await assertNativeUploadClaimCanStart(transaction, {
    workspaceId: claim.workspaceId,
    taskId: attachment.taskId,
    actorUserId: attachment.uploaderUserId,
  });
  const inserted = await transaction
    .insert(meta)
    .values({
      key: nativeUploadClaimKey(claim.workspaceId, claim.attachmentId),
      value: JSON.stringify(claim),
    })
    .onConflictDoNothing()
    .returning({ key: meta.key });
  if (inserted.length !== 1) {
    throw new Error("native upload claim already exists");
  }
}

export async function nativeUploadClaimCleanupTargetInTransaction(
  transaction: NativeUploadWriter,
  input: Readonly<{ workspaceId: string; attachmentId: string }>,
): Promise<NativeByteCleanupTarget | null> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const attachmentId = canonicalId(input.attachmentId, "attachmentId");
  const key = nativeUploadClaimKey(workspaceId, attachmentId);
  const [marker] = await transaction
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key))
    .limit(1);
  if (!marker) return null;
  const claim = parseClaim(marker.value);
  if (
    claim.workspaceId !== workspaceId ||
    claim.attachmentId !== attachmentId
  ) {
    throw new Error("native upload claim conflicted");
  }
  return claim.cleanupTarget;
}

/**
 * Make a provider-rejected direct upload terminal without retiring its live
 * write-authority marker. Project deletion stays fenced through its drain
 * deadline.
 */
export async function rejectNativeUploadClaimInTransaction(
  transaction: NativeUploadWriter,
  input: Readonly<{
    workspaceId: string;
    attachmentId: string;
    pathname: string;
  }>,
): Promise<boolean> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const attachmentId = canonicalId(input.attachmentId, "attachmentId");
  const pathname = canonicalPath(input.pathname, "pathname");
  const key = nativeUploadClaimKey(workspaceId, attachmentId);
  const [marker] = await transaction
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key))
    .limit(1);
  if (!marker) return false;
  const claim = parseClaim(marker.value);
  if (
    claim.workspaceId !== workspaceId ||
    claim.attachmentId !== attachmentId ||
    claim.pathname !== pathname
  ) {
    return false;
  }
  const [placeholder] = await transaction
    .select({ id: attachments.id })
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, workspaceId),
        eq(attachments.storedPath, pathname),
      ),
    )
    .limit(1);
  if (!placeholder) return false;
  if (claim.state === "rejected") return true;

  const rejectedValue = JSON.stringify({ ...claim, state: "rejected" });
  const changed = await transaction
    .update(meta)
    .set({ value: rejectedValue })
    .where(and(eq(meta.key, key), eq(meta.value, marker.value)))
    .returning({ key: meta.key });
  return changed.length === 1;
}

/** A nonterminal marker blocks Project deletion until bytes have a home. */
export async function assertNoPendingNativeUploads(
  transaction: NativeUploadWriter,
  workspaceIdInput: string,
): Promise<readonly string[]> {
  const workspaceId = canonicalId(workspaceIdInput, "workspaceId");
  const prefix = nativeUploadClaimPrefix(workspaceId);
  const cleanupReceiptKeys: string[] = [];
  const claims = await transaction
    .select({ key: meta.key, value: meta.value })
    .from(meta)
    .where(like(meta.key, `${prefix}%`));
  let hasLiveAuthority = false;
  if (claims.length > 0) {
    const clock = await transaction.get<{ now: number }>(
      sql`SELECT unixepoch() AS now`,
    );
    if (!clock || !Number.isFinite(Number(clock.now))) {
      throw new Error("database clock unavailable");
    }
    const databaseNowMs = Number(clock.now) * 1_000;
    for (const row of claims) {
      const claim = parseClaim(row.value);
      if (
        nativeUploadClaimKey(claim.workspaceId, claim.attachmentId) !== row.key
      ) {
        throw new Error("native upload claim conflicted");
      }
      if (claim.custodyExpiresAt > databaseNowMs) {
        hasLiveAuthority = true;
        continue;
      }
      // The exact writer authority and its in-flight drain margin have
      // expired. Preserve its exact pathname in cleanup custody before
      // removing the quota claim and marker. No storage call occurs here.
      cleanupReceiptKeys.push(
        ...(await stageNativeByteCleanupTargets(
          transaction,
          claim.workspaceId,
          [claim.cleanupTarget],
        )),
      );
      const released = await releaseNativeUploadClaimInTransaction(
        transaction,
        claim,
      );
      if (!released) {
        throw new Error("native upload claim conflicted");
      }
    }
  }

  // A claim issued by the immediately previous release has no marker. Its
  // exact placeholder is still recognizable from server-owned row fields, but
  // its authority expiry is unknowable, so deletion must block rather than
  // guess that a possibly-live signed upload is dead.
  const possibleLegacyClaims = await transaction
    .select({
      id: attachments.id,
      taskId: attachments.taskId,
      filename: attachments.filename,
      storedPath: attachments.storedPath,
    })
    .from(attachments)
    .leftJoin(tasks, eq(tasks.id, attachments.taskId))
    .where(
      or(
        eq(attachments.workspaceId, workspaceId),
        eq(tasks.workspaceId, workspaceId),
      ),
    );
  if (
    possibleLegacyClaims.some(
      (row) =>
        row.storedPath ===
        claimPathname(workspaceId, row.taskId, row.id, row.filename),
    )
  ) {
    hasLiveAuthority = true;
  }
  if (hasLiveAuthority) throw new NativeUploadInProgressError();
  return Object.freeze(cleanupReceiptKeys);
}

/**
 * Inspect one exact attachment before account erasure removes it. A current
 * writer keeps the row and marker intact; a markerless placeholder is treated
 * as legacy live authority because its expiry cannot be proved. Once the
 * recorded drain deadline has passed, the exact backend locator is staged and
 * the placeholder plus marker are retired in this same writer transaction.
 */
export async function prepareNativeUploadClaimForDeletionInTransaction(
  transaction: NativeUploadWriter,
  input: Readonly<{ workspaceId: string; attachmentId: string }>,
): Promise<readonly string[]> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const attachmentId = canonicalId(input.attachmentId, "attachmentId");
  const key = nativeUploadClaimKey(workspaceId, attachmentId);
  const [attachment] = await transaction
    .select({
      taskId: attachments.taskId,
      filename: attachments.filename,
      storedPath: attachments.storedPath,
      attachmentWorkspaceId: attachments.workspaceId,
      taskWorkspaceId: tasks.workspaceId,
    })
    .from(attachments)
    .leftJoin(tasks, eq(tasks.id, attachments.taskId))
    .where(eq(attachments.id, attachmentId))
    .limit(1);
  if (!attachment) return Object.freeze([]);
  if (
    attachment.attachmentWorkspaceId !== workspaceId &&
    attachment.taskWorkspaceId !== workspaceId
  ) {
    throw new Error("native upload claim conflicted");
  }

  const [marker] = await transaction
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key))
    .limit(1);
  if (!marker) {
    const expectedPathname = claimPathname(
      workspaceId,
      attachment.taskId,
      attachmentId,
      attachment.filename,
    );
    if (attachment.storedPath === expectedPathname) {
      throw new NativeUploadInProgressError();
    }
    return Object.freeze([]);
  }

  const claim = parseClaim(marker.value);
  if (
    claim.workspaceId !== workspaceId ||
    claim.attachmentId !== attachmentId ||
    claim.pathname !== attachment.storedPath
  ) {
    throw new Error("native upload claim conflicted");
  }
  const clock = await transaction.get<{ now: number }>(
    sql`SELECT unixepoch() AS now`,
  );
  if (!clock || !Number.isFinite(Number(clock.now))) {
    throw new Error("database clock unavailable");
  }
  if (claim.custodyExpiresAt > Number(clock.now) * 1_000) {
    throw new NativeUploadInProgressError();
  }

  const receiptKeys = await stageNativeByteCleanupTargets(
    transaction,
    workspaceId,
    [claim.cleanupTarget],
  );
  const released = await releaseNativeUploadClaimInTransaction(
    transaction,
    claim,
  );
  if (!released) {
    throw new Error("native upload claim conflicted");
  }
  return receiptKeys;
}

export type NativeAttachmentRowDeletionResult = Readonly<{
  deletedAttachmentIds: readonly string[];
  cleanupReceiptKeys: readonly string[];
}>;

/**
 * Transfer an exact set of Signal-native attachment rows into durable byte
 * cleanup custody and remove those rows in the caller's writer transaction.
 * Live, malformed, or markerless writer authority fails closed. An expired
 * writer keeps its backend kind from the claim receipt; a finalized row keeps
 * its exact storedPath. No prefix or parent locator is ever inferred.
 */
export async function deleteNativeAttachmentRowsInTransaction(
  transaction: NativeUploadWriter,
  input: Readonly<{
    workspaceId: string;
    attachmentIds: readonly string[];
  }>,
): Promise<NativeAttachmentRowDeletionResult> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const attachmentIds = [
    ...new Set(
      input.attachmentIds.map((attachmentId) =>
        canonicalId(attachmentId, "attachmentId"),
      ),
    ),
  ];
  if (attachmentIds.length === 0) {
    return Object.freeze({
      deletedAttachmentIds: Object.freeze([]),
      cleanupReceiptKeys: Object.freeze([]),
    });
  }

  const selectRows = () =>
    transaction
      .select({
        id: attachments.id,
        storedPath: attachments.storedPath,
        attachmentWorkspaceId: attachments.workspaceId,
        taskWorkspaceId: tasks.workspaceId,
      })
      .from(attachments)
      .leftJoin(tasks, eq(tasks.id, attachments.taskId))
      .where(inArray(attachments.id, attachmentIds));
  const assertExactWorkspace = (
    rows: Awaited<ReturnType<typeof selectRows>>,
  ) => {
    for (const row of rows) {
      if (
        row.attachmentWorkspaceId &&
        row.taskWorkspaceId &&
        row.attachmentWorkspaceId !== row.taskWorkspaceId
      ) {
        throw new Error("native attachment parent conflicted");
      }
      if (
        (row.attachmentWorkspaceId ?? row.taskWorkspaceId) !== workspaceId
      ) {
        throw new Error("native attachment Project conflicted");
      }
    }
  };

  const candidates = await selectRows();
  assertExactWorkspace(candidates);
  const cleanupReceiptKeys: string[] = [];
  for (const attachment of candidates) {
    cleanupReceiptKeys.push(
      ...(await prepareNativeUploadClaimForDeletionInTransaction(
        transaction,
        { workspaceId, attachmentId: attachment.id },
      )),
    );
  }

  // Expired unfinished claims were retired above. Everything still present is
  // a finalized row whose exact storedPath must enter custody before deletion.
  const finalizedRows = await selectRows();
  assertExactWorkspace(finalizedRows);
  cleanupReceiptKeys.push(
    ...(await stageNativeByteCleanupReceipts(
      transaction,
      workspaceId,
      finalizedRows.map((row) => row.storedPath),
    )),
  );
  const finalizedIds = finalizedRows.map((row) => row.id);
  if (finalizedIds.length > 0) {
    const deleted = await transaction
      .delete(attachments)
      .where(inArray(attachments.id, finalizedIds))
      .returning({ id: attachments.id });
    if (deleted.length !== finalizedIds.length) {
      throw new Error("native attachment deletion conflicted");
    }
  }

  return Object.freeze({
    deletedAttachmentIds: Object.freeze(candidates.map((row) => row.id)),
    cleanupReceiptKeys: Object.freeze(cleanupReceiptKeys),
  });
}

/**
 * Remove only an unfinished claim. The exact placeholder pathname in the
 * receipt is part of the delete predicate, so a stale release cannot delete a
 * finalized attachment whose row now points at real bytes.
 */
export async function releaseNativeUploadClaimInTransaction(
  transaction: NativeUploadWriter,
  input: Readonly<{ workspaceId: string; attachmentId: string }>,
): Promise<boolean> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const attachmentId = canonicalId(input.attachmentId, "attachmentId");
  const key = nativeUploadClaimKey(workspaceId, attachmentId);
  const [row] = await transaction
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key))
    .limit(1);
  if (!row) {
    const [legacy] = await transaction
      .select({
        taskId: attachments.taskId,
        filename: attachments.filename,
        storedPath: attachments.storedPath,
      })
      .from(attachments)
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!legacy) return false;
    const expectedPathname = claimPathname(
      workspaceId,
      legacy.taskId,
      attachmentId,
      legacy.filename,
    );
    if (legacy.storedPath !== expectedPathname) return false;
    const removedLegacy = await transaction
      .delete(attachments)
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.workspaceId, workspaceId),
          eq(attachments.storedPath, expectedPathname),
        ),
      )
      .returning({ id: attachments.id });
    return removedLegacy.length === 1;
  }
  const claim = parseClaim(row.value);
  if (
    claim.workspaceId !== workspaceId ||
    claim.attachmentId !== attachmentId
  ) {
    throw new Error("native upload claim conflicted");
  }
  const removedAttachment = await transaction
    .delete(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, workspaceId),
        eq(attachments.storedPath, claim.pathname),
      ),
    )
    .returning({ id: attachments.id });
  if (removedAttachment.length !== 1) return false;
  const removed = await transaction
    .delete(meta)
    .where(and(eq(meta.key, key), eq(meta.value, row.value)))
    .returning({ key: meta.key });
  if (removed.length !== 1) {
    throw new Error("native upload claim conflicted");
  }
  return true;
}

/**
 * Automated stale-claim cleanup may retire a marked writer only after its
 * in-flight drain deadline. Markerless legacy rows have no trustworthy
 * deadline; their caller must first establish the conservative legacy age
 * cutoff, after which the exact placeholder release below remains safe.
 */
export async function releaseExpiredNativeUploadClaimInTransaction(
  transaction: NativeUploadWriter,
  input: Readonly<{ workspaceId: string; attachmentId: string }>,
): Promise<boolean> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const attachmentId = canonicalId(input.attachmentId, "attachmentId");
  const key = nativeUploadClaimKey(workspaceId, attachmentId);
  const [marker] = await transaction
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key))
    .limit(1);
  if (!marker) {
    return releaseNativeUploadClaimInTransaction(transaction, input);
  }
  const claim = parseClaim(marker.value);
  if (
    claim.workspaceId !== workspaceId ||
    claim.attachmentId !== attachmentId
  ) {
    throw new Error("native upload claim conflicted");
  }
  const clock = await transaction.get<{ now: number }>(
    sql`SELECT unixepoch() AS now`,
  );
  if (!clock || !Number.isFinite(Number(clock.now))) {
    throw new Error("database clock unavailable");
  }
  if (claim.custodyExpiresAt > Number(clock.now) * 1_000) return false;
  return releaseNativeUploadClaimInTransaction(transaction, input);
}

/**
 * Finalize one exact claim behind the deletion tombstone. A successful result
 * means the row CAS and marker removal committed together. A false result
 * means the caller must put the already-written byte under cleanup custody.
 */
export async function finalizeNativeUploadClaimInTransaction(
  transaction: NativeUploadWriter,
  input: NativeUploadFinalizationInput,
): Promise<NativeUploadFinalizationOutcome> {
  const workspaceId = canonicalId(input.workspaceId, "workspaceId");
  const attachmentId = canonicalId(input.attachmentId, "attachmentId");
  const pathname = canonicalPath(input.pathname, "pathname");
  const uploaderUserId = canonicalId(input.uploaderUserId, "uploaderUserId");
  const finalStoredPath = canonicalPath(
    input.finalStoredPath,
    "finalStoredPath",
  );
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new TypeError("sizeBytes must be a positive integer");
  }
  const key = nativeUploadClaimKey(workspaceId, attachmentId);
  const [marker] = await transaction
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key))
    .limit(1);
  if (!marker) {
    const [persisted] = await transaction
      .select({ id: attachments.id })
      .from(attachments)
      .where(
        and(
          eq(attachments.id, attachmentId),
          eq(attachments.workspaceId, workspaceId),
          eq(attachments.uploaderUserId, uploaderUserId),
          eq(attachments.storedPath, finalStoredPath),
        ),
      )
      .limit(1);
    return persisted ? "already-completed" : "lost";
  }
  const recorded = parseClaim(marker.value);
  if (
    recorded.workspaceId !== workspaceId ||
    recorded.attachmentId !== attachmentId ||
    recorded.pathname !== pathname ||
    recorded.state !== "pending"
  ) {
    return "lost";
  }

  const [placeholder] = await transaction
    .select({
      taskId: attachments.taskId,
      uploaderUserId: attachments.uploaderUserId,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, workspaceId),
        eq(attachments.uploaderUserId, uploaderUserId),
        eq(attachments.storedPath, pathname),
      ),
    )
    .limit(1);
  if (!placeholder) return "lost";

  // An account erasure can begin after authority is issued but before the
  // provider callback arrives. Re-prove both the real uploader and the fresh
  // workspace owner behind every deletion fence in this same writer
  // transaction before publishing the attachment row.
  await assertNativeUploadClaimCanStart(transaction, {
    workspaceId,
    taskId: placeholder.taskId,
    actorUserId: placeholder.uploaderUserId,
  });
  const updated = await transaction
    .update(attachments)
    .set({
      storedPath: finalStoredPath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    })
    .where(
      and(
        eq(attachments.id, attachmentId),
        eq(attachments.workspaceId, workspaceId),
        eq(attachments.uploaderUserId, uploaderUserId),
        eq(attachments.storedPath, pathname),
      ),
    )
    .returning({ id: attachments.id });
  if (updated.length !== 1) return "lost";

  const markerRemoved = await transaction
    .delete(meta)
    .where(and(eq(meta.key, key), eq(meta.value, marker.value)))
    .returning({ key: meta.key });
  if (markerRemoved.length !== 1) {
    throw new Error("native upload claim conflicted");
  }
  return "completed";
}

export async function clearNativeUploadClaimsForProjectInTransaction(
  transaction: Pick<NativeUploadDb, "delete">,
  workspaceId: string,
): Promise<void> {
  const prefix = nativeUploadClaimPrefix(workspaceId);
  await transaction.delete(meta).where(like(meta.key, `${prefix}%`));
}
