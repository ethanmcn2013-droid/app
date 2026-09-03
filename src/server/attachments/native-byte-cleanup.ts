import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, like, lte, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import { meta } from "@/server/db/schema";
import * as schema from "@/server/db/schema";
import {
  deleteBlobPathnameConfirmed,
  deleteBytesConfirmed,
  deleteDiskStorageKeyConfirmed,
} from "@/server/storage";

type CleanupDb = LibSQLDatabase<typeof schema>;
type CleanupReceiptWriter = Pick<CleanupDb, "insert" | "select">;

const RECEIPT_VERSION = 1 as const;
const RECEIPT_OWNER = "signal-native-attachment" as const;
export const NATIVE_BYTE_CLEANUP_META_PREFIX =
  "project-deletion:native-byte-cleanup:v1:";
export const NATIVE_BYTE_CLEANUP_LEASE_MS = 60_000;
const MIN_LEASE_MS = 5_000;
const MAX_LEASE_MS = 5 * 60_000;
const DEFAULT_REPAIR_LIMIT = 25;
const MAX_REPAIR_LIMIT = 50;
const RETRY_AFTER_MS = 60_000;

type NativeByteCleanupReceipt = Readonly<{
  version: typeof RECEIPT_VERSION;
  owner: typeof RECEIPT_OWNER;
  workspaceId: string;
  target: NativeByteCleanupTarget;
  claimToken: string | null;
}>;

export type NativeByteCleanupTarget =
  | Readonly<{ kind: "blob-pathname"; locator: string }>
  | Readonly<{ kind: "disk-key"; locator: string }>
  | Readonly<{ kind: "stored-path"; locator: string }>;

type DueReceiptRow = Readonly<{
  key: string;
  value: string;
}>;

type ClaimedReceipt = Readonly<{
  key: string;
  value: string;
  receipt: NativeByteCleanupReceipt;
}>;

export type NativeByteCleanupResult = Readonly<{
  scanned: number;
  attempted: number;
  cleaned: number;
  retryScheduled: number;
  skipped: number;
  failed: number;
}>;

export type NativeByteCleanupDependencies = Readonly<{
  database: CleanupDb;
  deleteTarget: (target: NativeByteCleanupTarget) => Promise<void>;
  randomLeaseId?: () => string;
  leaseDurationMs?: number;
  retryAfterMs?: number;
  /** Test-only database clock. Production uses SQLite/libSQL time. */
  databaseNowSeconds?: () => SQL<Date>;
  /** Test-only crash seam, called after storage success but before DB cleanup. */
  afterDelete?: (target: NativeByteCleanupTarget) => Promise<void>;
}>;

function canonicalWorkspaceId(value: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.includes("://")
  ) {
    throw new TypeError("workspaceId must be a canonical id");
  }
  return value;
}

function canonicalLocator(value: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 16_384 ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError("cleanup locator must be exact and non-empty");
  }
  return value;
}

function databaseNowSeconds(source?: () => SQL<Date>): SQL<Date> {
  return source?.() ?? sql<Date>`unixepoch()`;
}

function boundedWholeSeconds(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const duration = value ?? fallback;
  if (
    !Number.isSafeInteger(duration) ||
    duration % 1_000 !== 0 ||
    duration < minimum ||
    duration > maximum
  ) {
    throw new RangeError(
      `${label} must be a whole-second duration from ${minimum} to ${maximum}`,
    );
  }
  return duration;
}

function normalizedLimit(value: number | undefined): number {
  const limit = value ?? DEFAULT_REPAIR_LIMIT;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_REPAIR_LIMIT) {
    throw new RangeError(`limit must be an integer from 1 to ${MAX_REPAIR_LIMIT}`);
  }
  return limit;
}

export function nativeByteCleanupReceiptKey(
  workspaceIdInput: string,
  targetInput: NativeByteCleanupTarget,
): string {
  const workspaceId = canonicalWorkspaceId(workspaceIdInput);
  const target = canonicalTarget(targetInput);
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        "project-deletion-native-byte-cleanup",
        RECEIPT_VERSION,
        workspaceId,
        target.kind,
        target.locator,
      ]),
    )
    .digest("hex");
  return `${NATIVE_BYTE_CLEANUP_META_PREFIX}${digest}`;
}

function canonicalTarget(
  input: NativeByteCleanupTarget,
): NativeByteCleanupTarget {
  if (
    input?.kind !== "blob-pathname" &&
    input?.kind !== "disk-key" &&
    input?.kind !== "stored-path"
  ) {
    throw new TypeError("cleanup target kind is invalid");
  }
  return Object.freeze({
    kind: input.kind,
    locator: canonicalLocator(input.locator),
  });
}

function serializeReceipt(receipt: NativeByteCleanupReceipt): string {
  return JSON.stringify(receipt);
}

