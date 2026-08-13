import type {
  AnalyticsMetricBundle,
  AnalyticsQuery,
  AnalyticsResponseMeta,
  AnalyticsSnapshot,
  BriefingResponse,
  MetricKey,
  SignalAction,
  SignalObservation,
  SourceReference,
} from "./contracts";
import {
  calculateMetrics,
  coverageFreshness,
  type MetricOptions,
} from "./metrics";

export const SIGNAL_RULE_VERSION = "signal-analytics-rules@1.0.0";

export interface RuleWeights {
  impact: number;
  urgency: number;
  confidence: number;
  recency: number;
  severity: number;
}

export interface RuleThresholds {
  slowPacePercent: number;
  slowPaceMinimumItems: number;
  stalledMinimumItems: number;
  repeatedLowValueImpact: number;
  minimumConfidence: number;
}

export interface RuleConfiguration {
  maxObservations: number;
  weights: RuleWeights;
  thresholds: RuleThresholds;
}

export const DEFAULT_RULE_CONFIGURATION: Readonly<RuleConfiguration> = {
  maxObservations: 3,
  weights: {
    impact: 5,
    urgency: 4,
    confidence: 3,
    recency: 2,
    severity: 4,
  },
  thresholds: {
    slowPacePercent: -25,
    slowPaceMinimumItems: 2,
    stalledMinimumItems: 2,
    repeatedLowValueImpact: 2,
    minimumConfidence: 0.55,
  },
};

export interface ObservationSuppression {
  issueKey: string;
  until: string;
  reason: "dismissed" | "repeated_low_value";
}

export interface RuleOptions {
  configuration?: Partial<RuleConfiguration> & {
    weights?: Partial<RuleWeights>;
    thresholds?: Partial<RuleThresholds>;
  };
  suppressions?: ObservationSuppression[];
  metricOptions?: MetricOptions;
  /** Internal response shaping; public Briefing payloads stay capped at 100. */
  inlineSourceLimit?: number | null;
}

export interface RuleCandidate extends SignalObservation {
  ranking: {
    severity: number;
    impact: number;
    urgency: number;
    confidence: number;
    recency: number;
  };
}

function configuration(options: RuleOptions): RuleConfiguration {
  const requested = options.configuration;
  return {
    maxObservations: Math.min(
      3,
      Math.max(0, Math.floor(requested?.maxObservations ?? 3)),
    ),
    weights: { ...DEFAULT_RULE_CONFIGURATION.weights, ...requested?.weights },
    thresholds: {
      ...DEFAULT_RULE_CONFIGURATION.thresholds,
      ...requested?.thresholds,
    },
  };
}

function countSourceTypes(sources: SourceReference[]): SignalObservation["sourceCounts"] {
  const unique = new Set(sources.map((source) => `${source.type}:${source.id}`));
  let notes = 0;
  let tasks = 0;
  let milestones = 0;
  for (const key of unique) {
    if (key.startsWith("note:")) notes += 1;
    if (key.startsWith("task:")) tasks += 1;
    if (key.startsWith("milestone:")) milestones += 1;
  }
  return { notes, tasks, milestones };
}

function stableHash(value: string): string {
  // FNV-1a provides stable identifiers, not a security boundary.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function candidateId(rule: string, issueKey: string, sources: SourceReference[]): string {
  const sourceKey = sources
    .map((source) => `${source.type}:${source.id}`)
    .sort()
    .join("|");
  return `${rule}-${stableHash(`${issueKey}|${sourceKey}`)}`;
}

function trendHref(query: AnalyticsQuery, metric: MetricKey): string {
  const params = new URLSearchParams({
    view: "trends",
    scope_type: query.scope.type,
    scope_id: query.scope.id,
    workspace_id: query.scope.workspaceId,
    timezone: query.period.timezone,
    metric,
  });
  const preset = query.period.preset ?? "custom";
  params.set("period", preset);
  if (preset === "custom") {
    params.set("start", query.period.start);
    params.set("end", query.period.end);
  }
  for (const ownerId of query.filters?.ownerIds ?? []) {
    params.append("owner", ownerId);
  }
  for (const status of query.filters?.statuses ?? []) {
    params.append("status", status);
  }
  return `/app/trends?${params.toString()}`;
}

function action(
  id: string,
  label: string,
  href: string,
  primary: boolean,
): SignalAction {
  return { id, label, href, primary };
}

