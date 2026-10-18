/** A current preview never falls back to a different Project or provisions a binding. */
export function selectCurrentPreviewWorkspace<T extends { suiteWorkspaceId: string | null }>(
  workspaces: readonly T[], requestedWorkspaceId: string, requestedPlanningPeriodId: string | undefined,
  membership: { kind: string; context?: { workspaceId: string; planningPeriodId: string | null } },
): T | null {
  if (membership.kind !== "member" || !membership.context || membership.context.workspaceId !== requestedWorkspaceId ||
    (requestedPlanningPeriodId !== undefined && membership.context.planningPeriodId !== requestedPlanningPeriodId)) return null;
  const matches = workspaces.filter(workspace => workspace.suiteWorkspaceId === requestedWorkspaceId);
  return matches.length === 1 ? matches[0] : null;
}
