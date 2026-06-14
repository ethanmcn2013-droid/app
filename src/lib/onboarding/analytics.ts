import { captureClientEvent } from "@/lib/analytics/client";

export type OnboardingEventName =
  | "onboarding_started"
  | "onboarding_step_viewed"
  | "onboarding_segment_selected"
  | "onboarding_context_selected"
  | "onboarding_starter_confirmed"
  | "onboarding_skipped"
  | "onboarding_completed"
  | "signup_completed";

export type OnboardingEventProps = {
  step?: string;
  primary_use_case?: string;
  secondary_context?: string;
  domain_id?: string;
  template_id?: string | null;
  seed_mode?: "starter" | "blank" | "template";
  workspace_id?: string;
  source?: string;
  email_domain?: string;
};

/** Client-side onboarding funnel events. */
export function trackOnboardingEvent(
  name: OnboardingEventName,
  props: OnboardingEventProps = {},
): void {
  captureClientEvent(name, props);
}
