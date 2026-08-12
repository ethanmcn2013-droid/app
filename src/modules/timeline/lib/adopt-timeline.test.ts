import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decideTimelineAdoption,
  type TimelineAdoptionCandidate,
  type TimelineAdoptionEvidence,
} from "@/modules/timeline/lib/adopt-timeline";

/**
 * ── WHAT THESE TESTS PIN, AND WHAT CHANGED (WP1, DECISIONS.md D-002) ───────
 *
 * They used to pin the question "which of the owner's Timelines do we open?"
 * and its last resort, `{ kind: "open", slug: first.slug }` — the owner's first
 * Timeline, returned to a request that named a specific Tasks Project. One of
 * them ("opening falls back to the owner's first Timeline") asserted the P0
 * wrong-Project substitution as intended behaviour.
 *
 * They now pin the narrower question the resolver actually has to answer:
 * *does the evidence prove which Timeline belongs to THIS Project?* The
 * outcome `open` no longer exists (ADR 0001 §6), so a request for Project B can
 * no longer be answered with Project A's plan.
 *
 * The incident these paths were built for is still covered, deliberately and
 * by name, in "the production incident stays fixed" below: a couple with one
 * Tasks Project and one in-app Timeline is still bound, still on first visit,
 * still without meeting "That workspace is not available." looking at their own
 * plan. What they no longer get is somebody else's Project when the evidence is
 * thin — they get asked.
 */

const REQUESTED = "ws_requested";

const unlinked = (slug: string): TimelineAdoptionCandidate => ({
  slug,
  suiteWorkspaceId: null,
});
const linked = (slug: string, suite: string): TimelineAdoptionCandidate => ({
  slug,
  suiteWorkspaceId: suite,
});
/** An unbound Timeline whose own child names a Tasks Project — the legacy
 *  evidence that predates `suiteWorkspaceId` being written at creation. */
const names = (slug: string, ...ids: string[]): TimelineAdoptionCandidate => ({
  slug,
  suiteWorkspaceId: null,
  boundTasksWorkspaceIds: ids,
});

function evidence(
  owned: TimelineAdoptionCandidate[],
  overrides: Partial<TimelineAdoptionEvidence> = {},
): TimelineAdoptionEvidence {
  return {
    requestedTasksWorkspaceId: REQUESTED,
    owned,
    soleOwnedTasksWorkspaceId: null,
    ...overrides,
  };
}

// ── The P0 ──────────────────────────────────────────────────────────────────

test("a request for Project B is never answered with Project A's Timeline", () => {
  // THE defect. Before WP1 this returned { kind: "open", slug: "timeline-a" }:
  // the owner asked for the Timeline of a Project they are a member of, and got
  // a different Project's plan, silently and durably.
  const decision = decideTimelineAdoption(
    evidence([linked("timeline-a", "ws_a")], {
      requestedTasksWorkspaceId: "ws_b",
    }),
  );
  assert.equal(decision.kind, "provision");
  assert.ok(
    !("slug" in decision) || decision.slug !== "timeline-a",
    "no outcome may name a Timeline bound to a different Tasks Project",
  );
});

test("no outcome named `open` survives, for any shape of evidence", () => {
  // ADR 0001 §6: the valid outcomes are exact, provisioned,
  // owner-reconciliation-required, archived, denied, failed. Anything that
  // resolves to "the owner's other Timeline" is outside that list by
  // construction, so the guard is on the whole outcome vocabulary rather than
  // on one branch that could be reintroduced beside it.
  const shapes: TimelineAdoptionCandidate[][] = [
    [],
    [unlinked("one")],
    [unlinked("one"), unlinked("two")],
    [linked("one", "ws_other")],
    [linked("one", "ws_other"), unlinked("two")],
    [names("one", "ws_other")],
    [names("one", REQUESTED), names("two", REQUESTED)],
    [names("one", REQUESTED, "ws_other")],
  ];
  const allowed = new Set([
    "exact",
    "adopt",
    "provision",
    "owner-reconciliation-required",
  ]);
  for (const owned of shapes) {
    for (const sole of [null, REQUESTED, "ws_other"]) {
      const decision = decideTimelineAdoption(
        evidence(owned, { soleOwnedTasksWorkspaceId: sole }),
      );
      assert.ok(
        allowed.has(decision.kind),
        `unexpected outcome ${decision.kind} for ${JSON.stringify(owned)}`,
      );
      assert.notEqual(decision.kind as string, "open");
    }
  }
});

test("a Timeline bound to another Project is never a candidate for this one", () => {
  const decision = decideTimelineAdoption(
    evidence([linked("theirs", "ws_other")], {
      soleOwnedTasksWorkspaceId: REQUESTED,
    }),
  );
  // It belongs to ws_other, so it is neither adopted nor opened, and because
  // provisioning strands nothing here, the requested Project simply gets its
  // own Timeline.
  assert.deepEqual(decision, { kind: "provision" });
});

