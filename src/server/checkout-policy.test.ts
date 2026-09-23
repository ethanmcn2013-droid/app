import { test } from "node:test";
import assert from "node:assert/strict";
import { checkoutModeFor, eventAccessExpiresAt, isPaidTier } from "./checkout-policy";

test("one-time purchases never request a Stripe subscription", () => {
  assert.equal(checkoutModeFor("event"), "payment");
  assert.equal(checkoutModeFor("wedding"), "payment");
  assert.equal(checkoutModeFor("workspace"), "subscription");
  assert.equal(checkoutModeFor("studio"), "subscription");
  for (const value of ["free", "__proto__", null, 3, {}, "annual"]) assert.equal(isPaidTier(value), false);
});

test("Event lasts twelve calendar months including leap-year boundaries", () => {
  for (const [paid, expires] of [
    ["2027-01-21T12:00:00Z", "2028-01-21T12:00:00.000Z"],
    ["2027-03-01T12:00:00Z", "2028-03-01T12:00:00.000Z"],
    ["2028-02-29T12:00:00Z", "2029-02-28T12:00:00.000Z"],
  ]) assert.equal(eventAccessExpiresAt(new Date(paid)).toISOString(), expires);
});
