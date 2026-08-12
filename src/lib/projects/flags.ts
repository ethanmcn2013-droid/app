/**
 * Active Project V3 flag — plan §14.2.
 *
 * Default OFF, in every environment including test and development. This is
 * deliberately unlike `resolvePlanningFeatureFlags`, which defaults on outside
 * production: WP2 must be byte-identical to today until the founder turns it
 * on, and a flag that is on in dev is a flag whose off-path never runs.
 *
 * The flag gates *presentation and routing*. It never gates a safety check:
 * nothing in this wave falls back to known-unsafe behaviour when it is off
 * (plan §14.2 last line).
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export const ACTIVE_PROJECT_V3_FLAG = "SIGNAL_ACTIVE_PROJECT_V3_ENABLED";

export function isActiveProjectV3Enabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const raw = env[ACTIVE_PROJECT_V3_FLAG];
  if (typeof raw !== "string") return false;
  return TRUTHY.has(raw.trim().toLowerCase());
}
