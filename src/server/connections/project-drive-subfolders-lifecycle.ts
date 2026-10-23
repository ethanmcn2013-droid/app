import "server-only";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/server/db/schema";
import { withProjectDriveReceiptSession } from "./project-drive-access";
import { findGoogleDriveFilesByAppProperty, type GoogleFetch } from "./google-drive";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { boundedSubfolderProviderCall, canonicalSubfolderUrl } from "./project-drive-subfolders-provider";

const { projectDriveSubfolders: folders } = schema;
type Executor = Pick<LibSQLDatabase<typeof schema>, "select" | "delete">;

/** A create may still finish after timeout. Never discard its marker custody. */
export async function assertProjectDriveSubfoldersSettled(database: Pick<Executor, "select">, scope: SQL) {
  const [unresolved] = await database.select({ id: folders.id }).from(folders).where(and(scope, eq(folders.createStarted, true), isNull(folders.folderId))).limit(1);
  if (unresolved) throw new Error("Drive folder creation is unresolved. Reconcile the original folder request before deleting its records.");
}

/** Caller owns an immediate writer transaction or an already durable erasure fence. */
export async function retireProjectDriveSubfolders(database: Executor, scope: SQL) {
  await assertProjectDriveSubfoldersSettled(database, scope);
  // Folder bytes remain owned by the connected account. Local deletion never
  // trashes a child, changes inheritance, or grants/revokes permissions.
  await database.delete(folders).where(and(scope, sql`(${folders.createStarted} = 0 OR ${folders.folderId} IS NOT NULL)`));
}

/** Erasure-only recovery. Exact existing marker search; never issues a create. */
export async function reconcileProjectDriveSubfolderForErasure(
  database: LibSQLDatabase<typeof schema>,
  accountUserId: string,
  operationId: string,
  dependencies: { withSession: typeof withProjectDriveReceiptSession; fetchImpl: GoogleFetch } = { withSession: withProjectDriveReceiptSession, fetchImpl: fetch },
): Promise<void> {
  const [row] = await database.select().from(folders).where(eq(folders.id, operationId));
  if (!row || !row.createStarted || row.folderId) return;
  const [held] = await database.select().from(schema.meta).where(eq(schema.meta.key, googleDriveAccountErasureFenceKey(accountUserId)));
  if (!held || (row.leaseUntil && row.leaseUntil > new Date())) throw new Error("Drive folder recovery is not ready.");
  const [relation] = await database.select({ owner: schema.workspaces.ownerUserId, storageOwner: schema.providerConnections.userId }).from(schema.workspaces).innerJoin(schema.workspaceStorage, eq(schema.workspaceStorage.workspaceId, schema.workspaces.id)).innerJoin(schema.providerConnections, eq(schema.providerConnections.id, schema.workspaceStorage.connectionId)).where(and(eq(schema.workspaces.id, row.workspaceId), eq(schema.workspaceStorage.id, row.storageGenerationId)));
  if (!relation || (relation.owner !== accountUserId && relation.storageOwner !== accountUserId && row.actorUserId !== accountUserId)) throw new Error("Drive folder recovery custody differs.");
  const started = performance.now();
  let outcome = "error";
  try {
    const file = await dependencies.withSession({ workspaceId: row.workspaceId, storageGenerationId: row.storageGenerationId, connectionId: row.connectionId, folderId: row.parentId }, async session => {
      if (session.credential.providerAccountId !== row.providerAccountId) throw new Error("Drive folder recovery account differs.");
      const matches = await boundedSubfolderProviderCall(signal => findGoogleDriveFilesByAppProperty(session.accessToken, { key: "signalSubfolderOperationId", value: row.id, parentId: row.parentId, includeTrashed: true, pageSize: 100 }, (url, init) => dependencies.fetchImpl(url, { ...init, signal })));
      if (matches.nextPageToken || matches.files.length !== 1) throw new Error("Drive folder creation remains unresolved.");
      const found = matches.files[0];
      if (found.mimeType !== "application/vnd.google-apps.folder" || found.parents.length !== 1 || found.parents[0] !== row.parentId || found.appProperties.signalSubfolderOperationId !== row.id) throw new Error("Drive folder recovery marker differs.");
      return found;
    });
    const folderUrl = canonicalSubfolderUrl(file.id);
    await database.transaction(async tx => {
      const [fence] = await tx.select().from(schema.meta).where(eq(schema.meta.key, googleDriveAccountErasureFenceKey(accountUserId)));
      if (!fence) throw new Error("Drive folder recovery fence changed.");
      await tx.update(folders).set({ status: "attention", folderId: file.id, folderUrl, leaseUntil: null }).where(and(eq(folders.id, row.id), isNull(folders.folderId), eq(folders.createStarted, true)));
    }, { behavior: "immediate" });
    outcome = "success";
  } finally {
    const durationMs = Math.round(performance.now() - started);
    const observation = JSON.stringify({ stage: "erasure_marker_search", outcome, durationMs });
    await database.update(folders).set({ providerDiagnostics: sql`CASE WHEN json_array_length(${folders.providerDiagnostics}) < 64 THEN json_insert(${folders.providerDiagnostics}, '$[#]', json(${observation})) ELSE ${folders.providerDiagnostics} END`, providerCallCount: sql`${folders.providerCallCount} + 1`, providerDurationMs: sql`${folders.providerDurationMs} + ${durationMs}` }).where(eq(folders.id, row.id));
  }
}
