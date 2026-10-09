import assert from "node:assert/strict";
import { test } from "node:test";
import stateModule from "./column-config-state.ts";

const { initialBoardConfigState, syncBoardConfigState, setBoardOptimisticForEpoch } = stateModule;

test("same-shaped Project transition resets optimistic state and refuses late rollback", () => {
  const a = initialBoardConfigState("project_a", null);
  const optimisticA = setBoardOptimisticForEpoch(a, "project_a", a.epoch, { name: "A" });
  const b = syncBoardConfigState(optimisticA, "project_b", null);
  assert.equal(b.optimistic, null);
  assert.equal(b.epoch, a.epoch + 1);
  assert.equal(setBoardOptimisticForEpoch(b, "project_a", a.epoch, null), b);

  const backToA = syncBoardConfigState(b, "project_a", null);
  assert.equal(setBoardOptimisticForEpoch(backToA, "project_a", a.epoch, null), backToA);
});

test("current Project result applies, but a fresh server revision supersedes it", () => {
  const original = { name: "old" };
  const state = initialBoardConfigState("project_a", original);
  const optimistic = setBoardOptimisticForEpoch(state, "project_a", state.epoch, { name: "new" });
  assert.equal(optimistic.optimistic.name, "new");
  const confirmed = { name: "server" };
  const revalidated = syncBoardConfigState(optimistic, "project_a", confirmed);
  assert.equal(revalidated.optimistic, confirmed);
  assert.equal(setBoardOptimisticForEpoch(revalidated, "project_a", state.epoch, original), revalidated);
});