function comparisonFor(
  metrics: AnalyticsMetricBundle,
  key: MetricKey,
): SignalObservation["metric"] {
  const metric = metrics[key];
  let value: number | null = null;
  if (metric.value && "count" in metric.value) value = metric.value.count;
  if (key === "completion_pace_change" && metrics.completion_pace_change.value) {
    value = metrics.completion_pace_change.value.currentCount;
  }
  if (key === "milestone_movement" && metrics.milestone_movement.value) {
    value = metrics.milestone_movement.value.changeCount;
  }
  return {
    key,
    value,
    previousValue: metric.comparison?.previousValue ?? null,
    delta: metric.comparison?.delta ?? null,
    unit: metric.unit,
    comparisonBasis: metric.comparison?.basis ?? "Current records in the selected scope.",
  };
}

function makeCandidate(input: {
  rule: string;
  issueKey: string;
  title: string;
  summary: string;
  whyItMatters: string;
  state: SignalObservation["state"];
  confidence: number;
  query: AnalyticsQuery;
  metrics: AnalyticsMetricBundle;
  metricKey: MetricKey;
  reasons: string[];
  sources: SourceReference[];
  evidenceCount?: number;
  sourceCounts?: SignalObservation["sourceCounts"];
  actions: SignalAction[];
  updatedAt: string;
  ranking: RuleCandidate["ranking"];
}): RuleCandidate {
  const uniqueSources = [
    ...new Map(
      input.sources.map((source) => [`${source.type}:${source.id}`, source]),
    ).values(),
  ];
  return {
    id: candidateId(input.rule, input.issueKey, uniqueSources),
    type: input.rule,
    issueKey: input.issueKey,
    title: input.title,
    summary: input.summary,
    whyItMatters: input.whyItMatters,
    state: input.state,
    confidence: input.confidence,
    scope: input.query.scope,
    period: input.query.period,
    metric: comparisonFor(input.metrics, input.metricKey),
    reasons: [...new Set(input.reasons)],
    evidenceCount: input.evidenceCount ?? uniqueSources.length,
    sourceCounts: input.sourceCounts ?? countSourceTypes(uniqueSources),
    sources: uniqueSources,
    actions: input.actions,
    updatedAt: input.updatedAt,
    ruleVersion: SIGNAL_RULE_VERSION,
    ranking: input.ranking,
  };
}

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Detect candidates only from deterministic metrics and source links. */
export function buildRuleCandidates(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  metrics: AnalyticsMetricBundle,
  options: RuleOptions = {},
): RuleCandidate[] {
  const config = configuration(options);
  const candidates: RuleCandidate[] = [];
  const updatedAt = snapshot.capturedAt;

  const risk = metrics.cross_product_milestone_risk;
  if (risk.value) {
    for (const milestone of risk.value.milestones) {
      const ids = new Set([
        milestone.milestoneId,
        ...milestone.overdueTaskIds,
        ...milestone.blockedTaskIds,
        ...milestone.openDecisionIds,
        ...milestone.unresolvedDependencyIds.map((id) => `timeline-dependency:${id}`),
      ]);
      const sources = risk.sources.filter((source) => ids.has(source.id));
      const milestoneSource = sources.find((source) => source.type === "milestone");
      const decisionCount = milestone.openDecisionIds.length;
      const blockedCount = milestone.blockedTaskIds.length;
      const overdueCount = milestone.overdueTaskIds.length;
      const taskCount = new Set([
        ...milestone.blockedTaskIds,
        ...milestone.overdueTaskIds,
      ]).size;
      const dependencyCount = milestone.unresolvedDependencyIds.length;
      const title =
        decisionCount > 0
          ? `${countPhrase(decisionCount, "unresolved decision is", "unresolved decisions are")} putting ${milestone.title} at risk.`
          : blockedCount > 0
            ? `${countPhrase(blockedCount, "blocked item is", "blocked items are")} putting ${milestone.title} at risk.`
            : `${milestone.title} has unresolved work ahead of it.`;
      const reasons = [
        ...(decisionCount > 0
          ? [countPhrase(decisionCount, "connected decision is open", "connected decisions are open") + "."]
          : []),
        ...(blockedCount > 0
          ? [countPhrase(blockedCount, "connected item is blocked", "connected items are blocked") + "."]
          : []),
        ...(overdueCount > 0
          ? [countPhrase(overdueCount, "connected item is overdue", "connected items are overdue") + "."]
          : []),
        ...(milestone.unresolvedDependencyIds.length > 0
          ? [countPhrase(milestone.unresolvedDependencyIds.length, "dependency is unresolved", "dependencies are unresolved") + "."]
          : []),
      ];
      const primary =
        sources.find((source) => source.type === "task") ?? milestoneSource ?? sources[0];
      candidates.push(
        makeCandidate({
          rule: "cross_product_milestone_risk",
          issueKey: `milestone:${milestone.milestoneId}`,
          title,
          summary: reasons.join(" "),
          whyItMatters: "The connected work could affect an upcoming delivery date.",
          state: "needs_attention",
          confidence: risk.status === "available" ? 0.96 : 0.72,
          query,
          metrics,
          metricKey: "cross_product_milestone_risk",
          reasons,
          sources,
          evidenceCount: 1 + taskCount + decisionCount + dependencyCount,
          sourceCounts: {
            notes: decisionCount,
            tasks: taskCount + dependencyCount,
            milestones: 1,
          },
          actions: [
            ...(primary
              ? [action("review-connected-work", "Review connected work", primary.deepLink, true)]
              : []),
            action(
              "open-milestone-trend",
              "Open trend",
              trendHref(query, "milestone_movement"),
              false,
            ),
          ],
          updatedAt,
          ranking: {
            severity: 3,
            impact: 3,
            urgency: 3,
            confidence: risk.status === "available" ? 0.96 : 0.72,
            recency: 1.5,
          },
        }),
      );
    }
  }

  const overdue = metrics.open_overdue_work;
  if (overdue.value && overdue.value.count > 0) {
    candidates.push(
      makeCandidate({
        rule: "open_overdue_work",
        issueKey: "tasks:overdue",
        title: `${countPhrase(overdue.value.count, "active item is", "active items are")} overdue.`,
        summary: "These items remain open after their due dates.",
        whyItMatters: "Past-due work can quietly compress the next delivery window.",
        state: overdue.value.count >= 3 ? "needs_attention" : "watch",
        confidence: overdue.status === "available" ? 0.98 : 0.75,
        query,
        metrics,
        metricKey: "open_overdue_work",
        reasons: [overdue.summary],
        sources: overdue.sources,
        evidenceCount: overdue.evidenceCount,
        sourceCounts: {
          notes: overdue.sourceCounts.notes,
          tasks: overdue.sourceCounts.tasks,
          milestones: overdue.sourceCounts.milestones,
        },
        actions: [
          ...(overdue.sources[0]
            ? [action("review-overdue", "Review delayed work", overdue.sources[0].deepLink, true)]
            : []),
          action("open-overdue-trend", "See trend", trendHref(query, "open_overdue_work"), false),
        ],
        updatedAt,
        ranking: {
          severity: overdue.value.count >= 5 ? 3 : 2,
          impact: overdue.value.count >= 3 ? 3 : 2,
          urgency: 3,
          confidence: overdue.status === "available" ? 0.98 : 0.75,
          recency: 1,
        },
      }),
    );
  }

  const blocked = metrics.blocked_work;
  if (blocked.value && blocked.value.count > 0) {
    candidates.push(
      makeCandidate({
        rule: "blocked_work",
        issueKey: "tasks:blocked",
        title: `${countPhrase(blocked.value.count, "active item is", "active items are")} waiting on something.`,
        summary: `${blocked.value.explicitCount} explicitly blocked; ${blocked.value.inferredCount} have unresolved dependencies.`,
        whyItMatters: "Work cannot move until the connected dependency is cleared.",
        state: blocked.value.count >= 3 ? "needs_attention" : "watch",
        confidence: blocked.status === "available" ? 0.94 : 0.7,
        query,
        metrics,
        metricKey: "blocked_work",
        reasons: [blocked.summary],
        sources: blocked.sources,
        evidenceCount: blocked.evidenceCount,
        sourceCounts: {
          notes: blocked.sourceCounts.notes,
          tasks: blocked.sourceCounts.tasks,
          milestones: blocked.sourceCounts.milestones,
        },
        actions: [
          ...(blocked.sources[0]
            ? [action("review-blocked", "Review waiting work", blocked.sources[0].deepLink, true)]
            : []),
          action("open-blocked-trend", "See trend", trendHref(query, "blocked_work"), false),
        ],
        updatedAt,
        ranking: {
          severity: blocked.value.count >= 4 ? 3 : 2,
          impact: blocked.value.count >= 3 ? 3 : 2,
          urgency: 2,
          confidence: blocked.status === "available" ? 0.94 : 0.7,
          recency: 1,
        },
      }),
    );
  }

  const unowned = metrics.unowned_work;
  if (unowned.value && unowned.value.count > 0) {
    candidates.push(
      makeCandidate({
        rule: "unowned_work",
        issueKey: "tasks:unowned",
        title: `${countPhrase(unowned.value.count, "active item does", "active items do")} not have an owner.`,
        summary: "Active work without an owner is less likely to move predictably.",
        whyItMatters: "Assigning ownership gives each item a clear next person.",
        state: unowned.value.count >= 3 ? "needs_attention" : "watch",
        confidence: unowned.status === "available" ? 0.99 : 0.75,
        query,
        metrics,
        metricKey: "unowned_work",
        reasons: [unowned.summary],
        sources: unowned.sources,
        evidenceCount: unowned.evidenceCount,
        sourceCounts: {
          notes: unowned.sourceCounts.notes,
          tasks: unowned.sourceCounts.tasks,
          milestones: unowned.sourceCounts.milestones,
        },
        actions: [
          ...(unowned.sources[0]
            ? [action("assign-unowned", "Assign unowned work", unowned.sources[0].deepLink, true)]
            : []),
          action("open-ownership", "See distribution", trendHref(query, "workload_distribution"), false),
        ],
        updatedAt,
        ranking: {
          severity: unowned.value.count >= 5 ? 3 : 2,
          impact: unowned.value.count >= 3 ? 3 : 2,
          urgency: 2,
          confidence: unowned.status === "available" ? 0.99 : 0.75,
          recency: 1,
        },
      }),
    );
  }

  const pace = metrics.completion_pace_change;
  if (
    pace.status !== "insufficient_history" &&
    pace.value &&
    pace.value.delta <= -config.thresholds.slowPaceMinimumItems &&
    pace.value.percentChange != null &&
    pace.value.percentChange <= config.thresholds.slowPacePercent
  ) {
    candidates.push(
      makeCandidate({
        rule: "completion_pace_change",
        issueKey: "tasks:completion-pace",
        title: "Work is moving more slowly than usual.",
        summary: `${pace.value.currentCount} items completed, compared with a recent median of ${pace.value.priorMedian}.`,
        whyItMatters: "The selected scope may need a smaller plan or a cleared dependency.",
        state: pace.value.percentChange <= -50 ? "needs_attention" : "watch",
        confidence: pace.status === "available" ? 0.9 : 0.68,
        query,
        metrics,
        metricKey: "completion_pace_change",
        reasons: [pace.summary, pace.comparison?.basis ?? ""].filter(Boolean),
        sources: pace.sources,
        evidenceCount: pace.evidenceCount,
        sourceCounts: {
          notes: pace.sourceCounts.notes,
          tasks: pace.sourceCounts.tasks,
          milestones: pace.sourceCounts.milestones,
        },
        actions: [action("open-completion-trend", "Open trend", trendHref(query, "work_completed"), true)],
        updatedAt,
        ranking: {
          severity: pace.value.percentChange <= -50 ? 3 : 2,
          impact: 2,
          urgency: 2,
          confidence: pace.status === "available" ? 0.9 : 0.68,
          recency: 1,
        },
      }),
    );
  }

  const stalled = metrics.stalled_work;
  if (stalled.value && stalled.value.count >= config.thresholds.stalledMinimumItems) {
    candidates.push(
      makeCandidate({
        rule: "stalled_work",
        issueKey: "tasks:stalled",
        title: `${countPhrase(stalled.value.count, "active item has", "active items have")} been waiting without progress.`,
        summary: stalled.summary,
        whyItMatters: "Long-waiting work can be a sign that the next action is unclear.",
        state: stalled.value.count >= 5 ? "needs_attention" : "watch",
        confidence: stalled.status === "available" ? 0.88 : 0.65,
        query,
        metrics,
        metricKey: "stalled_work",
        reasons: [stalled.summary],
        sources: stalled.sources,
        evidenceCount: stalled.evidenceCount,
        sourceCounts: {
          notes: stalled.sourceCounts.notes,
          tasks: stalled.sourceCounts.tasks,
          milestones: stalled.sourceCounts.milestones,
        },
        actions: [
          ...(stalled.sources[0]
            ? [action("review-stalled", "Review waiting work", stalled.sources[0].deepLink, true)]
            : []),
          action("open-age-trend", "See trend", trendHref(query, "open_work_age"), false),
        ],
        updatedAt,
        ranking: {
          severity: stalled.value.count >= 5 ? 3 : 2,
          impact: 2,
          urgency: 1,
          confidence: stalled.status === "available" ? 0.88 : 0.65,
          recency: 0.8,
        },
      }),
    );
  }

  const movement = metrics.milestone_movement;
  if (movement.value && movement.value.changeCount >= 2) {
    candidates.push(
      makeCandidate({
        rule: "milestone_movement",
        issueKey: "timeline:date-movement",
        title: `${countPhrase(movement.value.milestoneCount, "milestone has", "milestones have")} moved recently.`,
        summary: `${movement.value.changeCount} date changes produced a net movement of ${movement.value.netDays} days.`,
        whyItMatters: "Repeated date movement can compress connected work and decisions.",
        state: Math.abs(movement.value.netDays) >= 7 ? "needs_attention" : "watch",
        confidence: movement.status === "available" ? 0.95 : 0.7,
        query,
        metrics,
        metricKey: "milestone_movement",
        reasons: [movement.summary],
        sources: movement.sources,
        evidenceCount: movement.evidenceCount,
        sourceCounts: {
          notes: movement.sourceCounts.notes,
          tasks: movement.sourceCounts.tasks,
          milestones: movement.sourceCounts.milestones,
        },
        actions: [
          ...(movement.sources[0]
            ? [action("open-milestone", "Open milestone", movement.sources[0].deepLink, true)]
            : []),
          action("open-movement-trend", "See trend", trendHref(query, "milestone_movement"), false),
        ],
        updatedAt,
        ranking: {
          severity: Math.abs(movement.value.netDays) >= 7 ? 3 : 2,
          impact: 2,
          urgency: 2,
          confidence: movement.status === "available" ? 0.95 : 0.7,
          recency: 1,
        },
      }),
    );
  }

  return candidates;
}

