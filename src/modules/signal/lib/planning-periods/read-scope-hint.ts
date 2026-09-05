import type { SignalScope } from "./scope";

/** Scope identity is one exact scalar, never a comma-separated filter list. */
export function isBriefingReadScopeId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 &&
    value.trim() === value && !/[,\u0000-\u001f\u007f]/.test(value);
}

/** URL hints select a reading scope; the orchestrator still authorizes it. */
export function parseBriefingReadScopeHint(
  params: Record<string, string | string[] | undefined>,
  periodsEnabled: boolean,
): { kind: "absent" } | { kind: "invalid" } | { kind: "scope"; scope: SignalScope } {
  // Canonical suite links may carry the parent period alongside a workspace.
  // The explicit workspace remains the narrower, unambiguous reading scope.
  if (params.workspaceId !== undefined) {
    return isBriefingReadScopeId(params.workspaceId)
      ? { kind: "scope", scope: { kind: "workspace", workspaceId: params.workspaceId } }
      : { kind: "invalid" };
  }
  if (params.planningPeriodId !== undefined) {
    return periodsEnabled && isBriefingReadScopeId(params.planningPeriodId)
      ? { kind: "scope", scope: { kind: "planningPeriod", planningPeriodId: params.planningPeriodId } }
      : { kind: "invalid" };
  }
  return { kind: "absent" };
}
