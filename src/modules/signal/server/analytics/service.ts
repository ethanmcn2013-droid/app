import "server-only";

import type {
  AnalyticsPreferences,
  AnalyticsQuery,
  AnalyticsResponseMeta,
  AnalyticsSnapshot,
  BriefingResponse,
  BreakdownItem,
  BreakdownKey,
  EvidenceResponse,
  MetricKey,
  MetricResult,
  MetricStatus,
  NoteRecord,
  OverviewQueueItem,
  OverviewProjectRow,
  OverviewResponse,
  ProviderKey,
  SignalAction,
  SignalObservation,
  SourceReference,
  TasksProviderResult,
  TimelineProviderResult,
  TrendPoint,
  TrendsResponse,
} from "../../lib/analytics/contracts";
import { calculateMetric, calculateMetrics, coverageFreshness } from "../../lib/analytics/metrics";
import {
  attentionProjectsEvidenceObservation,
  milestoneEvidenceObservation,
  projectEvidenceDetails,
  projectEvidenceObservation,
  projectsNeedingAttentionCount,
} from "../../lib/analytics/evidence";
import { getAnalyticsFixture } from "../../lib/analytics/fixtures";
import { buildBriefing, SIGNAL_RULE_VERSION } from "../../lib/analytics/rules";
import { scopeSnapshot } from "../../lib/analytics/scope";
import { buildTrendPoints, resolveTrendStatus } from "../../lib/analytics/trend-series";
import { AnalyticsApiError } from "./errors";
import type { AuthorizedAnalyticsContext } from "./policy";
import type { ParsedAnalyticsQuery } from "./query";
import { combineCoverage, providerCoverage } from "./providers/coverage";
import { NotesAnalyticsProvider } from "./providers/notes";
import { TimelineAnalyticsProvider } from "./providers/timeline";
import { projectsFromTasks, TasksAnalyticsProvider } from "./providers/tasks";
import { paginateSources, withEvidencePagination } from "./pagination";
import { readMetricSnapshotHistory, readSnapshotEvidence } from "./snapshots";

const OVERVIEW_PROJECT_LIMIT = 100;
const BREAKDOWN_ITEM_LIMIT = 100;

export interface AnalyticsCalculation<T> {
  data: T;
  timingMs: number;
}

export async function calculateBriefing(
  context: AuthorizedAnalyticsContext,
): Promise<AnalyticsCalculation<BriefingResponse>> {
  return calculate(context, (snapshot, query) => buildBriefing(snapshot, query));
}

export async function calculateOverview(
  context: AuthorizedAnalyticsContext,
): Promise<AnalyticsCalculation<OverviewResponse>> {
  return calculate(context, buildOverview);
}

export async function calculateTrends(
  context: AuthorizedAnalyticsContext,
): Promise<AnalyticsCalculation<TrendsResponse>> {
  return calculate(context, buildTrends);
}

export async function calculateEvidence(
  context: AuthorizedAnalyticsContext,
  evidenceId: string,
): Promise<AnalyticsCalculation<EvidenceResponse>> {
  if (!/^[A-Za-z0-9._:-]{1,240}$/.test(evidenceId)) {
    throw new AnalyticsApiError(400, "invalid_request", "Evidence identifier is invalid.");
  }
  return calculate(context, (snapshot, query) => buildEvidence(snapshot, query, evidenceId));
}

export type SignalViewName = "briefing" | "overview" | "trends";
export type SignalViewResponse = BriefingResponse | OverviewResponse | TrendsResponse;
export interface SignalNavigationData {
  projects: Array<{ id: string; name: string }>;
  owners: Array<{ id: string; displayName: string | null }>;
  statuses: string[];
}

type ServiceAnalyticsSnapshot = AnalyticsSnapshot & {
  navigation?: SignalNavigationData;
};

