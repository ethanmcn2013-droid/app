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

describe("phraseFor, the observation never carries the title", () => {
  // The whole point of the split: an imperative, a question, or a
  // shout in subject position is what produced "Approve the final
  // seating plan is 2 days overdue".
  const AWKWARD_TITLES = [
    "Send the invitations.",
    "Do we need a marquee?",
    "URGENT: confirm the band",
    "Approve the final seating plan",
  ];

  for (const title of AWKWARD_TITLES) {
    test(`no phrasing interpolates "${title}"`, () => {
      for (const trigger of ALL_TRIGGERS) {
        for (let rot = 0; rot < 3; rot++) {
          const text = phraseFor(trigger, task({ title }), rot, {
            idleDays: 6,
            daysOut: -2,
            blockedByTitles: ["Book the band"],
          });
          assert.doesNotMatch(
            text,
            new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
            `${trigger} @ ${rot}: ${text}`,
          );
        }
      }
    });
  }

  test("every observation is a complete sentence", () => {
    for (const trigger of ALL_TRIGGERS) {
      for (let rot = 0; rot < 3; rot++) {
        const text = phraseFor(trigger, task(), rot, {
          idleDays: 6,
          daysOut: -2,
        });
        assert.match(text, /^[A-Z]/, `${trigger} @ ${rot}: ${text}`);
        assert.match(text, /\.$/, `${trigger} @ ${rot}: ${text}`);
      }
    }
  });
});

describe("phraseFor, context propagation", () => {
  test("stuck-work uses idleDays from context, not task field", () => {
    const t = task({ idleDays: 1 });
    const text = phraseFor("stuck-work", t, 0, { idleDays: 5 });
    assert.match(text, /for five days/);
    assert.doesNotMatch(text, /a day\b/);
  });

  test("due-soon overdue uses daysOut from context", () => {
    const t = task();
    const text = phraseFor("due-soon", t, 0, { daysOut: -5 });
    assert.match(text, /five days past its date/i);
  });

  test("due-soon due-today renders 'today'", () => {
    const text = phraseFor("due-soon", task(), 0, { daysOut: 0.5 });
    assert.match(text, /today/i);
  });

  test("blocked-too-long uses idleDays from context", () => {
    const t = task({ idleDays: 8, blockedBy: ["x"] });
    const text = phraseFor("blocked-too-long", t, 0, { idleDays: 12 });
    assert.match(text, /Twelve days/);
  });
});

