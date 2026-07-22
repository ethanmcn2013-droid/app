/**
 * Stable, UI-safe contracts for Signal's progressive analytics layer.
 *
 * Source adapters own translation from the Notes, Tasks and Timeline schemas.
 * The analytics domain never receives raw Note bodies or provider credentials.
 */

export type ISOInstant = string;
export type LocalDate = string;

export type ScopeType = "workspace" | "project" | "user";

/** Every scope carries its workspace boundary, including project and user scopes. */
export interface AnalyticsScope {
  type: ScopeType;
  id: string;
  workspaceId: string;
}

/** `end` is exclusive. Both boundaries are normalized UTC instants. */
export interface AnalyticsPeriod {
  start: ISOInstant;
  end: ISOInstant;
  timezone: string;
  preset?: PeriodPreset;
}

export type PeriodPreset =
  | "four_weeks"
  | "twelve_weeks"
  | "six_months"
  | "twelve_months"
  | "custom";

export type MetricKey =
  | "work_completed"
  | "open_work"
  | "open_overdue_work"
  | "open_work_age"
  | "stalled_work"
  | "blocked_work"
  | "unowned_work"
  | "completion_pace_change"
  | "milestone_movement"
  | "open_decisions"
  | "follow_up_completion"
  | "workload_distribution"
  | "cross_product_milestone_risk";

export type BreakdownKey = "project" | "owner" | "status" | "work_type";

export interface AnalyticsFilters {
  ownerIds?: string[];
  statuses?: string[];
}

export interface AnalyticsPagination {
  page: number;
  perPage: number;
}

/** Canonical input shared by services, metrics and API controllers. */
export interface AnalyticsQuery {
  scope: AnalyticsScope;
  period: AnalyticsPeriod;
  filters?: AnalyticsFilters;
  metric?: MetricKey;
  breakdown?: BreakdownKey;
  pagination?: AnalyticsPagination;
}

/**
 * Date-only due dates expire at the end of that local calendar day.
 * Instant dates are compared directly. Adapters must not guess one form from the other.
 */
export type AnalyticsDate =
  | { kind: "date"; value: LocalDate }
  | { kind: "instant"; value: ISOInstant };

export interface PersonRef {
  id: string;
  /** Display-only name. Email addresses are intentionally excluded. */
  displayName: string | null;
}

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  ownerIds: string[];
  state: "on_track" | "watch" | "needs_attention" | "unknown";
  deepLink: string;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

export interface TaskRecord {
  id: string;
  workspaceId: string;
  projectIds: string[];
  title: string;
  status: string;
  terminal: boolean;
  ownerIds: string[];
  owners?: PersonRef[];
  due: AnalyticsDate | null;
  createdAt: ISOInstant;
  completedAt: ISOInstant | null;
  lastMeaningfulActivityAt: ISOInstant | null;
  blocking: {
    explicit: boolean;
    dependencyIds: string[];
    unresolvedDependencyIds: string[];
  };
  linkedDecisionIds: string[];
  linkedMilestoneIds: string[];
  workType: string | null;
  deepLink: string;
  updatedAt: ISOInstant;
}

/** Only structured, approved extracts enter this record. Never a raw Note body. */
export interface NoteRecord {
  id: string;
  workspaceId: string;
  projectIds: string[];
  kind: "decision" | "follow_up" | "question";
  title: string;
  state: "open" | "resolved" | "completed" | "cancelled";
  ownerIds: string[];
  due: AnalyticsDate | null;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
  completedAt: ISOInstant | null;
  linkedTaskIds: string[];
  linkedMilestoneIds: string[];
  deepLink: string;
  exposure: "approved_extract";
}

export interface MilestoneDateChange {
  from: AnalyticsDate;
  to: AnalyticsDate;
  changedAt: ISOInstant;
}

