import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  QUALIFIED_VIEW_MIN_VISIBLE_MS,
  QUALIFIED_VIEW_RECEIPT_RETENTION_MS,
  hashQualifiedViewSession,
  parseQualifiedViewPayload,
  qualifiedViewReceiptExpiry,
  qualifiedViewRequestEligibility,
} from "./qualified-view";

const SESSION_ID = "7bd648de-1aa0-4a81-82d7-2d722942a092";
const REQUEST_URL = "https://app.signalstudio.ie/s/opaque-token/view";

function browserHeaders(overrides: Record<string, string> = {}): Headers {
  return new Headers({
    origin: "https://app.signalstudio.ie",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    "content-type": "application/json",
    "user-agent": "Mozilla/5.0 Safari/605.1.15",
    ...overrides,
  });
}

describe("qualified view payload", () => {
  it("accepts only a random browser session and at least two visible seconds", () => {
    assert.deepEqual(
      parseQualifiedViewPayload({
        sessionId: SESSION_ID,
        visibleForMs: QUALIFIED_VIEW_MIN_VISIBLE_MS,
      }),
      { sessionId: SESSION_ID, visibleForMs: 2_000 },
    );
    assert.throws(() =>
      parseQualifiedViewPayload({ sessionId: SESSION_ID, visibleForMs: 1_999 }),
    );
    assert.throws(() =>
      parseQualifiedViewPayload({
        sessionId: SESSION_ID,
        visibleForMs: 2_000,
        referrer: "https://example.com/private",
      }),
    );
  });

  it("hashes the session per publication without preserving the raw id", () => {
    const first = hashQualifiedViewSession("publication-a", SESSION_ID);
    const same = hashQualifiedViewSession("publication-a", SESSION_ID);
    const other = hashQualifiedViewSession("publication-b", SESSION_ID);
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.equal(first, same);
    assert.notEqual(first, other);
    assert.equal(first.includes(SESSION_ID), false);
  });

  it("expires deduplication material after the fixed retention window", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    assert.equal(
      qualifiedViewReceiptExpiry(now).getTime() - now.getTime(),
      QUALIFIED_VIEW_RECEIPT_RETENTION_MS,
    );
  });
});

describe("qualified view request metadata", () => {
  it("accepts a same-origin browser fetch", () => {
    assert.deepEqual(
      qualifiedViewRequestEligibility(browserHeaders(), REQUEST_URL),
      { eligible: true },
    );
  });

  it("rejects cross-origin, prefetch, missing fetch metadata, and bots", () => {
    assert.equal(
      qualifiedViewRequestEligibility(
        browserHeaders({ origin: "https://attacker.example" }),
        REQUEST_URL,
      ).eligible,
      false,
    );
    assert.equal(
      qualifiedViewRequestEligibility(
        browserHeaders({ purpose: "prefetch" }),
        REQUEST_URL,
      ).eligible,
      false,
    );
    const missingFetchSite = browserHeaders();
    missingFetchSite.delete("sec-fetch-site");
    assert.equal(
      qualifiedViewRequestEligibility(missingFetchSite, REQUEST_URL).eligible,
      false,
    );
    assert.equal(
      qualifiedViewRequestEligibility(
        browserHeaders({ "user-agent": "Slackbot-LinkExpanding 1.0" }),
        REQUEST_URL,
      ).eligible,
      false,
    );
  });
});
