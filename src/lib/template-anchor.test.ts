import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAnchorDate,
  resolveTemplateDueAt,
  templateMilestoneCount,
} from "./template-anchor";

const DAY_MS = 24 * 60 * 60 * 1000;

test("parseAnchorDate accepts a plain calendar date at UTC midnight", () => {
  assert.equal(
    parseAnchorDate("2027-09-18"),
    Date.parse("2027-09-18T00:00:00.000Z"),
  );
});

test("parseAnchorDate refuses the dates Date.parse rolls forward", () => {
  assert.equal(parseAnchorDate("2026-02-31"), null);
  assert.equal(parseAnchorDate("2026-13-01"), null);
});

test("parseAnchorDate refuses anything that is not YYYY-MM-DD", () => {
  assert.equal(parseAnchorDate(null), null);
  assert.equal(parseAnchorDate(undefined), null);
  assert.equal(parseAnchorDate(""), null);
  assert.equal(parseAnchorDate("18/09/2027"), null);
  assert.equal(parseAnchorDate("2027-09-18T12:00:00Z"), null);
});

test("a negative offset lands before the wedding day", () => {
  const due = resolveTemplateDueAt({
    anchorDate: "2027-09-18",
    dueOffsetDays: -14,
  });
  assert.ok(due);
  assert.equal(due.toISOString(), "2027-09-04T00:00:00.000Z");
});

test("offset 0 is the wedding day itself and a positive offset is after", () => {
  assert.equal(
    resolveTemplateDueAt({ anchorDate: "2027-09-18", dueOffsetDays: 0 })
      ?.toISOString(),
    "2027-09-18T00:00:00.000Z",
  );
  assert.equal(
    resolveTemplateDueAt({ anchorDate: "2027-09-18", dueOffsetDays: 21 })
      ?.toISOString(),
    "2027-10-09T00:00:00.000Z",
  );
});

test("no offset means no due date, even with an anchor", () => {
  assert.equal(resolveTemplateDueAt({ anchorDate: "2027-09-18" }), null);
  assert.equal(
    resolveTemplateDueAt({ anchorDate: "2027-09-18", dueOffsetDays: null }),
    null,
  );
});

test("NO ANCHOR MEANS NO DUE DATE. It never falls back to days-from-now", () => {
  // This is the load-bearing refusal. Signal builds the couple's briefing
  // from tasks.due_at and Timeline orders milestones by it, so a date
  // derived from the day the couple happened to redeem would surface as a
  // deadline nobody set.
  const before = Date.now();
  const due = resolveTemplateDueAt({ anchorDate: null, dueOffsetDays: -14 });
  assert.equal(due, null);
  assert.equal(
    resolveTemplateDueAt({ anchorDate: "not a date", dueOffsetDays: -14 }),
    null,
  );
  // Guard against a future edit that quietly reintroduces a now-relative
  // fallback: nothing above may have produced an instant near "now".
  assert.ok(Date.now() - before < 60 * DAY_MS);
});

test("a fractional offset is truncated rather than producing a part-day instant", () => {
  assert.equal(
    resolveTemplateDueAt({ anchorDate: "2027-09-18", dueOffsetDays: -14.9 })
      ?.toISOString(),
    "2027-09-04T00:00:00.000Z",
  );
});

test("templateMilestoneCount counts only explicit milestones", () => {
  assert.equal(templateMilestoneCount([]), 0);
  assert.equal(
    templateMilestoneCount([{}, { milestone: false }, { milestone: true }]),
    1,
  );
});
