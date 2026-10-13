import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { db } from "@/server/db";
import { activities, meta, tasks, users, workspaces } from "@/server/db/schema";
import { authorizeStoredProject } from "@/server/actions/project-authz";
import { hasAccountDeletionStartedWith } from "@/server/account-deletion-lifecycle";
import { assertProjectNotDeleting } from "@/server/projects/project-deletion-fence";
import { privateTaskDbWrite } from "@/server/actions/private-task-db-write";
import { nextTaskSeq } from "@/server/db/task-seq";
import { createTaskInTransaction, prepareCanonicalTaskCreate } from "./create-task-core";
import { canonicalTitleUpdate } from "./title-update-core";
import { readWorkspaceColumnConfig } from "@/server/db/board-config-read";
import { isDoneColumnKey } from "@/lib/board-columns";
import { captureTaskCreated } from "@/server/sponsored-use/capture";
import { assertLocalOperationNotExpired } from "./local-operation-policy";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type LocalOperation = Readonly<{ operationId: string; kind: "create" | "title"; projectId: string; taskId: string; title: string }>;
type Response = { version: 1; operationId: string; kind: "create" | "title"; projectId: string; taskId: string; title: string; seq: number; activityId: string; committedAt: string };
type Receipt = { version: 1; actor: string; operation: LocalOperation; response: Response };
export class LocalOperationError extends Error {
  constructor(public readonly code: "unavailable" | "conflict" | "corrupt" | "invalid") { super(code); }
}
const fail = (code: LocalOperationError["code"]): never => { throw new LocalOperationError(code); };
// libSQL's file adapter reuses one connection per client. Two interactive
// transactions on that connection can leave a statement in progress at commit.
// Serialize this adapter's transactions; SQLite IMMEDIATE remains the boundary
// against other clients and processes.
const transactions = new WeakMap<Database, Promise<void>>();
async function transaction<T>(database: Database, run: (tx: Transaction) => Promise<T>): Promise<T> {
  assertLocalOperationNotExpired();
  const previous = transactions.get(database) ?? Promise.resolve();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const tail = previous.then(() => pending);
  transactions.set(database, tail);
  await previous;
  try { assertLocalOperationNotExpired(); return await database.transaction(async tx => { const result = await run(tx); assertLocalOperationNotExpired(); return result; }, { behavior: "immediate" }); }
  finally { release(); if (transactions.get(database) === tail) transactions.delete(database); }
}
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const exactKeys = (value: unknown, keys: string[]): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
export function parseLocalOperation(value: unknown): LocalOperation {
  if (!exactKeys(value, ["operationId", "kind", "projectId", "taskId", "title"]) || !identifier(value.operationId) || !identifier(value.projectId) || !identifier(value.taskId) ||
    (value.kind !== "create" && value.kind !== "title") || typeof value.title !== "string" || !value.title.trim() || value.title.length > 500) return fail("invalid");
  return { operationId: value.operationId, kind: value.kind, projectId: value.projectId, taskId: value.taskId, title: value.title };
}
/** Injective actor/operation encoding. Kind and object are intentionally absent.
 * Disposable local fixtures only: ordinary production erasure/export do not own this namespace. */
export const localOperationKey = (actor: string, operationId: string) => `local-task-operation:v1:${JSON.stringify([actor, operationId])}`;

