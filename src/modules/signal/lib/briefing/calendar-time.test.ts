import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  briefingTimestampLabel,
  calendarDayDifference,
  dateOrdinal,
  deadlineDayDifference,
  deadlineIsOverdue,
  compareDeadlines,
  deadlineWeekday,
} from "./calendar-time";

/** Observe construction in an isolated module, without changing global Intl. */
function instrumentCalendar() {
  let constructions = 0;
  const DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
    construct(target, args) {
      constructions++;
      return Reflect.construct(target, args);
    },
  });
  const source = readFileSync(new URL("./calendar-time.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  const module = { exports: {} };
  new Function("Intl", "module", "exports", compiled)(
    { DateTimeFormat }, module, module.exports,
  );
  return { calendar: module.exports as typeof import("./calendar-time"), constructions: () => constructions };
}

test("bulk calendar work reuses formatting rules without retaining dates or crossing timezones", () => {
  const { calendar, constructions } = instrumentCalendar();
  const now = Date.parse("2026-07-15T07:42:00Z");
  for (let offset = 0; offset < 320; offset++) {
    assert.equal(calendar.calendarDayDifference(now + offset * 86_400_000, now, "UTC"), offset);
    assert.equal(calendar.compareDeadlines(
      { kind: "date-only", date: "2026-07-15" },
      { kind: "date-only", date: "2026-07-15" }, "UTC", now,
    ), 0);
  }
  assert.equal(constructions(), 1, "task growth must not reconstruct the same calendar formatter");
  assert.equal(calendar.deadlineWeekday({ kind: "date-only", date: "2026-07-15" }, "UTC"), "Wednesday");
  assert.equal(calendar.deadlineShortDate({ kind: "instant", at: now }, "UTC"), "15 Jul");
  assert.equal(calendar.localHour(now, "UTC"), 7);
  assert.equal(calendar.briefingTimestampLabel(now, "UTC"), "Wednesday 07:42");
  assert.equal(constructions(), 5, "distinct locale/options must retain distinct formatting rules");
  assert.equal(calendar.localHour(now, "Europe/Dublin"), 8);
  assert.equal(calendar.localHour(now, "UTC"), 7);
  assert.equal(constructions(), 6, "the explicit reader timezone must remain part of the key");
  assert.equal(calendar.deadlineDayDifference(null, now, "UTC"), null);
  assert.equal(calendar.deadlineIsOverdue({ kind: "unknown" }, now, "UTC"), false);
  assert.throws(() => calendar.calendarDayDifference(Number.NaN, now, "UTC"), RangeError);
});

test("formatter retention is bounded and invalid timezone construction does not evict valid rules", () => {
  const { calendar, constructions } = instrumentCalendar();
  const zones = Intl.supportedValuesOf("timeZone").slice(0, 65);
  assert.equal(zones.length, 65);
  for (const zone of zones.slice(0, 64)) calendar.calendarDayDifference(0, 0, zone);
  assert.equal(constructions(), 64);
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.throws(() => calendar.calendarDayDifference(0, 0, "Invalid/Timezone"), RangeError);
  }
  assert.equal(constructions(), 66);
  calendar.calendarDayDifference(0, 0, zones[0]);
  assert.equal(constructions(), 66, "failed construction must not change the pool");
  calendar.calendarDayDifference(0, 0, zones[64]);
  calendar.calendarDayDifference(0, 0, zones[0]);
  assert.equal(constructions(), 67, "recently used rules must remain available");
  calendar.calendarDayDifference(0, 0, zones[1]);
  assert.equal(constructions(), 68, "the least recently used rule must have been evicted");
});

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
