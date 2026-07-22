import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { buildBriefing } from "./build";
import type { BriefingSource } from "./source";
import type { TaskSignal } from "./types";

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;
const CTX = { userId: "u-test", email: "test@example.com" };

function source(signals: TaskSignal[]): BriefingSource {
  return { async getSignalsForUser() { return signals; } };
}

function task(overrides: Partial<TaskSignal> = {}): TaskSignal {
  return {
    id: "t",
    title: "t",
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

test("Priority Compression caps the whole briefing at three with stable ties", async () => {
  const signals = [
    task({ id: "d", dueAt: NOW - DAY }),
    task({ id: "c", dueAt: NOW - DAY }),
    task({ id: "b", idleDays: 9 }),
    task({ id: "a", idleDays: 9 }),
    task({ id: "z", lane: "shipped", movedToShippedAt: NOW - 1_000 }),
  ];
  const first = await buildBriefing(source(signals), CTX, NOW);
  const second = await buildBriefing(source([...signals].reverse()), CTX, NOW);
  const ids = (briefing: typeof first) => [
    ...briefing.needsAttention,
    ...briefing.movingWell,
    ...briefing.quietRisks,
  ].map((item) => item.id);
  assert.equal(ids(first).length, 3);
  assert.deepEqual(ids(first), ids(second));
});

// ─────────────────────────────────────────────────────────────
// Engine output
// ─────────────────────────────────────────────────────────────
describe("buildBriefing, empty + base shape", () => {
  test("isEmpty=true when nothing is triggered", async () => {
    const b = await buildBriefing(source([]), CTX, NOW);
    assert.equal(b.isEmpty, true);
    assert.equal(b.needsAttention.length, 0);
    assert.equal(b.movingWell.length, 0);
    assert.equal(b.quietRisks.length, 0);
    assert.equal(b.suggestedFocus.length, 0);
  });

  test("populates userId, generatedAt, greetingHour", async () => {
    const b = await buildBriefing(source([]), CTX, NOW);
    assert.equal(b.userId, CTX.userId);
    assert.equal(b.generatedAt, NOW);
    assert.ok(b.greetingHour >= 0 && b.greetingHour <= 23);
  });
});

describe("buildBriefing, bucket caps", () => {
  test("Needs attention is hard-capped at 3 items even with 5 due-soon", async () => {
    const signals = Array.from({ length: 5 }, (_, i) =>
      task({ id: `t${i}`, dueAt: NOW + i * 3_600_000 }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.needsAttention.length, 3);
  });

  test("Quiet risks is hard-capped at 3 items", async () => {
    const signals = Array.from({ length: 6 }, (_, i) =>
      task({ id: `t${i}`, idleDays: 5 + i }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.quietRisks.length, 3);
  });

  test("Moving well is hard-capped at 3 items", async () => {
    const signals = Array.from({ length: 5 }, (_, i) =>
      task({
        id: `t${i}`,
        lane: "shipped",
        movedToShippedAt: NOW - i * 3_600_000,
      }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.movingWell.length, 3);
  });

  test("Suggested focus is hard-capped at 3 items", async () => {
    const signals = [
      ...Array.from({ length: 3 }, (_, i) =>
        task({ id: `due-${i}`, dueAt: NOW + i * 3_600_000 }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        task({ id: `stuck-${i}`, idleDays: 5 + i }),
      ),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.suggestedFocus.length, 3);
  });
});

describe("buildBriefing, bucket dedup", () => {
  test("a task that hits multiple triggers appears in only one bucket", async () => {
    const signals = [
      task({
        id: "double",
        idleDays: 10,
        dueAt: NOW - 2 * DAY,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.needsAttention.length, 1);
    assert.equal(b.quietRisks.length, 0);
  });
});

describe("buildBriefing, focus ranking", () => {
  test("due-soon ranks higher than stuck-work in the focus block", async () => {
    const signals = [
      task({ id: "stuck", idleDays: 30 }),
      task({ id: "due", dueAt: NOW + 6 * 3_600_000 }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.suggestedFocus[0]?.id, "due");
  });

  test("overdue items rank higher than future-due items in focus block", async () => {
    const signals = [
      task({ id: "future", dueAt: NOW + 1.5 * DAY }),
      task({ id: "overdue", dueAt: NOW - 3 * DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.suggestedFocus[0]?.id, "overdue");
  });
});

describe("buildBriefing, prose rotation determinism", () => {
  test("same (user, day) → same phrasing across two calls", async () => {
    const signals = [task({ id: "x", idleDays: 5 })];
    const a = await buildBriefing(source(signals), CTX, NOW);
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(a.quietRisks[0]?.text, b.quietRisks[0]?.text);
  });

  test("different days → potentially different phrasing", async () => {
    const signals = [task({ id: "x", idleDays: 5 })];
    const day0 = await buildBriefing(source(signals), CTX, NOW);
    const day7 = await buildBriefing(source(signals), CTX, NOW + 7 * DAY);
    const variants = new Set<string>();
    for (let d = 0; d < 7; d++) {
      const b = await buildBriefing(source(signals), CTX, NOW + d * DAY);
      const text = b.quietRisks[0]?.text;
      if (text) variants.add(text);
    }
    void day0;
    void day7;
    assert.ok(variants.size > 1, "rotation should produce at least 2 phrasings across 7 days");
  });
});

// ─────────────────────────────────────────────────────────────
// Bucket-orchestration tests for the new triggers (Phase F.1)
// ─────────────────────────────────────────────────────────────
describe("buildBriefing, crowded-week orchestration", () => {
  test("crowded-week lands in needsAttention, not quietRisks", async () => {
    const signals = Array.from({ length: 4 }, (_, i) =>
      task({ id: `t${i}`, dueAt: NOW + (i + 1) * DAY }),
    );
    const b = await buildBriefing(source(signals), CTX, NOW);
    const inAttention = b.needsAttention.some(
      (i) => i.trigger === "crowded-week",
    );
    const inRisks = b.quietRisks.some((i) => i.trigger === "crowded-week");
    assert.equal(inAttention, true);
    assert.equal(inRisks, false);
  });

  test("global compression keeps the strongest three when due-soon and crowded-week compete", async () => {
    const signals = [
      task({ id: "d1", dueAt: NOW + 0.5 * DAY }),
      task({ id: "d2", dueAt: NOW + 1 * DAY }),
      task({ id: "d3", dueAt: NOW + 2 * DAY }),
      task({ id: "d4", dueAt: NOW + 4 * DAY }),
      task({ id: "d5", dueAt: NOW + 5 * DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const triggers = new Set(b.needsAttention.map((i) => i.trigger));
    assert.ok(triggers.has("due-soon"));
    assert.equal(
      b.needsAttention.length + b.movingWell.length + b.quietRisks.length,
      3,
    );
  });

  test("crowded-week ranks between due-soon and stuck-work in focus block", async () => {
    const signals = [
      task({ id: "stuck", idleDays: 30 }),
      ...Array.from({ length: 3 }, (_, i) =>
        task({ id: `cw${i}`, dueAt: NOW + (i + 2) * DAY }),
      ),
      task({ id: "due", dueAt: NOW + 0.5 * DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.suggestedFocus[0]?.trigger, "due-soon");
    const crowdedIdx = b.suggestedFocus.findIndex(
      (i) => i.trigger === "crowded-week",
    );
    const stuckIdx = b.suggestedFocus.findIndex(
      (i) => i.trigger === "stuck-work",
    );
    if (crowdedIdx !== -1 && stuckIdx !== -1) {
      assert.ok(crowdedIdx < stuckIdx);
    }
  });
});

describe("buildBriefing, blocked-too-long orchestration", () => {
  test("blocked-too-long lands in quietRisks, not needsAttention", async () => {
    const signals = [
      task({ id: "blocker", title: "Music supplier confirm" }),
      task({
        id: "blocked",
        title: "Florist deposit",
        blockedBy: ["blocker"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const inRisks = b.quietRisks.some(
      (i) => i.trigger === "blocked-too-long",
    );
    const inAttention = b.needsAttention.some(
      (i) => i.trigger === "blocked-too-long",
    );
    assert.equal(inRisks, true);
    assert.equal(inAttention, false);
  });

  test("blocked-too-long does not double up with stuck-work for the same task", async () => {
    const signals = [
      task({ id: "u1", title: "Upstream" }),
      task({
        id: "blocked",
        title: "Downstream",
        blockedBy: ["u1"],
        idleDays: 10,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const blockedAppearances =
      b.needsAttention.filter((i) => i.id === "blocked").length +
      b.quietRisks.filter((i) => i.id === "blocked").length +
      b.movingWell.filter((i) => i.id === "blocked").length;
    assert.equal(blockedAppearances, 1);
  });
});

describe("buildBriefing, name-the-blocker prose", () => {
  test("brief item names the blocker task when title is resolvable", async () => {
    const signals = [
      task({ id: "music", title: "Music supplier confirmation" }),
      task({
        id: "florist",
        title: "Florist deposit",
        blockedBy: ["music"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const item = b.quietRisks.find((i) => i.id === "florist");
    assert.ok(item, "blocked-too-long item should be present");
    assert.match(
      item!.text,
      /Music supplier confirmation/,
      "prose should name the blocker",
    );
  });

  test("two-blocker brief item names both blockers", async () => {
    const signals = [
      task({ id: "music", title: "Music supplier" }),
      task({ id: "venue", title: "Venue agreement" }),
      task({
        id: "florist",
        title: "Florist deposit",
        blockedBy: ["music", "venue"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const item = b.quietRisks.find((i) => i.id === "florist");
    assert.ok(item, "blocked-too-long item should be present");
    assert.match(item!.text, /Music supplier and Venue agreement/);
  });

  test("three-blocker brief item names the first and counts the rest", async () => {
    const signals = [
      task({ id: "m", title: "Music supplier" }),
      task({ id: "v", title: "Venue agreement" }),
      task({ id: "s", title: "Stationer" }),
      task({
        id: "florist",
        title: "Florist deposit",
        blockedBy: ["m", "v", "s"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const item = b.quietRisks.find((i) => i.id === "florist");
    assert.ok(item);
    assert.match(item!.text, /Music supplier and 2 more/);
  });

  test("falls back to generic phrasing when blocker title is unresolvable", async () => {
    const signals = [
      task({
        id: "orphaned-blocked",
        title: "Caterer deposit",
        blockedBy: ["task-not-in-this-source"],
        idleDays: 9,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    const item = b.quietRisks.find((i) => i.id === "orphaned-blocked");
    assert.ok(item, "still surfaces the task");
    assert.doesNotMatch(item!.text, /task-not-in-this-source/);
  });
});

describe("buildBriefing, full Wedding 2026 shape", () => {
  test("produces a sensible Wedding-shaped briefing from the demo signals", async () => {
    const signals: TaskSignal[] = [
      task({
        id: "florist",
        title: "Florist deposit",
        idleDays: 18,
      }),
      task({
        id: "catering",
        title: "Catering tasting",
        dueAt: NOW + 3 * DAY,
        idleDays: 4,
      }),
      task({
        id: "invitations",
        title: "Send invitations",
        dueAt: NOW - 14 * DAY,
      }),
      task({
        id: "save-the-dates",
        title: "Save-the-dates",
        lane: "shipped",
        movedToShippedAt: NOW - 6 * 3_600_000,
      }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW);
    assert.equal(b.isEmpty, false);
    assert.ok(b.needsAttention.length >= 1, "should surface the overdue invitations");
    assert.ok(
      b.needsAttention.length + b.movingWell.length + b.quietRisks.length <= 3,
      "the whole briefing is compressed to three",
    );
    assert.ok(b.suggestedFocus.length >= 1);
  });
});

// ─────────────────────────────────────────────────────────────
// Read state, dismissals stick, carry-overs age honestly
// ─────────────────────────────────────────────────────────────
describe("buildBriefing, dismissals (ReadState.suppressed)", () => {
  test("a not-useful tap keeps the item out under that trigger", async () => {
    const signals = [
      task({ id: "florist", title: "Florist deposit", dueAt: NOW - DAY }),
      task({ id: "catering", title: "Catering tasting", dueAt: NOW + DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      suppressed: new Set(["due-soon:florist"]),
    });
    const ids = b.needsAttention.map((i) => i.id);
    assert.ok(!ids.includes("florist"), "dismissed item must not surface");
    assert.ok(ids.includes("catering"), "other items are unaffected");
  });

  test("a dismissal is per-trigger, the item can surface for a new reason", async () => {
    const signals = [
      task({ id: "florist", title: "Florist deposit", idleDays: 9, dueAt: NOW + DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      suppressed: new Set(["stuck-work:florist"]),
    });
    assert.ok(
      b.needsAttention.some((i) => i.id === "florist" && i.trigger === "due-soon"),
      "due-soon must still surface after a stuck-work dismissal",
    );
    assert.ok(
      !b.quietRisks.some((i) => i.id === "florist"),
      "the dismissed stuck-work read stays out",
    );
  });

  test("a wildcard key dismisses the item under every trigger", async () => {
    const signals = [
      task({ id: "florist", title: "Florist deposit", idleDays: 9, dueAt: NOW + DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      suppressed: new Set(["*:florist"]),
    });
    assert.equal(b.needsAttention.length, 0);
    assert.equal(b.quietRisks.length, 0);
  });

  test("dismissing everything yields the all-clear, honestly", async () => {
    const signals = [
      task({ id: "florist", title: "Florist deposit", dueAt: NOW - DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      suppressed: new Set(["due-soon:florist"]),
    });
    assert.equal(b.isEmpty, true);
  });
});

describe("buildBriefing, carry-over aging (ReadState.ages)", () => {
  test("a day-3 carry-over gets ageDays and sorts below fresh items", async () => {
    const signals = [
      task({ id: "old", title: "Old ask", dueAt: NOW - 5 * DAY }),
      task({ id: "fresh", title: "Fresh ask", dueAt: NOW - DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      ages: new Map([["due-soon:old", 3]]),
    });
    assert.equal(b.needsAttention.length, 2);
    assert.equal(b.needsAttention[0].id, "fresh", "fresh item leads");
    assert.equal(b.needsAttention[1].id, "old", "carry-over moves to the bottom");
    assert.equal(b.needsAttention[1].ageDays, 3);
    assert.equal(b.needsAttention[0].ageDays, undefined);
  });

  test("day-1 items never carry an age", async () => {
    const signals = [task({ id: "t1", title: "Ask", dueAt: NOW - DAY })];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      ages: new Map([["due-soon:t1", 1]]),
    });
    assert.equal(b.needsAttention[0].ageDays, undefined);
  });

  test("aging demotes within the block but never changes what qualifies", async () => {
    const signals = [
      task({ id: "a", title: "A", dueAt: NOW - 9 * DAY }),
      task({ id: "b", title: "B", dueAt: NOW - 3 * DAY }),
      task({ id: "c", title: "C", dueAt: NOW - 2 * DAY }),
      task({ id: "d", title: "D", dueAt: NOW - DAY }),
    ];
    const b = await buildBriefing(source(signals), CTX, NOW, {
      ages: new Map([["due-soon:a", 4]]),
    });
    assert.equal(b.needsAttention.length, 3);
    const ids = b.needsAttention.map((i) => i.id);
    assert.ok(ids.includes("a"), "aged item keeps its qualified slot");
    assert.equal(ids[ids.length - 1], "a", "but reads last in the block");
  });
});
