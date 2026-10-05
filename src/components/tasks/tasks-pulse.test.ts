import { test } from "node:test";
import assert from "node:assert/strict";
import { STUCK_AFTER_DAYS, dayWords, donePercent, tasksPulse, unchangedDays, type PulseTask } from "./tasks-pulse";

const frame = { today: "2026-10-05", timeZone: "Europe/Dublin" };

const task = (id: string, extra: Partial<PulseTask> = {}): PulseTask => ({
  id,
  title: id,
  status: "todo",
  done: false,
  dueOn: null,
  ...extra,
});

test("counts open, done, late, due today and undated from the tasks alone", () => {
  const pulse = tasksPulse(
    [
      task("a"),
      task("b", { dueOn: "2026-10-04" }),
      task("c", { dueOn: "2026-10-05" }),
      task("d", { dueOn: "2026-10-09" }),
      task("e", { status: "done", done: true, dueOn: "2026-09-01" }),
    ],
    "todo",
    frame,
  );
  assert.equal(pulse.total, 5);
  assert.equal(pulse.done, 1);
  assert.equal(pulse.open, 4);
  assert.equal(pulse.late, 1, "a finished task past its date is not late");
  assert.equal(pulse.dueToday, 1);
  assert.equal(pulse.undated, 1);
});

test("done this week is the seven days ending today, in the project's time zone", () => {
  const done = (id: string, completedAt?: string) => task(id, { status: "done", done: true, completedAt });
  const pulse = tasksPulse(
    [
      done("today", "2026-10-05T09:00:00Z"),
      // 23:30 UTC on 28 Sep is already 29 Sep in Dublin (summer time): inside the week.
      done("edge-in", "2026-09-28T23:30:00Z"),
      done("edge-out", "2026-09-28T12:00:00Z"),
      done("no-instant"),
      done("not-a-date", "nonsense"),
      // Finished "tomorrow" by a skewed clock: never counted as this week.
      done("ahead", "2026-10-06T12:00:00Z"),
    ],
    "todo",
    frame,
  );
  assert.equal(pulse.done, 6);
  assert.equal(pulse.doneThisWeek, 2);
});

test("stuck is started, unfinished work unchanged for four days or more", () => {
  const at = (iso: string) => new Date(iso);
  const pulse = tasksPulse(
    [
      task("queued", { status: "todo", updatedAt: at("2026-09-01T10:00:00Z") }),
      task("fresh", { status: "doing", updatedAt: at("2026-10-03T10:00:00Z") }),
      task("four", { status: "doing", updatedAt: at("2026-10-01T10:00:00Z") }),
      task("nine", { status: "waiting", updatedAt: at("2026-09-26T10:00:00Z") }),
      task("finished", { status: "done", done: true, updatedAt: at("2026-09-01T10:00:00Z") }),
      task("no-record", { status: "review" }),
    ],
    "todo",
    frame,
  );
  assert.deepEqual(
    pulse.stuck.map((fact) => [fact.id, fact.days]),
    [
      ["nine", 9],
      ["four", STUCK_AFTER_DAYS],
    ],
  );
});

test("a custom first column is the queue, whatever it is called", () => {
  const old = new Date("2026-09-01T10:00:00Z");
  const pulse = tasksPulse([task("a", { status: "ideas", updatedAt: old }), task("b", { status: "todo", updatedAt: old })], "ideas", frame);
  assert.deepEqual(pulse.stuck.map((fact) => fact.id), ["b"]);
});

test("unchanged days: the record's own count wins, a bad date is zero, the future is zero", () => {
  assert.equal(unchangedDays({ idleDays: 6, updatedAt: new Date("2026-10-05T10:00:00Z") }, frame), 6);
  assert.equal(unchangedDays({ updatedAt: new Date("nonsense") }, frame), 0);
  assert.equal(unchangedDays({ updatedAt: new Date("2026-10-08T10:00:00Z") }, frame), 0);
  assert.equal(unchangedDays({}, frame), 0);
});

test("words and the ring", () => {
  assert.equal(dayWords(1), "1 day");
  assert.equal(dayWords(7), "7 days");
  assert.equal(donePercent({ total: 0, done: 0 }), 0);
  assert.equal(donePercent({ total: 13, done: 5 }), 38);
});