async function authorize(tx: Transaction, actor: string, projectId: string, taskId?: string, allowMissingTask = false) {
  if (!identifier(actor)) return fail("unavailable");
  if (taskId) {
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if ((!task && !allowMissingTask) || (task && (task.workspaceId !== projectId || task.archivedAt !== null))) return fail("unavailable");
  }
  const grant = await authorizeStoredProject({ storedProjectId: projectId, actorUserId: actor, capability: "createOrEditTasks", archivePolicy: "enforce", executor: tx });
  if (!grant.ok) return fail("unavailable");
  try { await assertProjectNotDeleting(tx, projectId); } catch { return fail("unavailable"); }
  const [subject] = await tx.select().from(users).where(eq(users.id, actor)).limit(1);
  const [owner] = await tx.select({ id: users.id, clerkId: users.clerkId }).from(workspaces).innerJoin(users, eq(users.id, workspaces.ownerUserId)).where(eq(workspaces.id, projectId)).limit(1);
  if (!subject || !owner || await hasAccountDeletionStartedWith(tx, subject.clerkId ?? actor) || await hasAccountDeletionStartedWith(tx, owner.clerkId ?? owner.id)) return fail("unavailable");
}
function decode(value: string): Receipt {
  let stored: unknown;
  try { stored = JSON.parse(value); } catch { return fail("corrupt"); }
  if (!exactKeys(stored, ["version", "actor", "operation", "response"]) || stored.version !== 1 || !identifier(stored.actor)) return fail("corrupt");
  let operation: LocalOperation;
  try { operation = parseLocalOperation(stored.operation); } catch { return fail("corrupt"); }
  const response = stored.response;
  if (!exactKeys(response, ["version", "operationId", "kind", "projectId", "taskId", "title", "seq", "activityId", "committedAt"]) || response.version !== 1 ||
    !Number.isSafeInteger(response.seq) || (response.seq as number) < 1 || !identifier(response.activityId) || typeof response.committedAt !== "string" ||
    !Number.isFinite(Date.parse(response.committedAt)) || new Date(response.committedAt).toISOString() !== response.committedAt ||
    Object.entries(operation).some(([key, entry]) => response[key] !== entry)) return fail("corrupt");
  return { version: 1, actor: stored.actor, operation, response: response as Response };
}
async function receipt(tx: Transaction, actor: string, operation: LocalOperation) {
  assertLocalOperationNotExpired();
  const [row] = await tx.select().from(meta).where(eq(meta.key, localOperationKey(actor, operation.operationId))).limit(1);
  if (!row) return null;
  const saved = decode(row.value);
  if (saved.actor !== actor) return fail("corrupt");
  if (JSON.stringify(saved.operation) !== JSON.stringify(operation)) return fail("conflict");
  // The immutable operation history is checked against its own activity, never
  // against today's mutable title. Current Task is returned separately.
  const [task] = await tx.select().from(tasks).where(eq(tasks.id, operation.taskId)).limit(1);
  if (!task || task.workspaceId !== operation.projectId || task.archivedAt !== null) return fail("unavailable");
  const [activity] = await tx.select().from(activities).where(eq(activities.id, saved.response.activityId)).limit(1);
  const expected = operation.kind === "create" ? { kind: "taskAdd", lane: "todo" } : { kind: "update", field: "title" };
  if (!activity || activity.userId !== actor || activity.workspaceId !== operation.projectId || activity.taskId !== operation.taskId || activity.kind !== expected.kind ||
    JSON.stringify(activity.payload) !== JSON.stringify(expected) || activity.createdAt.toISOString() !== saved.response.committedAt || task.seq !== saved.response.seq) return fail("corrupt");
  return saved.response;
}
async function current(tx: Transaction, operation: LocalOperation) {
  const [task] = await tx.select({ taskId: tasks.id, projectId: tasks.workspaceId, title: tasks.title, seq: tasks.seq, updatedAt: tasks.updatedAt }).from(tasks).where(and(eq(tasks.id, operation.taskId), eq(tasks.workspaceId, operation.projectId))).limit(1);
  return task ? { ...task, updatedAt: task.updatedAt.toISOString() } : null;
}
export async function reconcileLocalOperation(database: Database, actor: string, input: unknown) {
  const operation = parseLocalOperation(input);
  return transaction(database, async tx => {
    await authorize(tx, actor, operation.projectId, operation.taskId, operation.kind === "create");
    const response = await receipt(tx, actor, operation);
    return { response, currentTask: await current(tx, operation) };
  });
}
export async function applyLocalOperation(database: Database, actor: string, input: unknown, hooks: { afterTask?: () => Promise<void>; afterActivity?: () => Promise<void> } = {}) {
  const operation = parseLocalOperation(input);
  return transaction(database, async tx => {
    await authorize(tx, actor, operation.projectId, operation.taskId, operation.kind === "create");
    const existing = await receipt(tx, actor, operation);
    if (existing) return existing;
    assertLocalOperationNotExpired();
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const activityId = `a-${randomUUID()}`;
    let seq: number;
    if (operation.kind === "create") {
      const [collision] = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, operation.taskId)).limit(1);
      if (collision) return fail("unavailable");
      const done = isDoneColumnKey("todo", await readWorkspaceColumnConfig(operation.projectId, tx));
      const canonical = prepareCanonicalTaskCreate({ id: operation.taskId, workspaceId: operation.projectId, title: operation.title, createdAt: now, completedAt: done ? now : null });
      const written = await createTaskInTransaction({
        async nextPosition(value) { const [row] = await tx.select({ max: sql<number | null>`MAX(${tasks.position})` }).from(tasks).where(and(eq(tasks.workspaceId, value.workspaceId), eq(tasks.lane, value.lane))); return (row?.max ?? 0) + 1; },
        async insertTask(value) {
          assertLocalOperationNotExpired();
          const [row] = await privateTaskDbWrite(() => tx.insert(tasks).values({ id: value.id, workspaceId: value.workspaceId, title: value.title, lane: value.lane, priority: value.priority, assignees: [...value.assignees], seq: nextTaskSeq(value.workspaceId), position: value.position, createdAt: now, updatedAt: now, completedAt: value.completedAtSeconds === null ? null : new Date(value.completedAtSeconds * 1000) }).returning({ seq: tasks.seq }));
          if (!row?.seq) return fail("corrupt");
          await hooks.afterTask?.(); return { seq: row.seq };
        },
        async insertActivity() { assertLocalOperationNotExpired(); await tx.insert(activities).values({ id: activityId, workspaceId: operation.projectId, taskId: operation.taskId, userId: actor, kind: "taskAdd", payload: { kind: "taskAdd", lane: "todo" }, createdAt: now }); await hooks.afterActivity?.(); },
      }, canonical);
      seq = written.seq;
      assertLocalOperationNotExpired();
      await captureTaskCreated(tx, { actorUserId: actor, projectId: operation.projectId });
    } else {
      assertLocalOperationNotExpired();
      const [row] = await privateTaskDbWrite(() => tx.update(tasks).set(canonicalTitleUpdate(operation.title, now)).where(and(eq(tasks.id, operation.taskId), eq(tasks.workspaceId, operation.projectId))).returning({ seq: tasks.seq }));
      if (!row?.seq) return fail("corrupt"); seq = row.seq;
      await hooks.afterTask?.();
      assertLocalOperationNotExpired();
      await tx.insert(activities).values({ id: activityId, workspaceId: operation.projectId, taskId: operation.taskId, userId: actor, kind: "update", payload: { kind: "update", field: "title" }, createdAt: now }); await hooks.afterActivity?.();
    }
    const response: Response = { version: 1, ...operation, seq, activityId, committedAt: now.toISOString() };
    assertLocalOperationNotExpired();
    await tx.insert(meta).values({ key: localOperationKey(actor, operation.operationId), value: JSON.stringify({ version: 1, actor, operation, response } satisfies Receipt), updatedAt: now });
    return response;
  });
}

export async function readLocalTasks(database: Database, actor: string, projectId: string, taskId?: string) {
  if (!identifier(projectId) || (taskId !== undefined && !identifier(taskId))) return fail("invalid");
  return transaction(database, async tx => {
    await authorize(tx, actor, projectId, taskId);
    const rows = await tx.select({ taskId: tasks.id, projectId: tasks.workspaceId, title: tasks.title, seq: tasks.seq }).from(tasks)
      .where(taskId ? and(eq(tasks.workspaceId, projectId), eq(tasks.id, taskId), sql`${tasks.archivedAt} IS NULL`) : and(eq(tasks.workspaceId, projectId), sql`${tasks.archivedAt} IS NULL`));
    return { projectId, tasks: rows };
  });
}
