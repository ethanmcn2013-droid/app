/**
 * Stable, UI-safe contracts for Signal's progressive analytics layer.
 *
 * Source adapters own translation from the Notes, Tasks and Timeline schemas.
 * The analytics domain never receives raw Note bodies or provider credentials.
 */

export type ISOInstant = string;
export type LocalDate = string;

/**
 * The identity spaces, named separately so they cannot be confused (ADR 0001 §1).
 *
 * Analytics used to hold three id spaces in fields all called `projectId(s)`:
 * a slugified Tasks tag, a Timeline `projects.slug`, and — nowhere — the
 * canonical Project. `service.ts` then joined a Timeline slug against a tag
 * slug as if they were the same key, so "the next milestone for this project"
 * was a coincidence rather than a fact. These brands make that a compile error.
 */
declare const IDENTITY_SPACE: unique symbol;
type Identity<Space extends string> = string & { readonly [IDENTITY_SPACE]: Space };

/**
 * A Project. Exactly one thing is a Project in Signal Studio: a Tasks
 * `workspaces.id` (ADR 0001 §1). Analytics authorizes on this and nothing else.
 */
export type ProjectId = Identity<"TasksWorkspaceId">;

/**
 * A Label (Workstream): a slugified Tasks tag. A classification of work
 * *inside* one Project. Never an identity, never an authorization boundary,
 * and never presented as a Project (D-010, ADR 0001 §1).
 */
export type LabelId = Identity<"AnalyticsLabel">;

/**
 * A Timeline `projects.slug`: a subordinate artifact key inside a Project
 * (ADR 0001 §1). It shares no namespace with either of the above.
 */
export type TimelineProjectSlug = Identity<"TimelineProjectSlug">;

/**
 * A Program: a planning-period id. A *grouping* of Projects that may widen a
 * local read scope. Never a Project, never an authorization boundary
 * (ADR 0001 §1, §7).
 */
export type ProgramId = Identity<"PlanningPeriodId">;

/** Assert a value is a canonical Project id. Every conversion is deliberate. */
export function asProjectId(value: string): ProjectId {
  return value as ProjectId;
}

/** Assert a value is a tag-derived Label id. */
export function asLabelId(value: string): LabelId {
  return value as LabelId;
}

/** Assert a value is a Timeline project slug. */
export function asTimelineProjectSlug(value: string): TimelineProjectSlug {
  return value as TimelineProjectSlug;
}

/** Assert a value is a planning-period (Program) id. */
export function asProgramId(value: string): ProgramId {
  return value as ProgramId;
}

/**
 * `"project"` is deliberately absent (D-010).
 *
 * The old `"project"` scope authorized on a slugified tag, which is not an
 * authorization boundary and never was. It now collapses into `"workspace"`,
 * and the tag arrives as `AnalyticsFilters.labelIds` — a filter, which is what
 * it always was.
 */
export type ScopeType = "workspace" | "user";

/** Every scope carries its Project boundary, including the user scope. */
export interface AnalyticsScope {
  type: ScopeType;
  /** For `workspace` this equals `workspaceId`; for `user`, a Tasks user id. */
  id: string;
  /** The canonical Project. The only authorization boundary in this domain. */
  workspaceId: ProjectId;
}

/**
 * The Program (planning-period) axis, stated explicitly rather than omitted.
 *
 * Analytics does not carry one today and must say so rather than imply an
 * unscoped read: every provider query is bound to exactly one Project
 * (`eq(tasks.workspaceId, …)`, `source_tasks_workspace_id = ?`), so a Program —
 * which spans Projects — cannot be honoured without a per-Project membership
 * proof this domain does not yet perform. Carrying the axis as a typed
 * `not_carried` keeps the absence visible in every response instead of leaving
 * a reader to assume the period was applied.
 */
export type AnalyticsProgramAxis =
  | { kind: "not_carried"; reason: "analytics_reads_a_single_project" }
  | { kind: "program"; programId: ProgramId; label: string | null };

