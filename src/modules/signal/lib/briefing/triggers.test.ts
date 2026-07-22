import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import {
  detectBlockedTooLong,
  detectCrowdedWeek,
  detectDueSoon,
  detectJustShipped,
  detectOverload,
  detectStuckWork,
} from "./triggers";
import type { TaskSignal } from "./types";

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function makeTask(overrides: Partial<TaskSignal> = {}): TaskSignal {
  return {
    id: "t-default",
    title: "Default task",
    lane: "in-flight",
    priority: 2,
    dueAt: null,
    idleDays: 0,
    commentCount: 0,
    blockedBy: [],
    sourceLabel: "Tasks · Test",
    movedToShippedAt: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// detectStuckWork
// ─────────────────────────────────────────────────────────────
describe("detectStuckWork", () => {
  test("flags an open task idle ≥ 3 days", () => {
    const out = detectStuckWork([
      makeTask({ id: "a", idleDays: 5, lane: "in-flight" }),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].task.id, "a");
    assert.equal(out[0].trigger, "stuck-work");
  });

  test("does not flag idle < 3 days", () => {
    const out = detectStuckWork([
      makeTask({ idleDays: 2, lane: "in-flight" }),
    ]);
    assert.equal(out.length, 0);
  });

  test("does not flag shipped tasks even if idle", () => {
    const out = detectStuckWork([
      makeTask({ idleDays: 10, lane: "shipped" }),
    ]);
    assert.equal(out.length, 0);
  });

  test("does not flag tasks blocked by others, different problem", () => {
    const out = detectStuckWork([
      makeTask({ idleDays: 10, blockedBy: ["other-task"] }),
    ]);
    assert.equal(out.length, 0);
  });

  test("higher idleDays raises severity", () => {
    const [low] = detectStuckWork([makeTask({ id: "low", idleDays: 4 })]);
    const [high] = detectStuckWork([makeTask({ id: "high", idleDays: 30 })]);
    assert.ok(high.severity > low.severity);
  });

  test("higher priority (lower number) raises severity at same idleDays", () => {
    const [p0] = detectStuckWork([
      makeTask({ id: "p0", idleDays: 5, priority: 0 }),
    ]);
    const [p3] = detectStuckWork([
      makeTask({ id: "p3", idleDays: 5, priority: 3 }),
    ]);
    assert.ok(p0.severity > p3.severity);
  });
});

// ─────────────────────────────────────────────────────────────
// detectDueSoon
// ─────────────────────────────────────────────────────────────
describe("detectDueSoon", () => {
  test("flags tasks due today", () => {
    const out = detectDueSoon(
      [makeTask({ id: "today", dueAt: NOW + 6 * 3_600_000 })],
      NOW,
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].trigger, "due-soon");
  });

  test("flags tasks due within 2 days", () => {
    const out = detectDueSoon(
      [makeTask({ id: "tomorrow", dueAt: NOW + 1.5 * DAY })],
      NOW,
    );
    assert.equal(out.length, 1);
  });

  test("does not flag tasks more than 2 days out", () => {
    const out = detectDueSoon(
      [makeTask({ dueAt: NOW + 5 * DAY })],
      NOW,
    );
    assert.equal(out.length, 0);
  });

  test("flags overdue tasks (negative daysOut)", () => {
    const out = detectDueSoon(
      [makeTask({ id: "overdue", dueAt: NOW - 3 * DAY })],
      NOW,
    );
    assert.equal(out.length, 1);
  });

  test("ignores tasks without a dueAt", () => {
    const out = detectDueSoon([makeTask({ dueAt: null })], NOW);
    assert.equal(out.length, 0);
  });

  test("ignores shipped tasks", () => {
    const out = detectDueSoon(
      [makeTask({ dueAt: NOW + DAY, lane: "shipped" })],
      NOW,
    );
    assert.equal(out.length, 0);
  });

  test("overdue items outweigh due-today items in severity", () => {
    const [today] = detectDueSoon(
      [makeTask({ id: "today", dueAt: NOW + 4 * 3_600_000 })],
      NOW,
    );
    const [overdue] = detectDueSoon(
      [makeTask({ id: "overdue", dueAt: NOW - 5 * DAY })],
      NOW,
    );
    assert.ok(overdue.severity > today.severity);
  });

  test("more overdue days raises severity", () => {
    const [oneDay] = detectDueSoon(
      [makeTask({ id: "1d", dueAt: NOW - 1 * DAY })],
      NOW,
    );
    const [tenDays] = detectDueSoon(
      [makeTask({ id: "10d", dueAt: NOW - 10 * DAY })],
      NOW,
    );
    assert.ok(tenDays.severity > oneDay.severity);
  });
});

// ─────────────────────────────────────────────────────────────
// detectJustShipped
// ─────────────────────────────────────────────────────────────
describe("detectJustShipped", () => {
  test("flags tasks shipped within 24h", () => {
    const out = detectJustShipped(
      [
        makeTask({
          id: "fresh",
          lane: "shipped",
          movedToShippedAt: NOW - 6 * 3_600_000,
        }),
      ],
      NOW,
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].trigger, "just-shipped");
  });

  test("does not flag stale shipped tasks", () => {
    const out = detectJustShipped(
      [
        makeTask({
          lane: "shipped",
          movedToShippedAt: NOW - 5 * DAY,
        }),
      ],
      NOW,
    );
    assert.equal(out.length, 0);
  });

  test("does not flag non-shipped tasks regardless of movedToShippedAt", () => {
    const out = detectJustShipped(
      [
        makeTask({
          lane: "in-flight",
          movedToShippedAt: NOW - 1 * 3_600_000,
        }),
      ],
      NOW,
    );
    assert.equal(out.length, 0);
  });

  test("ignores shipped tasks with null movedToShippedAt", () => {
    const out = detectJustShipped(
      [makeTask({ lane: "shipped", movedToShippedAt: null })],
      NOW,
    );
    assert.equal(out.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────
// detectOverload
// ─────────────────────────────────────────────────────────────
describe("detectOverload", () => {
  test("flags when > 5 in-flight (or review) tasks", () => {
    const tasks = Array.from({ length: 7 }, (_, i) =>
      makeTask({ id: `t${i}`, lane: "in-flight" }),
    );
    const out = detectOverload(tasks);
    assert.equal(out.length, 1);
    assert.equal(out[0].trigger, "overload");
    assert.equal(out[0].task.id, "synthetic:overload");
    assert.match(out[0].task.title, /7 items in flight/);
  });

  test("does not flag at exactly 5 in-flight", () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({ id: `t${i}`, lane: "in-flight" }),
    );
    assert.equal(detectOverload(tasks).length, 0);
  });

  test("counts 'review' lane toward the in-flight threshold", () => {
    const mixed = [
      ...Array.from({ length: 4 }, (_, i) =>
        makeTask({ id: `i${i}`, lane: "in-flight" }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        makeTask({ id: `r${i}`, lane: "review" }),
      ),
    ];
    assert.equal(detectOverload(mixed).length, 1);
  });

  test("ignores shipped / next tasks in the count", () => {
    const mixed = [
      ...Array.from({ length: 4 }, (_, i) =>
        makeTask({ id: `i${i}`, lane: "in-flight" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeTask({ id: `s${i}`, lane: "shipped" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeTask({ id: `n${i}`, lane: "next" }),
      ),
    ];
    assert.equal(detectOverload(mixed).length, 0);
  });

  test("more overload raises severity", () => {
    const six = Array.from({ length: 6 }, (_, i) =>
      makeTask({ id: `t${i}`, lane: "in-flight" }),
    );
    const ten = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `t${i}`, lane: "in-flight" }),
    );
    const [s6] = detectOverload(six);
    const [s10] = detectOverload(ten);
    assert.ok(s10.severity > s6.severity);
  });
});

// ─────────────────────────────────────────────────────────────
// detectCrowdedWeek
// ─────────────────────────────────────────────────────────────
describe("detectCrowdedWeek", () => {
  test("flags when ≥ 3 open tasks have due dates inside 7 days", () => {
    const tasks = Array.from({ length: 4 }, (_, i) =>
      makeTask({ id: `t${i}`, dueAt: NOW + (i + 1) * DAY }),
    );
    const out = detectCrowdedWeek(tasks, NOW);
    assert.equal(out.length, 1);
    assert.equal(out[0].trigger, "crowded-week");
    assert.equal(out[0].task.id, "synthetic:crowded-week");
    assert.match(out[0].task.title, /4 items/);
  });

  test("does not flag at exactly 2 upcoming items", () => {
    const tasks = [
      makeTask({ id: "a", dueAt: NOW + 1 * DAY }),
      makeTask({ id: "b", dueAt: NOW + 3 * DAY }),
    ];
    assert.equal(detectCrowdedWeek(tasks, NOW).length, 0);
  });

  test("ignores tasks more than 7 days out", () => {
    const tasks = [
      makeTask({ id: "a", dueAt: NOW + 1 * DAY }),
      makeTask({ id: "b", dueAt: NOW + 10 * DAY }),
      makeTask({ id: "c", dueAt: NOW + 15 * DAY }),
    ];
    assert.equal(detectCrowdedWeek(tasks, NOW).length, 0);
  });

  test("ignores overdue items (in the past), they're due-soon's job", () => {
    const tasks = [
      makeTask({ id: "a", dueAt: NOW - 2 * DAY }),
      makeTask({ id: "b", dueAt: NOW - 1 * DAY }),
      makeTask({ id: "c", dueAt: NOW - 3 * DAY }),
    ];
    assert.equal(detectCrowdedWeek(tasks, NOW).length, 0);
  });

  test("ignores shipped tasks even if due in window", () => {
    const tasks = Array.from({ length: 4 }, (_, i) =>
      makeTask({
        id: `t${i}`,
        dueAt: NOW + (i + 1) * DAY,
        lane: "shipped",
      }),
    );
    assert.equal(detectCrowdedWeek(tasks, NOW).length, 0);
  });

  test("more items raises severity", () => {
    const three = Array.from({ length: 3 }, (_, i) =>
      makeTask({ id: `t${i}`, dueAt: NOW + (i + 1) * DAY }),
    );
    const seven = Array.from({ length: 7 }, (_, i) =>
      makeTask({ id: `t${i}`, dueAt: NOW + (i + 1) * DAY }),
    );
    const [s3] = detectCrowdedWeek(three, NOW);
    const [s7] = detectCrowdedWeek(seven, NOW);
    assert.ok(s7.severity > s3.severity);
  });
});

// ─────────────────────────────────────────────────────────────
// detectBlockedTooLong
// ─────────────────────────────────────────────────────────────
describe("detectBlockedTooLong", () => {
  test("flags blocked tasks idle ≥ 5 days", () => {
    const out = detectBlockedTooLong([
      makeTask({
        id: "a",
        blockedBy: ["other"],
        idleDays: 7,
      }),
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].trigger, "blocked-too-long");
  });

  test("does not flag blocked but recently-active (idle < 5)", () => {
    const out = detectBlockedTooLong([
      makeTask({ blockedBy: ["other"], idleDays: 2 }),
    ]);
    assert.equal(out.length, 0);
  });

  test("does not flag stuck tasks that aren't blocked, that's stuck-work's job", () => {
    const out = detectBlockedTooLong([
      makeTask({ blockedBy: [], idleDays: 30 }),
    ]);
    assert.equal(out.length, 0);
  });

  test("does not flag shipped blocked tasks", () => {
    const out = detectBlockedTooLong([
      makeTask({
        blockedBy: ["other"],
        idleDays: 30,
        lane: "shipped",
      }),
    ]);
    assert.equal(out.length, 0);
  });

  test("more blockers raises severity", () => {
    const [one] = detectBlockedTooLong([
      makeTask({ id: "one", blockedBy: ["a"], idleDays: 7 }),
    ]);
    const [many] = detectBlockedTooLong([
      makeTask({ id: "many", blockedBy: ["a", "b", "c"], idleDays: 7 }),
    ]);
    assert.ok(many.severity > one.severity);
  });

  test("more idle days raises severity", () => {
    const [low] = detectBlockedTooLong([
      makeTask({ id: "low", blockedBy: ["a"], idleDays: 5 }),
    ]);
    const [high] = detectBlockedTooLong([
      makeTask({ id: "high", blockedBy: ["a"], idleDays: 30 }),
    ]);
    assert.ok(high.severity > low.severity);
  });

  test("closes the gap left by detectStuckWork, stuck-work excludes blocked", () => {
    const t = makeTask({ blockedBy: ["other"], idleDays: 10 });
    assert.equal(detectStuckWork([t]).length, 0);
    assert.equal(detectBlockedTooLong([t]).length, 1);
  });
});
