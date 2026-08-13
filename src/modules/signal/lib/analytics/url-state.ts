import type {
  AnalyticsQuery,
  BreakdownKey,
  LabelId,
  MetricKey,
  PeriodPreset,
  ProjectId,
  ScopeType,
} from "./contracts";
import { asLabelId, asProjectId, PROGRAM_AXIS_NOT_CARRIED } from "./contracts";
import {
  DAY_MS,
  isValidTimezone,
  parseInstant,
  resolvePeriod,
  validatePeriod,
} from "./time";

export type SignalView = "briefing" | "overview" | "trends";

export interface AnalyticsUrlState {
  view: SignalView;
  query: AnalyticsQuery;
  evidenceId: string | null;
  evidencePage: number;
}

export interface AnalyticsUrlDefaults {
  workspaceId: ProjectId;
  scopeType?: ScopeType;
  scopeId?: string;
  timezone?: string;
  now?: string;
  period?: Exclude<PeriodPreset, "custom">;
}

type QueryInput = URLSearchParams | Record<string, string | string[] | undefined>;

const VIEWS = new Set<SignalView>(["briefing", "overview", "trends"]);
const SCOPES = new Set<ScopeType>(["workspace", "user"]);
/** Pre-D-010 links carried a tag slug here. It is read as a Label filter. */
const LEGACY_PROJECT_SCOPE = "project";
const PERIODS = new Set<Exclude<PeriodPreset, "custom">>([
  "four_weeks",
  "twelve_weeks",
  "six_months",
  "twelve_months",
]);
const METRICS = new Set<MetricKey>([
  "work_completed",
  "open_work",
  "open_overdue_work",
  "open_work_age",
  "stalled_work",
  "blocked_work",
  "unowned_work",
  "completion_pace_change",
  "milestone_movement",
  "open_decisions",
  "follow_up_completion",
  "workload_distribution",
  "cross_product_milestone_risk",
]);
const BREAKDOWNS = new Set<BreakdownKey>([
  "label",
  "owner",
  "status",
  "work_type",
]);
const MAX_RANGE_MS = 366 * DAY_MS;

function values(input: QueryInput, key: string): string[] {
  if (input instanceof URLSearchParams) {
    return input
      .getAll(key)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);
  }
  const value = input[key];
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value])
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function first(input: QueryInput, key: string): string | undefined {
  return values(input, key)[0];
}