function parseReceipt(value: string): NativeByteCleanupReceipt {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new TypeError("invalid native-byte cleanup receipt");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("invalid native-byte cleanup receipt");
  }
  const candidate = parsed as Record<string, unknown>;
  const workspaceId = canonicalWorkspaceId(candidate.workspaceId as string);
  const targetCandidate = candidate.target;
  if (
    !targetCandidate ||
    typeof targetCandidate !== "object" ||
    Array.isArray(targetCandidate)
  ) {
    throw new TypeError("invalid native-byte cleanup receipt");
  }
  const target = canonicalTarget(
    targetCandidate as NativeByteCleanupTarget,
  );
  const claimToken = candidate.claimToken;
  if (
    candidate.version !== RECEIPT_VERSION ||
    candidate.owner !== RECEIPT_OWNER ||
    (claimToken !== null &&
      (typeof claimToken !== "string" || claimToken.length === 0))
  ) {
    throw new TypeError("invalid native-byte cleanup receipt");
  }
  return Object.freeze({
    version: RECEIPT_VERSION,
    owner: RECEIPT_OWNER,
    workspaceId,
    target,
    claimToken,
  });
}

function unclaimedReceipt(
  workspaceId: string,
  target: NativeByteCleanupTarget,
): NativeByteCleanupReceipt {
  return Object.freeze({
    version: RECEIPT_VERSION,
    owner: RECEIPT_OWNER,
    workspaceId: canonicalWorkspaceId(workspaceId),
    target: canonicalTarget(target),
    claimToken: null,
  });
}

/**
 * Give exact Signal-owned byte locators durable custody before their Project
 * rows disappear. Each locator gets its own stable receipt, so partial cleanup
 * and crash replay never widen into a prefix or folder deletion. The key is
 * deliberately outside `board:${workspaceId}:`; Project metadata cleanup must
 * not erase the only remaining authority to remove these bytes.
 */
export async function stageNativeByteCleanupReceipts(
  executor: CleanupReceiptWriter,
  workspaceIdInput: string,
  storedPathInputs: readonly string[],
): Promise<readonly string[]> {
  return stageNativeByteCleanupTargets(
    executor,
    workspaceIdInput,
    storedPathInputs
      .filter((storedPath) => storedPath.length > 0)
      .map((storedPath) => ({ kind: "stored-path", locator: storedPath })),
  );
}

export async function stageNativeByteCleanupTargets(
  executor: CleanupReceiptWriter,
  workspaceIdInput: string,
  targetInputs: readonly NativeByteCleanupTarget[],
): Promise<readonly string[]> {
  const workspaceId = canonicalWorkspaceId(workspaceIdInput);
  const targets = [
    ...new Map(
      targetInputs.map((input) => {
        const target = canonicalTarget(input);
        return [`${target.kind}\u0000${target.locator}`, target] as const;
      }),
    ).values(),
  ];
  const keys: string[] = [];
  for (const target of targets) {
    const key = nativeByteCleanupReceiptKey(workspaceId, target);
    const receipt = unclaimedReceipt(workspaceId, target);
    const value = serializeReceipt(receipt);
    const inserted = await executor
      .insert(meta)
      .values({
        key,
        value,
        updatedAt: sql<Date>`unixepoch()`,
      })
      .onConflictDoNothing()
      .returning({ key: meta.key });
    if (inserted.length === 0) {
      const [existing] = await executor
        .select({ value: meta.value })
        .from(meta)
        .where(eq(meta.key, key))
        .limit(1);
      if (!existing) {
        throw new Error("native-byte cleanup receipt conflicted");
      }
      const parsed = parseReceipt(existing.value);
      if (
        parsed.workspaceId !== workspaceId ||
        parsed.target.kind !== target.kind ||
        parsed.target.locator !== target.locator
      ) {
        throw new Error("native-byte cleanup receipt conflicted");
      }
    }
    keys.push(key);
  }
  return Object.freeze(keys);
}

function leaseToken(randomLeaseId: () => string): string {
  const value = randomLeaseId();
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("randomLeaseId must return a non-empty string");
  }
  return `native-byte-cleanup/${RECEIPT_VERSION}:${createHash("sha256")
    .update(value)
    .digest("hex")}`;
}

/**
 * Bounded, cross-tenant drain for deletion receipts. The scan is intentionally
 * global; the receipt itself is the exact cleanup authority and exposes no
 * Project data. A DB-clock lease is acquired with one CAS before storage I/O,
 * and every completion/retry statement is fenced by its opaque claim token.
 */