/** The only Program value analytics can honestly produce today. */
export const PROGRAM_AXIS_NOT_CARRIED: AnalyticsProgramAxis = {
  kind: "not_carried",
  reason: "analytics_reads_a_single_project",
};

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

export type BreakdownKey = "label" | "owner" | "status" | "work_type";

export interface AnalyticsFilters {
  ownerIds?: string[];
  statuses?: string[];
  /** Tag-derived Labels to narrow the read to. A filter, never a boundary. */
  labelIds?: LabelId[];
}

export interface AnalyticsPagination {
  page: number;
  perPage: number;
}

/** Canonical input shared by services, metrics and API controllers. */
export interface AnalyticsQuery {
  scope: AnalyticsScope;
  period: AnalyticsPeriod;
  /** Declared explicitly so an absent Program can never read as an applied one. */
  program: AnalyticsProgramAxis;
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

/**
 * A tag-derived Label (Workstream) inside one Project.
 *
 * This was `ProjectRecord`, and it was nested inside a workspace — a shape
 * D-010 makes impossible, because a Project *is* the workspace. It is a
 * breakdown of work within the Project, and must never be labelled "Project".
 */
export interface LabelRecord {
  id: LabelId;
  workspaceId: ProjectId;
  name: string;
  ownerIds: string[];
  state: "on_track" | "watch" | "needs_attention" | "unknown";
  deepLink: string;
  createdAt: ISOInstant;
  updatedAt: ISOInstant;
}

export interface TaskRecord {
  id: string;
  workspaceId: ProjectId;
  labelIds: LabelId[];
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
  workspaceId: ProjectId;
  labelIds: LabelId[];
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
  workspaceId: ProjectId;
  /** Timeline's own slug. Not a Project id and not a Label id (ADR 0001 §1). */
  timelineProjectSlug: TimelineProjectSlug;
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
  workspaceId: ProjectId;
  timelineProjectSlug: TimelineProjectSlug;
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
  workspaceId: ProjectId;
  labelIds: LabelId[];
  entityType: "task" | "note" | "milestone" | "label";
  entityId: string;
  kind: AnalyticsEventKind;
  at: ISOInstant;
  /** False for superficial metadata edits that must not reset stalled-work age. */
  meaningful: boolean;
  terminalTransition?: boolean;
  fromValue?: string | null;
  toValue?: string | null;
}

export type ProviderKey = "tasks" | "notes" | "timeline" | "labels";

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
  | "label_read";

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
  labels: LabelRecord[];
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
  /** Bounded Project-wide options used by the persistent application shell. */
  navigation?: {
    labels: Array<{ id: LabelId; name: string }>;
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

export interface LabelsProvider {
  read(query: AnalyticsQuery, signal?: AbortSignal): Promise<ProviderResult<LabelRecord>>;
}

export interface ProviderBundle {
  tasks: TasksProvider;
  notes?: NotesProvider;
  timeline?: TimelineProvider;
  labels?: LabelsProvider;
}

export interface SourceReference {
  type: "task" | "note" | "milestone" | "label";
  id: string;
  title: string;
  state: string;
  ownerIds: string[];
  date: ISOInstant | LocalDate | null;
  labelIds: LabelId[];
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
    labels: number;
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
  /** Travels with every view so the declared axis is never assumed. */
  program: AnalyticsProgramAxis;
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

/**
 * One tag-derived Label row. `nextMilestone*` is deliberately absent: it used
 * to be filled by matching a Timeline slug against a tag slug, which is not a
 * relationship that exists. Timeline milestones belong to the Project, not to
 * a Label, so a per-Label next milestone cannot be derived from current data.
 */
export interface OverviewLabelRow {
  id: LabelId;
  name: string;
  state: ObservationState | "unknown";
  reasons: string[];
  progress: number | null;
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
  labels: OverviewLabelRow[];
  availability: {
    /** Whether Label state can be derived from the connected task source. */
    labels: MetricStatus;
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
