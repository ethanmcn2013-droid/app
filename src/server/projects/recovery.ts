import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import type { db } from "@/server/db";
import { attachments, shareLinks, users, workspaces } from "@/server/db/schema";
import { proveProjectCapability } from "@/server/actions/project-authz";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting, ProjectDeletionInProgressError } from "./project-deletion-fence";
import { parseProjectId } from "@/lib/projects/project-ref";
import { RECOVERY_PAGE_SIZE, type RecoveryCursor, type RecoveryPage, type TasksRecovery } from "@/lib/projects/recovery";
import { withRecoveryTransaction } from "@/lib/projects/recovery-lock-retry";

type Database = typeof db;
type Reader = Pick<Database, "select">;
const unavailable = { kind: "unavailable" } as const;
const shareRow = sql<number>`share_links.rowid`;
const fileRow = sql<number>`attachments.rowid`;

function page<T extends { row: number }, U>(rows: T[], project: (row: T) => U): RecoveryPage<U> {
  const visible = rows.slice(0, RECOVERY_PAGE_SIZE);
  return { items: visible.map(project), next: rows.length > RECOVERY_PAGE_SIZE ? visible.at(-1)!.row : null };
}

/** Non-bearer, exact-row comparison even for pre-0027 legacy secret IDs.
 * Rowids are locators only: replacement/rekeying must also match the digest.
 * A stale locator refuses rather than revoking a different link. */
function fingerprint(projectId: string, token: string, scheme: string) {
  return createHash("sha256").update(JSON.stringify([projectId, token, scheme])).digest("hex");
}

async function proveRecoveryProject(executor: Reader, actorUserId: string, candidate: string) {
  const id = parseProjectId(candidate);
  if (!id || !actorUserId) return null;
  const grant = await proveProjectCapability(actorUserId, id, "open", "enforce", executor);
  if (!grant.ok) return null;
  const [actor] = await executor.select({ clerkId: users.clerkId }).from(users).where(eq(users.id, actorUserId)).limit(1);
  if (!actor?.clerkId || await hasAccountDeletionStartedWith(executor, actor.clerkId)) return null;
  return grant;
}

/** Metadata only. Never loads Tasks, task bodies, Notes or commercial readers.
 * Every read stays exact-project; account export remains separately available. */
export async function readTasksRecoveryWith(database: Database, actorUserId: string, projectId: string, cursor: RecoveryCursor = {}, now = new Date()): Promise<TasksRecovery> {
  return withRecoveryTransaction(database, () => database.transaction(async tx => {
    const grant = await proveRecoveryProject(tx, actorUserId, projectId);
    if (!grant) return unavailable;
    const [project] = await tx.select({ id: workspaces.id, name: workspaces.name, publishedAt: workspaces.publishedAt })
      .from(workspaces).where(eq(workspaces.id, grant.projectId)).limit(1);
    if (!project) return unavailable;
    let deletionPending = false;
    try { await assertProjectNotDeleting(tx, grant.projectId); }
    catch (error) { if (error instanceof ProjectDeletionInProgressError) deletionPending = true; else throw error; }
    const links = await tx.select({ row: shareRow, token: shareLinks.token, scheme: shareLinks.tokenScheme,
      createdAt: shareLinks.createdAt, expiresAt: shareLinks.expiresAt, revokedAt: shareLinks.revokedAt })
      .from(shareLinks).where(and(eq(shareLinks.workspaceId, grant.projectId), cursor.links ? lt(shareRow, cursor.links) : undefined))
      .orderBy(desc(shareRow)).limit(RECOVERY_PAGE_SIZE + 1);
    const canDelete = grant.capabilities.deleteOrTransferOwnership;
    const files = canDelete ? await tx.select({ row: fileRow, id: attachments.id, filename: attachments.filename, bytes: attachments.sizeBytes })
      .from(attachments).where(and(eq(attachments.workspaceId, grant.projectId), cursor.files ? lt(fileRow, cursor.files) : undefined))
      .orderBy(desc(fileRow)).limit(RECOVERY_PAGE_SIZE + 1) : [];
    return {
      kind: "ready", project: { id: project.id, name: project.name, archived: grant.archived },
      canDelete, canUnpublish: grant.capabilities.revokeTimeline, deletionPending, published: project.publishedAt !== null,
      links: page(links, link => ({ row: link.row, fingerprint: fingerprint(project.id, link.token, link.scheme),
        createdAt: link.createdAt.toISOString(), state: link.revokedAt ? "revoked" as const : link.expiresAt && link.expiresAt <= now ? "expired" as const : "active" as const })),
      files: page(files, file => ({ id: file.id, filename: file.filename, bytes: file.bytes })),
    };
  }, { behavior: "deferred" }));
}