export function calculateSignalView(
  context: AuthorizedAnalyticsContext,
  viewName: "briefing",
  evidenceId?: string | null,
  evidencePage?: number,
): Promise<{ view: BriefingResponse; evidence: EvidenceResponse | null; navigation: SignalNavigationData; timingMs: number }>;
export function calculateSignalView(
  context: AuthorizedAnalyticsContext,
  viewName: "overview",
  evidenceId?: string | null,
  evidencePage?: number,
): Promise<{ view: OverviewResponse; evidence: EvidenceResponse | null; navigation: SignalNavigationData; timingMs: number }>;
export function calculateSignalView(
  context: AuthorizedAnalyticsContext,
  viewName: "trends",
  evidenceId?: string | null,
  evidencePage?: number,
): Promise<{ view: TrendsResponse; evidence: EvidenceResponse | null; navigation: SignalNavigationData; timingMs: number }>;
export function calculateSignalView(
  context: AuthorizedAnalyticsContext,
  viewName: SignalViewName,
  evidenceId?: string | null,
  evidencePage?: number,
): Promise<{ view: SignalViewResponse; evidence: EvidenceResponse | null; navigation: SignalNavigationData; timingMs: number }>;

/** One provider pass for the selected view and its optional open drawer. */
export async function calculateSignalView(
  context: AuthorizedAnalyticsContext,
  viewName: SignalViewName,
  evidenceId?: string | null,
  evidencePage = 1,
): Promise<{
  view: SignalViewResponse;
  evidence: EvidenceResponse | null;
  navigation: SignalNavigationData;
  timingMs: number;
}> {
  const result = await calculate(context, async (snapshot, query) => {
    const view = viewName === "overview"
      ? buildOverview(snapshot, query)
      : viewName === "trends"
        ? await buildTrends(snapshot, query)
        : buildBriefing(snapshot, query);
    return {
      view,
      evidence: evidenceId
        ? await buildEvidence(
            snapshot,
            withEvidencePagination(query, evidencePage),
            evidenceId,
          )
        : null,
      navigation: navigationData(snapshot),
    };
  });
  return { ...result.data, timingMs: result.timingMs };
}

function navigationData(snapshot: ServiceAnalyticsSnapshot): SignalNavigationData {
  if (snapshot.navigation) return snapshot.navigation;
  const people = new Map<string, { id: string; displayName: string | null }>();
  for (const task of snapshot.tasks) {
    for (const owner of task.owners ?? []) people.set(owner.id, owner);
    for (const id of task.ownerIds) {
      if (!people.has(id)) people.set(id, { id, displayName: null });
    }
  }
  return {
    projects: snapshot.projects.map((project) => ({ id: project.id, name: project.name })),
    owners: Array.from(people.values()),
    statuses: Array.from(new Set(snapshot.tasks.map((task) => task.status))).sort(),
  };
}

async function calculate<T>(
  context: AuthorizedAnalyticsContext,
  builder: (snapshot: ServiceAnalyticsSnapshot, query: AnalyticsQuery) => T | Promise<T>,
): Promise<AnalyticsCalculation<T>> {
  const started = performance.now();
  const query = toAnalyticsQuery(context.query);
  let snapshot: ServiceAnalyticsSnapshot;
  if (context.principal.dataAccess === "fixtures") {
    const fixture = getAnalyticsFixture(context.query.fixtureScenario ?? "signature");
    snapshot = fixture.snapshot;
  } else {
    snapshot = await loadSnapshot(context, query);
  }
  const data = await builder(scopeSnapshot(snapshot, query), query);
  return {
    data,
    timingMs: performance.now() - started,
  };
}

export function toAnalyticsQuery(query: ParsedAnalyticsQuery): AnalyticsQuery {
  return {
    scope: query.scope,
    period: {
      start: query.start.toISOString(),
      end: query.end.toISOString(),
      timezone: query.timezone,
      preset: query.period,
    },
    filters: {
      ...(query.ownerIds.length ? { ownerIds: query.ownerIds } : {}),
      ...(query.statuses.length ? { statuses: query.statuses } : {}),
    },
    metric: query.metric as MetricKey,
    breakdown: query.breakdown,
    pagination: { page: query.page, perPage: query.perPage },
  };
}

