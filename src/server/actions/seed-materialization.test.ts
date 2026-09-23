import { strict as assert } from "node:assert";
import test from "node:test";
import { materializeWorkspaceDomainSeed } from "./seed-materialization";

test("the same starter pack materializes independently in two Projects", () => {
  const first = materializeWorkspaceDomainSeed("ws-first", "wedding");
  const second = materializeWorkspaceDomainSeed("ws-second", "wedding");
  assert.equal(first.length, second.length);

  const firstIds = new Set(first.map((entry) => entry.task.id));
  const secondIds = new Set(second.map((entry) => entry.task.id));
  assert.equal(firstIds.size, first.length);
  assert.equal(secondIds.size, second.length);
  assert.equal(
    [...firstIds].filter((id) => secondIds.has(id)).length,
    0,
    "global task primary keys must not collide across Projects",
  );

  for (const entry of first) {
    for (const blocker of entry.task.blockedBy ?? []) {
      assert.ok(firstIds.has(blocker), "a blocker must stay in its Project");
      assert.ok(!secondIds.has(blocker));
    }
  }
  for (const entry of second) {
    for (const blocker of entry.task.blockedBy ?? []) {
      assert.ok(secondIds.has(blocker), "a blocker must stay in its Project");
      assert.ok(!firstIds.has(blocker));
    }
  }

  assert.deepEqual(
    materializeWorkspaceDomainSeed("ws-first", "wedding"),
    first,
    "a retry for the same Project must preserve stable ids",
  );
});
