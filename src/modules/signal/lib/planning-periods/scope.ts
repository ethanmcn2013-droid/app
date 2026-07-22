import { sql } from "drizzle-orm";
import { dataSource, type UserIdentity } from "../data/source";
import { getTasksDb } from "../../server/tasks-db/signal-tasks-db-client";

export type SignalScope =
  | { kind: "workspace"; workspaceId: string }
  | { kind: "planningPeriod"; planningPeriodId: string };

export type PlanningPeriodCatalogItem = {
  id: string;
  name: string;
  contextType: string;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
};

export type PlanningWorkspaceCatalogItem = {
  id: string;
  name: string;
  role: "owner" | "member";
  planningPeriodId: string | null;
  contextType: string | null;
  primaryDate: string | null;
  primaryDateLabel: string | null;
};

export type PlanningCatalog = {
  periods: PlanningPeriodCatalogItem[];
  workspaces: PlanningWorkspaceCatalogItem[];
  planningSchemaAvailable: boolean;
};

export type AuthorizedSignalScope = {
  scope: SignalScope;
  label: string;
  timezone: string;
  period: PlanningPeriodCatalogItem | null;
  workspaces: PlanningWorkspaceCatalogItem[];
};

type PlanningRow = {
  period_id: unknown;
  period_name: unknown;
  period_context_type: unknown;
  start_date: unknown;
  end_date: unknown;
  timezone: unknown;
  workspace_id: unknown;
  workspace_name: unknown;
  workspace_context_type: unknown;
  primary_date: unknown;
  primary_date_label: unknown;
  role: unknown;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Current-membership catalog from the canonical Tasks DB. The v2 query is
 * bounded and selects only period/workspace context. If Tasks has not yet
 * rolled out the additive columns, workspace scope remains available through
 * the v1 membership query and period scope fails closed.
 */
export async function listPlanningCatalogForUser(
  identity: UserIdentity,
): Promise<PlanningCatalog> {
  const legacy = await dataSource.listForUser(identity);
  const fallback: PlanningCatalog = {
    periods: [],
    workspaces: legacy.slice(0, 200).map((workspace) => ({
      id: workspace.workspaceId,
      name: workspace.name,
      role: workspace.role,
      planningPeriodId: null,
      contextType: null,
      primaryDate: null,
      primaryDateLabel: null,
    })),
    planningSchemaAvailable: false,
  };
  const tasksDb = getTasksDb();
  if (!tasksDb) return fallback;

  try {
    const rows = await tasksDb.all<PlanningRow>(sql`
      WITH current_user AS (
        SELECT id FROM users WHERE clerk_id = ${identity.clerkId} LIMIT 1
      )
      SELECT DISTINCT
        p.id AS period_id,
        p.name AS period_name,
        p.context_type AS period_context_type,
        p.start_date AS start_date,
        p.end_date AS end_date,
        p.timezone AS timezone,
        w.id AS workspace_id,
        w.name AS workspace_name,
        w.context_type AS workspace_context_type,
        w.primary_date AS primary_date,
        w.primary_date_label AS primary_date_label,
        CASE WHEN w.owner_user_id = cu.id THEN 'owner' ELSE 'member' END AS role
      FROM current_user cu
      INNER JOIN workspaces w
        ON w.owner_user_id = cu.id
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = w.id AND wm.user_id = cu.id
        )
      INNER JOIN planning_periods p ON p.id = w.planning_period_id
      WHERE w.archived_at IS NULL AND p.archived_at IS NULL
      ORDER BY p.position ASC, w.position ASC, w.name ASC
      LIMIT 200
    `);
    const periods = new Map<string, PlanningPeriodCatalogItem>();
    const workspaces: PlanningWorkspaceCatalogItem[] = [];
    for (const row of rows) {
      const periodId = text(row.period_id);
      const periodName = text(row.period_name);
      const workspaceId = text(row.workspace_id);
      const workspaceName = text(row.workspace_name);
      const contextType = text(row.period_context_type);
      const timezone = text(row.timezone);
      if (!periodId || !periodName || !workspaceId || !workspaceName || !contextType || !timezone) {
        continue;
      }
      if (!periods.has(periodId)) {
        periods.set(periodId, {
          id: periodId,
          name: periodName,
          contextType,
          startDate: text(row.start_date),
          endDate: text(row.end_date),
          timezone,
        });
      }
      workspaces.push({
        id: workspaceId,
        name: workspaceName,
        role: row.role === "owner" ? "owner" : "member",
        planningPeriodId: periodId,
        contextType: text(row.workspace_context_type),
        primaryDate: text(row.primary_date),
        primaryDateLabel: text(row.primary_date_label),
      });
    }
    return {
      periods: Array.from(periods.values()),
      workspaces,
      planningSchemaAvailable: true,
    };
  } catch {
    return fallback;
  }
}

export function authorizeSignalScope(
  catalog: PlanningCatalog,
  scope: SignalScope,
  fallbackTimezone = "UTC",
): AuthorizedSignalScope | null {
  if (scope.kind === "workspace") {
    const workspace = catalog.workspaces.find((item) => item.id === scope.workspaceId);
    if (!workspace) return null;
    const period = workspace.planningPeriodId
      ? catalog.periods.find((item) => item.id === workspace.planningPeriodId) ?? null
      : null;
    return {
      scope,
      label: workspace.name,
      timezone: period?.timezone ?? fallbackTimezone,
      period,
      workspaces: [workspace],
    };
  }
  const period = catalog.periods.find((item) => item.id === scope.planningPeriodId);
  if (!period) return null;
  const workspaces = catalog.workspaces.filter(
    (item) => item.planningPeriodId === period.id,
  );
  if (workspaces.length === 0) return null;
  return {
    scope,
    label: period.name,
    timezone: period.timezone,
    period,
    workspaces,
  };
}

export function selectAuthorizedScopeHint(
  catalog: PlanningCatalog,
  workspaceId: string | null,
  planningPeriodId: string | null,
): SignalScope | null {
  if (workspaceId && catalog.workspaces.some((item) => item.id === workspaceId)) {
    return { kind: "workspace", workspaceId };
  }
  if (
    planningPeriodId &&
    catalog.periods.some((item) => item.id === planningPeriodId) &&
    catalog.workspaces.some((item) => item.planningPeriodId === planningPeriodId)
  ) {
    return { kind: "planningPeriod", planningPeriodId };
  }
  return null;
}

export function planningPeriodsEnabled(): boolean {
  return (
    process.env.SIGNAL_PERIOD_SIGNAL_ENABLED === "1" ||
    process.env.SIGNAL_PERIOD_SIGNAL_ENABLED === "true"
  );
}
