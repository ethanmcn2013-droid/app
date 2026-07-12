export type PlanningAnalyticsEvent =
  | "planning_period_created"
  | "planning_period_archived"
  | "planning_period_restored"
  | "workspace_bulk_created"
  | "workspace_moved"
  | "workspace_archived"
  | "workspace_restored"
  | "workspace_duplicated"
  | "contextual_onboarding_started"
  | "contextual_onboarding_saved"
  | "contextual_onboarding_completed";

/** Allowlist only structural counters and context. No names, content, or tokens. */
export type PlanningAnalyticsProps = Readonly<{
  planning_period_context?: string;
  workspace_context?: string;
  workspace_count?: number;
  step?: string;
  source?: "your_work" | "onboarding" | "lifecycle" | "migration";
  resumed?: boolean;
}>;

export function safePlanningAnalyticsProps(
  props: PlanningAnalyticsProps,
): PlanningAnalyticsProps {
  const workspaceCount = props.workspace_count;
  return {
    planning_period_context: props.planning_period_context?.slice(0, 32),
    workspace_context: props.workspace_context?.slice(0, 32),
    workspace_count:
      workspaceCount === undefined
        ? undefined
        : Math.max(0, Math.min(100, Math.trunc(workspaceCount))),
    step: props.step?.slice(0, 32),
    source: props.source,
    resumed: props.resumed,
  };
}
