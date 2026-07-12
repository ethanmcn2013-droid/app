export type PlanningFeature =
  | "planningPeriods"
  | "contextualOnboarding"
  | "crossWorkspaceSignal"
  | "audienceTimeline"
  | "schoolPilot"
  | "lifecycleDuplication";

export type PlanningFeatureFlags = Readonly<Record<PlanningFeature, boolean>>;

const ENV_KEYS: Readonly<Record<PlanningFeature, string>> = {
  planningPeriods: "SIGNAL_PLANNING_PERIODS_ENABLED",
  contextualOnboarding: "SIGNAL_CONTEXTUAL_ONBOARDING_ENABLED",
  crossWorkspaceSignal: "SIGNAL_PERIOD_SIGNAL_ENABLED",
  audienceTimeline: "SIGNAL_AUDIENCE_TIMELINE_ENABLED",
  schoolPilot: "SIGNAL_SCHOOL_PILOT_ENABLED",
  lifecycleDuplication: "SIGNAL_LIFECYCLE_DUPLICATION_ENABLED",
};

function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Server-controlled flags. New writes default off in production and on in
 * test/development. Disabling them never removes access to an existing
 * workspace or changes membership checks.
 */
export function resolvePlanningFeatureFlags(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PlanningFeatureFlags {
  const defaultEnabled = env.NODE_ENV !== "production";
  return {
    planningPeriods: envBoolean(env[ENV_KEYS.planningPeriods], defaultEnabled),
    contextualOnboarding: envBoolean(
      env[ENV_KEYS.contextualOnboarding],
      defaultEnabled,
    ),
    crossWorkspaceSignal: envBoolean(
      env[ENV_KEYS.crossWorkspaceSignal],
      defaultEnabled,
    ),
    audienceTimeline: envBoolean(env[ENV_KEYS.audienceTimeline], defaultEnabled),
    schoolPilot: envBoolean(env[ENV_KEYS.schoolPilot], defaultEnabled),
    lifecycleDuplication: envBoolean(
      env[ENV_KEYS.lifecycleDuplication],
      defaultEnabled,
    ),
  };
}
