import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INSTRUMENTATION_VERSION,
  MEANINGFUL_ACTION_KINDS,
  isAllowedKind,
  validateMeaningfulAction,
} from "./event-schema";

const HASH_A = "a".repeat(32);
const HASH_B = "b".repeat(32);

function valid(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt_1",
    instrumentationVersion: INSTRUMENTATION_VERSION,
    product: "tasks",
    kind: "task_completed",
    occurredAt: 1_785_000_000_000,
    subjectIdHash: HASH_A,
    workspaceIdHash: HASH_B,
    ...overrides,
  };
}

test("accepts a well-formed event", () => {
  const result = validateMeaningfulAction(valid());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.event.kind, "task_completed");
});

test("every allowlisted kind is accepted under its own product", () => {
  for (const [product, kinds] of Object.entries(MEANINGFUL_ACTION_KINDS)) {
    for (const kind of kinds) {
      const result = validateMeaningfulAction(valid({ product, kind }));
      assert.equal(result.ok, true, `${product}/${kind} should be allowed`);
    }
  }
});

test("a kind belonging to another product is rejected", () => {
  const result = validateMeaningfulAction(valid({ product: "notes", kind: "task_created" }));
  assert.equal(result.ok, false);
});

test("page views and other unlisted kinds are rejected", () => {
  for (const kind of ["page_view", "note_opened", "task_viewed", "briefing_rendered"]) {
    const result = validateMeaningfulAction(valid({ kind }));
    assert.equal(result.ok, false, `${kind} must not count as use`);
  }
});

test("forbidden content fields are rejected, not stripped", () => {
  for (const field of ["title", "body", "email", "url", "clerkId", "code", "attachment"]) {
    const result = validateMeaningfulAction(valid({ [field]: "x" }));
    assert.equal(result.ok, false, `${field} must be rejected`);
    if (!result.ok) assert.match(result.reason, /forbidden field|unexpected field/);
  }
});

test("a forbidden field cannot hide inside a nested object", () => {
  const result = validateMeaningfulAction({
    ...valid(),
    meta: { nested: { title: "private note title" } },
  });
  assert.equal(result.ok, false);
});

test("raw identifiers are refused so only hashes can travel", () => {
  for (const field of ["workspaceId", "subjectId", "userId"]) {
    const result = validateMeaningfulAction(valid({ [field]: "raw-id" }));
    assert.equal(result.ok, false, `${field} must be refused`);
  }
});

test("unhashed-looking identity values are rejected", () => {
  assert.equal(validateMeaningfulAction(valid({ subjectIdHash: "user_123" })).ok, false);
  assert.equal(validateMeaningfulAction(valid({ workspaceIdHash: "" })).ok, false);
  assert.equal(validateMeaningfulAction(valid({ subjectIdHash: "A".repeat(32) })).ok, false);
});

test("missing and extra fields are both rejected", () => {
  const { eventId: _drop, ...withoutId } = valid();
  assert.equal(validateMeaningfulAction(withoutId).ok, false);
  assert.equal(validateMeaningfulAction(valid({ extra: 1 })).ok, false);
});

test("a foreign instrumentation version is rejected", () => {
  assert.equal(validateMeaningfulAction(valid({ instrumentationVersion: "v2" })).ok, false);
});

test("timestamps must be positive numbers", () => {
  for (const occurredAt of [0, -1, Number.NaN, "yesterday"]) {
    assert.equal(validateMeaningfulAction(valid({ occurredAt })).ok, false);
  }
});

test("isAllowedKind refuses unknown products", () => {
  assert.equal(isAllowedKind("roadmap", "task_created"), false);
});
