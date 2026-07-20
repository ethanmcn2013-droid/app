import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_FIXTURE_DESCRIPTIONS,
  DEMO_FIXTURE_IDS,
  resolveDemoFixture,
} from "./notes-fixtures";

test("the review fixture set stays complete and stable", () => {
  assert.deepEqual(DEMO_FIXTURE_IDS, [
    "first-use",
    "first-capture",
    "populated",
    "empty",
    "dense",
    "loading",
    "error",
    "long-content",
    "partial-failure",
    "restricted",
    "capture-email",
  ]);
});

test("every fixture carries review intent rather than an opaque slug", () => {
  assert.deepEqual(Object.keys(DEMO_FIXTURE_DESCRIPTIONS), DEMO_FIXTURE_IDS);
  for (const description of Object.values(DEMO_FIXTURE_DESCRIPTIONS)) {
    assert.ok(description.length >= 24, description);
  }
});

test("known fixtures resolve and unknown values fail safely to populated", () => {
  for (const fixture of DEMO_FIXTURE_IDS) {
    assert.equal(resolveDemoFixture(fixture), fixture);
  }
  assert.equal(resolveDemoFixture(["empty", "error"]), "empty");
  assert.equal(resolveDemoFixture(["not-a-fixture", "empty"]), "populated");
  assert.equal(resolveDemoFixture("not-a-fixture"), "populated");
  assert.equal(resolveDemoFixture(undefined), "populated");
});
