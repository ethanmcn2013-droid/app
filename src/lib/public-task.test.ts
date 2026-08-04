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
    // The column claim is public by design (T·121): guest surfaces group
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

test("overdue flag derives from dueAt only when a serving instant is given", () => {
  const dueTuesday = {
    ...privateTask,
    dueAt: new Date("2026-07-14T09:00:00Z"),
  };
  const thursday = new Date("2026-07-16T08:00:00Z");

  // No instant → historical shape, never the flag.
  assert.equal(toPublicTask(dueTuesday).overdue, undefined);
  // Past due at the serving instant → flagged, timestamp itself not exposed.
  const projected = toPublicTask(dueTuesday, thursday);
  assert.equal(projected.overdue, true);
  assert.equal("dueAt" in projected, false);
  // Done work is never "late".
  assert.equal(
    toPublicTask({ ...dueTuesday, lane: "done" }, thursday).overdue,
    undefined,
  );
  // Not yet due → no flag.
  assert.equal(
    toPublicTask(dueTuesday, new Date("2026-07-13T08:00:00Z")).overdue,
    undefined,
  );
});
