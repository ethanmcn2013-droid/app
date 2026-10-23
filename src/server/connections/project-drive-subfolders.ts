import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db } from "@/server/db";
import * as schema from "@/server/db/schema";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { authorizeProjectDrive, authorizeProjectDriveForAuthenticatedActor, assertProjectDriveCapability, type AuthorizedProjectDriveContext } from "./project-drive-authz";
import { withAuthorizedProjectDriveSession, type ProjectDriveStorageSession } from "./project-drive-access";
import { readCurrentProjectDriveFolderSetupState } from "./project-drive-folder-management";
import { googleDriveAccountErasureFenceKey } from "./project-drive-operation-lifecycle";
import { DRIVE_FOLDER_GENERATION_MARKER, DRIVE_FOLDER_WORKSPACE_MARKER } from "./drive-folders";
import { createGoogleDriveFolder, findGoogleDriveChildFoldersByName, findGoogleDriveFilesByAppProperty, getGoogleDriveFile, type GoogleDriveFile, type GoogleFetch } from "./google-drive";
import { boundedSubfolderProviderCall, canonicalSubfolderUrl } from "./project-drive-subfolders-provider";

const { projectDriveSubfolders: folders, workspaceStorage, providerConnections, workspaces, workspaceMembers, users, meta } = schema;
type Database = LibSQLDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Row = typeof folders.$inferSelect;
const MIME = "application/vnd.google-apps.folder";
export const PROJECT_DRIVE_SUBFOLDER_MARKER = "signalSubfolderOperationId";

/** Private plan binding: persist on the server; never accept provider ids from a model. */
export type ProjectDriveSubfolderBinding = Readonly<{
  projectId: string;
  actorUserId: string;
  storageGenerationId: string;
  connectionId: string;
  providerAccountId: string;
  parentId: string;
  folderName: string;
}>;
export type ProjectDriveSubfolderResult = Readonly<{
  operationId: string;
  status: Row["status"];
  folderName: string;
  folderUrl: string | null;
}>;

export class ProjectDriveSubfolderConflict extends Error {
  constructor() { super("This Project Drive folder request needs review."); this.name = "ProjectDriveSubfolderConflict"; }
}

export type ProjectDriveSubfolderDependencies = Readonly<{
  database: Database;
  authorize: typeof authorizeProjectDrive;
  authorizeAuthenticatedActor: typeof authorizeProjectDriveForAuthenticatedActor;
  withSession: typeof withAuthorizedProjectDriveSession;
  fetchImpl: GoogleFetch;
  now?: () => Date;
  /** Synthetic crash seam; never configured by the production factory. */
  afterCreate?: () => Promise<void>;
}>;

function name(value: string): string {
  if (typeof value !== "string") throw new ProjectDriveSubfolderConflict();
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 100 || /[\\/\u0000-\u001f\u007f]/.test(trimmed) || trimmed === "." || trimmed === "..") throw new ProjectDriveSubfolderConflict();
  return trimmed;
}
function result(row: Row): ProjectDriveSubfolderResult {
  return { operationId: row.id, status: row.status, folderName: row.folderName, folderUrl: row.status === "complete" ? row.folderUrl : null };
}
function binding(row: Row): ProjectDriveSubfolderBinding {
  return { projectId: row.workspaceId, actorUserId: row.actorUserId, storageGenerationId: row.storageGenerationId, connectionId: row.connectionId, providerAccountId: row.providerAccountId, parentId: row.parentId, folderName: row.folderName };
}
function sameBinding(a: ProjectDriveSubfolderBinding, b: ProjectDriveSubfolderBinding) {
  return a.projectId === b.projectId && a.actorUserId === b.actorUserId && a.storageGenerationId === b.storageGenerationId && a.connectionId === b.connectionId && a.providerAccountId === b.providerAccountId && a.parentId === b.parentId && a.folderName === b.folderName;
}

