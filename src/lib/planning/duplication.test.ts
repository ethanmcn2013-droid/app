import { test } from "node:test";
import assert from "node:assert/strict";
import { planDuplicatedTasks, type DuplicableTask } from "./duplication";

const task: DuplicableTask = {
  id: "task-complete",
  title: "Reusable lesson plan",
  description: "Private working description",
  lane: "done",
  priority: "p2",
  assignees: ["owner", "old-collaborator"],
  due: "2026-05-10",
  dueAt: new Date("2026-05-10T09:00:00Z"),
  estimate: 2,
  tags: ["lesson"],
  recurrence: null,
  startDay: 2,
  durationDays: 1,
  position: 1,
  parentTaskId: null,
  boardColumnKey: null,
  isMilestone: false,
};

test("scenario L: duplication resets completion and filters former assignees", () => {
  const [copy] = planDuplicatedTasks(
    [task],
    { copyReusableTasks: true, copyTimelineStructure: false },
    new Set(["owner"]),
    () => "new-task",
  );
  assert.equal(copy.id, "new-task");
  assert.equal(copy.lane, "todo");
  assert.deepEqual(copy.assignees, ["owner"]);
});

test("scenario L: duplication output cannot carry public links, invites, history, attachments, sponsor, or Notes provenance", () => {
  const hostile = {
    ...task,
    shareToken: "public-secret",
    invitationToken: "invite-secret",
    history: [{ completedAt: "yesterday" }],
    attachment: { path: "private" },
    sponsorId: "venue",
    sourceNoteId: "private-note",
  };
  const [copy] = planDuplicatedTasks(
    [hostile],
    { copyReusableTasks: true, copyTimelineStructure: false },
    new Set(["owner"]),
    () => "new-task",
  );
  const serialized = JSON.stringify(copy);
  for (const secret of ["public-secret", "invite-secret", "yesterday", "private-note", "venue"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("Timeline structure is copied only when explicitly selected", () => {
  const milestone = { ...task, id: "milestone", isMilestone: true };
  assert.equal(
    planDuplicatedTasks(
      [milestone],
      { copyReusableTasks: true, copyTimelineStructure: false },
      new Set(),
      () => "copy",
    ).length,
    0,
  );
});
