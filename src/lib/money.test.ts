import assert from "node:assert/strict";
import test from "node:test";
import { budgetCoverageLine, formatCents, isProjectCurrency } from "./money";

test("amounts format code-first in the project currency, USD when unset", () => {
  assert.equal(formatCents(1_840_000, "EUR"), "EUR 18,400");
  assert.equal(formatCents(120_050, "USD"), "USD 1,200.50");
  // Unset or unknown currency keeps the label the amounts were entered
  // under — relabelling a stored number would change the claim.
  assert.equal(formatCents(120_000, null), "USD 1,200");
  assert.equal(formatCents(120_000, "ZZZ"), "USD 1,200");
});

test("currency guard accepts only the curated codes", () => {
  assert.equal(isProjectCurrency("EUR"), true);
  assert.equal(isProjectCurrency("BTC"), false);
  assert.equal(isProjectCurrency(null), false);
});

test("the roll-up leads with coverage and never fakes a total", () => {
  assert.equal(
    budgetCoverageLine({
      summedCents: 1_840_000,
      costedCount: 12,
      uncostedCount: 31,
      budgetCents: 5_000_000,
      currency: "EUR",
    }),
    "EUR 18,400 of EUR 50,000. 12 tasks costed, 31 without a price.",
  );
  assert.equal(
    budgetCoverageLine({
      summedCents: 90_000,
      costedCount: 1,
      uncostedCount: 0,
      budgetCents: null,
      currency: "USD",
    }),
    "USD 900 recorded. 1 task costed.",
  );
  // Nothing costed and no budget: say nothing rather than "USD 0 of…".
  assert.equal(
    budgetCoverageLine({
      summedCents: 0,
      costedCount: 0,
      uncostedCount: 9,
      budgetCents: null,
      currency: null,
    }),
    null,
  );
});
