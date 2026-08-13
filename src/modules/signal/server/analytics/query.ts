import { normalizeSuiteContextForSignal } from "@/lib/suite-context";
import {
  asLabelId,
  asProjectId,
  PROGRAM_AXIS_NOT_CARRIED,
  type AnalyticsProgramAxis,
  type LabelId,
  type ProjectId,
} from "../../lib/analytics/contracts";
import { AnalyticsApiError } from "./api-error";

export const ANALYTICS_PERIODS = [
  "four_weeks",
  "twelve_weeks",
  "six_months",
  "twelve_months",
  "custom",
] as const;
export const ANALYTICS_METRICS = [
  "work_completed",
  "open_work",
  "open_overdue_work",
  "open_work_age",
  "stalled_work",
  "blocked_work",
  "unowned_work",
  "completion_pace_change",
  "workload_distribution",
  "milestone_movement",
  "open_decisions",
  "follow_up_completion",
  "cross_product_milestone_risk",
] as const;
export const ANALYTICS_BREAKDOWNS = [
  "label",
  "owner",
  "status",
  "work_type",
] as const;

/**
 * Inbound compatibility only (ADR 0001 sec 8): links minted before D-010 carry
 * `scope_type=project&scope_id=<tag slug>`. That was never an authorization
 * boundary — the workspace predicate was — so the value is accepted and
 * re-expressed as the Label filter it always was. It is never treated as a
 * Project, and the response records the collapse.
 */
const LEGACY_PROJECT_SCOPE = "project";

type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];
type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];
type AnalyticsBreakdown = (typeof ANALYTICS_BREAKDOWNS)[number];

export interface ParsedAnalyticsQuery {
  scope: {
    type: "workspace" | "user";
    id: string;
    workspaceId: ProjectId;
  };
  period: AnalyticsPeriod;
  program: AnalyticsProgramAxis;
  start: Date;
  end: Date;
  timezone: string;
  customStart: string | null;
  customEnd: string | null;
  ownerIds: string[];
  statuses: string[];
  /** Tag-derived Labels narrowing the read. Never an authorization boundary. */
  labelIds: LabelId[];
  /** Set when a pre-D-010 `scope_type=project` link was re-expressed as a filter. */
  legacyProjectScopeCollapsed: boolean;
  metric: AnalyticsMetric;
  breakdown: AnalyticsBreakdown;
  page: number;
  perPage: number;
  fixtureScenario: "signature" | "healthy" | "insufficient_history" | "empty" | "stale" | "provider_failure" | "large_evidence" | "unauthorized" | null;
}

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,63}$/;

export function parseAnalyticsQuery(
  request: Request,
  now = new Date(),
): ParsedAnalyticsQuery {
  const params = normalizeSuiteContextForSignal(
    new URL(request.url).searchParams,
  );
  const requestedScopeType = enumParam(
    params.get("scope_type") ?? "workspace",
    ["workspace", LEGACY_PROJECT_SCOPE, "user"] as const,
    "scope_type",
  );
  const requestedScopeId = identifierParam(params.get("scope_id"), "scope_id");
  const legacyProjectScopeCollapsed = requestedScopeType === LEGACY_PROJECT_SCOPE;
  const scopeType = legacyProjectScopeCollapsed ? "workspace" : requestedScopeType;
  const workspaceId = asProjectId(
    requestedScopeType === "workspace"
      ? requestedScopeId
      : identifierParam(params.get("workspace_id"), "workspace_id"),
  );
  const scopeId = legacyProjectScopeCollapsed ? workspaceId : requestedScopeId;
  const labelIds = [
    ...listParam(params, "label", IDENTIFIER),
    ...(legacyProjectScopeCollapsed ? [requestedScopeId] : []),
  ].map(asLabelId);
  const period = enumParam(
    params.get("period") ?? "four_weeks",
    ANALYTICS_PERIODS,
    "period",
  );
  const timezone = timezoneParam(params.get("timezone") ?? "UTC");
  const { start, end } = resolvePeriod(period, params, now);
  const ownerIds = listParam(params, "owner", IDENTIFIER);
  const statuses = listParam(params, "status", STATUS);
  const metric = enumParam(
    params.get("metric") ?? "work_completed",
    ANALYTICS_METRICS,
    "metric",
  );
  const breakdown = enumParam(
    // `project` is accepted so a pre-D-010 link does not 400; it means the
    // tag-derived Label breakdown, which is what it always computed.
    (params.get("breakdown") ?? "label") === LEGACY_PROJECT_SCOPE
      ? "label"
      : params.get("breakdown") ?? "label",
    ANALYTICS_BREAKDOWNS,
    "breakdown",
  );

  return {
    scope: { type: scopeType, id: scopeId, workspaceId },
    period,
    program: PROGRAM_AXIS_NOT_CARRIED,
    start,
    end,
    timezone,
    customStart: period === "custom" ? params.get("start") : null,
    customEnd: period === "custom" ? params.get("end") : null,
    ownerIds,
    statuses,
    labelIds,
    legacyProjectScopeCollapsed,
    metric,
    breakdown,
    page: integerParam(params.get("page"), "page", 1, 1, 10_000),
    perPage: integerParam(params.get("per_page"), "per_page", 25, 1, 100),
    fixtureScenario: optionalEnumParam(
      params.get("fixture"),
      ["signature", "healthy", "insufficient_history", "empty", "stale", "provider_failure", "large_evidence", "unauthorized"] as const,
      "fixture",
    ),
  };
}

