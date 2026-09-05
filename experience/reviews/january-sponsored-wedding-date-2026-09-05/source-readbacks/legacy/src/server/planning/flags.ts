import "server-only";

import {
  resolvePlanningFeatureFlags,
  type PlanningFeature,
} from "@/lib/planning/flags";

export function requirePlanningFeature(feature: PlanningFeature): void {
  if (!resolvePlanningFeatureFlags()[feature]) {
    throw new Error("This planning feature is not enabled.");
  }
}
