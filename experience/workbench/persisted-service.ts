import "server-only";
import { createHash } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import type { db } from "@/server/db";
import { activities, meta, tasks, users, workspaces } from "@/server/db/schema";
import { authorizeStoredProject } from "@/server/actions/project-authz";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { privateTaskDbWrite } from "@/server/actions/private-task-db-write";
import { nextTaskSeq } from "@/server/db/task-seq";
import { createTaskInTransaction, prepareCanonicalTaskCreate } from "@/server/tasks/create-task-core";

/** Internal recipe adapter, never an authenticated product transport. The caller
 * owns a fresh local database and explicitly supplies the synthetic principal. */
export type Operation = Readonly<{ operationId: string; actor: string; project: string; taskId: string; title: string; createdAt: string }>;
type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
export const operationKey = (operation: Operation) => `board:${operation.project}:workbench-task-create:${sha(operation.operationId)}`;
export const activityId = (operation: Operation) => `a-workbench-${sha(operation.operationId).slice(0, 32)}`;
const identity = (operation: Operation) => ({ version: 1, ...operation, payloadDigest: sha(JSON.stringify({ title: operation.title, lane: "todo", priority: "p2" })) });
type Stored = ReturnType<typeof identity> & { seq: number; position: number; activityId: string };
type Proof = { status: "present"; result: Stored } | { status: "absent" | "unknown" };

async function authorize(tx: Transaction, operation: Operation) {
  const proof = await authorizeStoredProject({ storedProjectId: operation.project, actorUserId: operation.actor,
    capability: "createOrEditTasks", archivePolicy: "enforce", executor: tx });
  if (!proof.ok) throw new Error("Project is unavailable");
  await assertProjectNotDeleting(tx, operation.project);
  const [actor] = await tx.select({ id: users.id, clerkId: users.clerkId }).from(users).where(eq(users.id, operation.actor)).limit(1);
  const [owner] = await tx.select({ id: users.id, clerkId: users.clerkId }).from(workspaces)
    .innerJoin(users, eq(users.id, workspaces.ownerUserId)).where(eq(workspaces.id, operation.project)).limit(1);
  if (!actor || !owner || await hasAccountDeletionStartedWith(tx, actor.clerkId ?? actor.id) ||
    await hasAccountDeletionStartedWith(tx, owner.clerkId ?? owner.id)) throw new Error("Project is unavailable");
}
function validate(operation: Operation) {
  for (const name of ["operationId", "actor", "project", "taskId"] as const) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(operation[name])) throw new Error("Invalid local operation identity");
  }
  if (typeof operation.title !== "string" || !operation.title.trim() || operation.title.length > 500 ||
    !Number.isFinite(Date.parse(operation.createdAt)) || new Date(operation.createdAt).toISOString() !== operation.createdAt)
    throw new Error("Invalid local operation payload");
}

async function prove(tx: Transaction, operation: Operation): Promise<Proof> {
  const [record] = await tx.select().from(meta).where(eq(meta.key, operationKey(operation))).limit(1);
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, operation.taskId)).limit(1);
  const activity = await tx.select().from(activities).where(or(eq(activities.id, activityId(operation)), eq(activities.taskId, operation.taskId))).limit(2);
  if (!record) {
    if (activity.some(row => row.id === activityId(operation) && (row.workspaceId !== operation.project || row.taskId !== operation.taskId || row.userId !== operation.actor)))
      throw new Error("Operation identity conflicts");
    return !task && activity.length === 0 ? { status: "absent" } : { status: "unknown" };
  }
  let result: Stored;
  try { result = JSON.parse(record.value) as Stored; } catch { return { status: "unknown" }; }
  const expected = identity(operation);
  if (!result || typeof result !== "object" || Object.keys(result).length !== Object.keys(expected).length + 3) return { status: "unknown" };
  if (Object.keys(expected).some(key => result[key as keyof typeof expected] !== expected[key as keyof typeof expected]))
    throw new Error("Operation identity conflicts");
  if (!Number.isSafeInteger(result.seq) || result.seq < 1 || !Number.isFinite(result.position) || result.activityId !== activityId(operation) ||
    !task || task.workspaceId !== operation.project || task.title !== operation.title || task.lane !== "todo" || task.priority !== "p2" ||
    task.seq !== result.seq || task.position !== result.position || task.parentTaskId !== null || task.description !== null ||
    task.assignees.length !== 0 || task.completedAt !== null || task.updatedAt.toISOString() !== operation.createdAt ||
    activity.length !== 1 || activity[0].workspaceId !== operation.project || activity[0].taskId !== operation.taskId ||
    activity[0].userId !== operation.actor || activity[0].kind !== "taskAdd" || activity[0].payload.kind !== "taskAdd" ||
    activity[0].payload.lane !== "todo" || activity[0].createdAt.toISOString() !== operation.createdAt) return { status: "unknown" };
  return { status: "present", result };
}

export async function reconcile(database: Database, operation: Operation) {
  validate(operation);
  return database.transaction(async tx => { await authorize(tx, operation); return prove(tx, operation); }, { behavior: "immediate" });
}

export async function createOwnedLocalTask(database: Database, operation: Operation,
  hooks: { afterTask?: () => Promise<void>; afterActivity?: () => Promise<void> } = {}) {
  validate(operation);
  return database.transaction(async tx => {
    await authorize(tx, operation); // Replay cannot bypass revoked membership or fences.
    const existing = await prove(tx, operation);
    if (existing.status === "present") return { reused: true, ...existing };
    if (existing.status !== "absent") throw new Error("Operation facts are unknown; no retry permitted");
    const task = prepareCanonicalTaskCreate({ id: operation.taskId, workspaceId: operation.project,
      title: operation.title, createdAt: new Date(operation.createdAt) });
    const written = await createTaskInTransaction({
      async nextPosition(value) {
        const [row] = await tx.select({ max: sql<number | null>`MAX(${tasks.position})` }).from(tasks)
          .where(and(eq(tasks.workspaceId, value.workspaceId), eq(tasks.lane, value.lane)));
        return (row?.max ?? 0) + 1;
      },
      async insertTask(value) {
        const [row] = await privateTaskDbWrite(() => tx.insert(tasks).values({ id: value.id, workspaceId: value.workspaceId,
          seq: nextTaskSeq(value.workspaceId), title: value.title, description: value.description, lane: value.lane, priority: value.priority,
          assignees: [...value.assignees], position: value.position, updatedAt: new Date(value.createdAtSeconds * 1000) }).returning({ seq: tasks.seq }));
        if (!row || row.seq === null) throw new Error("Canonical insert did not return sequence");
        await hooks.afterTask?.();
        return { seq: row.seq };
      },
      async insertActivity(value) {
        await tx.insert(activities).values({ id: activityId(operation), workspaceId: value.workspaceId, taskId: value.id,
          userId: operation.actor, kind: "taskAdd", payload: { kind: "taskAdd", lane: value.lane }, createdAt: new Date(value.createdAtSeconds * 1000) });
        await hooks.afterActivity?.();
      },
    }, task);
    const result: Stored = { ...identity(operation), seq: written.seq, position: written.position, activityId: activityId(operation) };
    await tx.insert(meta).values({ key: operationKey(operation), value: JSON.stringify(result), updatedAt: new Date(operation.createdAt) });
    return { reused: false, status: "present" as const, result };
  }, { behavior: "immediate" });
}
