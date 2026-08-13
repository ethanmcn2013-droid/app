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

/**
 * R6 · every action the rules mint must resolve to a route that exists.
 *
 * `trendHref()` built `/app/trends?…`, a route this application has never
 * served. The ledger boundary happened to strip it — `safeAction` rejects any
 * href carrying a query string — so nothing failed there. The evidence drawer
 * does not strip: `service.ts` returns `observation.actions` unfiltered,
 * `evidence-drawer.tsx` renders each through `action-link.tsx`, and that
 * component has no allowlist. A reader opening evidence was shown a
 * "See trend" button that 404s.
 *
 * This asserts against the real route surface rather than a hand-listed set,
 * so a rule that invents another destination fails here rather than in a
 * reader's hands.
 */
describe("rule actions point only at routes that exist", () => {
  const SERVED_APP_ROUTES = [
    "/app/tasks",
    "/app/notes",
    "/app/timeline",
    "/app/home",
    "/app/home/briefing",
    "/app/your-work",
  ];

  function actionPaths(scenario: "signature" | "healthy"): string[] {
    const fixture = getAnalyticsFixture(scenario);
    const candidates = buildRuleCandidates(
      fixture.snapshot,
      fixture.query,
      calculateMetrics(fixture.snapshot, fixture.query),
    );
    return candidates
      .flatMap((candidate) => candidate.actions)
      .map((action) => new URL(action.href, "https://app.signalstudio.ie").pathname);
  }

  it("mints no action to an unserved route", () => {
    for (const path of actionPaths("signature")) {
      assert.ok(
        SERVED_APP_ROUTES.some(
          (route) => path === route || path.startsWith(`${route}/`),
        ),
        `rule action points at ${path}, which this app does not serve`,
      );
    }
  });

  it("never mints /app/trends, which does not exist", () => {
    assert.deepEqual(
      actionPaths("signature").filter((path) => path.startsWith("/app/trends")),
      [],
    );
  });

  it("leaves every surviving candidate a working primary action", () => {
    const fixture = getAnalyticsFixture("signature");
    const briefing = buildBriefing(fixture.snapshot, fixture.query);
    for (const observation of briefing.observations) {
      const primary = observation.actions.find((action) => action.primary);
      assert.ok(primary, `${observation.type} lost its primary action`);
    }
  });
});