// ── The exact answers ───────────────────────────────────────────────────────

test("an existing binding to this exact Project is the answer, with no write", () => {
  assert.deepEqual(
    decideTimelineAdoption(evidence([linked("ours", REQUESTED)])),
    { kind: "exact", slug: "ours" },
  );
});

test("an owner with no Timeline at all is provisioned one for this Project", () => {
  // Production blocker 2: nothing in the product ever created a Timeline
  // workspace, so the owner met a permanent empty state whose advice did
  // nothing. Provisioning is retained precisely so that stays fixed — it is
  // now keyed to the requested Project rather than to "their first workspace".
  assert.deepEqual(decideTimelineAdoption(evidence([])), { kind: "provision" });
});

test("legacy exact evidence is adopted: the child names this exact Project", () => {
  assert.deepEqual(
    decideTimelineAdoption(evidence([names("glenmara-house", REQUESTED)])),
    { kind: "adopt", slug: "glenmara-house" },
  );
});

test("the production incident stays fixed: one Project, one in-app Timeline", () => {
  // The regression this whole family of code exists for. A Timeline made by
  // the in-app create flow carries no suite id and no bound child, so the
  // rail's `?workspaceId=` hint resolved to nothing and the owner met "That
  // workspace is not available." looking at their own plan.
  //
  // It is still adopted — but on a uniqueness proof rather than on "it is the
  // only one lying around": the owner owns exactly one Tasks Project and it is
  // the one being asked for, so there is exactly one possible pairing.
  assert.deepEqual(
    decideTimelineAdoption(
      evidence([unlinked("glenmara-house")], {
        soleOwnedTasksWorkspaceId: REQUESTED,
      }),
    ),
    { kind: "adopt", slug: "glenmara-house" },
  );
});

// ── The refusals ────────────────────────────────────────────────────────────

test("an unproven Timeline beside a second Tasks Project is never guessed at", () => {
  // Same shape as the incident above, one fact different: the owner has more
  // than one Tasks Project, so `soleOwnedTasksWorkspaceId` is null and the
  // pairing is no longer forced. Binding here would be a coin toss, and a
  // wrong Timeline↔Project join is silent, durable and harder to notice than
  // the dead end it replaced. Provisioning would strand their plan. So: ask.
  const decision = decideTimelineAdoption(evidence([unlinked("wedding")]));
  assert.equal(decision.kind, "owner-reconciliation-required");
  assert.deepEqual(
    decision.kind === "owner-reconciliation-required" ? decision : null,
    {
      kind: "owner-reconciliation-required",
      reason: "unproven-timeline-present",
      candidates: ["wedding"],
    },
  );
});

test("several unproven Timelines are never guessed between", () => {
  const decision = decideTimelineAdoption(
    evidence([unlinked("wedding"), unlinked("side-project")], {
      soleOwnedTasksWorkspaceId: REQUESTED,
    }),
  );
  assert.equal(decision.kind, "owner-reconciliation-required");
  // Both are offered to the owner. Neither is chosen for them, and "first" is
  // not a tiebreak.
  assert.deepEqual(
    decision.kind === "owner-reconciliation-required"
      ? [...decision.candidates]
      : [],
    ["wedding", "side-project"],
  );
});

test("two Timelines naming the same Project are a review case, not a merge", () => {
  const decision = decideTimelineAdoption(
    evidence([names("one", REQUESTED), names("two", REQUESTED)]),
  );
  assert.equal(decision.kind, "owner-reconciliation-required");
  assert.equal(
    decision.kind === "owner-reconciliation-required" ? decision.reason : null,
    "ambiguous-evidence",
  );
});

test("mixed parentage inside one Timeline is a review case", () => {
  // A Timeline whose children name this Project AND another one proves nothing
  // exactly. Adopting it would quietly annex the other Project's milestones.
  const decision = decideTimelineAdoption(
    evidence([names("mixed", REQUESTED, "ws_other")], {
      soleOwnedTasksWorkspaceId: REQUESTED,
    }),
  );
  assert.equal(decision.kind, "owner-reconciliation-required");
  assert.equal(
    decision.kind === "owner-reconciliation-required" ? decision.reason : null,
    "ambiguous-evidence",
  );
});

test("an empty request adopts, opens and provisions nothing", () => {
  const decision = decideTimelineAdoption(
    evidence([unlinked("only-one")], {
      requestedTasksWorkspaceId: "   ",
      soleOwnedTasksWorkspaceId: "   ",
    }),
  );
  assert.equal(decision.kind, "owner-reconciliation-required");
});

test("a decision that names a Timeline names one the caller actually owns", () => {
  const owned = [names("only-one", REQUESTED)];
  const decision = decideTimelineAdoption(evidence(owned));
  assert.ok(decision.kind !== "provision");
  assert.ok(
    "slug" in decision &&
      owned.some((candidate) => candidate.slug === decision.slug),
    "the decision must name a Timeline the caller actually owns",
  );
});