describe("duration prose never rounds a day count upward", () => {
  // The receipt under the row says "Last update was eighteen days ago".
  // The row said "3 weeks", overstating its own evidence by three days.
  test("eighteen idle days never reads as three weeks", () => {
    for (let rot = 0; rot < 3; rot++) {
      const text = phraseFor("stuck-work", task(), rot, { idleDays: 18 });
      assert.match(text, /eighteen days/, text);
      assert.doesNotMatch(text, /weeks?/, text);
    }
  });

  // The month branch reopened the split it was meant to close: at 59 idle
  // days the row said "over a month" while the reader could count 59. One
  // unit, one number, at every age.
  test("a month-plus age still states the day count", () => {
    assert.match(
      phraseFor("stuck-work", task(), 0, { idleDays: 45 }),
      /for 45 days\./,
    );
    assert.match(
      phraseFor("stuck-work", task(), 0, { idleDays: 59 }),
      /for 59 days\./,
    );
    assert.match(
      phraseFor("stuck-work", task(), 0, { idleDays: 140 }),
      /for 140 days\./,
    );
  });

  test("no age is ever rendered in a coarser unit than days", () => {
    for (const idleDays of [2, 18, 29, 30, 31, 45, 59, 60, 90, 400]) {
      for (let rot = 0; rot < 3; rot++) {
        const text = phraseFor("stuck-work", task(), rot, { idleDays });
        assert.doesNotMatch(text, /month|week|year/i, `${idleDays} @ ${rot}: ${text}`);
        assert.ok(
          text.includes(String(idleDays)) || idleDays <= 20,
          `${idleDays} @ ${rot}: ${text}`,
        );
      }
    }
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
    assert.match(text, /Waiting on Music supplier\./);
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

  test("three blockers render 'X and two more', spelled", () => {
    const t = task({ blockedBy: ["x", "y", "z"], idleDays: 7 });
    const text = phraseFor("blocked-too-long", t, 0, {
      idleDays: 7,
      blockedByTitles: ["Music supplier", "Venue agreement", "Stationer"],
    });
    assert.match(text, /Music supplier and two more/);
    assert.doesNotMatch(text, /\d/);
  });

  test("six blockers render 'X and five more', spelled", () => {
    const text = phraseFor("blocked-too-long", task(), 0, {
      idleDays: 14,
      blockedByTitles: ["A", "B", "C", "D", "E", "F"],
    });
    assert.match(text, /A and five more/);
    assert.doesNotMatch(text, /\d/);
  });

  test("falls back to an unnamed upstream when no titles resolve", () => {
    const t = task({ blockedBy: ["x"], idleDays: 7 });
    const text = phraseFor("blocked-too-long", t, 0, {
      idleDays: 7,
      blockedByTitles: [],
    });
    assert.match(text, /Waiting on something upstream\. Seven days now\./);
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

// ─────────────────────────────────────────────────────────────
// The one place a title still has to travel inline: the upstream
// blocker, which has no row of its own. Every live failure of the
// title/observation split has surfaced here.
//   "Nine days waiting on Send the invitations.."
//   "Blocked by Do we need a marquee? for nine days."
// ─────────────────────────────────────────────────────────────
describe("blocker titles never break the sentence they travel in", () => {
  const PANEL_TITLES = [
    "Send the invitations.",
    "Do we need a marquee?",
    "URGENT: confirm the band",
    "Order the stationery",
  ];
  /** The two shapes that can sit inside a clause, once de-punctuated. */
  const NAMEABLE: Record<string, string> = {
    "Send the invitations.": "Send the invitations",
    "Order the stationery": "Order the stationery",
  };
  const PREPOSITIONS =
    "for|in|on|at|by|since|until|with|after|before|from|to|of";

  function escapeRe(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  for (const title of PANEL_TITLES) {
    for (const trigger of ALL_TRIGGERS) {
      for (let rot = 0; rot < 3; rot++) {
        test(`${trigger} @ ${rot} survives "${title}"`, () => {
          const text = phraseFor(trigger, task({ title }), rot, {
            idleDays: 9,
            daysOut: -2,
            blockedByTitles: [title],
          });

          // Sentence integrity: one terminal stop, no borrowed mark.
          assert.match(text, /^[A-Z]/, text);
          assert.match(text, /[^.]\.$/, text);
          assert.doesNotMatch(text, /\.\./, text);
          assert.doesNotMatch(text, /[?!]/, text);
          assert.doesNotMatch(text, /URGENT/, text);
          assert.doesNotMatch(text, /—/, text);

          const nameable = NAMEABLE[title];
          if (!nameable) {
            // A question or a shout is counted, never named.
            assert.doesNotMatch(
              text,
              new RegExp(escapeRe(title.replace(/[?!]/g, "")), "i"),
              text,
            );
            if (trigger === "blocked-too-long") {
              assert.match(text, /one upstream item/, text);
            }
            return;
          }

          if (trigger !== "blocked-too-long") return;
          // Named, de-punctuated, and never handed a following
          // preposition that would give the title a second reading.
          assert.match(text, new RegExp(escapeRe(nameable)), text);
          assert.doesNotMatch(
            text,
            new RegExp(`${escapeRe(nameable)}\\s+(${PREPOSITIONS})\\b`),
            text,
          );
        });
      }
    }
  }

  test("a terminal stop on the title is stripped, not doubled", () => {
    for (let rot = 0; rot < 3; rot++) {
      const text = phraseFor("blocked-too-long", task(), rot, {
        idleDays: 9,
        blockedByTitles: ["Send the invitations."],
      });
      assert.match(text, /Send the invitations[.,]/, text);
      assert.doesNotMatch(text, /invitations\.\./, text);
    }
  });

  test("one unnameable title in a pair sends the whole subject to a count", () => {
    for (let rot = 0; rot < 3; rot++) {
      const text = phraseFor("blocked-too-long", task(), rot, {
        idleDays: 9,
        blockedByTitles: ["Order the stationery", "Do we need a marquee?"],
      });
      assert.match(text, /two upstream items/, text);
      assert.doesNotMatch(text, /marquee/i, text);
    }
  });

  test("an unnameable lead counts the whole list rather than naming it", () => {
    const text = phraseFor("blocked-too-long", task(), 0, {
      idleDays: 9,
      blockedByTitles: [
        "URGENT: confirm the band",
        "Order the stationery",
        "Book the room",
      ],
    });
    assert.match(text, /three upstream items/, text);
    assert.doesNotMatch(text, /URGENT/, text);
  });

  test("a nameable lead with unnameable followers still names the lead", () => {
    const text = phraseFor("blocked-too-long", task(), 0, {
      idleDays: 9,
      blockedByTitles: [
        "Order the stationery",
        "Do we need a marquee?",
        "URGENT: confirm the band",
      ],
    });
    assert.match(text, /Order the stationery and two more/, text);
  });

  test("no rotation ever runs a named blocker into a preposition", () => {
    for (let rot = 0; rot < 3; rot++) {
      const text = phraseFor("blocked-too-long", task(), rot, {
        idleDays: 9,
        blockedByTitles: ["Send the invitations."],
      });
      assert.doesNotMatch(
        text,
        new RegExp(`invitations\\s+(${PREPOSITIONS})\\b`),
        text,
      );
    }
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
