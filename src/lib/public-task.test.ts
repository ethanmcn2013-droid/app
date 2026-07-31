import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "./data";
import { toPublicTask } from "./public-task";

const privateTask: Task = {
  id: "t-private",
  workspaceId: "ws-secret",
  title: "Publish the launch plan",
  description: "Internal notes: delay until vendor confirms.",
  lane: "doing",
  priority: "p1",
  assignees: ["owner"],
  due: "Fri",
  tags: ["launch"],
  comments: 4,
  idleDays: 2,
  blockedBy: ["t-foreign"],
  startDay: 3,
  durationDays: 2,
  recurrence: { kind: "weekly", weekday: 5 },
  position: 4,
  parentTaskId: null,
  externalContactName: "Vendor Contact",
  externalContactEmail: "vendor@example.com",
  cents: 125000,
  isMilestone: true,
  boardColumnKey: "launch",
  sourceNoteId: "user-1:note-1",
  updatedAt: new Date("2026-07-11T12:00:00Z"),
};

test("public task projection is a stable allowlist", () => {
  const projected = toPublicTask(privateTask);
  assert.deepEqual(projected, {
    id: "t-private",
    title: "Publish the launch plan",
    lane: "doing",
    priority: "p1",
    due: "Fri",
    tags: ["launch"],
    // The column claim is public by design (T·120): guest surfaces group
    // by the operator's custom columns through it.
    boardColumnKey: "launch",
  });
  assert.deepEqual(Object.keys(projected).sort(), [
    "boardColumnKey",
    "due",
    "id",
    "lane",
    "priority",
    "tags",
    "title",
  ]);
});

test("public projection omits empty optional fields", () => {
  const projected = toPublicTask({
    ...privateTask,
    due: undefined,
    tags: [],
  });
  assert.deepEqual(projected, {
    id: "t-private",
    title: "Publish the launch plan",
    lane: "doing",
    priority: "p1",
    boardColumnKey: "launch",
  });
});
