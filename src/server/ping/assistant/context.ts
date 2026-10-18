import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { db } from "@/server/db";
import { meta, tasks, users, workspaceMembers, workspaces } from "@/server/db/schema";
import { proveProjectCapability, type ProjectCapabilityKey } from "@/server/actions/project-authz";
import { parseProjectId } from "@/lib/projects/project-ref";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { accountDeletionTombstoneKey } from "@/server/account-deletion-key";
import { pingMemberNameKey } from "@/lib/ping/command";

export type AssistantActionTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class AssistantActionRefusal extends Error {
  constructor(readonly code: "unavailable" | "ambiguous" | "unsupported" | "stale") { super(code); }
}
export type ResolvedAssistantProject = typeof workspaces.$inferSelect;

/** Account and Project erasure fences use the same transaction as the effect. */
export async function assertAssistantActor(tx: AssistantActionTransaction, actorId: string) {
  const [actor] = await tx.select().from(users).where(eq(users.id, actorId)).limit(1);
  if (!actor) throw new AssistantActionRefusal("unavailable");
  const key = accountDeletionTombstoneKey(actor.clerkId ?? actor.id);
  if ((await tx.select({ key: meta.key }).from(meta).where(eq(meta.key, key)).limit(1)).length) {
    throw new AssistantActionRefusal("unavailable");
  }
  return actor;
}

export async function authorizeAssistantProject(tx: AssistantActionTransaction, actorId: string, projectId: string,
  capability: ProjectCapabilityKey = "open") {
  const id = parseProjectId(projectId);
  if (!id || !(await proveProjectCapability(actorId, id, capability, "enforce", tx)).ok) {
    throw new AssistantActionRefusal("unavailable");
  }
  await assertAssistantActor(tx, actorId);
  await assertProjectNotDeleting(tx, id);
  const [project] = await tx.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  if (!project?.ownerUserId) throw new AssistantActionRefusal("unavailable");
  await assertAssistantActor(tx, project.ownerUserId);
  return project;
}

/** Names select candidates only. The chosen canonical ID is separately authorized. */
export async function resolveAssistantProjectName(tx: AssistantActionTransaction, actorId: string, name: string,
  capability: ProjectCapabilityKey = "open") {
  await assertAssistantActor(tx, actorId);
  const rows = await tx.select({ id: workspaces.id, name: workspaces.name }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, actorId));
  const key = name.normalize("NFKC").trim().toLocaleLowerCase("en");
  const matches = rows.filter(row => row.name.normalize("NFKC").trim().toLocaleLowerCase("en") === key);
  if (matches.length !== 1) throw new AssistantActionRefusal(matches.length > 1 ? "ambiguous" : "unavailable");
  return authorizeAssistantProject(tx, actorId, matches[0].id, capability);
}

/** Only an authorized Project roster; never the global users directory. */
export async function assistantMemberRoster(tx: AssistantActionTransaction, actorId: string, projectId: string) {
  await authorizeAssistantProject(tx, actorId, projectId);
  return tx.select({ userId: users.id, name: users.name, role: workspaceMembers.role }).from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId)).where(eq(workspaceMembers.workspaceId, projectId));
}

export async function resolveAssistantMember(tx: AssistantActionTransaction, actorId: string, projectId: string,
  ref: { kind: "self" } | { kind: "name"; name: string }) {
  const roster = await assistantMemberRoster(tx, actorId, projectId);
  const matches = ref.kind === "self" ? roster.filter(row => row.userId === actorId)
    : roster.filter(row => pingMemberNameKey(row.name) !== null && pingMemberNameKey(row.name) === pingMemberNameKey(ref.name));
  if (matches.length !== 1) throw new AssistantActionRefusal(matches.length > 1 ? "ambiguous" : "unavailable");
  await assertAssistantActor(tx, matches[0].userId);
  return matches[0].userId;
}

/** Captured IDs have no authority until every row is re-read inside the writer snapshot. */
export async function assistantTasksByIds(tx: AssistantActionTransaction, actorId: string, projectId: string,
  ids: readonly string[], writing = true) {
  await authorizeAssistantProject(tx, actorId, projectId, writing ? "createOrEditTasks" : "open");
  if (!ids.length || ids.length > 500 || new Set(ids).size !== ids.length) throw new AssistantActionRefusal("unsupported");
  const rows = await tx.select().from(tasks).where(and(eq(tasks.workspaceId, projectId), inArray(tasks.id, [...ids])));
  if (rows.length !== ids.length) throw new AssistantActionRefusal("stale");
  const byId = new Map(rows.map(row => [row.id, row]));
  return ids.map(id => byId.get(id)!);
}

export async function assistantTaskCatalog(tx: AssistantActionTransaction, actorId: string, projectId: string,
  includeArchived = false) {
  await authorizeAssistantProject(tx, actorId, projectId);
  return tx.select().from(tasks).where(and(eq(tasks.workspaceId, projectId), includeArchived ? undefined : isNull(tasks.archivedAt)))
    .orderBy(asc(tasks.seq), asc(tasks.id)).limit(1001);
}

/** Bounded account catalog. No foreign Project names or member addresses are projected. */
export async function getAssistantContext(tx: AssistantActionTransaction, actorId: string, projectId?: string | null) {
  await assertAssistantActor(tx, actorId);
  const projects = await tx.select({ id: workspaces.id, name: workspaces.name, archivedAt: workspaces.archivedAt })
    .from(workspaceMembers).innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, actorId)).orderBy(asc(workspaces.id)).limit(201);
  if (projects.length > 200) throw new AssistantActionRefusal("unsupported");
  if (!projectId) return { projects, project: null, members: [], tasks: [] };
  const project = await authorizeAssistantProject(tx, actorId, projectId);
  const members = await assistantMemberRoster(tx, actorId, projectId);
  const catalog = await assistantTaskCatalog(tx, actorId, projectId);
  if (catalog.length > 1000) throw new AssistantActionRefusal("unsupported");
  return { projects, project: { id: project.id, name: project.name }, members,
    tasks: catalog.map(row => ({ id: row.id, title: row.title, status: row.boardColumnKey ?? row.lane,
      milestone: row.isMilestone, seq: row.seq })) };
}
