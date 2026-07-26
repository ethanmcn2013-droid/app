import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAnalyticsFixture } from "./fixtures";
import { calculateMetrics } from "./metrics";
import {
  SIGNAL_RULE_VERSION,
  buildBriefing,
  buildRuleCandidates,
  rankAndSelectObservations,
  type RuleCandidate,
} from "./rules";

describe("progressive Signal safety invariants", () => {
  it("selects no more than three grounded observations with useful actions", () => {
    const fixture = getAnalyticsFixture("signature");
    const briefing = buildBriefing(fixture.snapshot, fixture.query);

    assert.ok(briefing.observations.length > 0);
    assert.ok(briefing.observations.length <= 3);
    for (const observation of briefing.observations) {
      const sourceCount =
        observation.sourceCounts.notes +
        observation.sourceCounts.tasks +
        observation.sourceCounts.milestones;
      assert.ok(sourceCount > 0);
      assert.equal(observation.evidenceCount, sourceCount);
      assert.ok(observation.actions.some((action) => action.primary));
      assert.equal(observation.ruleVersion, SIGNAL_RULE_VERSION);
    }
  });

  it("combines the signature cross-product issue before ranking", () => {
    const fixture = getAnalyticsFixture("signature");
    const briefing = buildBriefing(fixture.snapshot, fixture.query);
    const lead = briefing.observations[0];

    assert.equal(lead?.type, "cross_product_milestone_risk");
    assert.equal(lead?.sourceCounts.tasks, 5);
    assert.equal(lead?.sourceCounts.notes, 2);
    assert.equal(lead?.sourceCounts.milestones, 1);
    assert.equal(lead?.evidenceCount, 8);
    assert.equal(
      briefing.observations.filter((item) => item.type === "blocked_work")
        .length,
      0,
    );
  });

  it("does not manufacture concern on a healthy complete day", () => {
    const fixture = getAnalyticsFixture("healthy");
    const briefing = buildBriefing(fixture.snapshot, fixture.query);

    assert.deepEqual(briefing.observations, []);
    assert.deepEqual(briefing.emptyState, {
      headline: "Nothing needs you right now.",
      body: "Work is moving normally.",
    });
  });

  it("never emits the healthy all-clear after a provider failure", () => {
    const fixture = getAnalyticsFixture("provider_failure");
    const briefing = buildBriefing(fixture.snapshot, fixture.query);

    assert.deepEqual(briefing.observations, []);
    assert.equal(briefing.meta.freshness, "partial");
    assert.notEqual(
      briefing.emptyState?.headline,
      "Nothing needs you right now.",
    );
  });

  it("keeps observation identifiers stable for identical evidence", () => {
    const fixture = getAnalyticsFixture("signature");
    const first = buildBriefing(fixture.snapshot, fixture.query);
    const second = buildBriefing(fixture.snapshot, fixture.query);

    assert.deepEqual(
      first.observations.map((item) => item.id),
      second.observations.map((item) => item.id),
    );
  });

  it("rejects candidates with no evidence or no primary action", () => {
    const fixture = getAnalyticsFixture("signature");
    const candidate = buildRuleCandidates(
      fixture.snapshot,
      fixture.query,
      calculateMetrics(fixture.snapshot, fixture.query),
    )[0]!;
    const noEvidence: RuleCandidate = {
      ...candidate,
      sources: [],
      evidenceCount: 0,
      sourceCounts: { notes: 0, tasks: 0, milestones: 0 },
    };
    const noAction: RuleCandidate = {
      ...candidate,
      id: `${candidate.id}-no-action`,
      issueKey: `${candidate.issueKey}:no-action`,
      actions: candidate.actions.map((action) => ({
        ...action,
        primary: false,
      })),
    };

    assert.deepEqual(
      rankAndSelectObservations(
        [noEvidence, noAction],
        fixture.snapshot.capturedAt,
      ),
      [],
    );
  });

  it("cannot be configured above the three-observation product cap", () => {
    const fixture = getAnalyticsFixture("signature");
    const candidates = buildRuleCandidates(
      fixture.snapshot,
      fixture.query,
      calculateMetrics(fixture.snapshot, fixture.query),
    );
    const expanded = Array.from({ length: 8 }, (_, index) => {
      const candidate = candidates[index % candidates.length]!;
      return {
        ...candidate,
        id: `distinct-${index}`,
        issueKey: `distinct-${index}`,
        sources: candidate.sources.map((source) => ({
          ...source,
          id: `${source.id}-${index}`,
        })),
      };
    });

    assert.equal(
      rankAndSelectObservations(expanded, fixture.snapshot.capturedAt, {
        configuration: { maxObservations: 99 },
      }).length,
      3,
    );
  });
});
