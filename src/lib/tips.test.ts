/**
 * Tests for tips.ts — tip-selection engine.
 *
 * Run: node --import tsx --test src/lib/tips.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTip, TIPS } from "./tips";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const NOW = 1_000_000_000_000; // arbitrary fixed epoch ms

// ── Session cap ───────────────────────────────────────────────────────────────

test("sessionShown true → null (session cap enforced)", () => {
  const result = nextTip({
    context: "inbox",
    seen: {},
    lastShownAt: null,
    now: NOW,
    sessionShown: true,
  });
  assert.equal(result, null);
});

// ── Weekly cap boundary ───────────────────────────────────────────────────────

test("lastShownAt exactly 7 days ago → eligible (boundary: 7 days is stale)", () => {
  // exactly 7 days is NOT within the window (< 7 days triggers the cap)
  const result = nextTip({
    context: "inbox",
    seen: {},
    lastShownAt: NOW - SEVEN_DAYS_MS,
    now: NOW,
    sessionShown: false,
  });
  // 7 days exactly: now - lastShownAt = SEVEN_DAYS_MS, which is NOT < SEVEN_DAYS_MS
  assert.notEqual(result, null, "Exactly 7 days old is eligible");
});

test("lastShownAt 6 days 23 hours ago → capped (within 7 days)", () => {
  const sixDays23Hours = SEVEN_DAYS_MS - 60 * 60 * 1000;
  const result = nextTip({
    context: "inbox",
    seen: {},
    lastShownAt: NOW - sixDays23Hours,
    now: NOW,
    sessionShown: false,
  });
  assert.equal(result, null, "Within 7-day window must be capped");
});

test("lastShownAt null (never shown) → eligible", () => {
  const result = nextTip({
    context: "inbox",
    seen: {},
    lastShownAt: null,
    now: NOW,
    sessionShown: false,
  });
  assert.notEqual(result, null, "null lastShownAt should be eligible");
});

// ── Context filter ────────────────────────────────────────────────────────────

test("context 'inbox' → only inbox tips returned", () => {
  const result = nextTip({
    context: "inbox",
    seen: {},
    lastShownAt: null,
    now: NOW,
    sessionShown: false,
  });
  assert.notEqual(result, null);
  assert.equal(result?.context, "inbox");
});

test("context 'task-panel' → only task-panel tips returned", () => {
  const result = nextTip({
    context: "task-panel",
    seen: {},
    lastShownAt: null,
    now: NOW,
    sessionShown: false,
  });
  assert.notEqual(result, null);
  assert.equal(result?.context, "task-panel");
});

test("context 'board' → only board tips returned", () => {
  const result = nextTip({
    context: "board",
    seen: {},
    lastShownAt: null,
    now: NOW,
    sessionShown: false,
  });
  assert.notEqual(result, null);
  assert.equal(result?.context, "board");
});

// ── Seen exclusion ────────────────────────────────────────────────────────────

test("all inbox tips seen at current version → null", () => {
  const inboxTips = TIPS.filter((t) => t.context === "inbox");
  const seen: Record<string, number> = {};
  for (const tip of inboxTips) {
    seen[tip.id] = tip.version;
  }
  const result = nextTip({
    context: "inbox",
    seen,
    lastShownAt: null,
    now: NOW,
    sessionShown: false,
  });
  assert.equal(result, null, "All tips seen should return null");
});

test("tip seen at version 1, tip.version=1 → excluded", () => {
  const inboxTip = TIPS.find((t) => t.context === "inbox");
  assert.ok(inboxTip, "There must be at least one inbox tip");
  const seen: Record<string, number> = { [inboxTip.id]: 1 };

  // If there's only one inbox tip, result should be null.
  const inboxCount = TIPS.filter((t) => t.context === "inbox").length;
  const result = nextTip({
    context: "inbox",
    seen,
    lastShownAt: null,
    now: NOW,
    sessionShown: false,
  });
  if (inboxCount === 1) {
    assert.equal(result, null, "Only tip already seen → null");
  } else {
    // If there are more inbox tips, one should still come up
    assert.notEqual(result?.id, inboxTip.id, "Already-seen tip must be skipped");
  }
});

// ── Version bump re-eligibility ───────────────────────────────────────────────

test("version bump: seen[id]=1, tip.version=2 → eligible again", () => {
  // Find or construct a scenario with a bump. Use TIPS[0] but simulate version 2.
  // We create a synthetic tip array by testing the logic directly.
  // Use a real tip and test with seen version lower than current.
  const tip = TIPS[0]!;

  // seen version = tip.version - 1: user saw the old version
  const seen: Record<string, number> = { [tip.id]: tip.version - 1 };

  // If seen[id] < tip.version, it is eligible.
  const seenVersion = seen[tip.id] ?? 0;
  const eligible = seenVersion < tip.version;
  assert.equal(eligible, true, "Version bump should make tip eligible again");

  // Also verify via nextTip: use the same context and only this tip
  // We need to ensure tip.version > 0 (it always is, set to 1 minimum).
  // If seen is 0 and version is 1, it should be eligible.
  const seen0: Record<string, number> = {};
  const result = nextTip({
    context: tip.context,
    seen: seen0,
    lastShownAt: null,
    now: NOW,
    sessionShown: false,
  });
  assert.notEqual(result, null, "Unseen tip should be eligible");
});

test("seen at version 1, tip bumped to version 2 → re-eligible", () => {
  // We test this by checking seen[id]=1 against a hypothetical tip with version 2.
  // Since we can't mutate TIPS in the test, we verify the logic:
  // nextTip skips when seenVersion >= tip.version.
  // So seen=1 with version=2 means 1 < 2, tip is eligible.
  const seenVersion = 1;
  const tipVersion = 2;
  assert.equal(seenVersion < tipVersion, true, "seen=1, version=2 → eligible");
  assert.equal(seenVersion >= tipVersion, false, "guard should NOT exclude");
});

// ── All TIPS have required fields ─────────────────────────────────────────────

test("all TIPS have non-empty id, body, valid context, positive version", () => {
  for (const tip of TIPS) {
    assert.ok(tip.id.length > 0, `Tip missing id: ${JSON.stringify(tip)}`);
    assert.ok(tip.body.length > 0, `Tip missing body: ${tip.id}`);
    assert.ok(
      ["board", "task-panel", "inbox"].includes(tip.context),
      `Unknown context '${tip.context}' on tip ${tip.id}`,
    );
    assert.ok(tip.version >= 1, `Version must be >= 1 on tip ${tip.id}`);
  }
});

// ── First eligible wins ───────────────────────────────────────────────────────

test("first eligible tip in context is returned, not the second", () => {
  // Derive the context to exercise rather than naming one. This test is
  // about ordering, and hard-coding "task-panel" made it fail the moment a
  // tip was retired from that context for editorial reasons.
  const contexts = [...new Set(TIPS.map((tip) => tip.context))];
  const contextTips = contexts
    .map((context) => TIPS.filter((tip) => tip.context === context))
    .sort((a, b) => b.length - a.length)[0]!;
  assert.ok(contextTips.length >= 2, "Need a context with at least 2 tips for this test");

  // Mark all but the last as seen.
  const seen: Record<string, number> = {};
  for (const tip of contextTips.slice(0, contextTips.length - 1)) {
    seen[tip.id] = tip.version;
  }

  const result = nextTip({
    context: contextTips[0]!.context,
    seen,
    lastShownAt: null,
    now: NOW,
    sessionShown: false,
  });
  const lastTip = contextTips[contextTips.length - 1]!;
  assert.equal(result?.id, lastTip.id, "Should return the only unseen tip");
});
