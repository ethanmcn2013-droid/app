import assert from "node:assert/strict";
import test from "node:test";
import { storedDeadline } from "@/modules/signal/lib/data/deadline";
import { deadlineDayDifference } from "@/modules/signal/lib/briefing/calendar-time";
import { advanceRecurringDueAt, dateOnlyDueLabel, isDateOnlyDue, offsetStoredDueAt } from "./stored-due-transition";

test("recurrence keeps a picker date provably date-only across DST and reader zones", () => {
  const original = new Date("2026-03-28T09:00:00.000Z");
  assert.equal(isDateOnlyDue("2026-03-28", original), true);
  const next = advanceRecurringDueAt(original, { kind: "weekly", weekday: 6 }, true, Date.parse("2026-03-28T10:00:00Z"));
  const label = dateOnlyDueLabel(next);
  assert.equal(label, "2026-04-04");
  assert.equal(next.toISOString(), "2026-04-04T09:00:00.000Z");
  const read = storedDeadline(label, next);
  assert.deepEqual(read, { kind: "date-only", date: label });
  for (const zone of ["Etc/GMT+12", "Pacific/Kiritimati", "Europe/Dublin"]) {
    assert.equal(deadlineDayDifference(read, Date.parse("2026-04-03T12:00:00Z"), zone),
      zone === "Pacific/Kiritimati" ? 0 : 1);
  }
});

test("duplicate preserves selected calendar days without reclassifying genuine 09Z instants", () => {
  const original = new Date("2026-03-29T09:00:00.000Z");
  const duplicate = offsetStoredDueAt(original, 2, isDateOnlyDue("2026-03-29", original));
  assert.deepEqual(storedDeadline(dateOnlyDueLabel(duplicate), duplicate), { kind: "date-only", date: "2026-03-31" });
  assert.equal(duplicate.toISOString(), "2026-03-31T09:00:00.000Z");
  assert.equal(isDateOnlyDue("29 Mar", original), false);
  assert.equal(isDateOnlyDue("2026-03-29", new Date("2026-03-29T10:00:00Z")), false);
  assert.deepEqual(storedDeadline("29 Mar", offsetStoredDueAt(original, 2, false)),
    { kind: "instant", at: Date.parse("2026-03-31T09:00:00Z") });
  const timedRecurring = advanceRecurringDueAt(original, { kind: "weekly", weekday: 0 }, false, Date.parse("2026-03-29T10:00:00Z"));
  assert.equal(isDateOnlyDue("29 Mar", timedRecurring), false);
  assert.equal(storedDeadline("29 Mar", timedRecurring)?.kind, "instant");
});
