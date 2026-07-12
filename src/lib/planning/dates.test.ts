import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarDateInTimeZone,
  calendarDaysBetween,
  daysUntil,
  milestoneCompletion,
  timeElapsed,
} from "./dates";

test("scenario G: elapsed time and milestones remain separate values", () => {
  const elapsed = timeElapsed("2026-01-01", "2026-04-10", {
    today: "2026-02-22",
  });
  const milestones = milestoneCompletion(8, 12);
  assert.equal(elapsed.percent, 53);
  assert.deepEqual(milestones, { completed: 8, total: 12 });
  assert.equal("onTrack" in elapsed, false);
  assert.equal("percent" in milestones, false);
});

test("scenario H: Europe/Dublin spring DST is one calendar day, not 23 hours", () => {
  assert.equal(calendarDaysBetween("2026-03-28", "2026-03-29"), 1);
  assert.equal(
    daysUntil("2026-03-30", {
      now: new Date("2026-03-28T23:30:00Z"),
      timeZone: "Europe/Dublin",
    }),
    2,
  );
});

test("Europe/Dublin autumn rollover uses the local calendar date", () => {
  assert.equal(
    calendarDateInTimeZone(
      new Date("2026-10-25T23:30:00Z"),
      "Europe/Dublin",
    ),
    "2026-10-25",
  );
  assert.equal(
    daysUntil("2026-10-26", {
      now: new Date("2026-10-25T23:30:00Z"),
      timeZone: "Europe/Dublin",
    }),
    1,
  );
});

test("days remaining handles today and a passed primary date", () => {
  assert.equal(daysUntil("2026-07-12", { now: new Date("2026-07-12T12:00:00Z"), timeZone: "Europe/Dublin" }), 0);
  assert.equal(daysUntil("2026-07-11", { now: new Date("2026-07-12T12:00:00Z"), timeZone: "Europe/Dublin" }), -1);
});