function resolvePeriod(
  period: AnalyticsPeriod,
  params: URLSearchParams,
  now: Date,
): { start: Date; end: Date } {
  const end = params.get("end") ? boundaryParam(params.get("end"), "end", true) : now;
  let start: Date;
  if (period === "custom") {
    start = boundaryParam(params.get("start"), "start", false);
    if (!params.get("end")) {
      throw invalid("end", "is required for a custom range");
    }
  } else if (params.has("start") || params.has("end")) {
    throw invalid("period", "start and end are only valid with period=custom");
  } else {
    const days = period === "four_weeks" ? 28 : period === "twelve_weeks" ? 84 : period === "six_months" ? 183 : 365;
    start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  }

  if (start.getTime() >= end.getTime()) {
    throw invalid("start", "must be before end");
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
    throw invalid("period", "must not exceed 366 days");
  }
  return { start, end };
}

function boundaryParam(value: string | null, field: string, endExclusive: boolean): Date {
  if (!value) throw invalid(field, "is required");
  if (!DATE_ONLY.test(value)) {
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      throw invalid(field, "must be YYYY-MM-DD or an ISO timestamp");
    }
    return instant;
  }
  const calendarDay = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== value) {
    throw invalid(field, "is not a calendar date");
  }
  return endExclusive
    ? new Date(calendarDay.getTime() + 24 * 60 * 60 * 1_000)
    : calendarDay;
}

function identifierParam(value: string | null, field: string): string {
  if (!value || !IDENTIFIER.test(value)) {
    throw invalid(field, "is required and must be a valid identifier");
  }
  return value;
}

function listParam(
  params: URLSearchParams,
  field: string,
  pattern: RegExp,
): string[] {
  const values = params
    .getAll(field)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length > 20) throw invalid(field, "must contain at most 20 values");
  if (values.some((value) => !pattern.test(value))) {
    throw invalid(field, "contains unsupported characters");
  }
  return Array.from(new Set(values));
}

function timezoneParam(value: string): string {
  if (value.length > 64) throw invalid("timezone", "is too long");
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return value;
  } catch {
    throw invalid("timezone", "must be a valid IANA timezone");
  }
}

function integerParam(
  value: string | null,
  field: string,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw invalid(field, "must be an integer");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw invalid(field, `must be between ${min} and ${max}`);
  }
  return parsed;
}

function enumParam<const T extends readonly string[]>(
  value: string,
  allowed: T,
  field: string,
): T[number] {
  if (!allowed.includes(value)) {
    throw invalid(field, `must be one of: ${allowed.join(", ")}`);
  }
  return value as T[number];
}

function optionalEnumParam<const T extends readonly string[]>(
  value: string | null,
  allowed: T,
  field: string,
): T[number] | null {
  return value === null ? null : enumParam(value, allowed, field);
}

function invalid(field: string, reason: string): AnalyticsApiError {
  return new AnalyticsApiError(400, "invalid_request", `Invalid ${field}: ${reason}.`, { field });
}
