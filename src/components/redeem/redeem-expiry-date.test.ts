import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRedeemExpiryDate } from "./redeem-expiry-date";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RedeemResultCard, REDEEM_FAILURE_COPY, REDEEM_TIER_LABELS } from "./redeem-result-card";

test("redeem expiry copy is identical across server and browser locales", () => {
  assert.equal(
    formatRedeemExpiryDate("2027-12-31T23:59:59.000Z"),
    "31 December 2027",
  );
});

test("every failed redemption renders a support route without putting the code in its URL", () => {
  for (const reason of Object.keys(REDEEM_FAILURE_COPY) as Array<keyof typeof REDEEM_FAILURE_COPY>) {
    const html = renderToStaticMarkup(createElement(RedeemResultCard, {
      code: "SYNTHETIC-PRIVATE-CODE",
      result: { ok: false, reason },
    }));
    assert.match(html, /href="mailto:hello@signalstudio\.ie\?subject=Access%20code%20help"/);
    assert.match(html, /href="\/app\/tasks"/);
    assert.doesNotMatch(html, /href="[^"]*SYNTHETIC-PRIVATE-CODE/);
    assert.doesNotMatch(html, /mint a fresh|someone got there first/i);
  }
});

test("waiting and account/project failures retain their distinct recovery instructions", () => {
  assert.match(REDEEM_FAILURE_COPY["rate-limited"].body, /ten minutes/);
  assert.match(REDEEM_FAILURE_COPY["still-provisioning"].body, /right account.*manage the intended project.*same code/);
  assert.match(REDEEM_FAILURE_COPY["already-redeemed"].body, /account you first used.*same code/);
});

test("legacy Wedding and Studio grants have explicit public success labels", () => {
  assert.equal(REDEEM_TIER_LABELS.wedding, "Wedding suite");
  assert.equal(REDEEM_TIER_LABELS.studio, "Studio");
  for (const tier of ["wedding", "studio"] as const) {
    const html = renderToStaticMarkup(createElement(RedeemResultCard, {
      code: "SYNTHETIC-LEGACY",
      result: { ok: true, tier, expiresAt: "2027-12-31T23:59:59.000Z", notes: null },
    }));
    assert.ok(html.includes(`>${REDEEM_TIER_LABELS[tier]}</span>`));
  }
});

test("public Pro copy preserves the original claimed project destination", () => {
  const html = renderToStaticMarkup(createElement(RedeemResultCard, {
    code: "SYNTHETIC-SUCCESS",
    result: { ok: true, tier: "workspace", expiresAt: "2027-12-31T23:59:59.000Z", notes: null, projectId: "project-original", sponsorSlug: "synthetic-venue" },
  }));
  assert.match(html, />Pro<\/span>/);
  assert.match(html, /workspaceId=project-original/);
  assert.match(html, /welcome=venue/);
});