export interface MilestoneRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  state: "upcoming" | "in_flight" | "completed" | "paused" | "cancelled";
  currentDate: AnalyticsDate | null;
  dateChanges: MilestoneDateChange[];
  dependencyIds: string[];
  unresolvedDependencyIds: string[];
  linkedTaskIds: string[];
  linkedDecisionIds: string[];
  ownerIds: string[];
  deepLink: string;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

/** A permitted Timeline task referenced as a milestone dependency. */
export interface TimelineDependencyRecord {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  state: string;
  resolved: boolean;
  ownerIds: string[];
  date: AnalyticsDate | null;
  blockedMilestoneIds: string[];
  deepLink: string;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

export type AnalyticsEventKind =
  | "created"
  | "updated"
  | "status_changed"
  | "completed"
  | "assigned"
  | "blocked"
  | "unblocked"
  | "commented"
  | "date_changed"
  | "decision_opened"
  | "decision_resolved"
  | "follow_up_completed"
  | "project_paused";

export interface AnalyticsEvent {
  id: string;
  workspaceId: string;
  projectIds: string[];
  entityType: "task" | "note" | "milestone" | "project";
  entityId: string;
  kind: AnalyticsEventKind;
  at: ISOInstant;
  /** False for superficial metadata edits that must not reset stalled-work age. */
  meaningful: boolean;
  terminalTransition?: boolean;
  fromValue?: string | null;
  toValue?: string | null;
}

export type ProviderKey = "tasks" | "notes" | "timeline" | "projects";

export type ProviderCapability =
  | "task_read"
  | "task_completion_timestamps"
  | "task_status_history"
  | "task_meaningful_activity"
  | "task_dependencies"
  | "task_owners"
  | "decision_read"
  | "follow_up_read"
  | "milestone_read"
  | "milestone_date_history"
  | "cross_product_links"
  | "project_read";

export type ProviderCoverageStatus =
  | "ready"
  | "partial"
  | "stale"
  | "unavailable"
  | "unsupported";

export interface ProviderCoverage {
  provider: ProviderKey;
  status: ProviderCoverageStatus;
  capabilities: ProviderCapability[];
  historyStartAt: ISOInstant | null;
  historyEndAt: ISOInstant | null;
  calculatedAt: ISOInstant;
  staleAfter: ISOInstant | null;
  sourceRecordCount: number;
  /** Safe diagnostic codes or plain-language gaps; never source content. */
  issues: string[];
}

export interface DataCoverage {
  status: "complete" | "partial" | "stale" | "unavailable";
  providers: Partial<Record<ProviderKey, ProviderCoverage>>;
  calculatedAt: ISOInstant;
}

export interface AnalyticsSnapshot {
  scope: AnalyticsScope;
  capturedAt: ISOInstant;
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  notes: NoteRecord[];
  milestones: MilestoneRecord[];
  timelineDependencies?: TimelineDependencyRecord[];
  events: AnalyticsEvent[];
  coverage: DataCoverage;
}

export interface ProviderResult<T> {
  records: T[];
  coverage: ProviderCoverage;
}

export interface TasksProviderResult {
  tasks: TaskRecord[];
  events: AnalyticsEvent[];
  /** Bounded workspace-wide options used by the persistent application shell. */
  navigation?: {
    projects: Array<{ id: string; name: string }>;
    owners: PersonRef[];
    statuses: string[];
  };
  coverage: ProviderCoverage;
}

export interface TimelineProviderResult {
  milestones: MilestoneRecord[];
  dependencies?: TimelineDependencyRecord[];
  events: AnalyticsEvent[];
  coverage: ProviderCoverage;
}

export interface TasksProvider {
  read(query: AnalyticsQuery, signal?: AbortSignal): Promise<TasksProviderResult>;
}

export interface NotesProvider {
  read(query: AnalyticsQuery, signal?: AbortSignal): Promise<ProviderResult<NoteRecord>>;
}

export interface TimelineProvider {
  read(query: AnalyticsQuery, signal?: AbortSignal): Promise<TimelineProviderResult>;
}

export interface ProjectsProvider {
  read(query: AnalyticsQuery, signal?: AbortSignal): Promise<ProviderResult<ProjectRecord>>;
}

export interface ProviderBundle {
  tasks: TasksProvider;
  notes?: NotesProvider;
  timeline?: TimelineProvider;
  projects?: ProjectsProvider;
}

export interface SourceReference {
  type: "task" | "note" | "milestone" | "project";
  id: string;
  title: string;
  state: string;
  ownerIds: string[];
  date: ISOInstant | LocalDate | null;
  projectIds: string[];
  deepLink: string;
  reason: string;
}

export type MetricStatus =
  | "available"
  | "partial"
  | "insufficient_history"
  | "unsupported";

export interface MetricComparison {
  previousValue: number | null;
  delta: number | null;
  percentChange: number | null;
  basis: string;
}

export interface MetricResult<TValue> {
  key: MetricKey;
  status: MetricStatus;
  value: TValue | null;
  unit: "items" | "days" | "distribution" | "milestones";
  summary: string;
  comparison: MetricComparison | null;
  /** Total contributing records, independent of the bounded inline `sources`. */
  evidenceCount: number;
  sourceCounts: {
    notes: number;
    tasks: number;
    milestones: number;
    projects: number;
  };
  sources: SourceReference[];
  calculatedAt: ISOInstant;
  coverage: DataCoverage;
  metricVersion: string;
}

export interface CountMetricValue {
  count: number;
}

export interface AgeMetricValue extends CountMetricValue {
  medianDays: number | null;
  oldestDays: number | null;
}

export interface StalledMetricValue extends CountMetricValue {
  thresholdDays: number;
}

export interface BlockedMetricValue extends CountMetricValue {
  explicitCount: number;
  inferredCount: number;
  bothCount: number;
}

export interface CompletionPaceValue {
  currentCount: number;
  priorCounts: [number, number, number];
  priorMedian: number;
  delta: number;
  percentChange: number | null;
}

export interface MilestoneMovementValue {
  changeCount: number;
  milestoneCount: number;
  netDays: number;
}

export interface FollowUpCompletionValue {
  completedCount: number;
  remainingCount: number;
}

export interface WorkloadOwnerValue {
  ownerId: string;
  displayName: string | null;
  activeCount: number;
  share: number;
}

export interface WorkloadDistributionValue {
  totalActive: number;
  totalAssignments: number;
  unownedCount: number;
  owners: WorkloadOwnerValue[];
}

export interface MilestoneRiskItem {
  milestoneId: string;
  title: string;
  overdueTaskIds: string[];
  blockedTaskIds: string[];
  openDecisionIds: string[];
  unresolvedDependencyIds: string[];
  sourceTypes: Array<"tasks" | "notes" | "timeline">;
}

export interface MilestoneRiskValue {
  count: number;
  milestones: MilestoneRiskItem[];
}

export interface AnalyticsMetricValues {
  work_completed: CountMetricValue;
  open_work: CountMetricValue;
  open_overdue_work: CountMetricValue;
  open_work_age: AgeMetricValue;
  stalled_work: StalledMetricValue;
  blocked_work: BlockedMetricValue;
  unowned_work: CountMetricValue;
  completion_pace_change: CompletionPaceValue;
  milestone_movement: MilestoneMovementValue;
  open_decisions: CountMetricValue;
  follow_up_completion: FollowUpCompletionValue;
  workload_distribution: WorkloadDistributionValue;
  cross_product_milestone_risk: MilestoneRiskValue;
}

export type AnalyticsMetricBundle = {
  [K in MetricKey]: MetricResult<AnalyticsMetricValues[K]>;
};

export type ObservationState = "on_track" | "watch" | "needs_attention";

export interface SignalAction {
  id: string;
  label: string;
  href: string;
  primary: boolean;
}

export interface ObservationMetric {
  key: MetricKey;
  value: number | null;
  previousValue: number | null;
  delta: number | null;
  unit: string;
  comparisonBasis: string;
}

export interface SignalObservation {
  id: string;
  type: string;
  issueKey: string;
  title: string;
  summary: string;
  whyItMatters: string;
  state: ObservationState;
  confidence: number;
  scope: AnalyticsScope;
  period: AnalyticsPeriod;
  metric: ObservationMetric;
  reasons: string[];
  /** Total contributing records, even when `sources` is omitted or capped. */
  evidenceCount: number;
  sourceCounts: { notes: number; tasks: number; milestones: number };
  sources: SourceReference[];
  actions: SignalAction[];
  updatedAt: ISOInstant;
  ruleVersion: string;
}

export interface AnalyticsResponseMeta {
  scope: AnalyticsScope;
  period: AnalyticsPeriod;
  calculatedAt: ISOInstant;
  coverage: DataCoverage;
  freshness: "fresh" | "stale" | "partial" | "unavailable";
  ruleVersion: string;
}

export interface BriefingResponse {
  observations: SignalObservation[];
  emptyState: {
    headline: string;
    body: string;
  } | null;
  meta: AnalyticsResponseMeta;
}

export interface OverviewSummaryItem {
  id: string;
  label: string;
  value: number | string | null;
  supportingText: string;
  metricKey?: MetricKey;
  evidenceId: string | null;
}

export interface OverviewProjectRow {
  id: string;
  name: string;
  state: ObservationState | "unknown";
  reasons: string[];
  progress: number | null;
  nextMilestone: string | null;
  nextMilestoneDate: AnalyticsDate | null;
  nextMilestoneDeepLink: string | null;
  ownerIds: string[];
  evidenceId: string | null;
  deepLink: string;
}

export interface OverviewQueueItem {
  id: string;
  label: string;
  count: number;
  metricKey: MetricKey;
  evidenceId: string | null;
  action: SignalAction | null;
}

export interface TrendPoint {
  start: ISOInstant;
  end: ISOInstant;
  value: number;
  label: string;
  annotation?: string;
  sourceIds: string[];
  evidenceId: string | null;
}

export interface OverviewResponse {
  summary: OverviewSummaryItem[];
  projects: OverviewProjectRow[];
  availability: {
    /** Whether project state can be derived from the connected project/task sources. */
    projects: MetricStatus;
    /** Whether the queue includes every source it depends on. */
    actionQueue: MetricStatus;
    /** Distinguishes missing history from a currently unavailable metric source. */
    primaryTrend: MetricStatus;
  };
  primaryTrend: {
    metric: MetricKey;
    title: string;
    interpretation: string;
    points: TrendPoint[];
  } | null;
  actionQueue: OverviewQueueItem[];
  observations: SignalObservation[];
  meta: AnalyticsResponseMeta;
}

export interface BreakdownItem {
  key: string;
  label: string;
  value: number;
  sourceIds: string[];
  evidenceId: string | null;
}

export interface TrendsResponse {
  metric: MetricKey;
  /** Unit represented by each chart point; this can differ from the metric's aggregate unit. */
  pointUnit: "items" | "days" | "changes";
  title: string;
  interpretation: string;
  status: MetricStatus;
  points: TrendPoint[];
  breakdown: { key: BreakdownKey; items: BreakdownItem[] } | null;
  comparison: MetricComparison | null;
  records: SourceReference[];
  pagination: { page: number; perPage: number; total: number };
  meta: AnalyticsResponseMeta;
}

export interface EvidenceResponse {
  observation: SignalObservation;
  observed: string;
  why: string[];
  deterministicRule: string;
  comparisonBasis: string;
  records: SourceReference[];
  pagination: { page: number; perPage: number; total: number };
  actions: SignalAction[];
  meta: AnalyticsResponseMeta;
}

export interface AnalyticsPreferences {
  hiddenCardIds: string[];
  pinnedCardIds: string[];
  cardOrder: string[];
  updatedAt: ISOInstant | null;
}
