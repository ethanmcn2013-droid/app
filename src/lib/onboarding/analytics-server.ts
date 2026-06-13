import "server-only";

import { captureServerEvent } from "@/lib/analytics/posthog";
import type { OnboardingEventName, OnboardingEventProps } from "./analytics";

/** Server-side onboarding + lifecycle events. */
export async function trackOnboardingEventServer(
  distinctId: string,
  name: OnboardingEventName,
  props: OnboardingEventProps = {},
): Promise<void> {
  await captureServerEvent(distinctId, name, {
    ...props,
    source: props.source ?? "server",
  });
}