async function loadSnapshot(
  context: AuthorizedAnalyticsContext,
  query: AnalyticsQuery,
): Promise<ServiceAnalyticsSnapshot> {
  const capturedAt = new Date().toISOString();
  const tasksPromise = safeProvider<TasksProviderResult>(
    "tasks",
    () => new TasksAnalyticsProvider().read(query),
    {
      tasks: [],
      events: [],
      navigation: { projects: [], owners: [], statuses: [] },
      coverage: providerCoverage({ provider: "tasks", status: "unavailable" }),
    },
  );
  const notesPromise = safeProvider<{ records: NoteRecord[]; coverage: ReturnType<typeof providerCoverage> }>(
    "notes",
    () => new NotesAnalyticsProvider(context.principal.clerkId).read(query),
    { records: [], coverage: providerCoverage({ provider: "notes", status: "unavailable" }) },
  );
  const timelinePromise = safeProvider<TimelineProviderResult>(
    "timeline",
    () => new TimelineAnalyticsProvider().read(query),
    {
      milestones: [],
      dependencies: [],
      events: [],
      coverage: providerCoverage({ provider: "timeline", status: "unavailable" }),
    },
  );
  const [taskResult, noteResult, timelineResult] = await Promise.all([
    tasksPromise,
    notesPromise,
    timelinePromise,
  ]);
  const projects = projectsFromTasks(taskResult.tasks, query);
  const projectCoverage = providerCoverage({
    provider: "projects",
    status: taskResult.coverage.status,
    capabilities: ["project_read"],
    count: projects.length,
    calculatedAt: capturedAt,
    issues: taskResult.coverage.issues,
  });
  return {
    scope: query.scope,
    capturedAt,
    navigation: taskResult.navigation,
    projects,
    tasks: taskResult.tasks,
    notes: noteResult.records,
    milestones: timelineResult.milestones,
    timelineDependencies: timelineResult.dependencies ?? [],
    events: [...taskResult.events, ...timelineResult.events],
    coverage: combineCoverage(
      {
        tasks: taskResult.coverage,
        notes: noteResult.coverage,
        timeline: timelineResult.coverage,
        projects: projectCoverage,
      },
      capturedAt,
    ),
  };
}

