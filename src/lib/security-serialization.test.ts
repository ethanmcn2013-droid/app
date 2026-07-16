import assert from "node:assert/strict";
import test from "node:test";
import { buildIcsCalendar } from "./ical";
import { formatTasksAsCsv } from "./exports";
import type { Task } from "./data";

test("iCalendar output cannot inject properties through a task uid", () => {
  const calendar = buildIcsCalendar({
    workspaceName: "Workspace",
    events: [{
      uid: "task-1\r\nATTENDEE:mailto:outside@example.com",
      summary: "Safe",
      start: new Date("2026-07-16T12:00:00Z"),
    }],
  });
  assert.doesNotMatch(calendar, /\r\nATTENDEE:/);
  assert.match(calendar, /UID:task-1\\nATTENDEE:/);
});

test("CSV export neutralizes spreadsheet formula prefixes", () => {
  const task = {
    id: "t-1",
    workspaceId: "ws-a",
    title: "=HYPERLINK(\"https://example.invalid\")",
    description: "",
    lane: "todo",
    priority: "p2",
    assignees: [],
    tags: [],
    parentTaskId: null,
    externalContactName: null,
    externalContactEmail: null,
    cents: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Task;
  const csv = formatTasksAsCsv([task]);
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.invalid""\)"/);
});