function score(candidate: RuleCandidate, config: RuleConfiguration): number {
  const { ranking } = candidate;
  return (
    ranking.impact * config.weights.impact +
    ranking.urgency * config.weights.urgency +
    ranking.confidence * config.weights.confidence +
    ranking.recency * config.weights.recency +
    ranking.severity * config.weights.severity
  );
}

function sourceKeys(candidate: RuleCandidate): Set<string> {
  return new Set(candidate.sources.map((source) => `${source.type}:${source.id}`));
}

function overlap(left: RuleCandidate, right: RuleCandidate): number {
  const leftKeys = sourceKeys(left);
  const rightKeys = sourceKeys(right);
  if (leftKeys.size === 0 || rightKeys.size === 0) return 0;
  let shared = 0;
  for (const key of leftKeys) if (rightKeys.has(key)) shared += 1;
  return shared / Math.min(leftKeys.size, rightKeys.size);
}

function mergeCandidates(primary: RuleCandidate, related: RuleCandidate): RuleCandidate {
  const sources = [
    ...new Map(
      [...primary.sources, ...related.sources].map((source) => [
        `${source.type}:${source.id}`,
        source,
      ]),
    ).values(),
  ];
  const actions = [
    ...new Map(
      [...primary.actions, ...related.actions].map((item) => [item.id, item]),
    ).values(),
  ];
  const hasCompleteInlineEvidence =
    primary.evidenceCount === primary.sources.length &&
    related.evidenceCount === related.sources.length;
  const mergedCounts = hasCompleteInlineEvidence
    ? countSourceTypes(sources)
    : {
        notes: Math.max(primary.sourceCounts.notes, related.sourceCounts.notes),
        tasks: Math.max(primary.sourceCounts.tasks, related.sourceCounts.tasks),
        milestones: Math.max(
          primary.sourceCounts.milestones,
          related.sourceCounts.milestones,
        ),
      };
  return {
    ...primary,
    reasons: [...new Set([...primary.reasons, ...related.reasons])],
    sources,
    evidenceCount: hasCompleteInlineEvidence
      ? sources.length
      : mergedCounts.notes + mergedCounts.tasks + mergedCounts.milestones,
    sourceCounts: mergedCounts,
    actions,
    ranking: {
      severity: Math.max(primary.ranking.severity, related.ranking.severity),
      impact: Math.max(primary.ranking.impact, related.ranking.impact),
      urgency: Math.max(primary.ranking.urgency, related.ranking.urgency),
      confidence: Math.max(primary.ranking.confidence, related.ranking.confidence),
      recency: Math.max(primary.ranking.recency, related.ranking.recency),
    },
  };
}

