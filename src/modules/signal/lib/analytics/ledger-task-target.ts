import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import type { AuthorizedSignalScope } from "../planning-periods/scope";
import type { Briefing } from "../briefing/types";
import { groupLegacyBriefItems } from "./ledger-adapters";
import { stableSignalLedgerId } from "./ledger-contract";

const OPAQUE_LEDGER_ID = /^signal-[a-z0-9]+$/;
const CONTEXT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export type SignalTasksNavigationContext = Readonly<{
  planningPeriodId?: string | null;
  projectId?: string | null;
}>;

/**
 * Resolve an opaque, presentation-safe ledger entry back to the current
 * authorized Tasks context. Raw task and workspace ids never enter the ledger
 * DTO; this mapping runs only on the server after the briefing is rebuilt.
 */
export function legacyLedgerTasksHref(
  briefing: Briefing,
  authorizedScope: AuthorizedSignalScope,
  entryId: string,
  navigationContext?: SignalTasksNavigationContext,
): string | null {
  if (!OPAQUE_LEDGER_ID.test(entryId)) return null;

  const group = groupLegacyBriefItems(briefing).find(
    (candidate) =>
      stableSignalLedgerId(`legacy:${candidate.key}`) === entryId,
  );
  if (!group) return null;

  const authorizedWorkspaceIds = new Set(
    authorizedScope.workspaces.map((workspace) => workspace.id),
  );
  const task = group.items.find(
    (item) =>
      !item.id.startsWith("synthetic:") &&
      Boolean(item.workspaceId) &&
      authorizedWorkspaceIds.has(item.workspaceId!),
  );
  const workspaceId =
    task?.workspaceId ??
    (authorizedScope.scope.kind === "workspace"
      ? authorizedScope.scope.workspaceId
      : authorizedScope.workspaces.length === 1
        ? authorizedScope.workspaces[0]?.id
        : null);

  if (!workspaceId) return PRODUCT_APP_PATHS.tasks;

  const params = new URLSearchParams();
  if (task) params.set("task", task.id);
  params.set("workspaceId", workspaceId);
  appendNavigationContext(params, navigationContext);
  return `${PRODUCT_APP_PATHS.tasks}?${params.toString()}`;
}

export function authorizedScopeTasksHref(
  authorizedScope: AuthorizedSignalScope,
  navigationContext?: SignalTasksNavigationContext,
): string {
  const workspaceId =
    authorizedScope.scope.kind === "workspace"
      ? authorizedScope.scope.workspaceId
      : authorizedScope.workspaces.length === 1
        ? authorizedScope.workspaces[0]?.id
        : null;
  if (!workspaceId) return PRODUCT_APP_PATHS.tasks;
  const params = new URLSearchParams({ workspaceId });
  appendNavigationContext(params, navigationContext);
  return `${PRODUCT_APP_PATHS.tasks}?${params.toString()}`;
}

function appendNavigationContext(
  params: URLSearchParams,
  navigationContext?: SignalTasksNavigationContext,
): void {
  if (
    navigationContext?.planningPeriodId &&
    CONTEXT_ID.test(navigationContext.planningPeriodId)
  ) {
    params.set("planningPeriodId", navigationContext.planningPeriodId);
  }
  if (
    navigationContext?.projectId &&
    CONTEXT_ID.test(navigationContext.projectId)
  ) {
    params.set("projectId", navigationContext.projectId);
  }
}
