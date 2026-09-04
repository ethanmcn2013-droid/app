import type { SignalScope } from "./scope";

/** URL hints select a reading scope; the orchestrator still authorizes it. */
export function parseBriefingReadScopeHint(
  params: Record<string, string | string[] | undefined>,
  periodsEnabled: boolean,
): { kind: "absent" } | { kind: "invalid" } | { kind: "scope"; scope: SignalScope } {
  // Canonical suite links may carry the parent period alongside a workspace.
  // The explicit workspace remains the narrower, unambiguous reading scope.
  if (params.workspaceId !== undefined) {
    return typeof params.workspaceId === "string" && params.workspaceId.trim()
      ? { kind: "scope", scope: { kind: "workspace", workspaceId: params.workspaceId } }
      : { kind: "invalid" };
  }
  if (params.planningPeriodId !== undefined) {
    return periodsEnabled && typeof params.planningPeriodId === "string" && params.planningPeriodId.trim()
      ? { kind: "scope", scope: { kind: "planningPeriod", planningPeriodId: params.planningPeriodId } }
      : { kind: "invalid" };
  }
  return { kind: "absent" };
}
