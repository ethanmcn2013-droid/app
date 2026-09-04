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

test("missing annual configuration fails before checkout and returns explicit 503", () => {
  const annualGuard = billing.indexOf('if (interval === "annual" && !configuredPriceId)');
  const devGrant = billing.indexOf("if (!stripe)");
  assert.ok(annualGuard >= 0 && annualGuard < devGrant);
  assert.match(billing, /throw new MissingStripePriceError\(tier, interval\)/);
  assert.match(checkout, /err instanceof MissingStripePriceError/);
  assert.match(checkout, /status: 503/);
});

test("billing actions cannot grant or expire paid access directly", () => {
  assert.deepEqual([...billing.matchAll(/export async function (\w+)/g)].map(match => match[1]), ["createCheckoutSessionAction"]);
  assert.doesNotMatch(billing, /grantEntitlement|dev:no-stripe|db\.insert/);
  assert.match(billing, /if \(!stripe\)\s*\{\s*throw new Error/);
  const internal = readFileSync(new URL("./billing-entitlements.ts", import.meta.url), "utf8");
  assert.match(internal, /import "server-only"/);
  assert.doesNotMatch(internal, /["']use server["']/);
});

test("webhook dispatch and billing identity stay behind verified boundaries", () => {
  const webhook = readFileSync(new URL("../app/api/webhooks/stripe/route.ts", import.meta.url), "utf8");
  const lifecycle = readFileSync(new URL("./stripe-lifecycle.ts", import.meta.url), "utf8");
  const portal = readFileSync(new URL("./actions/plan.ts", import.meta.url), "utf8");
  const clerk = readFileSync(new URL("../app/api/webhooks/clerk/route.ts", import.meta.url), "utf8");
  assert.ok(webhook.indexOf("isDemoMode()") < webhook.indexOf("stripe.webhooks.constructEvent"));
  assert.ok(webhook.indexOf("stripe.webhooks.constructEvent") < webhook.indexOf("await handleStripeLifecycle"));
  assert.match(lifecycle, /case "invoice.paid"/);
  assert.match(lifecycle, /case "charge.refunded"/);
  assert.match(portal, /billingCustomerForUser\(userId\)/);
  assert.doesNotMatch(portal, /customers\.list|emailAddress/);
  assert.doesNotMatch(clerk, /grantEntitlement|EDU_PRO_DAYS/);
});
