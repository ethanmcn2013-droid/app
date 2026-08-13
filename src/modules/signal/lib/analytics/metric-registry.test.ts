/**
 * The registry is only worth having if it cannot drift from the code.
 *
 * Two drifts are pinned here. First, a new `MetricKey` with no registry entry
 * fails: a metric that ships without a stated truth class, denominator and
 * limitation set is exactly what produced R4, where two of thirteen metrics
 * could never be `available` and nothing said so. Second, a metric the
 * registry calls structurally unreachable must actually resolve `unsupported`
 * over the fixtures — which, since D-012 aligned fixture capabilities to live
 * provider declarations, is now the same answer production gives.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAnalyticsFixture } from "./fixtures";
import { calculateMetrics, SIGNAL_METRIC_VERSION } from "./metrics";
import {
  SIGNAL_METRIC_REGISTRY,
  structurallyUnreachableMetrics,
} from "./metric-registry";
import type { MetricKey } from "./contracts";

const ALL_METRIC_KEYS: MetricKey[] = [
  "work_completed",
  "open_work",
  "open_overdue_work",
  "open_work_age",
  "stalled_work",
  "blocked_work",
  "unowned_work",
  "completion_pace_change",
  "milestone_movement",
  "open_decisions",
  "follow_up_completion",
  "workload_distribution",
  "cross_product_milestone_risk",
];

describe("metric registry", () => {
  it("covers every metric the domain calculates, and nothing it does not", () => {
    const fixture = getAnalyticsFixture("signature");
    const calculated = Object.keys(
      calculateMetrics(fixture.snapshot, fixture.query),
    ).sort();

    assert.deepEqual(
      Object.keys(SIGNAL_METRIC_REGISTRY).sort(),
      calculated,
      "a metric without a registry entry ships without stated limitations",
    );
    assert.deepEqual(Object.keys(SIGNAL_METRIC_REGISTRY).sort(), [...ALL_METRIC_KEYS].sort());
  });

  it("states a definition, version, denominator decision and limitations for each", () => {
    for (const entry of Object.values(SIGNAL_METRIC_REGISTRY)) {
      assert.ok(entry.definition.length > 30, `${entry.key} needs a real definition`);
      assert.equal(entry.version, SIGNAL_METRIC_VERSION, `${entry.key} version drifted`);
      assert.equal(entry.scope, "one_project");
      assert.ok(entry.minimumHistory.length > 0, `${entry.key} must state its minimum history`);
      assert.ok(
        entry.limitations.length > 0,
        `${entry.key} claims no limitations, which has never been true of a metric here`,
      );
      assert.ok(entry.requires.length > 0, `${entry.key} must name what it refuses without`);
    }
  });

  it("names exactly the metrics that cannot be available live (R4)", () => {
    assert.deepEqual(
      structurallyUnreachableMetrics().map((entry) => entry.key).sort(),
      ["milestone_movement", "open_decisions"],
    );
  });

  it("proves the unreachable metrics resolve unsupported, not zero", () => {
    for (const scenario of ["signature", "healthy"] as const) {
      const fixture = getAnalyticsFixture(scenario);
      const metrics = calculateMetrics(fixture.snapshot, fixture.query);
      for (const { key } of structurallyUnreachableMetrics()) {
        assert.equal(
          metrics[key].status,
          "unsupported",
          `${key} must read unsupported in the ${scenario} fixture, as it does live`,
        );
        assert.equal(
          metrics[key].value,
          null,
          `${key} must carry no value; a missing source is not a zero`,
        );
      }
    }
  });

  it("keeps fixture capabilities aligned with live provider declarations (D-012)", () => {
    const fixture = getAnalyticsFixture("signature");
    const notes = fixture.snapshot.coverage.providers.notes;
    const timeline = fixture.snapshot.coverage.providers.timeline;

    assert.ok(notes && timeline);
    assert.ok(
      !notes.capabilities.includes("decision_read"),
      "no live Notes provider declares decision_read, so no fixture may either",
    );
    assert.ok(
      !timeline.capabilities.includes("milestone_date_history"),
      "Timeline declares date history only from activity rows nothing writes",
    );
  });

  it("does not claim any metric as reported truth", () => {
    assert.deepEqual(
      Object.values(SIGNAL_METRIC_REGISTRY)
        .filter((entry) => entry.truthClass === "reported")
        .map((entry) => entry.key),
      [],
      "reported truth needs an owner-authored source contract, which does not exist yet",
    );
  });
});
