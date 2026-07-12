import "server-only";

import { captureServerEvent } from "@/lib/analytics/posthog";
import {
  safePlanningAnalyticsProps,
  type PlanningAnalyticsEvent,
  type PlanningAnalyticsProps,
} from "@/lib/planning/analytics";

export async function trackPlanningEvent(
  actorUserId: string,
  event: PlanningAnalyticsEvent,
  props: PlanningAnalyticsProps = {},
): Promise<void> {
  await captureServerEvent(
    actorUserId,
    event,
    safePlanningAnalyticsProps(props),
  );
}