export function createNativeByteCleanupService(
  dependencies: NativeByteCleanupDependencies,
) {
  const leaseSeconds =
    boundedWholeSeconds(
      dependencies.leaseDurationMs,
      NATIVE_BYTE_CLEANUP_LEASE_MS,
      MIN_LEASE_MS,
      MAX_LEASE_MS,
      "leaseDurationMs",
    ) / 1_000;
  const retrySeconds =
    boundedWholeSeconds(
      dependencies.retryAfterMs,
      RETRY_AFTER_MS,
      1_000,
      24 * 60 * 60_000,
      "retryAfterMs",
    ) / 1_000;
  const randomLeaseId = dependencies.randomLeaseId ?? randomUUID;

  async function listDue(
    limit: number,
    keys?: readonly string[],
  ): Promise<DueReceiptRow[]> {
    const now = databaseNowSeconds(dependencies.databaseNowSeconds);
    const exactKeys = keys ? [...new Set(keys)].slice(0, limit) : null;
    if (exactKeys && exactKeys.length === 0) return [];
    // isolation-ok: cleanup receipts outlive their deleted tenants, so this
    // bounded cross-tenant scan is the only sound repair entrypoint.
    return dependencies.database
      .select({ key: meta.key, value: meta.value })
      .from(meta)
      .where(
        and(
          like(meta.key, `${NATIVE_BYTE_CLEANUP_META_PREFIX}%`),
          lte(meta.updatedAt, now),
          exactKeys ? inArray(meta.key, exactKeys) : undefined,
        ),
      )
      .orderBy(asc(meta.updatedAt), asc(meta.key))
      .limit(limit);
  }

  async function tryClaim(row: DueReceiptRow): Promise<ClaimedReceipt | null> {
    const receipt = parseReceipt(row.value);
    if (nativeByteCleanupReceiptKey(receipt.workspaceId, receipt.target) !== row.key) {
      throw new TypeError("invalid native-byte cleanup receipt key");
    }
    const token = leaseToken(randomLeaseId);
    const claimedValue = serializeReceipt({ ...receipt, claimToken: token });
    const now = databaseNowSeconds(dependencies.databaseNowSeconds);
    const [claimed] = await dependencies.database
      .update(meta)
      .set({
        value: claimedValue,
        updatedAt: sql<Date>`(${now}) + ${leaseSeconds}`,
      })
      .where(
        and(
          eq(meta.key, row.key),
          eq(meta.value, row.value),
          lte(meta.updatedAt, now),
        ),
      )
      .returning({ key: meta.key });
    return claimed
      ? Object.freeze({ key: row.key, value: claimedValue, receipt })
      : null;
  }

  async function scheduleRetry(claimed: ClaimedReceipt): Promise<boolean> {
    const now = databaseNowSeconds(dependencies.databaseNowSeconds);
    const [updated] = await dependencies.database
      .update(meta)
      .set({
        value: serializeReceipt({ ...claimed.receipt, claimToken: null }),
        updatedAt: sql<Date>`(${now}) + ${retrySeconds}`,
      })
      .where(and(eq(meta.key, claimed.key), eq(meta.value, claimed.value)))
      .returning({ key: meta.key });
    return Boolean(updated);
  }

  async function repairReady(
    input: Readonly<{ limit?: number; keys?: readonly string[] }> = {},
  ): Promise<NativeByteCleanupResult> {
    const limit = normalizedLimit(input.limit);
    const rows = await listDue(limit, input.keys);
    let attempted = 0;
    let cleaned = 0;
    let retryScheduled = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      let claimed: ClaimedReceipt | null;
      try {
        claimed = await tryClaim(row);
      } catch {
        failed += 1;
        continue;
      }
      if (!claimed) {
        skipped += 1;
        continue;
      }
      attempted += 1;

      try {
        // Exact object operation only. No prefix, parent or provider resource
        // id is ever derived from this locator. This call is outside every DB
        // writer transaction; the leased receipt survives a process crash.
        await dependencies.deleteTarget(claimed.receipt.target);
      } catch {
        failed += 1;
        if (await scheduleRetry(claimed).catch(() => false)) {
          retryScheduled += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      // Simulates process death after a confirmed/idempotent delete. Leave the
      // running receipt untouched so a later worker can reclaim after expiry.
      await dependencies.afterDelete?.(claimed.receipt.target);

      const removed = await dependencies.database
        .delete(meta)
        .where(and(eq(meta.key, claimed.key), eq(meta.value, claimed.value)))
        .returning({ key: meta.key });
      if (removed.length === 1) cleaned += 1;
      else skipped += 1;
    }

    return Object.freeze({
      scanned: rows.length,
      attempted,
      cleaned,
      retryScheduled,
      skipped,
      failed,
    });
  }

  return Object.freeze({ repairReady });
}

export async function repairPendingNativeAttachmentBytes(
  input: Readonly<{ limit?: number }> = {},
): Promise<NativeByteCleanupResult> {
  return createNativeByteCleanupService({
    database: db,
    deleteTarget: deleteNativeByteCleanupTargetConfirmed,
  }).repairReady(input);
}

export function deleteNativeByteCleanupTargetConfirmed(
  target: NativeByteCleanupTarget,
): Promise<void> {
  switch (target.kind) {
    case "blob-pathname":
      return deleteBlobPathnameConfirmed(target.locator);
    case "disk-key":
      return deleteDiskStorageKeyConfirmed(target.locator);
    case "stored-path":
      return deleteBytesConfirmed(target.locator);
  }
}