/** Apply evidence, action, suppression, deduplication and ranking gates. */
export function rankAndSelectObservations(
  candidates: RuleCandidate[],
  now: string,
  options: RuleOptions = {},
): SignalObservation[] {
  const config = configuration(options);
  const nowTimestamp = Date.parse(now);
  const suppressions = new Map(
    (options.suppressions ?? []).map((entry) => [entry.issueKey, entry]),
  );

  const eligible = candidates.filter((candidate) => {
    const evidenceCount =
      candidate.evidenceCount;
    if (evidenceCount === 0 || candidate.actions.every((item) => !item.primary)) return false;
    if (candidate.confidence < config.thresholds.minimumConfidence) return false;
    const suppression = suppressions.get(candidate.issueKey);
    if (!suppression || Date.parse(suppression.until) <= nowTimestamp) return true;
    return (
      suppression.reason === "repeated_low_value" &&
      candidate.ranking.impact > config.thresholds.repeatedLowValueImpact
    );
  });

  const sorted = [...eligible].sort(
    (left, right) =>
      score(right, config) - score(left, config) || left.id.localeCompare(right.id),
  );
  const combined: RuleCandidate[] = [];
  for (const candidate of sorted) {
    const duplicateIndex = combined.findIndex(
      (selected) =>
        selected.issueKey === candidate.issueKey ||
        selected.evidenceCount === selected.sources.length &&
          candidate.evidenceCount === candidate.sources.length &&
          overlap(selected, candidate) >= 0.6,
    );
    if (duplicateIndex === -1) combined.push(candidate);
    else combined[duplicateIndex] = mergeCandidates(combined[duplicateIndex], candidate);
  }

  return combined.slice(0, config.maxObservations).map((candidate) => {
    const { ranking, ...observation } = candidate;
    void ranking;
    return observation;
  });
}

