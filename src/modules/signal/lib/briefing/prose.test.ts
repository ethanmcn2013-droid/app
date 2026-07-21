import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { phraseFor } from "./prose";
import type { TaskSignal, TriggerKind } from "./types";

function task(overrides: Partial<TaskSignal> = {}): TaskSignal {
  return {
    id: "t",
    title: "Florist deposit",
    lane: "in-flight",
    priority: 2,
    dueAt: null,
    idleDays: 0,
    commentCount: 0,
    blockedBy: [],
    sourceLabel: "Tasks · Wedding 2026",
    movedToShippedAt: null,
    ...overrides,
  };
}

const ALL_TRIGGERS: TriggerKind[] = [
  "stuck-work",
  "due-soon",
  "just-shipped",
  "overload",
  "crowded-week",
  "blocked-too-long",
];

describe("phraseFor, every trigger × every rotation produces non-empty prose", () => {
  for (const trigger of ALL_TRIGGERS) {
    for (let rot = 0; rot < 3; rot++) {
      test(`${trigger} @ rotation ${rot}`, () => {
        const t = task();
        const text = phraseFor(trigger, t, rot, { idleDays: 5, daysOut: -3 });
        assert.ok(text.length > 0, "should return non-empty text");
        assert.equal(typeof text, "string");
      });
    }
  }
});

describe("phraseFor, context propagation", () => {
  test("stuck-work uses idleDays from context, not task field", () => {
    const t = task({ idleDays: 1 });
    const text = phraseFor("stuck-work", t, 0, { idleDays: 5 });
    assert.match(text, /5 days ago/);
    assert.doesNotMatch(text, /yesterday/);
  });

  test("due-soon overdue uses daysOut from context", () => {
    const t = task();
    const text = phraseFor("due-soon", t, 0, { daysOut: -5 });
    assert.match(text, /5 days overdue/i);
  });

  test("due-soon due-today renders 'today'", () => {
    const text = phraseFor("due-soon", task(), 0, { daysOut: 0.5 });
    assert.match(text, /today/i);
  });

  test("blocked-too-long uses idleDays from context", () => {
    const t = task({ idleDays: 8, blockedBy: ["x"] });
    const text = phraseFor("blocked-too-long", t, 0, { idleDays: 12 });
    assert.match(text, /12 days/);
  });
});

describe("phraseFor, rotation produces distinct phrasings across the library", () => {
  test("stuck-work has three distinct phrasings", () => {
    const variants = new Set<string>();
    for (let r = 0; r < 3; r++) {
      variants.add(phraseFor("stuck-work", task(), r, { idleDays: 5 }));
    }
    assert.equal(variants.size, 3);
  });

  test("due-soon overdue has three distinct phrasings", () => {
    const variants = new Set<string>();
    for (let r = 0; r < 3; r++) {
      variants.add(phraseFor("due-soon", task(), r, { daysOut: -2 }));
    }
    assert.equal(variants.size, 3);
  });

  test("just-shipped has three distinct phrasings", () => {
    const variants = new Set<string>();
    for (let r = 0; r < 3; r++) {
      variants.add(phraseFor("just-shipped", task(), r));
    }
    assert.equal(variants.size, 3);
  });

  test("overload has three distinct phrasings", () => {
    const variants = new Set<string>();
    for (let r = 0; r < 3; r++) {
      variants.add(phraseFor("overload", task(), r));
    }
    assert.equal(variants.size, 3);
  });

  test("crowded-week has three distinct phrasings", () => {
    const variants = new Set<string>();
    for (let r = 0; r < 3; r++) {
      variants.add(phraseFor("crowded-week", task(), r));
    }
    assert.equal(variants.size, 3);
  });

  test("blocked-too-long has three distinct phrasings", () => {
    const variants = new Set<string>();
    for (let r = 0; r < 3; r++) {
      variants.add(phraseFor("blocked-too-long", task(), r, { idleDays: 7 }));
    }
    assert.equal(variants.size, 3);
  });
});

describe("phraseFor, blocked-too-long multi-blocker rendering", () => {
  test("single blocker is named without 'and N more'", () => {
    const t = task({ blockedBy: ["x"], idleDays: 7 });
    const text = phraseFor("blocked-too-long", t, 0, {
      idleDays: 7,
      blockedByTitles: ["Music supplier"],
    });
    assert.match(text, /blocked by Music supplier/);
    assert.doesNotMatch(text, /and \d+ more/);
  });

  test("two blockers names both, 'X and Y'", () => {
    const t = task({ blockedBy: ["x", "y"], idleDays: 7 });
    const text = phraseFor("blocked-too-long", t, 0, {
      idleDays: 7,
      blockedByTitles: ["Music supplier", "Venue agreement"],
    });
    assert.match(text, /Music supplier and Venue agreement/);
    assert.doesNotMatch(text, /\bmore\b/);
  });

  test("three blockers render 'X and 2 more'", () => {
    const t = task({ blockedBy: ["x", "y", "z"], idleDays: 7 });
    const text = phraseFor("blocked-too-long", t, 0, {
      idleDays: 7,
      blockedByTitles: ["Music supplier", "Venue agreement", "Stationer"],
    });
    assert.match(text, /Music supplier and 2 more/);
  });

  test("six blockers render 'X and 5 more'", () => {
    const text = phraseFor("blocked-too-long", task(), 0, {
      idleDays: 14,
      blockedByTitles: ["A", "B", "C", "D", "E", "F"],
    });
    assert.match(text, /A and 5 more/);
  });

  test("falls back to 'has been waiting for N days' when no titles", () => {
    const t = task({ blockedBy: ["x"], idleDays: 7 });
    const text = phraseFor("blocked-too-long", t, 0, {
      idleDays: 7,
      blockedByTitles: [],
    });
    assert.match(text, /waiting for 7 days/);
    assert.doesNotMatch(text, /by /);
  });

  test("each of the three phrasings handles multi-blocker", () => {
    const t = task({ blockedBy: ["x", "y"], idleDays: 7 });
    for (let r = 0; r < 3; r++) {
      const text = phraseFor("blocked-too-long", t, r, {
        idleDays: 7,
        blockedByTitles: ["Music supplier", "Venue agreement"],
      });
      assert.match(
        text,
        /Music supplier and Venue agreement/,
        `phrasing ${r} should name both blockers`,
      );
    }
  });

  test("each phrasing has a generic fallback when no titles supplied", () => {
    const t = task({ idleDays: 7 });
    const variants = new Set<string>();
    for (let r = 0; r < 3; r++) {
      const text = phraseFor("blocked-too-long", t, r, { idleDays: 7 });
      assert.doesNotMatch(text, /by /, `phrasing ${r} should not name a blocker`);
      variants.add(text);
    }
    assert.equal(variants.size, 3);
  });
});

describe("phraseFor, voice rules from BRAND.md / COLLABORATION_LOOP.md", () => {
  test("no chart-language artifacts (%, =, count:, kpi)", () => {
    for (const trigger of ALL_TRIGGERS) {
      for (let r = 0; r < 3; r++) {
        const text = phraseFor(trigger, task(), r, { idleDays: 5, daysOut: -3 });
        assert.doesNotMatch(text, /%|=|count:|kpi/i, `${trigger} @ ${r}: ${text}`);
      }
    }
  });

  test("rotation index wraps with modulo (rot 5 → same as rot 2)", () => {
    const t = task({ idleDays: 5 });
    const a = phraseFor("stuck-work", t, 2);
    const b = phraseFor("stuck-work", t, 5);
    assert.equal(a, b);
  });
});
