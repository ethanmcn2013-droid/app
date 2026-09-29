import assert from "node:assert/strict";
import { test } from "node:test";
import { storedDeadline } from "./deadline";
import { deadlineDayDifference } from "../briefing/calendar-time";
import { advanceRecurringDueAt, dateOnlyDueLabel, isDateOnlyDue } from "@/lib/tasks/stored-due-transition";

test("the two current date pickers persist an actual date-only label across extreme zones", () => {
  const due = storedDeadline("2026-03-29", new Date("2026-03-29T09:00:00.000Z"));
  assert.deepEqual(due, { kind: "date-only", date: "2026-03-29" });
  for (const zone of ["Etc/GMT+12", "Pacific/Kiritimati", "Europe/Dublin"]) {
    assert.equal(deadlineDayDifference(due, Date.parse("2026-03-29T12:00:00.000Z"), zone),
      zone === "Pacific/Kiritimati" ? -1 : 0);
  }
});

test("a 09Z instant without a canonical picker label remains timed", () => {
  assert.deepEqual(storedDeadline("29 Mar", new Date("2026-03-29T09:00:00.000Z")),
    { kind: "instant", at: Date.parse("2026-03-29T09:00:00.000Z") });
  assert.deepEqual(storedDeadline(null, new Date("2026-03-29T09:00:00.000Z")),
    { kind: "instant", at: Date.parse("2026-03-29T09:00:00.000Z") });
});

test("same-date non-picker instant remains timed; conflicting label is unknown", () => {
  assert.deepEqual(storedDeadline("2026-10-25", new Date("2026-10-25T15:30:00.000Z")),
    { kind: "instant", at: Date.parse("2026-10-25T15:30:00.000Z") });
  assert.deepEqual(storedDeadline("2026-10-26", new Date("2026-10-25T15:30:00.000Z")),
    { kind: "unknown" });
  assert.deepEqual(storedDeadline("2026-02-30", null), { kind: "unknown" });
});

test("the Tasks recurrence writer remains a date-only Signal read in every reader zone", () => {
  const original = new Date("2026-03-28T09:00:00.000Z");
  const next = advanceRecurringDueAt(original, { kind: "weekly", weekday: 6 }, isDateOnlyDue("2026-03-28", original), Date.parse("2026-03-28T10:00:00Z"));
  const read = storedDeadline(dateOnlyDueLabel(next), next);
  assert.deepEqual(read, { kind: "date-only", date: "2026-04-04" });
  for (const zone of ["Etc/GMT+12", "Pacific/Kiritimati", "Europe/Dublin"]) {
    assert.equal(deadlineDayDifference(read, Date.parse("2026-04-03T12:00:00Z"), zone),
      zone === "Pacific/Kiritimati" ? 0 : 1);
  }
});