async function safeProvider<T extends { coverage: ReturnType<typeof providerCoverage> }>(
  provider: "tasks" | "notes" | "timeline",
  run: () => Promise<T>,
  empty: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[signal-analytics] ${provider} provider failed`, {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      ...empty,
      coverage: providerCoverage({
        provider,
        status: "unavailable",
        issues: [`${provider}_provider_failed`],
      }),
    };
  }
}

function buildOverview(snapshot: AnalyticsSnapshot, query: AnalyticsQuery): OverviewResponse {
  const metrics = calculateMetrics(snapshot, query);
  const briefing = buildBriefing(snapshot, query);
  const completed = metrics.work_completed;
  const overdue = metrics.open_overdue_work;
  const blocked = metrics.blocked_work;
  const unowned = metrics.unowned_work;
  const tasksAvailability = providerMetricStatus(snapshot, "tasks");
  const projectsAvailability = requiredSectionStatus([
    tasksAvailability,
    providerMetricStatus(snapshot, "projects"),
  ]);
  const timelineAvailability = providerMetricStatus(snapshot, "timeline");
  const actionQueueAvailability = optionalSectionStatus([
    tasksAvailability,
    providerMetricStatus(snapshot, "notes"),
  ]);
  const projects = projectRows(snapshot, query, tasksAvailability);
  const projectsNeedingAttention = projectsAvailability === "unsupported"
    ? null
    : projectsNeedingAttentionCount(snapshot, query);
  const nextMilestone = timelineAvailability === "unsupported"
    ? null
    : [...snapshot.milestones]
        .filter((item) => item.currentDate && item.state !== "completed" && item.state !== "cancelled")
        .sort((a, b) => dateValue(a.currentDate).localeCompare(dateValue(b.currentDate)))[0] ?? null;
  const points = completed.status === "unsupported"
    ? []
    : buildTrendPoints(snapshot, query, "work_completed");
  const primaryTrendStatus = resolveTrendStatus(
    completed.status,
    "work_completed",
    points.length,
  );
  return {
    summary: [
      {
        id: "projects_needing_attention",
        label: "Projects needing attention",
        value: projectsNeedingAttention,
        supportingText: projectsNeedingAttention === null
          ? "Project state is unavailable while the connected task source cannot be read."
          : "Projects with overdue or blocked work.",
        evidenceId: projectsNeedingAttention !== null && projectsNeedingAttention > 0
          ? "summary:projects_needing_attention"
          : null,
      },
      {
        id: "next_milestone",
        label: "Next milestone",
        value: timelineAvailability === "unsupported"
          ? null
          : nextMilestone?.title ?? "None scheduled",
        supportingText: timelineAvailability === "unsupported"
          ? "Timeline is unavailable, so the next milestone is not known."
          : nextMilestone?.currentDate
            ? dateValue(nextMilestone.currentDate)
            : "No upcoming date in Timeline.",
        evidenceId: nextMilestone ? `milestone:${nextMilestone.id}` : null,
      },
      {
        id: "work_completed",
        label: "Work completed",
        value: metricCountOrNull(completed),
        supportingText: completed.summary,
        metricKey: "work_completed",
        evidenceId: "metric:work_completed",
      },
      ...(metricCount(unowned) > 0
        ? [{
            id: "unowned_work",
            label: "Work without an owner",
            value: metricCount(unowned),
            supportingText: unowned.summary,
            metricKey: "unowned_work" as const,
            evidenceId: "metric:unowned_work",
          }]
        : []),
    ],
    availability: {
      projects: projectsAvailability,
      actionQueue: actionQueueAvailability,
      primaryTrend: primaryTrendStatus,
    },
    projects,
    primaryTrend: primaryTrendStatus !== "unsupported" && points.length >= 2
      ? {
          metric: "work_completed",
          title: completed.summary,
          interpretation: trendInterpretation(points, "Work completed"),
          points,
        }
      : null,
    actionQueue: [
      queue("overdue", "Overdue work", overdue),
      queue("blocked", "Work waiting on something", blocked),
      queue("unowned", "Work without an owner", unowned),
      queue("decisions", "Open decisions", metrics.open_decisions),
    ].filter((item): item is OverviewQueueItem => item !== null && item.count > 0),
    observations: briefing.observations,
    meta: responseMeta(
      snapshot,
      query,
      snapshot.projects.length > OVERVIEW_PROJECT_LIMIT ? "overview_project_limit_reached" : null,
    ),
  };
}

async function buildTrends(snapshot: AnalyticsSnapshot, query: AnalyticsQuery): Promise<TrendsResponse> {
  const metricKey = query.metric ?? "work_completed";
  const metric = calculateMetric(snapshot, query, metricKey);
  let points = metric.status === "unsupported"
    ? []
    : buildTrendPoints(snapshot, query, metricKey);
  if (metric.status !== "unsupported" && points.length < 2) {
    const history = await readMetricSnapshotHistory(query, metricKey);
    if (history.points.length) points = history.points;
  }
  const pagination = query.pagination ?? { page: 1, perPage: 25 };
  const { records, total } = paginateSources(metric.sources, pagination);
  const status = resolveTrendStatus(metric.status, metricKey, points.length);
  return {
    metric: metricKey,
    pointUnit: trendPointUnit(metricKey),
    title: metric.summary,
    interpretation: status === "unsupported"
      ? `${metric.summary} Missing source data has not been treated as zero.`
      : status === "insufficient_history"
        ? "Not enough history yet. Signal will show change once comparable source events have accumulated."
        : trendInterpretation(points, metricLabel(metricKey)),
    status,
    points,
    breakdown: buildBreakdown(snapshot, metric, query.breakdown ?? "project"),
    comparison: metric.comparison,
    records,
    pagination: { ...pagination, total },
    meta: responseMeta(snapshot, query),
  };
}

async function buildEvidence(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  evidenceId: string,
): Promise<EvidenceResponse> {
  // Evidence needs the complete authorized source set; the ordinary Briefing
  // response remains capped by buildBriefing's public inline limit.
  const briefing = buildBriefing(snapshot, query, { inlineSourceLimit: null });
  let observation = briefing.observations.find((item) => item.id === evidenceId) ?? null;
  let metric: MetricResult<unknown> | null = null;

  if (evidenceId.startsWith("snapshot:")) {
    const parts = evidenceId.split(":");
    const key = parts[1] as MetricKey | undefined;
    const id = parts[2];
    if (!key || !id || !METRIC_KEYS.has(key)) {
      throw new AnalyticsApiError(400, "invalid_request", "Snapshot evidence identifier is invalid.");
    }
    const saved = await readSnapshotEvidence(query, key, id);
    if (!saved) {
      throw new AnalyticsApiError(404, "not_found", "This historical snapshot is no longer available.");
    }
    const current = calculateMetric(snapshot, query, key);
    metric = {
      ...current,
      value: { count: saved.value },
      summary: `${metricLabel(key)} was ${saved.value} at this snapshot.`,
      comparison: null,
      sources: [],
      evidenceCount: 0,
      sourceCounts: { notes: 0, tasks: 0, milestones: 0, projects: 0 },
      calculatedAt: saved.snapshotAt,
    };
    observation = {
      ...metricObservation(metric, query, snapshot),
      id: evidenceId,
      issueKey: evidenceId,
      reasons: [
        metric.summary,
        "Signal stores this forward snapshot as an aggregate; source record content is not retained.",
      ],
      updatedAt: saved.snapshotAt,
    };
  }

  if (!observation) {
    if (evidenceId === "summary:projects_needing_attention") {
      observation = attentionProjectsEvidenceObservation(snapshot, query);
    } else if (evidenceId.startsWith("milestone:")) {
      observation = milestoneEvidenceObservation(
        snapshot,
        query,
        evidenceId.slice("milestone:".length),
      );
    } else if (evidenceId.startsWith("project:")) {
      observation = projectEvidenceObservation(
        snapshot,
        query,
        evidenceId.slice("project:".length),
      );
    }
  }

  if (!observation) {
    const key = evidenceMetricKey(evidenceId);
    if (key) {
      metric = calculateMetric(snapshot, query, key);
      if (evidenceId.startsWith("point:")) {
        const point = buildTrendPoints(snapshot, query, key).find((item) => item.evidenceId === evidenceId);
        if (!point) {
          throw new AnalyticsApiError(404, "not_found", "This trend datum is no longer available.");
        }
        metric = metricSubset(metric, new Set(point.sourceIds));
      } else if (evidenceId.startsWith("breakdown:")) {
        const parts = evidenceId.split(":");
        const breakdownKey = parts[2] as BreakdownKey | undefined;
        if (!breakdownKey || !["project", "owner", "status", "work_type"].includes(breakdownKey)) {
          throw new AnalyticsApiError(400, "invalid_request", "Evidence breakdown is invalid.");
        }
        const breakdown = buildBreakdown(snapshot, metric, breakdownKey);
        const group = breakdown?.items.find((item) => item.evidenceId === evidenceId);
        if (!group) {
          throw new AnalyticsApiError(404, "not_found", "This breakdown group is no longer available.");
        }
        metric = metricSubset(metric, new Set(group.sourceIds));
      }
      observation = metricObservation(metric, query, snapshot);
      observation = { ...observation, id: evidenceId, issueKey: evidenceId };
    }
  }
  if (!observation) {
    throw new AnalyticsApiError(404, "not_found", "Evidence is no longer available for this scope.");
  }

  const pagination = query.pagination ?? { page: 1, perPage: 25 };
  const { records, total } = paginateSources(observation.sources, pagination);
  const responseObservation = {
    ...observation,
    sources: observation.sources.slice(0, 100),
  };
  return {
    observation: responseObservation,
    observed: observation.title,
    why: observation.reasons,
    deterministicRule: metric
      ? `Metric ${metric.key}, ${metric.metricVersion}.`
      : `Observation ${observation.type}, ${observation.ruleVersion}.`,
    comparisonBasis: observation.metric.comparisonBasis,
    records,
    pagination: { ...pagination, total },
    actions: observation.actions,
    meta: responseMeta(snapshot, query),
  };
}

function projectRows(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  tasksAvailability: MetricStatus,
): OverviewProjectRow[] {
  return snapshot.projects.flatMap((project): OverviewProjectRow[] => {
    const details = projectEvidenceDetails(snapshot, query, project.id);
    if (!details) return [];
    const taskDataAvailable = tasksAvailability !== "unsupported";
    const timelineAvailable = providerMetricStatus(snapshot, "timeline") !== "unsupported";
    const next = timelineAvailable
      ? [...snapshot.milestones]
          .filter(
            (milestone) =>
              milestone.projectId === project.id &&
              milestone.currentDate &&
              milestone.state !== "completed" &&
              milestone.state !== "cancelled",
          )
          .sort((a, b) => dateValue(a.currentDate).localeCompare(dateValue(b.currentDate)))[0]
      : null;
    return [{
      id: project.id,
      name: project.name,
      state: taskDataAvailable ? details.state : "unknown",
      reasons: taskDataAvailable
        ? details.reasons
        : ["Task context is unavailable, so this project state is not known."],
      progress: taskDataAvailable ? details.progress : null,
      nextMilestone: next?.title ?? null,
      nextMilestoneDate: next?.currentDate ?? null,
      nextMilestoneDeepLink: next?.deepLink ?? null,
      ownerIds: project.ownerIds,
      evidenceId: taskDataAvailable ? `project:${project.id}` : null,
      deepLink: project.deepLink,
    }];
  }).sort((a, b) => stateOrder(b.state) - stateOrder(a.state) || a.name.localeCompare(b.name))
    .slice(0, OVERVIEW_PROJECT_LIMIT);
}

function trendPointUnit(key: MetricKey): TrendsResponse["pointUnit"] {
  if (key === "open_work_age") return "days";
  if (key === "milestone_movement") return "changes";
  return "items";
}

function buildBreakdown(
  snapshot: AnalyticsSnapshot,
  metric: MetricResult<unknown>,
  key: BreakdownKey,
): { key: BreakdownKey; items: BreakdownItem[] } | null {
  if (!metric.sources.length) return null;
  const groups = new Map<string, { label: string; ids: string[] }>();
  for (const source of metric.sources) {
    const values = breakdownValues(snapshot, source, key);
    for (const [groupKey, label] of values) {
      const existing = groups.get(groupKey);
      if (existing) existing.ids.push(source.id);
      else groups.set(groupKey, { label, ids: [source.id] });
    }
  }
  return {
    key,
    items: Array.from(groups, ([groupKey, value]) => ({
      key: groupKey,
      label: value.label,
      value: value.ids.length,
      sourceIds: value.ids,
      evidenceId: `breakdown:${metric.key}:${key}:${groupKey}`,
    })).sort((a, b) => b.value - a.value).slice(0, BREAKDOWN_ITEM_LIMIT),
  };
}

function breakdownValues(
  snapshot: AnalyticsSnapshot,
  source: SourceReference,
  key: BreakdownKey,
): Array<[string, string]> {
  if (key === "project") return source.projectIds.map((id) => [id, snapshot.projects.find((project) => project.id === id)?.name ?? id]);
  if (key === "owner") return source.ownerIds.length ? source.ownerIds.map((id) => [id, id]) : [["unowned", "Unowned"]];
  const task = source.type === "task" ? snapshot.tasks.find((item) => item.id === source.id) : null;
  if (key === "status") return [[task?.status ?? source.state, task?.status ?? source.state]];
  return [[task?.workType ?? source.type, task?.workType ?? source.type]];
}

function metricObservation(
  metric: MetricResult<unknown>,
  query: AnalyticsQuery,
  snapshot: AnalyticsSnapshot,
): SignalObservation {
  const count = metricCount(metric);
  const state: SignalObservation["state"] = metric.status === "unsupported" || metric.status === "insufficient_history"
    ? "watch"
    : count > 0 && attentionMetric(metric.key)
      ? "needs_attention"
      : "on_track";
  const actions: SignalAction[] = metric.sources
    .filter((source) => source.deepLink)
    .slice(0, 1)
    .map((source) => ({ id: `open-${source.type}`, label: `Open ${source.type}`, href: source.deepLink, primary: true }));
  return {
    id: `metric:${metric.key}`,
    type: "metric_evidence",
    issueKey: `metric:${metric.key}`,
    title: metric.summary,
    summary: metric.summary,
    whyItMatters: metric.status === "unsupported"
      ? "Signal cannot calculate this metric until the required connected source is available."
      : metric.status === "insufficient_history"
        ? "Signal needs more source history before it can make a confident comparison."
        : "These are the source records included in the deterministic calculation.",
    state,
    confidence: metric.coverage.status === "complete" ? 1 : 0.6,
    scope: query.scope,
    period: query.period,
    metric: {
      key: metric.key,
      value: metricCountOrNull(metric),
      previousValue: metric.comparison?.previousValue ?? null,
      delta: metric.comparison?.delta ?? null,
      unit: metric.unit,
      comparisonBasis: metric.comparison?.basis ?? (metric.status === "unsupported"
        ? "The required connected source is currently unavailable."
        : "Current selected period."),
    },
    reasons: [metric.summary, ...metric.coverage.providers.tasks?.issues ?? []],
    evidenceCount: metric.evidenceCount,
    sourceCounts: {
      notes: metric.sourceCounts.notes,
      tasks: metric.sourceCounts.tasks,
      milestones: metric.sourceCounts.milestones,
    },
    sources: metric.sources,
    actions,
    updatedAt: snapshot.capturedAt,
    ruleVersion: metric.metricVersion,
  };
}

function queue(
  id: string,
  label: string,
  metric: MetricResult<unknown>,
): OverviewQueueItem | null {
  const count = metricCountOrNull(metric);
  if (count === null) return null;
  return {
    id,
    label,
    count,
    metricKey: metric.key,
    evidenceId: `metric:${metric.key}`,
    action: metric.sources.find((source) => source.deepLink)
      ? {
          id: `open-${id}`,
          label: `Review ${label.toLowerCase()}`,
          href: metric.sources.find((source) => source.deepLink)!.deepLink,
          primary: true,
        }
      : null,
  };
}

function responseMeta(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  projectIssue: string | null = null,
): AnalyticsResponseMeta {
  const coverage = !projectIssue || !snapshot.coverage.providers.projects
    ? snapshot.coverage
    : {
        ...snapshot.coverage,
        status: "partial" as const,
        providers: {
          ...snapshot.coverage.providers,
          projects: {
            ...snapshot.coverage.providers.projects,
            status: "partial" as const,
            issues: [...snapshot.coverage.providers.projects.issues, projectIssue],
          },
        },
      };
  return {
    scope: query.scope,
    period: query.period,
    calculatedAt: snapshot.capturedAt,
    coverage,
    freshness: coverageFreshness(coverage),
    ruleVersion: SIGNAL_RULE_VERSION,
  };
}

function stateOrder(state: OverviewProjectRow["state"]): number {
  if (state === "needs_attention") return 3;
  if (state === "watch") return 2;
  if (state === "on_track") return 1;
  return 0;
}

function evidenceMetricKey(evidenceId: string): MetricKey | null {
  const parts = evidenceId.split(":");
  const candidate = parts[0] === "metric" || parts[0] === "point" || parts[0] === "breakdown" ? parts[1] : null;
  return candidate && METRIC_KEYS.has(candidate as MetricKey) ? candidate as MetricKey : null;
}

function metricSubset(
  metric: MetricResult<unknown>,
  sourceIds: ReadonlySet<string>,
): MetricResult<unknown> {
  const sources = metric.sources.filter((source) => sourceIds.has(source.id));
  return {
    ...metric,
    sources,
    evidenceCount: sources.length,
    sourceCounts: {
      notes: sources.filter((source) => source.type === "note").length,
      tasks: sources.filter((source) => source.type === "task").length,
      milestones: sources.filter((source) => source.type === "milestone").length,
      projects: sources.filter((source) => source.type === "project").length,
    },
  };
}

const METRIC_KEYS = new Set<MetricKey>([
  "work_completed", "open_work", "open_overdue_work", "open_work_age", "stalled_work",
  "blocked_work", "unowned_work", "completion_pace_change", "milestone_movement",
  "open_decisions", "follow_up_completion", "workload_distribution", "cross_product_milestone_risk",
]);

function metricCount(metric: MetricResult<unknown>): number {
  return metricCountOrNull(metric) ?? 0;
}

function metricCountOrNull(metric: MetricResult<unknown>): number | null {
  const value = metric.value;
  if (metric.status === "unsupported" || !value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["count", "currentCount", "completedCount", "totalActive", "changeCount"] as const) {
    if (typeof record[key] === "number") return record[key];
  }
  return null;
}

function providerMetricStatus(
  snapshot: AnalyticsSnapshot,
  key: ProviderKey,
): MetricStatus {
  const coverage = snapshot.coverage.providers[key];
  if (!coverage || coverage.status === "unavailable" || coverage.status === "unsupported") {
    return "unsupported";
  }
  return coverage.status === "ready" ? "available" : "partial";
}

/** Every provider is required to assert a project state. */
function requiredSectionStatus(statuses: MetricStatus[]): MetricStatus {
  if (statuses.some((status) => status === "unsupported")) return "unsupported";
  return statuses.some((status) => status !== "available") ? "partial" : "available";
}

/** A queue may show safe partial results when at least one source is available. */
function optionalSectionStatus(statuses: MetricStatus[]): MetricStatus {
  if (statuses.every((status) => status === "unsupported")) return "unsupported";
  return statuses.some((status) => status !== "available") ? "partial" : "available";
}

function attentionMetric(key: MetricKey): boolean {
  return [
    "open_overdue_work", "stalled_work", "blocked_work", "unowned_work",
    "open_decisions", "cross_product_milestone_risk",
  ].includes(key);
}

function metricLabel(key: MetricKey): string {
  return key.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function trendInterpretation(points: TrendPoint[], label: string): string {
  if (points.length < 2) return `Not enough ${label.toLowerCase()} history yet.`;
  const midpoint = Math.ceil(points.length / 2);
  const earlier = points.slice(0, midpoint).reduce((sum, point) => sum + point.value, 0);
  const later = points.slice(midpoint).reduce((sum, point) => sum + point.value, 0);
  if (later === earlier) return `${label} is steady across the selected period.`;
  return `${label} is ${later > earlier ? "higher" : "lower"} in the recent part of the selected period.`;
}

function dateValue(date: { value: string } | null): string {
  return date?.value ?? "";
}

export type { AnalyticsPreferences };
