import type {
  AnalyticsQuery,
  AnalyticsSnapshot,
  MilestoneRecord,
  ObservationState,
  ProjectRecord,
  SignalAction,
  SignalObservation,
  SourceReference,
  TaskRecord,
  TimelineDependencyRecord,
} from "./contracts";
import { SIGNAL_RULE_VERSION } from "./rules";
import { dueExpiry } from "./time";

export interface ProjectEvidenceDetails {
  project: ProjectRecord;
  state: ObservationState;
  reasons: string[];
  progress: number | null;
  sources: SourceReference[];
}

/** Use the same deterministic project-state derivation for cards and drawers. */
export function projectsNeedingAttentionCount(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
): number {
  return snapshot.projects.reduce((count, project) => {
    return count + (projectEvidenceDetails(snapshot, query, project.id)?.state === "needs_attention" ? 1 : 0);
  }, 0);
}

export function projectEvidenceDetails(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  projectId: string,
): ProjectEvidenceDetails | null {
  const project = snapshot.projects.find((item) => item.id === projectId);
  if (!project) return null;
  const tasks = snapshot.tasks.filter((task) => task.projectIds.includes(projectId));
  const overdue = tasks.filter((task) => taskIsOverdue(task, query));
  const blocked = tasks.filter(taskIsBlocked);
  const unowned = tasks.filter((task) => !task.terminal && task.ownerIds.length === 0);
  const reasons = [
    ...(overdue.length ? [`${overdue.length} overdue.`] : []),
    ...(blocked.length ? [`${blocked.length} waiting on dependencies.`] : []),
    ...(unowned.length ? [`${unowned.length} without an owner.`] : []),
  ];
  const state: ObservationState = overdue.length || blocked.length > 1
    ? "needs_attention"
    : blocked.length || unowned.length
      ? "watch"
      : "on_track";
  const issueReasons = new Map<string, string[]>();
  addTaskReasons(issueReasons, overdue, "Overdue work in this project.");
  addTaskReasons(issueReasons, blocked, "Work waiting on a dependency in this project.");
  addTaskReasons(issueReasons, unowned, "Active work without an owner in this project.");
  const sources = tasks.flatMap((task) => {
    const taskReasons = issueReasons.get(task.id);
    return taskReasons ? [taskSource(task, taskReasons.join(" "))] : [];
  });
  const terminal = tasks.filter((task) => task.terminal).length;
  return {
    project,
    state,
    reasons: reasons.length ? reasons : ["Work is moving normally."],
    progress: tasks.length ? Math.round((terminal / tasks.length) * 100) : null,
    sources,
  };
}

export function projectEvidenceObservation(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  projectId: string,
): SignalObservation | null {
  const details = projectEvidenceDetails(snapshot, query, projectId);
  if (!details) return null;
  const title = details.state === "needs_attention"
    ? `${details.project.name} needs attention.`
    : details.state === "watch"
      ? `${details.project.name} is worth watching.`
      : `${details.project.name} is on track.`;
  return observation({
    id: `project:${projectId}`,
    type: "project_state",
    title,
    summary: details.reasons.join(" "),
    whyItMatters: "This state is derived from the project's overdue, blocked, and unowned work.",
    state: details.state,
    query,
    snapshot,
    metricKey: "open_work",
    metricValue: details.sources.length,
    unit: "items",
    comparisonBasis: "Current project records in the selected scope and filters.",
    reasons: details.reasons,
    sources: details.sources,
    actions: actionFor(details.project.deepLink, "Open project", "open-project"),
  });
}

export function attentionProjectsEvidenceObservation(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
): SignalObservation | null {
  const details = snapshot.projects
    .map((project) => projectEvidenceDetails(snapshot, query, project.id))
    .filter((item): item is ProjectEvidenceDetails => item?.state === "needs_attention");
  if (!details.length) return null;
  const sources = uniqueSources(details.flatMap((item) => item.sources));
  const count = details.length;
  return observation({
    id: "summary:projects_needing_attention",
    type: "projects_needing_attention",
    title: `${count} ${count === 1 ? "project needs" : "projects need"} attention.`,
    summary: "These projects contain overdue or materially blocked work.",
    whyItMatters: "The summary is grounded in the exact work that set each project state.",
    state: "needs_attention",
    query,
    snapshot,
    metricKey: "open_work",
    metricValue: count,
    unit: "projects",
    comparisonBasis: "Current project states in the selected scope and filters.",
    reasons: details.map((item) => `${item.project.name}: ${item.reasons.join(" ")}`),
    sources,
    actions: actionFor(details[0].project.deepLink, "Open project", "open-project"),
  });
}