function safeIdentifier(value: string | undefined, fallback: string): string {
  if (!value || value.length > 200 || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

function safeList(input: QueryInput, key: string): string[] | undefined {
  const result = [
    ...new Set(
      values(input, key)
        .filter((value) => value.length <= 100 && !/[\u0000-\u001f]/.test(value)),
    ),
  ].slice(0, 20);
  return result.length === 0 ? undefined : result;
}

function integer(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function customPeriod(
  input: QueryInput,
  timezone: string,
): AnalyticsQuery["period"] | null {
  const start = first(input, "start");
  const end = first(input, "end");
  if (!start || !end) return null;
  try {
    const period = validatePeriod({ start, end, timezone, preset: "custom" });
    if (parseInstant(period.end) - parseInstant(period.start) > MAX_RANGE_MS) return null;
    return period;
  } catch {
    return null;
  }
}

/** Parse shareable URL state with bounded, reversible defaults. */
export function parseAnalyticsUrlState(
  input: QueryInput,
  defaults: AnalyticsUrlDefaults,
): AnalyticsUrlState {
  const timezoneInput = first(input, "timezone");
  const timezone =
    timezoneInput && isValidTimezone(timezoneInput)
      ? timezoneInput
      : isValidTimezone(defaults.timezone ?? "")
        ? defaults.timezone!
        : "UTC";
  const now = defaults.now ?? new Date().toISOString();
  // Validate caller-provided `now`; fixtures and tests rely on deterministic failures.
  parseInstant(now);

  const periodInput = first(input, "period") as PeriodPreset | undefined;
  const preset = PERIODS.has(periodInput as Exclude<PeriodPreset, "custom">)
    ? (periodInput as Exclude<PeriodPreset, "custom">)
    : (defaults.period ?? "four_weeks");
  const explicitPeriod =
    periodInput === "custom" ? customPeriod(input, timezone) : null;
  const period = explicitPeriod
    ? { ...explicitPeriod, preset: PERIODS.has(periodInput as Exclude<PeriodPreset, "custom">) ? preset : "custom" as const }
    : resolvePeriod(preset, now, timezone);

  const workspaceId = asProjectId(
    safeIdentifier(
      first(input, "workspace_id"),
      defaults.workspaceId,
    ),
  );
  const rawScope = first(input, "scope_type");
  const legacyProjectScope = rawScope === LEGACY_PROJECT_SCOPE;
  const scopeType = SCOPES.has(rawScope as ScopeType)
    ? (rawScope as ScopeType)
    : (legacyProjectScope ? "workspace" : defaults.scopeType ?? "workspace");
  const rawScopeId = first(input, "scope_id");
  const scopeId = legacyProjectScope
    ? workspaceId
    : safeIdentifier(rawScopeId, defaults.scopeId ?? workspaceId);
  const labelIds = [
    ...(safeList(input, "label") ?? []),
    ...(legacyProjectScope && rawScopeId ? [rawScopeId] : []),
  ].map(asLabelId);

  const rawView = first(input, "view") as SignalView | undefined;
  const rawMetric = first(input, "metric") as MetricKey | undefined;
  const rawBreakdown = first(input, "breakdown") as BreakdownKey | undefined;
  const evidence = first(input, "evidence");

  return {
    view: VIEWS.has(rawView as SignalView) ? (rawView as SignalView) : "briefing",
    query: {
      scope: { type: scopeType, id: scopeId, workspaceId },
      period,
      program: PROGRAM_AXIS_NOT_CARRIED,
      filters: {
        ownerIds: safeList(input, "owner"),
        statuses: safeList(input, "status"),
        ...(labelIds.length ? { labelIds } : {}),
      },
      metric: METRICS.has(rawMetric as MetricKey) ? (rawMetric as MetricKey) : "work_completed",
      breakdown: BREAKDOWNS.has(rawBreakdown as BreakdownKey)
        ? (rawBreakdown as BreakdownKey)
        : "label",
      pagination: {
        page: integer(first(input, "page"), 1, 1, 10_000),
        perPage: integer(first(input, "per_page"), 25, 1, 100),
      },
    },
    evidenceId: evidence ? safeIdentifier(evidence, "") || null : null,
    evidencePage: integer(first(input, "evidence_page"), 1, 1, 10_000),
  };
}

export function serializeAnalyticsUrlState(state: AnalyticsUrlState): URLSearchParams {
  const params = new URLSearchParams({
    view: state.view,
    scope_type: state.query.scope.type,
    scope_id: state.query.scope.id,
    workspace_id: state.query.scope.workspaceId,
    timezone: state.query.period.timezone,
    period: state.query.period.preset ?? "custom",
    metric: state.query.metric ?? "work_completed",
    breakdown: state.query.breakdown ?? "label",
    page: String(state.query.pagination?.page ?? 1),
    per_page: String(state.query.pagination?.perPage ?? 25),
  });
  if (!state.query.period.preset || state.query.period.preset === "custom") {
    params.set("start", state.query.period.start);
    params.set("end", state.query.period.end);
  }
  for (const owner of state.query.filters?.ownerIds ?? []) params.append("owner", owner);
  for (const status of state.query.filters?.statuses ?? []) params.append("status", status);
  for (const label of state.query.filters?.labelIds ?? []) params.append("label", label);
  if (state.evidenceId) params.set("evidence", state.evidenceId);
  if (state.evidenceId && state.evidencePage > 1) {
    params.set("evidence_page", String(state.evidencePage));
  }
  return params;
}

export function withSignalView(
  state: AnalyticsUrlState,
  view: SignalView,
): AnalyticsUrlState {
  return { ...state, view };
}

export function withEvidence(
  state: AnalyticsUrlState,
  evidenceId: string | null,
): AnalyticsUrlState {
  return { ...state, evidenceId, evidencePage: 1 };
}