/** Negative-only authority: the same current member population as the existing
 * task-share revoke action (including its deferred archive policy), without
 * borrowing task-edit permission. This cannot mint, rotate or edit a link. */
export async function revokeRecoveryShareWith(database: Database, actorUserId: string, projectId: string, reference: { row: number; fingerprint: string }): Promise<boolean> {
  if (!Number.isSafeInteger(reference.row) || reference.row < 1 || !/^[a-f0-9]{64}$/.test(reference.fingerprint)) return false;
  return withRecoveryTransaction(database, () => database.transaction(async tx => {
    const grant = await proveRecoveryProject(tx, actorUserId, projectId);
    if (!grant) return false;
    try { await assertProjectNotDeleting(tx, grant.projectId); }
    catch (error) { if (error instanceof ProjectDeletionInProgressError) return false; throw error; }
    const [link] = await tx.select({ token: shareLinks.token, scheme: shareLinks.tokenScheme }).from(shareLinks)
      .where(and(eq(shareLinks.workspaceId, grant.projectId), eq(shareRow, reference.row))).limit(1);
    if (!link || fingerprint(grant.projectId, link.token, link.scheme) !== reference.fingerprint) return false;
    await tx.update(shareLinks).set({ revokedAt: new Date() }).where(and(
      eq(shareLinks.workspaceId, grant.projectId), eq(shareLinks.token, link.token), isNull(shareLinks.revokedAt),
    ));
    return true;
  }, { behavior: "immediate" }));
}

/** Adapter for the existing public-id action; global lookup only discovers the
 * object's project before the same transactional local authority is proved. */
export async function revokeTaskShareByIdWith(database: Database, actorUserId: string, token: string): Promise<boolean> {
  // isolation-ok: exact stored link id discovers its owning project; no result
  // is returned to the caller before exact-project transactional authorization.
  const [link] = await database.select({ row: shareRow, projectId: shareLinks.workspaceId, scheme: shareLinks.tokenScheme })
    .from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  return link?.projectId ? revokeRecoveryShareWith(database, actorUserId, link.projectId, {
    row: link.row, fingerprint: fingerprint(link.projectId, token, link.scheme),
  }) : false;
}

/** Existing board-unpublish write, shared by Settings and independent recovery.
 * Re-proves the established manager capability in the committing transaction. */
export async function unpublishProjectWith(database: Database, actorUserId: string, projectId: string): Promise<{ slug: string } | null> {
  return withRecoveryTransaction(database, () => database.transaction(async tx => {
    const grant = await proveRecoveryProject(tx, actorUserId, projectId);
    if (!grant?.capabilities.revokeTimeline) return null;
    await assertProjectNotDeleting(tx, grant.projectId);
    const [row] = await tx.select({ slug: workspaces.slug }).from(workspaces).where(eq(workspaces.id, grant.projectId)).limit(1);
    if (!row) return null;
    await tx.update(workspaces).set({ publishedAt: null }).where(eq(workspaces.id, grant.projectId));
    return row;
  }, { behavior: "immediate" }));
}
