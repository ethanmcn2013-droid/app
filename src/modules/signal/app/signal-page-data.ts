import "server-only";

import { redirect } from "next/navigation";
import {
  serializeAnalyticsUrlState,
  type AnalyticsUrlState,
} from "../lib/analytics";
import type { EvidenceResponse } from "../lib/analytics/contracts";
import type { AnalyticsScope } from "../lib/analytics/contracts";
import {
  resolveAnalyticsPageContext,
  type AnalyticsPageContext,
} from "../server/analytics/page-context";
import type { SignalNavigationData } from "../server/analytics/service";
import { signalHref } from "../components/signal/links";
import type {
  EvidenceState,
  FilterOption,
  ScopeOption,
  SignalView,
} from "../components/signal/signal-types";

/**
 * Page-data helpers for the analytics path of /app/brief.
 *
 * Ported from signal/src/app/app/(signal)/page-data.ts.
 * S1 route rename: redirect target /app/onboarding → /app/brief/onboarding.
 */

export type SignalSearchParams = Record<
  string,
  string | string[] | undefined
>;

export interface SignalPageChrome {
  scopes: ScopeOption[];
  ownerOptions: FilterOption[];
  statusOptions: FilterOption[];
  scopeLabel: string;
  ownerNames: Readonly<Record<string, string>>;
  projectNames: Readonly<Record<string, string>>;
}

export async function requireAnalyticsPageContext(
  searchParams: SignalSearchParams,
): Promise<AnalyticsPageContext> {
  const context = await resolveAnalyticsPageContext(searchParams);
  // S1: redirect to /app/brief/onboarding instead of /app/onboarding
  if (!context) redirect("/app/signal/onboarding");
  return context;
}

export function buildSignalPageChrome(
  context: AnalyticsPageContext,
  navigation: SignalNavigationData,
): SignalPageChrome {
  const currentWorkspace = context.workspaces.find(
    (workspace) => workspace.id === context.state.query.scope.workspaceId,
  );
  const workspaceScopes: ScopeOption[] = context.workspaces.map(
    (workspace) => ({
      type: "workspace",
      kind: "workspace" as const,
      id: workspace.id,
      workspaceId: workspace.id,
      label: workspace.name,
    }),
  );
  const personalScope: ScopeOption = {
    type: "user",
    kind: "user" as const,
    id:
      context.state.query.scope.type === "user"
        ? context.state.query.scope.id
        : "me",
    workspaceId: context.state.query.scope.workspaceId,
    label: "My work",
  };
  const projectScopes: ScopeOption[] = navigation.projects.map((project) => ({
    type: "project",
    kind: "project" as const,
    id: project.id,
    workspaceId: context.state.query.scope.workspaceId,
    label: project.name,
  }));
  const scopes = [...workspaceScopes, personalScope, ...projectScopes];
  const active = scopes.find(
    (scope) =>
      scope.type === context.state.query.scope.type &&
      (scope.type === "user" || scope.id === context.state.query.scope.id) &&
      scope.workspaceId === context.state.query.scope.workspaceId,
  );

  return {
    scopes,
    scopeLabel: active?.label ?? currentWorkspace?.name ?? "Selected work",
    ownerOptions: navigation.owners.map((owner) => ({
      value: owner.id,
      label: owner.displayName ?? "Team member",
    })),
    statusOptions: navigation.statuses.map((status) => ({
      value: status,
      label: sentenceCase(status),
    })),
    ownerNames: Object.fromEntries(
      navigation.owners.map((owner) => [
        owner.id,
        owner.displayName ?? "Team member",
      ]),
    ),
    projectNames: Object.fromEntries(
      navigation.projects.map((project) => [project.id, project.name]),
    ),
  };
}

export function canonicalSignalParams(
  context: AnalyticsPageContext,
  searchParams: SignalSearchParams,
  view: SignalView,
): URLSearchParams {
  const state: AnalyticsUrlState = {
    ...context.state,
    view,
  };
  const params = serializeAnalyticsUrlState(state);
  const workspace = context.workspaces.find(
    (candidate) =>
      candidate.id === context.state.query.scope.workspaceId,
  );
  params.set("contextVersion", "2");
  params.set("workspaceId", context.state.query.scope.workspaceId);
  if (workspace?.planningPeriodId) {
    params.set("planningPeriodId", workspace.planningPeriodId);
  }
  const fixture = first(searchParams.fixture);
  if (fixture) params.set("fixture", fixture);
  return params;
}

export function evidenceHref(
  pathname: string,
  params: URLSearchParams,
  evidenceId: string,
): string {
  return signalHref(pathname, params, {
    evidence: evidenceId,
    evidence_page: null,
  });
}

export function evidenceState(
  pathname: string,
  params: URLSearchParams,
  response: EvidenceResponse | null,
  ownerNames: Readonly<Record<string, string>>,
  projectNames: Readonly<Record<string, string>>,
  displayScope: AnalyticsScope,
): EvidenceState | null {
  if (!response) return null;
  return {
    response: {
      ...response,
      observation: { ...response.observation, scope: displayScope },
      meta: { ...response.meta, scope: displayScope },
    },
    closeHref: signalHref(pathname, params, {
      evidence: null,
      evidence_page: null,
    }),
    ownerNames,
    projectNames,
  };
}

function sentenceCase(value: string): string {
  const normalized = value.replaceAll("_", " ").trim();
  return normalized
    ? normalized[0].toUpperCase() + normalized.slice(1)
    : "Unknown";
}

function first(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
