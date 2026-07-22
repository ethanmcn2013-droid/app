import assert from "node:assert/strict";
import test from "node:test";
import {
  briefingTimestampLabel,
  calendarDayDifference,
  dateOnlyToTimestamp,
  localWeekday,
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
  const timestamp = dateOnlyToTimestamp("2026-07-04");
  assert.notEqual(timestamp, null);
  assert.equal(localWeekday(timestamp!, "Europe/Dublin"), "Saturday");
  assert.equal(dateOnlyToTimestamp("2026-02-30"), null);
});
