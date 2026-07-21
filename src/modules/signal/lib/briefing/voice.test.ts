import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import type { Briefing } from "./types";
import { graceNote, greeting, summaryLine } from "./voice";

function brief(overrides: Partial<Briefing> = {}): Briefing {
  return {
    userId: "u_1",
    generatedAt: 0,
    greetingHour: 9,
    needsAttention: [],
    movingWell: [],
    quietRisks: [],
    suggestedFocus: [],
    isEmpty: false,
    ...overrides,
  };
}

describe("greeting", () => {
  test("time-of-day base phrase", () => {
    assert.equal(greeting(3), "It's late.");
    assert.equal(greeting(9), "Good morning.");
    assert.equal(greeting(14), "Good afternoon.");
    assert.equal(greeting(20), "Good evening.");
  });

  test("personalises with firstName when present", () => {
    assert.equal(greeting(9, "Ethan"), "Good morning, Ethan.");
  });

  test("falls back to impersonal when firstName is null/empty", () => {
    assert.equal(greeting(9, null), "Good morning.");
    assert.equal(greeting(9, ""), "Good morning.");
  });

  test("boundary hours land in the right bucket", () => {
    assert.equal(greeting(5), "Good morning.");
    assert.equal(greeting(12), "Good afternoon.");
    assert.equal(greeting(17), "Good evening.");
  });
});

describe("summaryLine", () => {
  test("silent on a quiet day, nothing pulling, no filler", () => {
    assert.equal(summaryLine(brief()), "");
  });

  test("still silent when only moving-well has items", () => {
    assert.equal(summaryLine(brief({ movingWell: [{} as never] })), "");
  });

  test("risk-only day singular vs plural", () => {
    assert.equal(
      summaryLine(brief({ quietRisks: [{} as never] })),
      "A quiet day, but 1 risk worth watching.",
    );
    assert.equal(
      summaryLine(brief({ quietRisks: [{}, {}] as never[] })),
      "A quiet day, but 2 risks worth watching.",
    );
  });

  test("attention count drives the line", () => {
    assert.equal(
      summaryLine(brief({ needsAttention: [{}] as never[] })),
      "One thing's calling.",
    );
    assert.equal(
      summaryLine(brief({ needsAttention: [{}, {}] as never[] })),
      "Two things calling, and a few quieter signals below.",
    );
    assert.equal(
      summaryLine(brief({ needsAttention: [{}, {}, {}] as never[] })),
      "Three things calling.",
    );
    assert.equal(
      summaryLine(
        brief({
          needsAttention: [{}, {}, {}] as never[],
          quietRisks: [{}] as never[],
        }),
      ),
      "Three things calling, more quietly behind them.",
    );
  });
});

describe("graceNote", () => {
  test("empty brief", () => {
    assert.equal(graceNote(brief({ isEmpty: true })), "That's the read.");
  });

  test("no focus block", () => {
    assert.equal(graceNote(brief()), "That's the read, good day.");
  });

  test("two-plus attention items steers to the focus block", () => {
    assert.equal(
      graceNote(
        brief({
          needsAttention: [{}, {}] as never[],
          suggestedFocus: [{}] as never[],
        }),
      ),
      "Take the focus block first. The rest can wait.",
    );
  });

  test("default sign-off with a focus block", () => {
    assert.equal(
      graceNote(brief({ suggestedFocus: [{}] as never[] })),
      "That's the read. Open Tasks when you're ready.",
    );
  });
});