export function createProjectDriveSubfolderService(deps: ProjectDriveSubfolderDependencies) {
  const now = deps.now ?? (() => new Date());

  async function proof(projectId: string, actorUserId: string) {
    const authorization = await deps.authorize(projectId, "manageProject");
    assertProjectDriveCapability(authorization, "manageProject");
    if (authorization.actorUserId !== actorUserId || authorization.archived) throw new ProjectDriveSubfolderConflict();
    return authorization;
  }

  /** Must share the writer transaction with prepare/claim/finalize. */
  async function fence(tx: Transaction, authorization: AuthorizedProjectDriveContext, expected?: ProjectDriveSubfolderBinding) {
    await assertProjectNotDeleting(tx, authorization.projectId);
    const [project] = await tx.select().from(workspaces).where(eq(workspaces.id, authorization.projectId));
    const [member] = await tx.select().from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, authorization.projectId), eq(workspaceMembers.userId, authorization.actorUserId)));
    if (!project?.ownerUserId || project.archivedAt !== null || member?.role !== "owner") throw new ProjectDriveSubfolderConflict();
    const storages = await tx.select().from(workspaceStorage).where(and(eq(workspaceStorage.workspaceId, authorization.projectId), eq(workspaceStorage.isCurrent, true)));
    if (storages.length !== 1 || storages[0].state !== "active") throw new ProjectDriveSubfolderConflict();
    const storage = storages[0];
    const connections = await tx.select().from(providerConnections).innerJoin(workspaceStorage, eq(workspaceStorage.connectionId, providerConnections.id)).where(eq(workspaceStorage.workspaceId, authorization.projectId));
    const pinned = connections.find(c => c.provider_connections.id === storage.connectionId)?.provider_connections;
    if (!pinned || pinned.status !== "active") throw new ProjectDriveSubfolderConflict();
    const accountIds = [...new Set([authorization.actorUserId, project.ownerUserId, ...connections.map(c => c.provider_connections.userId)])];
    const existing = await tx.select({ id: users.id }).from(users).where(inArray(users.id, accountIds));
    const erased = await tx.select({ key: meta.key }).from(meta).where(inArray(meta.key, accountIds.map(googleDriveAccountErasureFenceKey)));
    if (existing.length !== accountIds.length || erased.length) throw new ProjectDriveSubfolderConflict();
    const ready = await readCurrentProjectDriveFolderSetupState(tx, authorization);
    if (ready?.status !== "active" || ready.coverage !== "complete") throw new ProjectDriveSubfolderConflict();
    const current = { projectId: authorization.projectId, actorUserId: authorization.actorUserId, storageGenerationId: storage.id, connectionId: storage.connectionId, providerAccountId: pinned.providerAccountId, parentId: storage.folderId, folderName: expected?.folderName ?? "" };
    if (expected && !sameBinding(current, expected)) throw new ProjectDriveSubfolderConflict();
    return current;
  }

  async function bind(input: { projectId: string; actorUserId: string; folderName: string }): Promise<ProjectDriveSubfolderBinding> {
    const authorization = await proof(input.projectId, input.actorUserId);
    const folderName = name(input.folderName);
    return deps.database.transaction(async tx => ({ ...await fence(tx, authorization), folderName }), { behavior: "immediate" });
  }

  async function prepare(expected: ProjectDriveSubfolderBinding, operationId: string, assertPreparationAllowed?: (transaction: Transaction) => Promise<void>): Promise<ProjectDriveSubfolderResult> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId) || name(expected.folderName) !== expected.folderName) throw new ProjectDriveSubfolderConflict();
    const authorization = await proof(expected.projectId, expected.actorUserId);
    return deps.database.transaction(async tx => {
      await fence(tx, authorization, expected);
      await assertPreparationAllowed?.(tx);
      const [existing] = await tx.select().from(folders).where(eq(folders.id, operationId));
      if (existing) {
        if (!sameBinding(binding(existing), expected)) throw new ProjectDriveSubfolderConflict();
        return result(existing);
      }
      const [collision] = await tx.select({ id: folders.id }).from(folders).where(and(eq(folders.storageGenerationId, expected.storageGenerationId), eq(folders.folderName, expected.folderName)));
      if (collision) throw new ProjectDriveSubfolderConflict();
      const [row] = await tx.insert(folders).values({ id: operationId, workspaceId: expected.projectId, actorUserId: expected.actorUserId, storageGenerationId: expected.storageGenerationId, connectionId: expected.connectionId, providerAccountId: expected.providerAccountId, parentId: expected.parentId, folderName: expected.folderName, status: "pending", createdAt: now() }).returning();
      return result(row);
    }, { behavior: "immediate" });
  }

  async function read(input: { projectId: string; actorUserId: string; operationId: string }) {
    await proof(input.projectId, input.actorUserId);
    const [row] = await deps.database.select().from(folders).where(and(eq(folders.workspaceId, input.projectId), eq(folders.actorUserId, input.actorUserId), eq(folders.id, input.operationId)));
    return row ? result(row) : null;
  }

  /** Historical display checks the current local binding without provider calls.
   * Keep recovery's read unchanged: it may need custody after a root changes.
   */
  async function readForHistory(input: { projectId: string; actorUserId: string; operationId: string }) {
    const authorization = await deps.authorizeAuthenticatedActor(input.projectId, input.actorUserId, "manageProject");
    assertProjectDriveCapability(authorization, "manageProject");
    if (authorization.actorUserId !== input.actorUserId || authorization.archived) throw new ProjectDriveSubfolderConflict();
    return deps.database.transaction(async tx => {
      const [row] = await tx.select().from(folders).where(and(eq(folders.workspaceId, input.projectId), eq(folders.actorUserId, input.actorUserId), eq(folders.id, input.operationId)));
      if (!row || row.status !== "complete" || !row.folderId || row.folderUrl !== canonicalSubfolderUrl(row.folderId)) return null;
      await fence(tx, authorization, binding(row));
      return result(row);
    });
  }

  async function execute(input: { projectId: string; actorUserId: string; operationId: string; recoveryOnly?: boolean; assertMutationAllowed?: (transaction: Transaction) => Promise<void> }): Promise<ProjectDriveSubfolderResult> {
    const authorization = await proof(input.projectId, input.actorUserId);
    const claim = await deps.database.transaction(async tx => {
      const [row] = await tx.select().from(folders).where(and(eq(folders.id, input.operationId), eq(folders.workspaceId, input.projectId), eq(folders.actorUserId, input.actorUserId)));
      if (!row) throw new ProjectDriveSubfolderConflict();
      await fence(tx, authorization, binding(row));
      if (row.status === "complete" || row.status === "attention" || (row.status === "running" && row.leaseUntil && row.leaseUntil > now())) return { row, claimed: false };
      const [claimed] = await tx.update(folders).set({ status: "running", attemptId: randomUUID(), leaseUntil: new Date(now().getTime() + 60_000) }).where(eq(folders.id, row.id)).returning();
      return { row: claimed, claimed: true };
    }, { behavior: "immediate" });
    if (!claim.claimed) return result(claim.row);
    const row = claim.row;
    let received: GoogleDriveFile | undefined;
    async function measured<T>(stage: "parent_read" | "marker_search" | "name_search" | "folder_create", operation: (fetchImpl: GoogleFetch) => Promise<T>): Promise<T> {
      const started = performance.now();
      let outcome: "success" | "error" = "error";
      try { const value = await boundedSubfolderProviderCall(signal => operation((url, init) => deps.fetchImpl(url, { ...init, signal }))); outcome = "success"; return value; }
      finally {
        const observation = JSON.stringify({ stage, outcome, durationMs: Math.round(performance.now() - started) });
        await deps.database.update(folders).set({ providerDiagnostics: sql`CASE WHEN json_array_length(${folders.providerDiagnostics}) < 64 THEN json_insert(${folders.providerDiagnostics}, '$[#]', json(${observation})) ELSE ${folders.providerDiagnostics} END`, providerCallCount: sql`${folders.providerCallCount} + 1`, providerDurationMs: sql`${folders.providerDurationMs} + ${Math.round(performance.now() - started)}` }).where(and(eq(folders.id, row.id), eq(folders.attemptId, row.attemptId!)));
      }
    }
    async function fresh() {
      const current = await proof(input.projectId, input.actorUserId);
      await deps.database.transaction(async tx => {
        await fence(tx, current, binding(row));
        const [live] = await tx.select().from(folders).where(and(eq(folders.id, row.id), eq(folders.attemptId, row.attemptId!)));
        if (!live || live.status !== "running" || !live.leaseUntil || live.leaseUntil <= now()) throw new ProjectDriveSubfolderConflict();
      }, { behavior: "immediate" });
    }
    try {
      await deps.withSession(authorization, { kind: "generation", storageGenerationId: row.storageGenerationId }, async (session: ProjectDriveStorageSession) => {
        if (session.storage.id !== row.storageGenerationId || session.storage.connectionId !== row.connectionId || session.storage.folderId !== row.parentId || session.credential.providerAccountId !== row.providerAccountId || !session.storage.isCurrent || session.storage.state !== "active") throw new ProjectDriveSubfolderConflict();
        await fresh();
        const parent = await measured("parent_read", fetchImpl => getGoogleDriveFile(session.accessToken, row.parentId, fetchImpl));
        if (parent.id !== row.parentId || parent.mimeType !== MIME || parent.trashed || parent.parents.length !== 1 || parent.parents[0] !== session.storageRootFolderId || parent.appProperties[DRIVE_FOLDER_WORKSPACE_MARKER] !== row.workspaceId || parent.appProperties[DRIVE_FOLDER_GENERATION_MARKER] !== row.storageGenerationId) throw new ProjectDriveSubfolderConflict();
        await fresh();
        const matches = await measured("marker_search", fetchImpl => findGoogleDriveFilesByAppProperty(session.accessToken, { key: PROJECT_DRIVE_SUBFOLDER_MARKER, value: row.id, parentId: row.parentId, includeTrashed: true, pageSize: 100 }, fetchImpl));
        if (matches.nextPageToken || matches.files.length > 1) throw new ProjectDriveSubfolderConflict();
        received = matches.files[0];
        if (!received) {
          // A dispatched create can become visible later. Absence from search
          // is never permission to issue another create after timeout/crash.
          if (row.createStarted || input.recoveryOnly) throw new Error("unknown-provider-result");
          await fresh();
          const sameName = await measured("name_search", fetchImpl => findGoogleDriveChildFoldersByName(session.accessToken, { parentId: row.parentId, name: row.folderName }, fetchImpl));
          if (sameName.files.length || sameName.nextPageToken) throw new ProjectDriveSubfolderConflict();
          const current = await proof(input.projectId, input.actorUserId);
          await deps.database.transaction(async tx => {
            await fence(tx, current, binding(row));
            await input.assertMutationAllowed?.(tx);
            const changed = await tx.update(folders).set({ createStarted: true }).where(and(eq(folders.id, row.id), eq(folders.attemptId, row.attemptId!), eq(folders.status, "running"), gt(folders.leaseUntil, now()))).returning({ id: folders.id });
            if (!changed.length) throw new ProjectDriveSubfolderConflict();
          }, { behavior: "immediate" });
          received = await measured("folder_create", fetchImpl => createGoogleDriveFolder(session.accessToken, { name: row.folderName, parentId: row.parentId, appProperties: { [PROJECT_DRIVE_SUBFOLDER_MARKER]: row.id } }, fetchImpl));
          await deps.afterCreate?.();
        }
        if (received.mimeType !== MIME || received.trashed || received.name !== row.folderName || received.parents.length !== 1 || received.parents[0] !== row.parentId || received.appProperties[PROJECT_DRIVE_SUBFOLDER_MARKER] !== row.id || !received.id) throw new ProjectDriveSubfolderConflict();
        received = { ...received, webViewLink: canonicalSubfolderUrl(received.id) };
        await fresh();
      });
      const current = await proof(input.projectId, input.actorUserId);
      return await deps.database.transaction(async tx => {
        await fence(tx, current, binding(row));
        const [saved] = await tx.update(folders).set({ status: "complete", folderId: received!.id, folderUrl: received!.webViewLink!, leaseUntil: null }).where(and(eq(folders.id, row.id), eq(folders.attemptId, row.attemptId!), eq(folders.status, "running"), gt(folders.leaseUntil, now()))).returning();
        if (!saved) throw new ProjectDriveSubfolderConflict();
        return result(saved);
      }, { behavior: "immediate" });
    } catch (error) {
      // Persist provider acceptance even if authority changed. This is custody,
      // not completion, and it cannot create or widen access.
      let receipt: { folderId: string; folderUrl: string } | undefined;
      try { if (received?.id) receipt = { folderId: received.id, folderUrl: canonicalSubfolderUrl(received.id) }; } catch { /* retain unresolved marker custody */ }
      const [saved] = await deps.database.update(folders).set({ status: error instanceof ProjectDriveSubfolderConflict ? "attention" : "unknown", leaseUntil: null, ...receipt }).where(and(eq(folders.id, row.id), eq(folders.attemptId, row.attemptId!), eq(folders.status, "running"))).returning();
      if (!saved) throw new ProjectDriveSubfolderConflict();
      return result(saved);
    }
  }
  async function retireUnattempted(input: { projectId: string; actorUserId: string; operationId: string }): Promise<boolean> {
    const authorization=await proof(input.projectId,input.actorUserId);
    return deps.database.transaction(async tx=>{
      const [row]=await tx.select().from(folders).where(and(eq(folders.id,input.operationId),eq(folders.workspaceId,input.projectId),eq(folders.actorUserId,input.actorUserId)));
      await fence(tx,authorization,row?binding(row):undefined);
      if(!row)return true;
      if(row.createStarted||row.folderId!==null)return false;
      const retired=await tx.delete(folders).where(and(eq(folders.id,row.id),eq(folders.createStarted,false))).returning({id:folders.id});
      return retired.length===1;
    },{behavior:'immediate'});
  }
  return { bind, prepare, execute, read, readForHistory, retireUnattempted };
}

export function projectDriveSubfolderServiceFromEnv() {
  return createProjectDriveSubfolderService({ database: db, authorize: authorizeProjectDrive, authorizeAuthenticatedActor: authorizeProjectDriveForAuthenticatedActor, withSession: withAuthorizedProjectDriveSession, fetchImpl: fetch });
}