export function milestoneEvidenceObservation(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  milestoneId: string,
): SignalObservation | null {
  const milestone = snapshot.milestones.find((item) => item.id === milestoneId);
  if (!milestone) return null;
  const tasks = snapshot.tasks.filter(
    (task) =>
      milestone.linkedTaskIds.includes(task.id) || task.linkedMilestoneIds.includes(milestone.id),
  );
  const notes = snapshot.notes.filter(
    (note) =>
      milestone.linkedDecisionIds.includes(note.id) || note.linkedMilestoneIds.includes(milestone.id),
  );
  const dependencies = (snapshot.timelineDependencies ?? []).filter(
    (dependency) =>
      milestone.dependencyIds.includes(dependency.id) ||
      dependency.blockedMilestoneIds.includes(milestone.id),
  );
  const overdue = tasks.filter((task) => taskIsOverdue(task, query));
  const blocked = tasks.filter(taskIsBlocked);
  const openDecisions = notes.filter((note) => note.kind === "decision" && note.state === "open");
  const unresolvedDependencies = dependencies.filter((dependency) => !dependency.resolved);
  const unresolvedCount = new Set([
    ...milestone.unresolvedDependencyIds,
    ...unresolvedDependencies.map((dependency) => dependency.id),
  ]).size;
  const issueCount = overdue.length + blocked.length + openDecisions.length + unresolvedCount;
  const reasons = [
    ...(milestone.currentDate ? [`Scheduled for ${milestone.currentDate.value}.`] : ["No milestone date is available."]),
    ...(overdue.length ? [`${overdue.length} linked work ${overdue.length === 1 ? "item is" : "items are"} overdue.`] : []),
    ...(blocked.length ? [`${blocked.length} linked work ${blocked.length === 1 ? "item is" : "items are"} blocked.`] : []),
    ...(openDecisions.length ? [`${openDecisions.length} linked ${openDecisions.length === 1 ? "decision is" : "decisions are"} open.`] : []),
    ...(unresolvedCount ? [`${unresolvedCount} ${unresolvedCount === 1 ? "dependency is" : "dependencies are"} unresolved.`] : []),
    ...(!issueCount && dependencies.length ? ["All fetched Timeline dependencies are resolved."] : []),
  ];
  const sources = uniqueSources([
    milestoneSource(milestone, "The selected Timeline milestone."),
    ...tasks.map((task) =>
      taskSource(
        task,
        taskIsBlocked(task)
          ? "Linked work waiting on a dependency."
          : taskIsOverdue(task, query)
            ? "Linked overdue work."
            : "Work linked to this milestone.",
      ),
    ),
    ...notes.map((note) => ({
      type: "note" as const,
      id: note.id,
      title: note.title,
      state: note.state,
      ownerIds: note.ownerIds,
      date: note.due?.value ?? null,
      projectIds: note.projectIds,
      deepLink: note.deepLink,
      reason: note.state === "open" ? "Open decision linked to this milestone." : "Note linked to this milestone.",
    })),
    ...dependencies.map(dependencySource),
  ]);
  return observation({
    id: `milestone:${milestone.id}`,
    type: "milestone_state",
    title: issueCount
      ? `${milestone.title} has connected work that needs review.`
      : `${milestone.title} has no unresolved connected work.`,
    summary: reasons.join(" "),
    whyItMatters: "This view resolves the milestone's permitted linked work and dependency records.",
    state: issueCount ? "needs_attention" : "on_track",
    query,
    snapshot,
    metricKey: "cross_product_milestone_risk",
    metricValue: issueCount,
    unit: "items",
    comparisonBasis: "Current linked records and fetched Timeline dependency state.",
    reasons,
    sources,
    actions: actionFor(milestone.deepLink, "Open milestone", "open-milestone"),
  });
}

