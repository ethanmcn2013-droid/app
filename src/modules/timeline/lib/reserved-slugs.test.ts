import assert from "node:assert/strict";
import test from "node:test";

import { RESERVED_SLUGS, isValidSlug } from "./reserved-slugs";

test("static Timeline routes stay reserved for workspace and project slugs", () => {
  for (const slug of ["lab", "waitlist", "the-wedding"]) {
    assert.equal(RESERVED_SLUGS.has(slug), true, `${slug} must be reserved`);
    assert.equal(isValidSlug(slug), false, `${slug} must not validate as a user slug`);
  }
});

test("ordinary shareable slugs remain valid", () => {
  assert.equal(isValidSlug("summer-wedding"), true);
  assert.equal(isValidSlug("venue-2027"), true);
});
