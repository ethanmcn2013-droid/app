import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decideTimelineAdoption,
  type TimelineAdoptionCandidate,
} from "@/modules/timeline/lib/adopt-timeline";

const unlinked = (slug: string): TimelineAdoptionCandidate => ({
  slug,
  suiteWorkspaceId: null,
});
const linked = (slug: string, suite: string): TimelineAdoptionCandidate => ({
  slug,
  suiteWorkspaceId: suite,
});

test("an owner with no Timeline is provisioned one", () => {
  assert.deepEqual(decideTimelineAdoption([]), { kind: "provision" });
});

test("the single unlinked Timeline is adopted", () => {
  // The production case. A Timeline made by the in-app create flow carries no
  // suite id, so the rail's routing hint resolved to nothing and the owner met
  // "That workspace is not available." looking at their own plan.
  assert.deepEqual(decideTimelineAdoption([unlinked("glenmara-house")]), {
    kind: "adopt",
    slug: "glenmara-house",
  });
});

test("the one unlinked Timeline is adopted even beside linked ones", () => {
  assert.deepEqual(
    decideTimelineAdoption([
      linked("first-plan", "ws_already_bound"),
      unlinked("second-plan"),
    ]),
    { kind: "adopt", slug: "second-plan" },
  );
});

test("several unlinked Timelines are never guessed between", () => {
  // The refusal that matters. Binding the wrong Timeline to a Tasks workspace
  // is silent and durable; the dead end it would replace was at least visible.
  const decision = decideTimelineAdoption([
    unlinked("wedding"),
    unlinked("side-project"),
  ]);
  assert.deepEqual(decision, { kind: "open", slug: "wedding" });
  assert.notEqual(decision.kind, "adopt");
});

test("fully linked Timelines are opened, never rewritten", () => {
  assert.deepEqual(
    decideTimelineAdoption([
      linked("wedding", "ws_one"),
      linked("side-project", "ws_two"),
    ]),
    { kind: "open", slug: "wedding" },
  );
});

test("opening falls back to the owner's first Timeline, matching the no-context path", () => {
  // `getWorkspacesForUser` returns oldest first and the no-context path opens
  // workspaces[0]. If these two disagreed, the same person would see a
  // different Timeline depending on whether a routing hint happened to be in
  // the URL, which is precisely the inconsistency this fix exists to remove.
  const owned = [
    linked("oldest", "ws_one"),
    linked("newer", "ws_two"),
    linked("newest", "ws_three"),
  ];
  assert.deepEqual(decideTimelineAdoption(owned), {
    kind: "open",
    slug: "oldest",
  });
});

test("adoption never invents a slug the owner does not have", () => {
  const owned = [unlinked("only-one")];
  const decision = decideTimelineAdoption(owned);
  assert.ok(decision.kind !== "provision");
  assert.ok(
    owned.some((candidate) => candidate.slug === decision.slug),
    "the decision must name a Timeline the caller actually owns",
  );
});
