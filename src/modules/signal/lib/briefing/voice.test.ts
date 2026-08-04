import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import type { Briefing } from "./types";
import {
  closingLine,
  graceNote,
  greeting,
  readCountSentence,
  summaryLine,
} from "./voice";

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
    readCount: 0,
    triggeredCount: 0,
    ...overrides,
  };
}

describe("greeting", () => {
  test("time-of-day base phrase", () => {
    assert.equal(greeting(3), "It’s late.");
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

  // Display type sits beside "One risk" and "Three things calling", so a
  // figure in this line would be the only numeral on the page.
  test("risk-only day spells its count", () => {
    assert.equal(
      summaryLine(brief({ quietRisks: [{} as never] })),
      "A quiet day. One risk worth watching.",
    );
    assert.equal(
      summaryLine(brief({ quietRisks: [{}, {}] as never[] })),
      "A quiet day. Two risks worth watching.",
    );
    assert.equal(
      summaryLine(brief({ quietRisks: [{}, {}, {}] as never[] })),
      "A quiet day. Three risks worth watching.",
    );
  });

  test("attention count drives the line", () => {
    assert.equal(
      summaryLine(brief({ needsAttention: [{}] as never[] })),
      "One thing’s calling.",
    );
    assert.equal(
      summaryLine(brief({ needsAttention: [{}, {}] as never[] })),
      "Two things calling.",
    );
    assert.equal(
      summaryLine(brief({ needsAttention: [{}, {}, {}] as never[] })),
      "Three things calling.",
    );
  });

  // The quiet risks render directly below this line and the meta line
  // counts them, so no branch may pretend they are not there.
  test("every attention branch accounts for quiet risks below it", () => {
    assert.equal(
      summaryLine(
        brief({
          needsAttention: [{}] as never[],
          quietRisks: [{}, {}] as never[],
        }),
      ),
      "One thing’s calling, and a few quieter signals below.",
    );
    assert.equal(
      summaryLine(
        brief({
          needsAttention: [{}, {}] as never[],
          quietRisks: [{}, {}] as never[],
        }),
      ),
      "Two things calling, and a few quieter signals below.",
    );
    assert.equal(
      summaryLine(
        brief({
          needsAttention: [{}, {}, {}] as never[],
          quietRisks: [{}, {}] as never[],
        }),
      ),
      "Three things calling, and quieter signals below them.",
    );
  });

  // "A few quieter signals below" over exactly one visible risk row was
  // the line miscounting what sits one row underneath it.
  test("the tail is singular over exactly one risk", () => {
    assert.equal(
      summaryLine(
        brief({
          needsAttention: [{}] as never[],
          quietRisks: [{}] as never[],
        }),
      ),
      "One thing’s calling, and one quieter signal below.",
    );
    assert.equal(
      summaryLine(
        brief({
          needsAttention: [{}, {}] as never[],
          quietRisks: [{}] as never[],
        }),
      ),
      "Two things calling, and one quieter signal below.",
    );
    assert.equal(
      summaryLine(
        brief({
          needsAttention: [{}, {}, {}] as never[],
          quietRisks: [{}] as never[],
        }),
      ),
      "Three things calling, and one quieter signal below them.",
    );
  });

  test("no branch of the spoken line carries a numeral", () => {
    for (let att = 0; att <= 3; att++) {
      for (let risks = 0; risks <= 3; risks++) {
        const line = summaryLine(
          brief({
            needsAttention: Array.from({ length: att }, () => ({})) as never[],
            quietRisks: Array.from({ length: risks }, () => ({})) as never[],
          }),
        );
        assert.doesNotMatch(line, /\d/, `att ${att} / risks ${risks}: ${line}`);
        assert.doesNotMatch(line, /'/, `att ${att} / risks ${risks}: ${line}`);
      }
    }
  });
});

describe("graceNote", () => {
  test("empty brief", () => {
    assert.equal(graceNote(brief({ isEmpty: true })), "That’s the read.");
  });

  // Every row already carries a "Review in Tasks" control, and DESIGN.md
  // §11 refuses the instruction, so the sign-off stops after the read.
  test("a single-ask brief does not tell the reader where to go", () => {
    assert.equal(
      graceNote(brief({ needsAttention: [{}] as never[] })),
      "That’s the read.",
    );
  });

  // The sort is focusWeight, not age: due-soon 1000, crowded-week 800,
  // stuck-work 700, blocked-too-long 600. The longest-waiting item is
  // reliably LAST, so the old line described the wrong row every time.
  test("two-plus attention items describes the sort the page actually runs", () => {
    assert.equal(
      graceNote(brief({ needsAttention: [{}, {}] as never[] })),
      "That’s the read. Dates came first, then the quiet ones.",
    );
  });

  test("never claims an order the page does not use", () => {
    for (const b of [
      brief(),
      brief({ isEmpty: true }),
      brief({ needsAttention: [{}] as never[] }),
      brief({ needsAttention: [{}, {}] as never[] }),
      brief({ needsAttention: [{}, {}, {}] as never[] }),
    ]) {
      const line = graceNote(b);
      assert.doesNotMatch(line, /focus block/i, line);
      assert.doesNotMatch(line, /waiting longest|the top one/i, line);
      assert.doesNotMatch(line, /open tasks/i, line);
      assert.doesNotMatch(line, /'/, line);
    }
  });

  test("graceNote and the ledger adapters share one closing line", () => {
    assert.equal(
      graceNote(brief({ needsAttention: [{}, {}] as never[] })),
      closingLine(2, false),
    );
    assert.equal(graceNote(brief({ isEmpty: true })), closingLine(0, true));
  });
});

describe("readCountSentence", () => {
  test("states the denominator when the engine reported one", () => {
    assert.equal(
      readCountSentence(41, 0),
      "Signal read 41 items in this scope. Nothing crossed Signal’s attention rules.",
    );
    assert.equal(
      readCountSentence(1, 0),
      "Signal read one item in this scope. Nothing crossed Signal’s attention rules.",
    );
  });

  test("spells a small denominator and prints a large one", () => {
    assert.match(readCountSentence(2)!, /^Signal read two items/);
    assert.match(readCountSentence(20)!, /^Signal read twenty items/);
    assert.match(readCountSentence(21)!, /^Signal read 21 items/);
  });

  // The page can be empty while something crossed a rule: a lone
  // just-shipped item lands in a bucket that renders nowhere. Claiming
  // "nothing crossed" there was a false all-clear.
  test("never claims nothing crossed when something did", () => {
    assert.equal(
      readCountSentence(2, 1),
      "Signal read two items in this scope. One of them crossed a rule without asking anything of you.",
    );
    assert.equal(
      readCountSentence(9, 3),
      "Signal read nine items in this scope. Three of them crossed a rule without asking anything of you.",
    );
    for (let triggered = 1; triggered <= 5; triggered++) {
      assert.doesNotMatch(
        readCountSentence(12, triggered)!,
        /nothing crossed/i,
        `triggered ${triggered}`,
      );
    }
  });

  test("a triggered count of zero or nothing keeps the plain all-clear", () => {
    assert.match(readCountSentence(4)!, /Nothing crossed Signal’s attention rules\.$/);
    assert.match(readCountSentence(4, 0)!, /Nothing crossed Signal’s attention rules\.$/);
    assert.match(
      readCountSentence(4, null)!,
      /Nothing crossed Signal’s attention rules\.$/,
    );
    assert.match(
      readCountSentence(4, Number.NaN)!,
      /Nothing crossed Signal’s attention rules\.$/,
    );
  });

  test("never counts more crossed than it read", () => {
    assert.equal(
      readCountSentence(2, 9),
      "Signal read two items in this scope. Two of them crossed a rule without asking anything of you.",
    );
  });

  test("withholds the accounting rather than guessing it", () => {
    assert.equal(readCountSentence(0), null);
    assert.equal(readCountSentence(null), null);
    assert.equal(readCountSentence(undefined), null);
    assert.equal(readCountSentence(Number.NaN), null);
  });
});
