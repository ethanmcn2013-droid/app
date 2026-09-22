import "server-only";

import type { LaneId, Priority, RecurrenceSpec, UserId } from "@/lib/data";

export type CanonicalTaskCreate = Readonly<{
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  lane: LaneId;
  priority: Priority;
  assignees: readonly UserId[];
  estimate: number | null;
  due: string | null;
  dueAtSeconds: number | null;
  tags: readonly string[] | null;
  recurrence: RecurrenceSpec | null;
  externalContactName: string | null;
  externalContactEmail: string | null;
  cents: number | null;
  parentTaskId: string | null;
  isMilestone: boolean;
  completedAtSeconds: number | null;
  createdAtSeconds: number;
}>;

export type TaskCreateOperations = Readonly<{
  nextPosition(input: CanonicalTaskCreate): Promise<number>;
  insertTask(input: CanonicalTaskCreate & { position: number }): Promise<{ seq: number }>;
  insertActivity(input: CanonicalTaskCreate): Promise<void>;
}>;

function nullable<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

export function prepareCanonicalTaskCreate(input: Readonly<{
  id: string;
  workspaceId: string;
  title: string;
  description?: string | null;
  lane?: LaneId;
  priority?: Priority;
  assignees?: readonly UserId[];
  estimate?: number | null;
  due?: string | null;
  dueAt?: Date | null;
  tags?: readonly string[] | null;
  recurrence?: RecurrenceSpec | null;
  externalContactName?: string | null;
  externalContactEmail?: string | null;
  cents?: number | null;
  parentTaskId?: string | null;
  isMilestone?: boolean;
  completedAt?: Date | null;
  createdAt?: Date;
}>): CanonicalTaskCreate {
  // Validation of user-authored text belongs to each transport. The legacy
  // server action passes its title through byte-for-byte; promotion validates
  // and normalizes its separately reviewed form before reaching this core.
  const title = input.title;
  if (!input.id || !input.workspaceId) {
    throw new Error("invalid_task_create");
  }
  const createdAtSeconds = Math.floor((input.createdAt ?? new Date()).getTime() / 1000);
  const dueAtSeconds = input.dueAt == null ? null : Math.floor(input.dueAt.getTime() / 1000);
  const completedAtSeconds = input.completedAt == null ? null : Math.floor(input.completedAt.getTime() / 1000);
  if (!Number.isSafeInteger(createdAtSeconds) || (dueAtSeconds !== null && !Number.isSafeInteger(dueAtSeconds)) ||
      (completedAtSeconds !== null && !Number.isSafeInteger(completedAtSeconds))) {
    throw new Error("invalid_task_date");
  }
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    title,
    description: nullable(input.description),
    lane: input.lane ?? "todo",
    priority: input.priority ?? "p2",
    assignees: [...(input.assignees ?? [])],
    estimate: nullable(input.estimate),
    due: nullable(input.due),
    dueAtSeconds,
    tags: input.tags == null ? null : [...input.tags],
    recurrence: nullable(input.recurrence),
    externalContactName: nullable(input.externalContactName),
    externalContactEmail: nullable(input.externalContactEmail),
    cents: nullable(input.cents),
    parentTaskId: nullable(input.parentTaskId),
    isMilestone: input.isMilestone ?? false,
    completedAtSeconds,
    createdAtSeconds,
  };
}

/** One shared task write seam. The caller supplies operations bound to its open transaction. */
export async function createTaskInTransaction(
  operations: TaskCreateOperations,
  task: CanonicalTaskCreate,
): Promise<{ taskId: string; seq: number; position: number }> {
  const position = await operations.nextPosition(task);
  const { seq } = await operations.insertTask({ ...task, position });
  await operations.insertActivity(task);
  return { taskId: task.id, seq, position };
}
