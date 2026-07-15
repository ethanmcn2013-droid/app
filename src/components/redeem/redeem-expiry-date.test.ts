import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRedeemExpiryDate } from "./redeem-expiry-date";

test("redeem expiry copy is identical across server and browser locales", () => {
  assert.equal(
    formatRedeemExpiryDate("2027-12-31T23:59:59.000Z"),
    "31 December 2027",
  );
});
