import assert from "node:assert/strict";
import test from "node:test";
import { createTaskInTransaction, prepareCanonicalTaskCreate } from "./create-task-core";

test("canonical task creation preserves public defaults and explicit completion/date fields", async () => {
  const createdAt = new Date("2026-09-12T12:00:00.000Z");
  const completedAt = new Date("2026-09-12T12:01:00.000Z");
  const dueAt = new Date("2026-10-25T12:00:00.000Z");
  const task = prepareCanonicalTaskCreate({ id: "task_1", workspaceId: "project_1", title: "Reviewed work", dueAt, completedAt, createdAt });
  assert.deepEqual({ lane: task.lane, priority: task.priority, assignees: task.assignees, description: task.description,
    tags: task.tags, recurrence: task.recurrence, parentTaskId: task.parentTaskId, isMilestone: task.isMilestone },
  { lane: "todo", priority: "p2", assignees: [], description: null, tags: null, recurrence: null, parentTaskId: null, isMilestone: false });
  assert.equal(task.dueAtSeconds, dueAt.getTime() / 1000);
  assert.equal(task.completedAtSeconds, completedAt.getTime() / 1000);

  const order: string[] = [];
  const result = await createTaskInTransaction({
    async nextPosition() { order.push("position"); return 7; },
    async insertTask(value) { order.push(`task:${value.position}`); return { seq: 12 }; },
    async insertActivity() { order.push("activity"); },
  }, task);
  assert.deepEqual(result, { taskId: "task_1", seq: 12, position: 7 });
  assert.deepEqual(order, ["position", "task:7", "activity"]);
});

test("task core surfaces an activity failure so its owning transaction can roll back", async () => {
  const task = prepareCanonicalTaskCreate({ id: "task_2", workspaceId: "project_1", title: "Atomic work" });
  await assert.rejects(createTaskInTransaction({
    async nextPosition() { return 1; },
    async insertTask() { return { seq: 1 }; },
    async insertActivity() { throw new Error("activity_failed"); },
  }, task), /activity_failed/);
});
