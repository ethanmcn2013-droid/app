import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePlanningFeatureFlags } from "./flags";
import { safePlanningAnalyticsProps } from "./analytics";

test("planning UI can be disabled without disabling existing workspace access", () => {
  const flags = resolvePlanningFeatureFlags({
    NODE_ENV: "production",
    SIGNAL_PLANNING_PERIODS_ENABLED: "off",
    SIGNAL_CONTEXTUAL_ONBOARDING_ENABLED: "false",
  });
  assert.equal(flags.planningPeriods, false);
  assert.equal(flags.contextualOnboarding, false);
  // There is deliberately no workspaceAccess flag in this system.
  assert.equal("workspaceAccess" in flags, false);
});

test("new planning surfaces default off in production and on in development", () => {
  assert.equal(resolvePlanningFeatureFlags({ NODE_ENV: "production" }).planningPeriods, false);
  assert.equal(resolvePlanningFeatureFlags({ NODE_ENV: "development" }).planningPeriods, true);
});

test("analytics allowlist drops names, content, tokens, emails, and ids", () => {
  const hostile = {
    planning_period_context: "school_year",
    workspace_count: 6,
    source: "onboarding",
    workspace_name: "6th Year Geography",
    token: "secret",
    email: "pupil@example.test",
  } as never;
  assert.deepEqual(safePlanningAnalyticsProps(hostile), {
    planning_period_context: "school_year",
    workspace_context: undefined,
    workspace_count: 6,
    step: undefined,
    source: "onboarding",
    resumed: undefined,
  });
});
