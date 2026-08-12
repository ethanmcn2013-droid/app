/**
 * Europe/London, the two days a year the arithmetic is different.
 *
 * Every expectation here is RE-MEASURED with `Intl.DateTimeFormat` on every
 * run rather than trusted from the constants. A tzdata update that moved
 * either transition fails this suite instead of silently changing what the
 * `dst_boundary` scenario proves.
 *
 * Run:
 *   node --import tsx --test src/lib/home-layer/fixtures/dst.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HOME_FIXTURE_DST, HOME_FIXTURE_TIME_ZONE } from "./clock";
import { HOME_INBOX_SNOOZE_CASES } from "./inbox";
import {
  groupRow,
  MY_WORK_DST_ROWS,
  MY_WORK_FRAME_DST,
  projectMyWork,
} from "./my-work";
import { HOME_FIXTURE_ORCHARD_PROJECT_IDS } from "./projects";
import { homeFixtureWorld } from "./scenarios";

function localParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: HOME_FIXTURE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(new Date(iso));
  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${read("year")}-${read("month")}-${read("day")}`,
    time: `${read("hour")}:${read("minute")}`,
    zone: read("timeZoneName"),
  };
}

describe("the autumn transition is where it is claimed to be", () => {
  it("01:30 on 25 October 2026 happens twice", () => {
    const earlier = localParts(HOME_FIXTURE_DST.autumn.earlierInstantIso);
    const later = localParts(HOME_FIXTURE_DST.autumn.laterInstantIso);
    assert.equal(earlier.time, "01:30");
    assert.equal(later.time, "01:30");
    assert.equal(earlier.date, HOME_FIXTURE_DST.autumn.calendarDate);
    assert.equal(later.date, HOME_FIXTURE_DST.autumn.calendarDate);
    // Same wall clock, different offsets, one hour apart.
    assert.equal(earlier.zone, "BST");
    assert.equal(later.zone, "GMT");
    assert.equal(
      Date.parse(HOME_FIXTURE_DST.autumn.laterInstantIso) -
        Date.parse(HOME_FIXTURE_DST.autumn.earlierInstantIso),
      3_600_000,
    );
  });

  it("the contract takes the EARLIER occurrence", () => {
    assert.ok(
      Date.parse(HOME_FIXTURE_DST.autumn.earlierInstantIso) <
        Date.parse(HOME_FIXTURE_DST.autumn.laterInstantIso),
    );
  });
});

describe("the spring transition is where it is claimed to be", () => {
  it("01:30 on 28 March 2027 does not exist", () => {
    const before = localParts(HOME_FIXTURE_DST.spring.beforeGapInstantIso);
    const after = localParts(HOME_FIXTURE_DST.spring.forwardInstantIso);
    assert.equal(before.time, "00:59");
    assert.equal(before.zone, "GMT");
    // One minute later the wall clock reads 02:00. 01:00 to 01:59 never runs.
    assert.equal(after.time, "02:00");
    assert.equal(after.zone, "BST");
    assert.equal(
      Date.parse(HOME_FIXTURE_DST.spring.forwardInstantIso) -
        Date.parse(HOME_FIXTURE_DST.spring.beforeGapInstantIso),
      60_000,
    );
  });

  it("the contract resolves FORWARD to the first real instant", () => {
    assert.equal(
      localParts(HOME_FIXTURE_DST.spring.forwardInstantIso).date,
      HOME_FIXTURE_DST.spring.calendarDate,
    );
  });
});

describe("snooze targets resolve to the instants the contract names", () => {
  for (const snoozeCase of HOME_INBOX_SNOOZE_CASES) {
    it(`${snoozeCase.id}: ${snoozeCase.why}`, () => {
      assert.ok(snoozeCase.expectedResurfaceIso.endsWith("Z"));
      assert.ok(
        Date.parse(snoozeCase.expectedResurfaceIso) >
          Date.parse(snoozeCase.fromIso),
        "a snooze must resurface in the future",
      );
      // The zone is an EXPLICIT argument. There is no ambient default.
      assert.equal(snoozeCase.timeZone, HOME_FIXTURE_TIME_ZONE);
    });
  }

  it("covers both DST rules and the ordinary case", () => {
    const adjustments = HOME_INBOX_SNOOZE_CASES.map((entry) => entry.adjustment);
    assert.deepEqual(
      [...adjustments].sort(),
      ["earlier-of-ambiguous", "forward-from-gap", "none"],
    );
  });
});

describe("date grouping is calendar arithmetic, not millisecond arithmetic", () => {
  it("Sunday 25 October is one calendar day after Saturday 24 October, and 25 hours later", () => {
    const saturdayNoon = "2026-10-24T11:00:00.000Z"; // 12:00 BST
    const sundayNoon = "2026-10-25T12:00:00.000Z"; // 12:00 GMT
    assert.equal(localParts(saturdayNoon).time, "12:00");
    assert.equal(localParts(sundayNoon).time, "12:00");
    assert.equal(
      (Date.parse(sundayNoon) - Date.parse(saturdayNoon)) / 3_600_000,
      25,
      "the day the clocks go back is 25 hours long",
    );
  });

  it("a millisecond-offset window puts the Sunday row in the wrong bucket", () => {
    const row = MY_WORK_DST_ROWS.find(
      (entry) => entry.taskId === "home-task-dst-morning",
    );
    assert.ok(row?.dueAtIso);
    // The naive form: is it inside "one day" of the frame's instant?
    const naiveDaysOut = Math.floor(
      (Date.parse(row.dueAtIso as string) -
        Date.parse(MY_WORK_FRAME_DST.nowIso)) /
        86_400_000,
    );
    // The calendar form, which is what the projection uses.
    const grouped = groupRow(row, MY_WORK_FRAME_DST);
    assert.equal(naiveDaysOut, 0, "millisecond arithmetic reads this as today");
    assert.equal(grouped.group, "next");
    assert.equal(grouped.reason, "within-seven-days");
  });

  it("the inclusive Next edge and the first Later day sit either side of the change", () => {
    const projection = projectMyWork({
      rows: MY_WORK_DST_ROWS,
      frame: MY_WORK_FRAME_DST,
      projectsAuthorized: HOME_FIXTURE_ORCHARD_PROJECT_IDS,
    });
    assert.equal(projection.kind, "ready");
    if (projection.kind !== "ready") return;
    const reasons = Object.values(projection.groups)
      .flat()
      .map((entry) => `${entry.row.taskId}:${entry.reason}`)
      .sort();
    assert.deepEqual(reasons, [
      "home-task-dst-eve:due-today",
      "home-task-dst-later:beyond-window",
      "home-task-dst-morning:within-seven-days",
      "home-task-dst-week:within-seven-days",
    ]);
  });
});

describe("the dst_boundary scenario reads from its own pinned instant", () => {
  it("ranks against 24 October, not 16 July", () => {
    const world = homeFixtureWorld("dst_boundary");
    assert.equal(world.today.asOfIso, "2026-10-24T20:15:00.000Z");
    assert.equal(localParts(world.today.asOfIso).date, "2026-10-24");
  });

  it("still balances its accounting across the boundary", () => {
    const { today } = homeFixtureWorld("dst_boundary");
    assert.notEqual(today.accounting, null);
    if (!today.accounting) return;
    assert.equal(
      today.accounting.read,
      today.accounting.shown +
        today.accounting.cappedOut +
        today.accounting.dismissed +
        today.accounting.cleared,
    );
  });
});
