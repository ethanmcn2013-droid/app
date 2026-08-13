import "server-only";

import { auth } from "@clerk/nextjs/server";
import { eq, or } from "drizzle-orm";
import {
  getAnalyticsFixture,
  parseAnalyticsUrlState,
  type AnalyticsPreferences,
  type AnalyticsUrlState,
} from "../../lib/analytics";
import { asProjectId } from "../../lib/analytics/contracts";
import { getAccessMode } from "@/lib/access-mode";
import { normalizeSuiteContextForSignal } from "@/lib/suite-context";
import { ensureUserProvisioned } from "@/server/db/ensure-user";
import { getTasksDb } from "../tasks-db/signal-tasks-db-client";
import { users, workspaceMembers, workspaces } from "../tasks-db/signal-tasks-db-schema";
import { authorizeAnalyticsRequest, resolveLinkedAnalyticsWorkspace, type AuthorizedAnalyticsContext } from "./policy";
import { readAnalyticsPreferences } from "./preferences";
import type { ParsedAnalyticsQuery } from "./query";
import { toAnalyticsQuery } from "./service";

export interface AnalyticsWorkspaceOption {
  id: string;
  name: string;
  role: "owner" | "member";
  planningPeriodId: string | null;
}

export interface AnalyticsPageContext {
  /** Server-only authorization receipt; pass to analytics service functions. */
  authorization: AuthorizedAnalyticsContext;
  state: AnalyticsUrlState;
  workspaces: AnalyticsWorkspaceOption[];
  preferences: AnalyticsPreferences;
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Resolve an authenticated Signal page without requiring scope parameters.
 * The saved linked workspace is preferred, then the first live membership.
 * Every selected scope is still passed through the same API policy.
 */
export async function resolveAnalyticsPageContext(
  searchParams: SearchParams = {},
): Promise<AnalyticsPageContext | null> {
  const normalizedParams = normalizeSuiteContextForSignal(
    toUrlSearchParams(searchParams),
  );
  const mode = getAccessMode();
  const fixtureScenario = fixtureValue(normalizedParams.get("fixture") ?? undefined);
  if (mode === "demo" || mode === "review" || (mode === "development" && fixtureScenario)) {
    const fixture = getAnalyticsFixture(fixtureScenario ?? "signature");
    const parsed = parsedFromState(
      parseAnalyticsUrlState(normalizedParams, {
        workspaceId: fixture.query.scope.workspaceId,
        scopeType: fixture.query.scope.type,
        scopeId: fixture.query.scope.id,
        timezone: fixture.query.period.timezone,
        now: fixture.snapshot.capturedAt,
      }),
      fixtureScenario ?? "signature",
    );
    const authorization = await authorizeAnalyticsRequest(parsed);
    const query = publicPageQuery(
      toAnalyticsQuery(authorization.query),
      parsed.scope.type,
    );
    const state = { ...parseAnalyticsUrlState(normalizedParams, {
      workspaceId: query.scope.workspaceId,
      scopeType: query.scope.type,
      scopeId: query.scope.id,
      timezone: query.period.timezone,
      now: fixture.snapshot.capturedAt,
    }), query };
    return {
      authorization,
      state,
      workspaces: [{
        id: fixture.query.scope.workspaceId,
        name: "Signal fixture",
        role: "owner",
        planningPeriodId: null,
      }],
      preferences: { hiddenCardIds: [], pinnedCardIds: [], cardOrder: [], updatedAt: null },
    };
  }

  const { userId } = await auth();
  if (!userId) return null;
  // Signal can be the first product an authenticated suite user opens.
  // Provision the shared Tasks identity here as well as on the Tasks board so
  // the analytics workspace lookup never bounces between Signal and its
  // onboarding route while waiting for a webhook or a Tasks visit.
  await ensureUserProvisioned(userId);
  const candidates = await listWorkspaceOptions(userId);
  const linked = await resolveLinkedAnalyticsWorkspace(userId);
  const requested = normalizedParams.get("workspace_id") ?? undefined;
  const workspaceId =
    candidates.find((item) => item.id === requested)?.id ??
    candidates.find((item) => item.id === linked)?.id ??
    candidates[0]?.id;
  if (!workspaceId) return null;

  const stateInput = parseAnalyticsUrlState(normalizedParams, {
    workspaceId: asProjectId(workspaceId),
    timezone: "UTC",
  });
  const parsed = parsedFromState(stateInput, null);
  const authorization = await authorizeAnalyticsRequest(parsed);
  const query = publicPageQuery(
    toAnalyticsQuery(authorization.query),
    parsed.scope.type,
  );
  const preferences = await readAnalyticsPreferences(userId, workspaceId);
  return {
    authorization,
    state: { ...stateInput, query },
    workspaces: candidates,
    preferences,
  };
}

function publicPageQuery(
  query: AnalyticsUrlState["query"],
  requestedScopeType: ParsedAnalyticsQuery["scope"]["type"],
): AnalyticsUrlState["query"] {
  return requestedScopeType === "user"
    ? { ...query, scope: { ...query.scope, id: "me" } }
    : query;
}

function parsedFromState(
  state: AnalyticsUrlState,
  fixtureScenario: ParsedAnalyticsQuery["fixtureScenario"],
): ParsedAnalyticsQuery {
  const preset = state.query.period.preset ?? "custom";
  return {
    scope: state.query.scope,
    period: preset,
    start: new Date(state.query.period.start),
    end: new Date(state.query.period.end),
    timezone: state.query.period.timezone,
    customStart: preset === "custom" ? state.query.period.start : null,
    customEnd: preset === "custom" ? state.query.period.end : null,
    ownerIds: state.query.filters?.ownerIds ?? [],
    statuses: state.query.filters?.statuses ?? [],
    labelIds: state.query.filters?.labelIds ?? [],
    legacyProjectScopeCollapsed: false,
    program: state.query.program,
    metric: state.query.metric ?? "work_completed",
    breakdown: state.query.breakdown ?? "label",
    page: state.query.pagination?.page ?? 1,
    perPage: state.query.pagination?.perPage ?? 25,
    fixtureScenario,
  };
}

async function listWorkspaceOptions(clerkId: string): Promise<AnalyticsWorkspaceOption[]> {
  const db = getTasksDb();
  if (!db) return [];
  const [identity] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.clerkId, clerkId), eq(users.id, clerkId)))
    .limit(1);
  if (!identity) return [];
  const [owned, memberships] = await Promise.all([
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        planningPeriodId: workspaces.planningPeriodId,
      })
      .from(workspaces)
      .where(eq(workspaces.ownerUserId, identity.id))
      .limit(100),
    db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        planningPeriodId: workspaces.planningPeriodId,
        role: workspaceMembers.role,
      })
      .from(workspaces)
      .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, identity.id))
      .limit(100),
  ]);
  const options = new Map<string, AnalyticsWorkspaceOption>();
  for (const item of owned) options.set(item.id, { ...item, role: "owner" });
  for (const item of memberships) {
    if (!options.has(item.id)) {
      options.set(item.id, {
        id: item.id,
        name: item.name,
        planningPeriodId: item.planningPeriodId,
        role: item.role === "owner" ? "owner" : "member",
      });
    }
  }
  return Array.from(options.values());
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toUrlSearchParams(input: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params;
}

function fixtureValue(value: string | string[] | undefined): ParsedAnalyticsQuery["fixtureScenario"] {
  const candidate = first(value);
  return ["signature", "healthy", "insufficient_history", "empty", "stale", "provider_failure", "large_evidence", "unauthorized"].includes(candidate ?? "")
    ? candidate as ParsedAnalyticsQuery["fixtureScenario"]
    : null;
}