function observation(input: {
  id: string;
  type: string;
  title: string;
  summary: string;
  whyItMatters: string;
  state: ObservationState;
  query: AnalyticsQuery;
  snapshot: AnalyticsSnapshot;
  metricKey: SignalObservation["metric"]["key"];
  metricValue: number;
  unit: string;
  comparisonBasis: string;
  reasons: string[];
  sources: SourceReference[];
  actions: SignalAction[];
}): SignalObservation {
  const sources = uniqueSources(input.sources);
  return {
    id: input.id,
    type: input.type,
    issueKey: input.id,
    title: input.title,
    summary: input.summary,
    whyItMatters: input.whyItMatters,
    state: input.state,
    confidence: input.snapshot.coverage.status === "complete" ? 1 : 0.6,
    scope: input.query.scope,
    period: input.query.period,
    metric: {
      key: input.metricKey,
      value: input.metricValue,
      previousValue: null,
      delta: null,
      unit: input.unit,
      comparisonBasis: input.comparisonBasis,
    },
    reasons: input.reasons,
    evidenceCount: sources.length,
    sourceCounts: {
      notes: sources.filter((source) => source.type === "note").length,
      tasks: sources.filter((source) => source.type === "task").length,
      milestones: sources.filter((source) => source.type === "milestone").length,
    },
    // This object is assembled only inside the server evidence service. Keep
    // its complete authorized source set for pagination; service.ts shapes the
    // inline observation preview before it crosses the API boundary.
    sources,
    actions: input.actions,
    updatedAt: input.snapshot.capturedAt,
    ruleVersion: SIGNAL_RULE_VERSION,
  };
}

function taskIsBlocked(task: TaskRecord): boolean {
  return !task.terminal &&
    (task.blocking.explicit || task.blocking.unresolvedDependencyIds.length > 0);
}

function taskIsOverdue(task: TaskRecord, query: AnalyticsQuery): boolean {
  return !task.terminal && task.due !== null &&
    dueExpiry(task.due, query.period.timezone) < Date.parse(query.period.end);
}

function taskSource(task: TaskRecord, reason: string): SourceReference {
  return {
    type: "task",
    id: task.id,
    title: task.title,
    state: task.status,
    ownerIds: task.ownerIds,
    date: task.due?.value ?? null,
    projectIds: task.projectIds,
    deepLink: task.deepLink,
    reason,
  };
}

function milestoneSource(milestone: MilestoneRecord, reason: string): SourceReference {
  return {
    type: "milestone",
    id: milestone.id,
    title: milestone.title,
    state: milestone.state,
    ownerIds: milestone.ownerIds,
    date: milestone.currentDate?.value ?? null,
    projectIds: [milestone.projectId],
    deepLink: milestone.deepLink,
    reason,
  };
}

function dependencySource(dependency: TimelineDependencyRecord): SourceReference {
  return {
    type: "task",
    id: `timeline-dependency:${dependency.id}`,
    title: dependency.title,
    state: dependency.state,
    ownerIds: dependency.ownerIds,
    date: dependency.date?.value ?? null,
    projectIds: [dependency.projectId],
    deepLink: dependency.deepLink,
    reason: dependency.resolved
      ? "Resolved Timeline dependency for this milestone."
      : "Unresolved Timeline dependency for this milestone.",
  };
}

function actionFor(href: string, label: string, id: string): SignalAction[] {
  return href ? [{ id, label, href, primary: true }] : [];
}

function addTaskReasons(
  target: Map<string, string[]>,
  tasks: TaskRecord[],
  reason: string,
): void {
  for (const task of tasks) {
    const bucket = target.get(task.id);
    if (bucket) bucket.push(reason);
    else target.set(task.id, [reason]);
  }
}

function uniqueSources(sources: SourceReference[]): SourceReference[] {
  return [...new Map(sources.map((source) => [`${source.type}:${source.id}`, source])).values()];
}
