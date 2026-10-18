import "server-only";
import { eq, sql } from "drizzle-orm";
import { activities, tasks } from "@/server/db/schema";
import type { CanonicalTaskCreate } from "@/server/tasks/create-task-core";
import { captureTaskCreated } from "@/server/sponsored-use/capture";
import { privateTaskDbWrite } from "@/server/actions/private-task-db-write";
import { AssistantActionRefusal, type AssistantActionTransaction } from "./context";

/** Bounded append only. The caller holds the store's immediate writer transaction and authorization.
 * Values are produced by prepareCanonicalTaskCreate; this never replaces an existing graph.
 */
export async function insertAssistantTaskBatch(tx: AssistantActionTransaction, input: {
  actorId: string; projectId: string; values: readonly CanonicalTaskCreate[]; activityId: (id: string) => string;
}) {
  if (!input.values.length || input.values.length > 100 || input.values.some(value => value.workspaceId !== input.projectId)) {
    throw new AssistantActionRefusal("unsupported");
  }
  const [counter] = await tx.select({ max: sql<number | null>`MAX(${tasks.seq})` }).from(tasks).where(eq(tasks.workspaceId, input.projectId));
  const lanes = await tx.select({ lane: tasks.lane, max: sql<number | null>`MAX(${tasks.position})` }).from(tasks)
    .where(eq(tasks.workspaceId, input.projectId)).groupBy(tasks.lane);
  const positions = new Map(lanes.map(row => [row.lane, row.max ?? 0]));
  const values = input.values.map((task, index) => {
    const position = (positions.get(task.lane) ?? 0) + 1; positions.set(task.lane, position);
    return { id: task.id, workspaceId: input.projectId, seq: (counter?.max ?? 0) + index + 1, title: task.title,
      description: task.description, lane: task.lane, priority: task.priority, assignees: [...task.assignees],
      estimate: task.estimate, due: task.due, dueAt: task.dueAtSeconds === null ? null : new Date(task.dueAtSeconds * 1000),
      position, isMilestone: task.isMilestone, completedAt: task.completedAtSeconds === null ? null : new Date(task.completedAtSeconds * 1000),
      createdAt: new Date(task.createdAtSeconds * 1000), updatedAt: new Date(task.createdAtSeconds * 1000) };
  });
  // 25 rows keeps bound parameters below SQLite's conservative 999-variable limit.
  for (let offset = 0; offset < values.length; offset += 25) {
    const chunk = values.slice(offset, offset + 25);
    const inserted = await privateTaskDbWrite(() => tx.insert(tasks).values(chunk).returning({ id: tasks.id }));
    if (inserted.length !== chunk.length) throw new AssistantActionRefusal("stale");
  }
  await tx.insert(activities).values(input.values.map(task => ({ id: input.activityId(task.id), workspaceId: input.projectId,
    taskId: task.id, userId: input.actorId, kind: "taskAdd" as const, payload: { kind: "taskAdd" as const, lane: task.lane },
    createdAt: new Date(task.createdAtSeconds * 1000) })));
  for (const task of input.values) await captureTaskCreated(tx, { actorUserId: input.actorId, projectId: task.workspaceId });
  return values.map(value => value.id);
}
