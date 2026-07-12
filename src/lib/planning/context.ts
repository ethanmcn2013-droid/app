export const PLANNING_PERIOD_CONTEXTS = [
  "school_year",
  "semester",
  "wedding_season",
  "general",
] as const;

export type PlanningPeriodContext =
  (typeof PLANNING_PERIOD_CONTEXTS)[number];

export const WORKSPACE_CONTEXTS = [
  "class",
  "module",
  "wedding",
  "project",
] as const;

export type WorkspaceContext = (typeof WORKSPACE_CONTEXTS)[number];

export type ContextTerminology = Readonly<{
  planningPeriod: string;
  planningPeriodPlural: string;
  workspace: string;
  workspacePlural: string;
  audienceTimeline: string;
  defaultPlanningPeriodName: string;
}>;

/**
 * The sole user-facing vocabulary map for Planning Period surfaces.
 * Components consume this map instead of growing role-based conditionals.
 */
export const CONTEXT_TERMINOLOGY: Readonly<
  Record<PlanningPeriodContext, ContextTerminology>
> = {
  school_year: {
    planningPeriod: "School year",
    planningPeriodPlural: "School years",
    workspace: "Class",
    workspacePlural: "Classes",
    audienceTimeline: "Class Timeline",
    defaultPlanningPeriodName: "School year",
  },
  semester: {
    planningPeriod: "Semester",
    planningPeriodPlural: "Semesters",
    workspace: "Module",
    workspacePlural: "Modules",
    audienceTimeline: "Module Timeline",
    defaultPlanningPeriodName: "Semester",
  },
  wedding_season: {
    planningPeriod: "Wedding season",
    planningPeriodPlural: "Wedding seasons",
    workspace: "Wedding",
    workspacePlural: "Weddings",
    audienceTimeline: "Couple Timeline",
    defaultPlanningPeriodName: "Weddings",
  },
  general: {
    planningPeriod: "Planning period",
    planningPeriodPlural: "Planning periods",
    workspace: "Workspace",
    workspacePlural: "Workspaces",
    audienceTimeline: "Timeline",
    defaultPlanningPeriodName: "Active work",
  },
};

export const DEFAULT_WORKSPACE_CONTEXT: Readonly<
  Record<PlanningPeriodContext, WorkspaceContext>
> = {
  school_year: "class",
  semester: "module",
  wedding_season: "wedding",
  general: "project",
};

export function isPlanningPeriodContext(
  value: unknown,
): value is PlanningPeriodContext {
  return (
    typeof value === "string" &&
    (PLANNING_PERIOD_CONTEXTS as readonly string[]).includes(value)
  );
}

export function isWorkspaceContext(value: unknown): value is WorkspaceContext {
  return (
    typeof value === "string" &&
    (WORKSPACE_CONTEXTS as readonly string[]).includes(value)
  );
}

export function isCompatibleWorkspaceContext(
  periodContext: PlanningPeriodContext,
  workspaceContext: WorkspaceContext,
): boolean {
  if (periodContext === "general") return true;
  return DEFAULT_WORKSPACE_CONTEXT[periodContext] === workspaceContext;
}

export function terminologyFor(
  context: PlanningPeriodContext,
): ContextTerminology {
  return CONTEXT_TERMINOLOGY[context];
}
