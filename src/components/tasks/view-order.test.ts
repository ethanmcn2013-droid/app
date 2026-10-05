import { test } from "node:test";
import assert from "node:assert/strict";
import type { LabTask, TaskSchedule } from "@/components/hybrid/types";
import { boardOrder, calendarOrder } from "./view-order";

const task = (id: string, status: string, order: number, schedule: TaskSchedule = { kind: "unscheduled" }): LabTask => ({
  id,
  title: id,
  description: "",
  status,
  priority: "normal",
  assigneeIds: [],
  schedule,
  labelIds: [],
  subtasks: [],
  attachments: [],
  comments: [],
  blockedByIds: [],
  blockerIds: [],
  completed: false,
  workspaceId: "p",
  order,
});

test("the board walks column by column in the order each column draws", () => {
  const rows: Record<string, LabTask[]> = {
    todo: [task("a", "todo", 2), task("b", "todo", 1)],
    doing: [task("c", "doing", 1)],
    done: [task("d", "done", 1)],
  };
  // The column decides its own order (manual, due date, priority); the walk
  // follows it rather than re-sorting by stored position.
  assert.deepEqual(boardOrder(["todo", "doing", "done"], (key) => rows[key] ?? []), ["a", "b", "c", "d"]);
  assert.deepEqual(boardOrder(["done", "todo"], (key) => rows[key] ?? []), ["d", "a", "b"]);
});

test("the calendar walks dated work by day, then the tasks that need a date", () => {
  const visible = [
    task("later", "todo", 1, { kind: "due", dueOn: "2026-07-20" }),
    task("undated", "todo", 2),
    task("range", "doing", 3, { kind: "range", startOn: "2026-07-14", dueOn: "2026-07-22" }),
    task("milestone", "doing", 4, { kind: "milestone", on: "2026-07-16" }),
    task("sameDay", "todo", 5, { kind: "due", dueOn: "2026-07-20" }),
  ];
  assert.deepEqual(calendarOrder(visible), ["range", "milestone", "later", "sameDay", "undated"]);
});
