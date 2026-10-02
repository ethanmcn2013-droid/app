import assert from "node:assert/strict";
import test from "node:test";
import {
  briefingTimestampLabel,
  calendarDayDifference,
  dateOrdinal,
  deadlineDayDifference,
  deadlineIsOverdue,
  compareDeadlines,
  deadlineWeekday,
} from "./calendar-time";

test("briefing timestamps use the authorized timezone instead of the host timezone", () => {
  const generatedAt = Date.UTC(2026, 6, 15, 7, 42);
  assert.equal(
    briefingTimestampLabel(generatedAt, "Europe/Dublin"),
    "Wednesday 08:42",
  );
  assert.equal(briefingTimestampLabel(generatedAt, "UTC"), "Wednesday 07:42");
});

test("Europe/Dublin calendar days survive the 23-hour DST transition", () => {
  const before = Date.parse("2026-03-28T12:00:00Z");
  const after = Date.parse("2026-03-29T11:00:00Z");
  assert.equal(calendarDayDifference(after, before, "Europe/Dublin"), 1);
});

test("Europe/Dublin calendar days survive the 25-hour DST transition", () => {
  const before = Date.parse("2026-10-24T11:00:00Z");
  const after = Date.parse("2026-10-25T12:00:00Z");
  assert.equal(calendarDayDifference(after, before, "Europe/Dublin"), 1);
});

test("date-only parsing and weekday stay calendar-safe", () => {
  const deadline = { kind: "date-only" as const, date: "2026-07-04" };
  assert.equal(dateOrdinal(deadline.date) - dateOrdinal("2026-07-03"), 1);
  for (const zone of ["Europe/Dublin", "Etc/GMT+12", "Pacific/Kiritimati"]) {
    assert.equal(deadlineWeekday(deadline, zone), "Saturday");
  }
  assert.throws(() => dateOrdinal("2026-02-30"));
});

test("instants expire at their timestamp while calendar dates expire after their local day", () => {
  const now = Date.parse("2026-03-29T12:00:00Z");
  for (const zone of ["Etc/GMT+12", "Pacific/Kiritimati", "Europe/Dublin"]) {
    const before = { kind: "instant" as const, at: now - 1 };
    const equal = { kind: "instant" as const, at: now };
    const after = { kind: "instant" as const, at: now + 1 };
    assert.equal(deadlineIsOverdue(before, now, zone), true);
    assert.equal(deadlineIsOverdue(equal, now, zone), false);
    assert.equal(deadlineIsOverdue(after, now, zone), false);
    const today = zone === "Pacific/Kiritimati" ? "2026-03-30" : "2026-03-29";
    const dateOnly = { kind: "date-only" as const, date: today };
    assert.equal(deadlineDayDifference(dateOnly, now, zone), 0);
    assert.equal(deadlineIsOverdue(dateOnly, now, zone), false);
    assert.ok(compareDeadlines(before, dateOnly, zone, now) < 0, "expired same-day instant must survive a date cap");
  }
  assert.equal(deadlineIsOverdue({ kind: "instant", at: now - 3_600_000 }, now, "UTC"), true);
});
