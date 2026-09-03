import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, gt, lte, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import { meta } from "@/server/db/schema";
import * as schema from "@/server/db/schema";

type PermissionLeaseDb = LibSQLDatabase<typeof schema>;

const LEASE_VERSION = 1 as const;
export const PROJECT_DRIVE_PERMISSION_MUTATION_LEASE_DURATION_MS = 60_000;
const MIN_LEASE_DURATION_MS = 5_000;
const MAX_LEASE_DURATION_MS = 5 * 60_000;

export type ProjectDrivePermissionMutationTarget = Readonly<{
  workspaceId: string;
  storageGenerationId: string;
}>;

export type ProjectDrivePermissionMutationLeaseHandle =
  ProjectDrivePermissionMutationTarget &
    Readonly<{
      key: string;
      token: string;
      expiresAt: Date;
    }>;

export type ProjectDrivePermissionMutationLeaseGuard = Readonly<{
  /**
   * Extend the lease using the database clock directly before provider
   * mutation. An expired or replaced handle fails closed.
   */
  renew(): Promise<ProjectDrivePermissionMutationLeaseHandle>;
}>;

export type ProjectDrivePermissionMutationLeaseRunner = Readonly<{
  run<T>(
    target: ProjectDrivePermissionMutationTarget,
    operation: (
      guard: ProjectDrivePermissionMutationLeaseGuard,
    ) => Promise<T>,
  ): Promise<T>;
}>;

export type ProjectDrivePermissionMutationLeaseDependencies = Readonly<{
  database: PermissionLeaseDb;
  randomLeaseId?: () => string;
  leaseDurationMs?: number;
  /** Test-only database clock. Production uses SQLite/libSQL time. */
  databaseNowSeconds?: () => SQL<Date>;
}>;

export class ProjectDrivePermissionMutationLeaseError extends Error {
  readonly code: "busy" | "lost" | "unavailable";

  constructor(code: "busy" | "lost" | "unavailable") {
    super("Project Drive permission work is already in progress.");
    this.name = "ProjectDrivePermissionMutationLeaseError";
    this.code = code;
  }
}

function canonicalIdentifier(value: string, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 1_024 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new TypeError(`${label} must be a canonical identifier`);
  }
  return value;
}

function boundedLeaseDuration(value: number | undefined): number {
  const duration =
    value ?? PROJECT_DRIVE_PERMISSION_MUTATION_LEASE_DURATION_MS;
  if (
    !Number.isSafeInteger(duration) ||
    duration % 1_000 !== 0 ||
    duration < MIN_LEASE_DURATION_MS ||
    duration > MAX_LEASE_DURATION_MS
  ) {
    throw new RangeError(
      `leaseDurationMs must be a whole-second duration from ${MIN_LEASE_DURATION_MS} to ${MAX_LEASE_DURATION_MS}`,
    );
  }
  return duration;
}

function canonicalTarget(
  input: ProjectDrivePermissionMutationTarget,
): ProjectDrivePermissionMutationTarget {
  return Object.freeze({
    workspaceId: canonicalIdentifier(input.workspaceId, "workspaceId"),
    storageGenerationId: canonicalIdentifier(
      input.storageGenerationId,
      "storageGenerationId",
    ),
  });
}

/**
 * One collision-resistant key per exact Project/folder generation. The board
 * prefix lets the existing Project/account lifecycle delete an abandoned
 * expired row with its other board metadata after provider cleanup finishes.
 */
export function projectDrivePermissionMutationLeaseKey(
  input: ProjectDrivePermissionMutationTarget,
): string {
  const target = canonicalTarget(input);
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        "project-drive-permission-mutation-lease",
        LEASE_VERSION,
        target.workspaceId,
        target.storageGenerationId,
      ]),
    )
    .digest("hex");
  return `board:${target.workspaceId}:project-drive-permission-lease:${digest}`;
}

function leaseToken(randomLeaseId: () => string): string {
  const entropy = randomLeaseId();
  if (typeof entropy !== "string" || entropy.length === 0) {
    throw new TypeError("randomLeaseId must return a non-empty string");
  }
  return `project-drive-permission-lease/${LEASE_VERSION}:${createHash("sha256")
    .update(entropy)
    .digest("hex")}`;
}

function databaseNowSeconds(source?: () => SQL<Date>): SQL<Date> {
  return source?.() ?? sql<Date>`unixepoch()`;
}

/**
 * A database-clock, crash-expiring mutex over one immutable Drive folder
 * generation. Each acquire/renew/release is one short statement. Provider I/O
 * runs only after acquire commits and never while a writer transaction is
 * open. `meta.updated_at` is deliberately the lease expiry for these namespaced
 * rows; a dead runtime leaves no permanent lock.
 */
