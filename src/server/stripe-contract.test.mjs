import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stripe = readFileSync(new URL("./stripe.ts", import.meta.url), "utf8");
const billing = readFileSync(new URL("./actions/billing.ts", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../app/api/checkout/route.ts", import.meta.url), "utf8");

test("annual price resolution cannot fall through to a monthly price", () => {
  const annualBranch = stripe.slice(
    stripe.indexOf('if (interval === "annual")'),
    stripe.indexOf("const id = PRICE_IDS[tier]"),
  );
  assert.match(annualBranch, /return annual \|\| null/);
  assert.doesNotMatch(annualBranch, /const id = PRICE_IDS/);
  assert.doesNotMatch(stripe, /degrades to the monthly/);
});

test("missing annual configuration fails before dev grant and returns explicit 503", () => {
  const annualGuard = billing.indexOf('if (interval === "annual" && !configuredPriceId)');
  const devGrant = billing.indexOf("if (!stripe)");
  assert.ok(annualGuard >= 0 && annualGuard < devGrant);
  assert.match(billing, /throw new MissingStripePriceError\(tier, interval\)/);
  assert.match(checkout, /err instanceof MissingStripePriceError/);
  assert.match(checkout, /status: 503/);
});