function responseMeta(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
): AnalyticsResponseMeta {
  return {
    scope: query.scope,
    period: query.period,
    program: query.program,
    calculatedAt: snapshot.capturedAt,
    coverage: snapshot.coverage,
    freshness: coverageFreshness(snapshot.coverage),
    ruleVersion: SIGNAL_RULE_VERSION,
  };
}

/** Production briefing orchestration. The hard cap of three cannot be configured upward. */
export function buildBriefing(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  options: RuleOptions = {},
): BriefingResponse {
  const metrics = calculateMetrics(snapshot, query, options.metricOptions);
  const candidates = buildRuleCandidates(snapshot, query, metrics, options);
  const observations = rankAndSelectObservations(
    candidates,
    snapshot.capturedAt,
    options,
  );
  const inlineSourceLimit = options.inlineSourceLimit === null
    ? Number.POSITIVE_INFINITY
    : Math.max(0, Math.min(100, options.inlineSourceLimit ?? 100));
  const responseObservations = observations.map((observation) => ({
    ...observation,
    sources: observation.sources.slice(0, inlineSourceLimit),
  }));
  const meta = responseMeta(snapshot, query);
  return {
    observations: responseObservations,
    emptyState: responseObservations.length === 0 ? briefingEmptyState(meta.freshness) : null,
    meta,
  };
}

function briefingEmptyState(
  freshness: AnalyticsResponseMeta["freshness"],
): NonNullable<BriefingResponse["emptyState"]> {
  // Same register as the ledger's coverage copy: state what is true, and
  // never name a refresh the product does not have (the read happens when
  // the reader opens Signal) or tell the reader what to do about it.
  if (freshness === "unavailable") {
    return {
      headline: "Signal cannot reach the work right now.",
      body: "The sources are out of reach, so everything in scope is still unread. Signal will have a read once they answer.",
    };
  }
  if (freshness === "stale") {
    return {
      headline: "This read is older than today.",
      body: "The last full read of these sources ran earlier than it should have. What is below is that read, not this moment.",
    };
  }
  if (freshness === "partial") {
    return {
      headline: "Signal has only part of the picture.",
      body: "What is below came from the sources that answered. The rest is still unread, not clear.",
    };
  }
  return {
    headline: "Nothing needs you right now.",
    body: "Work is moving normally.",
  };
}