export function createProjectDrivePermissionMutationLease(
  dependencies: ProjectDrivePermissionMutationLeaseDependencies,
) {
  const leaseDurationMs = boundedLeaseDuration(
    dependencies.leaseDurationMs,
  );
  const leaseDurationSeconds = leaseDurationMs / 1_000;
  const randomLeaseId = dependencies.randomLeaseId ?? randomUUID;

  async function tryAcquire(
    input: ProjectDrivePermissionMutationTarget,
  ): Promise<ProjectDrivePermissionMutationLeaseHandle | null> {
    const target = canonicalTarget(input);
    const key = projectDrivePermissionMutationLeaseKey(target);
    const token = leaseToken(randomLeaseId);
    const now = databaseNowSeconds(dependencies.databaseNowSeconds);
    const expiresAt = sql<Date>`(${now}) + ${leaseDurationSeconds}`;
    try {
      const [row] = await dependencies.database
        .insert(meta)
        .values({ key, value: token, updatedAt: expiresAt })
        .onConflictDoUpdate({
          target: meta.key,
          set: { value: token, updatedAt: expiresAt },
          where: lte(meta.updatedAt, now),
        })
        .returning({ value: meta.value, expiresAt: meta.updatedAt });
      if (!row || row.value !== token) return null;
      return Object.freeze({ ...target, key, token, expiresAt: row.expiresAt });
    } catch (error) {
      if (error instanceof ProjectDrivePermissionMutationLeaseError) {
        throw error;
      }
      throw new ProjectDrivePermissionMutationLeaseError("unavailable");
    }
  }

  async function renew(
    handle: ProjectDrivePermissionMutationLeaseHandle,
  ): Promise<ProjectDrivePermissionMutationLeaseHandle> {
    const target = canonicalTarget(handle);
    const key = projectDrivePermissionMutationLeaseKey(target);
    if (key !== handle.key || !handle.token) {
      throw new ProjectDrivePermissionMutationLeaseError("lost");
    }
    const now = databaseNowSeconds(dependencies.databaseNowSeconds);
    const expiresAt = sql<Date>`(${now}) + ${leaseDurationSeconds}`;
    try {
      const [row] = await dependencies.database
        .update(meta)
        .set({ updatedAt: expiresAt })
        .where(
          and(
            eq(meta.key, key),
            eq(meta.value, handle.token),
            gt(meta.updatedAt, now),
          ),
        )
        .returning({ expiresAt: meta.updatedAt });
      if (!row) throw new ProjectDrivePermissionMutationLeaseError("lost");
      return Object.freeze({
        ...target,
        key,
        token: handle.token,
        expiresAt: row.expiresAt,
      });
    } catch (error) {
      if (error instanceof ProjectDrivePermissionMutationLeaseError) {
        throw error;
      }
      throw new ProjectDrivePermissionMutationLeaseError("unavailable");
    }
  }

  async function release(
    handle: ProjectDrivePermissionMutationLeaseHandle,
  ): Promise<boolean> {
    const target = canonicalTarget(handle);
    const key = projectDrivePermissionMutationLeaseKey(target);
    if (key !== handle.key || !handle.token) return false;
    const deleted = await dependencies.database
      .delete(meta)
      .where(and(eq(meta.key, key), eq(meta.value, handle.token)))
      .returning({ key: meta.key });
    return deleted.length === 1;
  }

  async function run<T>(
    input: ProjectDrivePermissionMutationTarget,
    operation: (
      guard: ProjectDrivePermissionMutationLeaseGuard,
    ) => Promise<T>,
  ): Promise<T> {
    if (typeof operation !== "function") {
      throw new TypeError("permission mutation operation is required");
    }
    const acquired = await tryAcquire(input);
    if (!acquired) throw new ProjectDrivePermissionMutationLeaseError("busy");
    let handle: ProjectDrivePermissionMutationLeaseHandle = acquired;
    const guard: ProjectDrivePermissionMutationLeaseGuard = Object.freeze({
      async renew() {
        handle = await renew(handle);
        return handle;
      },
    });
    try {
      return await operation(guard);
    } finally {
      // A release failure is an expiring availability cost, never permission
      // to guess provider truth or leak the opaque lease token in a log.
      await release(handle).catch(() => false);
    }
  }

  return Object.freeze({ tryAcquire, renew, release, run });
}

export const projectDrivePermissionMutationLease =
  createProjectDrivePermissionMutationLease({ database: db });
