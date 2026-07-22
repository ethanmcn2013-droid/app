import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function source(relativeUrl) {
  return readFileSync(new URL(relativeUrl, import.meta.url), "utf8");
}

test("Audience Timeline GET resolution is a pure read", () => {
  const server = source("./audience-timeline.ts");
  const start = server.indexOf("export const resolveAudienceTimeline");
  assert.ok(start >= 0);
  const resolver = server.slice(start);
  assert.doesNotMatch(resolver, /\.update\s*\(/);
  assert.doesNotMatch(resolver, /visitCount|lastAccessAt/);
});

test("qualified receipts have a minimal, non-identifying schema", () => {
  const schema = source("./db/timeline-schema.ts");
  const start = schema.indexOf("export const audienceViewReceipts");
  const end = schema.indexOf("export type Project", start);
  const receiptSchema = schema.slice(start, end);
  assert.match(receiptSchema, /publicationId/);
  assert.match(receiptSchema, /sessionHash/);
  assert.match(receiptSchema, /expiresAt/);
  assert.doesNotMatch(
    receiptSchema,
    /ipAddress|userAgent|referrer|rawToken|rawSession|audienceShareId/,
  );
});

test("view route and tracker enforce the qualified browser boundary", () => {
  const route = source("../../../app/s/[token]/view/route.ts");
  const tracker = source("../app/audience/qualified-view-tracker.tsx");
  const model = source("../lib/qualified-view.ts");
  assert.match(route, /qualifiedViewRequestEligibility/);
  assert.match(route, /audience-qualified-view/);
  assert.match(route, /checkRateLimit/);
  assert.match(route, /no-store/);
  assert.match(route, /status:\s*204/);
  assert.match(model, /sec-fetch-site/);
  assert.match(model, /same-origin/);
  assert.match(model, /prefetch/);
  assert.match(model, /AUTOMATED_VIEWER_RE/);
  assert.match(tracker, /MIN_VISIBLE_MS\s*=\s*2_000/);
  assert.match(tracker, /visibilitychange/);
  assert.match(tracker, /sessionStorage/);
  assert.match(tracker, /mode\s*!==\s*"shared"/);
  assert.match(tracker, /referrerPolicy:\s*"no-referrer"/);
});

test("owner reads aggregates while GDPR omits and erases receipt hashes", () => {
  const audience = source("./audience-timeline.ts");
  const gdpr = source("./timeline-gdpr.ts");
  assert.match(audience, /qualifiedViewCount:\s*timelinePublications\.qualifiedViewCount/);
  assert.match(audience, /lastQualifiedViewAt:\s*timelinePublications\.lastQualifiedViewAt/);
  assert.match(gdpr, /delete\(audienceViewReceipts\)/);
  assert.match(gdpr, /audienceShareExportColumns/);
  assert.doesNotMatch(gdpr, /select\(\)\.from\(audienceShares\)/);
  assert.doesNotMatch(gdpr, /select\(\)\.from\(audienceViewReceipts\)/);
});
