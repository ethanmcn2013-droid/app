import type {
  AnalyticsDate,
  AnalyticsMetricBundle,
  AnalyticsMetricValues,
  AnalyticsQuery,
  AnalyticsSnapshot,
  DataCoverage,
  MetricComparison,
  MetricKey,
  MetricResult,
  MetricStatus,
  MilestoneRecord,
  NoteRecord,
  ProviderCapability,
  ProviderCoverage,
  ProviderKey,
  SourceReference,
  TaskRecord,
  TimelineDependencyRecord,
} from "./contracts";
import { scopeSnapshot } from "./scope";
import {
  DAY_MS,
  analyticsDateInstant,
  dueExpiry,
  elapsedDays,
  isInPeriod,
  parseInstant,
  previousEqualPeriods,
  signedDateDifferenceDays,
  validatePeriod,
} from "./time";

export const SIGNAL_METRIC_VERSION = "signal-analytics-metrics@1.0.0";

export interface MetricOptions {
  stalledAfterDays?: number;
  upcomingMilestoneDays?: number;
}

const DEFAULT_OPTIONS: Required<MetricOptions> = {
  stalledAfterDays: 7,
  upcomingMilestoneDays: 30,
};

function provider(
  snapshot: AnalyticsSnapshot,
  key: ProviderKey,
): ProviderCoverage | undefined {
  return snapshot.coverage.providers[key];
}

function supports(
  snapshot: AnalyticsSnapshot,
  key: ProviderKey,
  capability: ProviderCapability,
): boolean {
  const value = provider(snapshot, key);
  return Boolean(
    value &&
      value.status !== "unavailable" &&
      value.status !== "unsupported" &&
      value.capabilities.includes(capability),
  );
}

function providerStatus(
  snapshot: AnalyticsSnapshot,
  key: ProviderKey,
  capability: ProviderCapability,
): MetricStatus {
  const value = provider(snapshot, key);
  if (!value || !supports(snapshot, key, capability)) return "unsupported";
  return value.status === "partial" || value.status === "stale"
    ? "partial"
    : "available";
}

function combineStatuses(statuses: MetricStatus[]): MetricStatus {
  if (statuses.every((status) => status === "unsupported")) return "unsupported";
  return statuses.some((status) => status !== "available") ? "partial" : "available";
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

function noteSource(note: NoteRecord, reason: string): SourceReference {
  return {
    type: "note",
    id: note.id,
    title: note.title,
    state: note.state,
    ownerIds: note.ownerIds,
    date: note.due?.value ?? null,
    projectIds: note.projectIds,
    deepLink: note.deepLink,
    reason,
  };
}

function milestoneSource(
  milestone: MilestoneRecord,
  reason: string,
): SourceReference {
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

function timelineDependencySource(
  dependency: TimelineDependencyRecord,
  reason: string,
): SourceReference {
  return {
    type: "task",
    id: `timeline-dependency:${dependency.id}`,
    title: dependency.title,
    state: dependency.state,
    ownerIds: dependency.ownerIds,
    date: dependency.date?.value ?? null,
    projectIds: [dependency.projectId],
    deepLink: dependency.deepLink,
    reason,
  };
}

function sourceCounts(sources: SourceReference[]): MetricResult<unknown>["sourceCounts"] {
  const unique = new Map(
    sources.map((source) => [`${source.type}:${source.id}`, source]),
  );
  return {
    notes: [...unique.values()].filter((source) => source.type === "note").length,
    tasks: [...unique.values()].filter((source) => source.type === "task").length,
    milestones: [...unique.values()].filter((source) => source.type === "milestone").length,
    projects: [...unique.values()].filter((source) => source.type === "project").length,
  };
}

function result<K extends MetricKey>(
  key: K,
  snapshot: AnalyticsSnapshot,
  input: {
    status: MetricStatus;
    value: AnalyticsMetricValues[K] | null;
    unit: MetricResult<AnalyticsMetricValues[K]>["unit"];
    summary: string;
    sources?: SourceReference[];
    comparison?: MetricComparison | null;
  },
): MetricResult<AnalyticsMetricValues[K]> {
  // Provider queries are bounded before they reach the domain layer. Keep every
  // authorized source returned by those providers here so Evidence and Trends
  // can paginate beyond the first response page. Presentation layers apply
  // their own inline limits.
  const sources = [
    ...new Map(
      (input.sources ?? []).map((source) => [
        `${source.type}:${source.id}`,
        source,
      ]),
    ).values(),
  ];
  const counts = sourceCounts(sources);
  return {
    key,
    status: input.status,
    value: input.value,
    unit: input.unit,
    summary: input.summary,
    comparison: input.comparison ?? null,
    evidenceCount: counts.notes + counts.tasks + counts.milestones + counts.projects,
    sourceCounts: counts,
    sources,
    calculatedAt: snapshot.capturedAt,
    coverage: snapshot.coverage,
    metricVersion: SIGNAL_METRIC_VERSION,
  };
}

function isOpen(task: TaskRecord): boolean {
  return !task.terminal;
}

function completionMoments(
  snapshot: AnalyticsSnapshot,
): Map<string, number[]> {
  const moments = new Map<string, number[]>();
  const canUseEvents = supports(snapshot, "tasks", "task_status_history");
  const canUseTimestamps = supports(
    snapshot,
    "tasks",
    "task_completion_timestamps",
  );

  if (canUseEvents) {
    for (const event of snapshot.events) {
      if (
        event.entityType !== "task" ||
        !(event.kind === "completed" || event.terminalTransition)
      ) {
        continue;
      }
      const at = parseInstant(event.at);
      const entries = moments.get(event.entityId) ?? [];
      if (!entries.includes(at)) entries.push(at);
      moments.set(event.entityId, entries);
    }
  }

  if (canUseTimestamps) {
    for (const task of snapshot.tasks) {
      if (!task.completedAt || moments.has(task.id)) continue;
      moments.set(task.id, [parseInstant(task.completedAt)]);
    }
  }

  return moments;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function workCompleted(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
): MetricResult<AnalyticsMetricValues["work_completed"]> {
  const eventStatus = providerStatus(snapshot, "tasks", "task_status_history");
  const timestampStatus = providerStatus(
    snapshot,
    "tasks",
    "task_completion_timestamps",
  );
  const status = combineStatuses([eventStatus, timestampStatus]);
  if (status === "unsupported") {
    return result("work_completed", snapshot, {
      status,
      value: null,
      unit: "items",
      summary: "Work completed is not available from the connected task source.",
    });
  }

  const moments = completionMoments(snapshot);
  const completed = snapshot.tasks.filter((task) => {
    const entries = moments.get(task.id);
    return entries?.some((at) => isInPeriod(at, query.period)) ?? false;
  });
  const usesHistory = supports(snapshot, "tasks", "task_status_history");
  return result("work_completed", snapshot, {
    status,
    value: { count: completed.length },
    unit: "items",
    summary: `${completed.length} ${completed.length === 1 ? "item was" : "items were"} completed in this period.`,
    sources: completed.map((task) =>
      taskSource(
        task,
        usesHistory
          ? "Moved into a completed state during this period."
          : "Completion timestamp falls in this period; transition history is unavailable.",
      ),
    ),
  });
}

function openWork(
  snapshot: AnalyticsSnapshot,
): MetricResult<AnalyticsMetricValues["open_work"]> {
  const status = providerStatus(snapshot, "tasks", "task_read");
  const tasks = status === "unsupported" ? [] : snapshot.tasks.filter(isOpen);
  return result("open_work", snapshot, {
    status,
    value: status === "unsupported" ? null : { count: tasks.length },
    unit: "items",
    summary:
      status === "unsupported"
        ? "Open work is not available from the connected task source."
        : `${tasks.length} ${tasks.length === 1 ? "item is" : "items are"} still open.`,
    sources: tasks.map((task) => taskSource(task, "This work is not in a terminal state.")),
  });
}

function overdueWork(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
): MetricResult<AnalyticsMetricValues["open_overdue_work"]> {
  const status = providerStatus(snapshot, "tasks", "task_read");
  if (status === "unsupported") {
    return result("open_overdue_work", snapshot, {
      status,
      value: null,
      unit: "items",
      summary: "Overdue work is not available from the connected task source.",
    });
  }
  const now = parseInstant(snapshot.capturedAt);
  const tasks = snapshot.tasks.filter(
    (task) =>
      isOpen(task) &&
      task.due != null &&
      dueExpiry(task.due, query.period.timezone) < now,
  );
  return result("open_overdue_work", snapshot, {
    status,
    value: { count: tasks.length },
    unit: "items",
    summary: `${tasks.length} open ${tasks.length === 1 ? "item is" : "items are"} overdue.`,
    sources: tasks.map((task) => taskSource(task, "Still open after its due date.")),
  });
}

function openWorkAge(
  snapshot: AnalyticsSnapshot,
): MetricResult<AnalyticsMetricValues["open_work_age"]> {
  const status = providerStatus(snapshot, "tasks", "task_read");
  if (status === "unsupported") {
    return result("open_work_age", snapshot, {
      status,
      value: null,
      unit: "days",
      summary: "Waiting time is not available from the connected task source.",
    });
  }
  const tasks = snapshot.tasks.filter(isOpen);
  const ages = tasks.map((task) => elapsedDays(task.createdAt, snapshot.capturedAt));
  const medianDays = median(ages);
  const oldestDays = ages.length > 0 ? Math.max(...ages) : null;
  return result("open_work_age", snapshot, {
    status,
    value: {
      count: tasks.length,
      medianDays: medianDays == null ? null : Math.round(medianDays * 10) / 10,
      oldestDays: oldestDays == null ? null : Math.round(oldestDays * 10) / 10,
    },
    unit: "days",
    summary:
      medianDays == null
        ? "There is no open work waiting."
        : `The typical open item has been waiting ${Math.round(medianDays)} days.`,
    sources: tasks
      .sort(
        (left, right) =>
          parseInstant(left.createdAt) - parseInstant(right.createdAt),
      )
      .map((task) => taskSource(task, "Age is measured from creation while work remains open.")),
  });
}

function stalledWork(
  snapshot: AnalyticsSnapshot,
  options: Required<MetricOptions>,
): MetricResult<AnalyticsMetricValues["stalled_work"]> {
  const taskStatus = providerStatus(snapshot, "tasks", "task_read");
  const activityStatus = providerStatus(
    snapshot,
    "tasks",
    "task_meaningful_activity",
  );
  if (taskStatus === "unsupported" || activityStatus === "unsupported") {
    return result("stalled_work", snapshot, {
      status: "unsupported",
      value: null,
      unit: "items",
      summary: "Waiting-time signals need meaningful activity history, which is not available yet.",
    });
  }

  const now = parseInstant(snapshot.capturedAt);
  const latestEventByTask = new Map<string, number>();
  for (const event of snapshot.events) {
    if (event.entityType !== "task" || !event.meaningful) continue;
    const at = parseInstant(event.at);
    if (at > now) continue;
    latestEventByTask.set(
      event.entityId,
      Math.max(latestEventByTask.get(event.entityId) ?? 0, at),
    );
  }
  const threshold = options.stalledAfterDays * DAY_MS;
  const tasks = snapshot.tasks.filter((task) => {
    if (!isOpen(task)) return false;
    const lastMeaningful = Math.max(
      parseInstant(task.createdAt),
      task.lastMeaningfulActivityAt
        ? parseInstant(task.lastMeaningfulActivityAt)
        : 0,
      latestEventByTask.get(task.id) ?? 0,
    );
    return now - lastMeaningful >= threshold;
  });

  return result("stalled_work", snapshot, {
    status: combineStatuses([taskStatus, activityStatus]),
    value: { count: tasks.length, thresholdDays: options.stalledAfterDays },
    unit: "items",
    summary: `${tasks.length} open ${tasks.length === 1 ? "item has" : "items have"} had no meaningful progress for ${options.stalledAfterDays} days.`,
    sources: tasks.map((task) =>
      taskSource(task, `No meaningful activity for at least ${options.stalledAfterDays} days.`),
    ),
  });
}

function blockedWork(
  snapshot: AnalyticsSnapshot,
): MetricResult<AnalyticsMetricValues["blocked_work"]> {
  const status = providerStatus(snapshot, "tasks", "task_dependencies");
  if (status === "unsupported") {
    return result("blocked_work", snapshot, {
      status,
      value: null,
      unit: "items",
      summary: "Blocked work is not available from the connected task source.",
    });
  }
  const tasks = snapshot.tasks.filter(
    (task) =>
      isOpen(task) &&
      (task.blocking.explicit || task.blocking.unresolvedDependencyIds.length > 0),
  );
  const explicitCount = tasks.filter((task) => task.blocking.explicit).length;
  const inferredCount = tasks.filter(
    (task) => task.blocking.unresolvedDependencyIds.length > 0,
  ).length;
  const bothCount = tasks.filter(
    (task) =>
      task.blocking.explicit && task.blocking.unresolvedDependencyIds.length > 0,
  ).length;
  return result("blocked_work", snapshot, {
    status,
    value: { count: tasks.length, explicitCount, inferredCount, bothCount },
    unit: "items",
    summary: `${tasks.length} open ${tasks.length === 1 ? "item is" : "items are"} waiting on something.`,
    sources: tasks.map((task) =>
      taskSource(
        task,
        task.blocking.explicit && task.blocking.unresolvedDependencyIds.length > 0
          ? "Marked blocked and has an unresolved dependency."
          : task.blocking.explicit
            ? "Explicitly marked as blocked."
            : "Has an unresolved dependency; inferred separately from explicit blocking.",
      ),
    ),
  });
}

function unownedWork(
  snapshot: AnalyticsSnapshot,
): MetricResult<AnalyticsMetricValues["unowned_work"]> {
  const status = providerStatus(snapshot, "tasks", "task_owners");
  if (status === "unsupported") {
    return result("unowned_work", snapshot, {
      status,
      value: null,
      unit: "items",
      summary: "Ownership information is not available from the connected task source.",
    });
  }
  const tasks = snapshot.tasks.filter((task) => isOpen(task) && task.ownerIds.length === 0);
  return result("unowned_work", snapshot, {
    status,
    value: { count: tasks.length },
    unit: "items",
    summary: `${tasks.length} active ${tasks.length === 1 ? "item has" : "items have"} no owner.`,
    sources: tasks.map((task) => taskSource(task, "Active work has no owner.")),
  });
}

function completionPace(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
): MetricResult<AnalyticsMetricValues["completion_pace_change"]> {
  const eventStatus = providerStatus(snapshot, "tasks", "task_status_history");
  const timestampStatus = providerStatus(
    snapshot,
    "tasks",
    "task_completion_timestamps",
  );
  const status = combineStatuses([eventStatus, timestampStatus]);
  if (status === "unsupported") {
    return result("completion_pace_change", snapshot, {
      status,
      value: null,
      unit: "items",
      summary: "Completion pace needs completion history, which is not available yet.",
    });
  }

  const periods = previousEqualPeriods(query.period, 3);
  const oldestStart = parseInstant(periods[2].start);
  const tasksCoverage = provider(snapshot, "tasks");
  const historyStart = tasksCoverage?.historyStartAt
    ? parseInstant(tasksCoverage.historyStartAt)
    : Number.POSITIVE_INFINITY;
  const historyEnd = tasksCoverage?.historyEndAt
    ? parseInstant(tasksCoverage.historyEndAt)
    : Number.NEGATIVE_INFINITY;
  if (
    historyStart > oldestStart ||
    historyEnd < parseInstant(query.period.end)
  ) {
    return result("completion_pace_change", snapshot, {
      status: "insufficient_history",
      value: null,
      unit: "items",
      summary: "Not enough history yet. Signal needs three earlier comparable periods.",
    });
  }

  const moments = completionMoments(snapshot);
  const countIn = (period: AnalyticsQuery["period"]) =>
    [...moments.values()].filter((entries) =>
      entries.some((at) => isInPeriod(at, period)),
    ).length;
  const currentCount = countIn(query.period);
  const priorCounts = periods.map(countIn) as [number, number, number];
  const priorMedian = median(priorCounts) ?? 0;
  const delta = currentCount - priorMedian;
  const change = percentChange(currentCount, priorMedian);
  const sources = snapshot.tasks.filter((task) => {
    const entries = moments.get(task.id);
    return entries?.some((at) => isInPeriod(at, query.period)) ?? false;
  });

  return result("completion_pace_change", snapshot, {
    status,
    value: {
      currentCount,
      priorCounts,
      priorMedian,
      delta,
      percentChange: change,
    },
    unit: "items",
    summary:
      delta === 0
        ? "Work completed is in line with the recent range."
        : `Work completed is moving ${delta > 0 ? "faster" : "more slowly"} than the median of the prior three periods.`,
    comparison: {
      previousValue: priorMedian,
      delta,
      percentChange: change,
      basis: `Compared with the median of three equal-length periods (${priorCounts.join(", ")} completed).`,
    },
    sources: sources.map((task) =>
      taskSource(task, "Completed during the current comparison period."),
    ),
  });
}

function milestoneMovement(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
): MetricResult<AnalyticsMetricValues["milestone_movement"]> {
  const status = providerStatus(snapshot, "timeline", "milestone_date_history");
  if (status === "unsupported") {
    return result("milestone_movement", snapshot, {
      status,
      value: null,
      unit: "days",
      summary: "Milestone movement needs stored date history, which is not available yet.",
    });
  }

  let changeCount = 0;
  let netDays = 0;
  const moved: MilestoneRecord[] = [];
  for (const milestone of snapshot.milestones) {
    const changes = milestone.dateChanges
      .filter((change) => isInPeriod(parseInstant(change.changedAt), query.period))
      .sort((left, right) => parseInstant(left.changedAt) - parseInstant(right.changedAt));
    if (changes.length === 0) continue;
    changeCount += changes.length;
    netDays += signedDateDifferenceDays(
      changes[0].from,
      changes[changes.length - 1].to,
      query.period.timezone,
    );
    moved.push(milestone);
  }
  return result("milestone_movement", snapshot, {
    status,
    value: { changeCount, milestoneCount: moved.length, netDays },
    unit: "days",
    summary: `${moved.length} ${moved.length === 1 ? "milestone moved" : "milestones moved"} ${changeCount} ${changeCount === 1 ? "time" : "times"} in this period.`,
    sources: moved.map((milestone) =>
      milestoneSource(milestone, "Its stored date history includes a change in this period."),
    ),
  });
}

function openDecisions(
  snapshot: AnalyticsSnapshot,
): MetricResult<AnalyticsMetricValues["open_decisions"]> {
  const status = providerStatus(snapshot, "notes", "decision_read");
  if (status === "unsupported") {
    return result("open_decisions", snapshot, {
      status,
      value: null,
      unit: "items",
      summary: "Structured decisions are not available from the connected Notes source.",
    });
  }
  const notes = snapshot.notes.filter(
    (note) => note.kind === "decision" && note.state === "open",
  );
  return result("open_decisions", snapshot, {
    status,
    value: { count: notes.length },
    unit: "items",
    summary: `${notes.length} structured ${notes.length === 1 ? "decision is" : "decisions are"} still open.`,
    sources: notes.map((note) => noteSource(note, "Structured decision remains unresolved.")),
  });
}

function followUpCompletion(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
): MetricResult<AnalyticsMetricValues["follow_up_completion"]> {
  const status = providerStatus(snapshot, "notes", "follow_up_read");
  if (status === "unsupported") {
    return result("follow_up_completion", snapshot, {
      status,
      value: null,
      unit: "items",
      summary: "Structured follow-ups are not available from the connected Notes source.",
    });
  }
  const followUps = snapshot.notes.filter((note) => note.kind === "follow_up");
  const completed = followUps.filter(
    (note) =>
      note.completedAt != null &&
      isInPeriod(parseInstant(note.completedAt), query.period),
  );
  const remaining = followUps.filter((note) => note.state === "open");
  const completedWithoutVerifiedTime = followUps.filter(
    (note) => note.state === "completed" && note.completedAt === null,
  );
  if (completedWithoutVerifiedTime.length > 0) {
    return result("follow_up_completion", snapshot, {
      status: "partial",
      value: null,
      unit: "items",
      summary: `Follow-up completion is incomplete because ${completedWithoutVerifiedTime.length} completed ${completedWithoutVerifiedTime.length === 1 ? "follow-up lacks" : "follow-ups lack"} a verified completion time.`,
      sources: [
        ...remaining.map((note) => noteSource(note, "Structured follow-up remains open.")),
        ...completed.map((note) => noteSource(note, "Completed during this period.")),
        ...completedWithoutVerifiedTime.map((note) =>
          noteSource(note, "Marked completed, but its canonical completion time is unavailable."),
        ),
      ],
    });
  }
  return result("follow_up_completion", snapshot, {
    status,
    value: { completedCount: completed.length, remainingCount: remaining.length },
    unit: "items",
    summary: `${completed.length} follow-ups were completed; ${remaining.length} remain open.`,
    sources: [
      ...remaining.map((note) => noteSource(note, "Structured follow-up remains open.")),
      ...completed.map((note) => noteSource(note, "Completed during this period.")),
    ],
  });
}

function workloadDistribution(
  snapshot: AnalyticsSnapshot,
): MetricResult<AnalyticsMetricValues["workload_distribution"]> {
  const status = providerStatus(snapshot, "tasks", "task_owners");
  if (status === "unsupported") {
    return result("workload_distribution", snapshot, {
      status,
      value: null,
      unit: "distribution",
      summary: "Workload distribution needs ownership data, which is not available yet.",
    });
  }
  const active = snapshot.tasks.filter(isOpen);
  const assignments = new Map<string, { count: number; displayName: string | null }>();
  for (const task of active) {
    for (const ownerId of task.ownerIds) {
      const owner = task.owners?.find((candidate) => candidate.id === ownerId);
      const current = assignments.get(ownerId) ?? {
        count: 0,
        displayName: owner?.displayName ?? null,
      };
      current.count += 1;
      if (!current.displayName && owner?.displayName) current.displayName = owner.displayName;
      assignments.set(ownerId, current);
    }
  }
  const totalAssignments = [...assignments.values()].reduce(
    (total, owner) => total + owner.count,
    0,
  );
  const owners = [...assignments.entries()]
    .map(([ownerId, owner]) => ({
      ownerId,
      displayName: owner.displayName,
      activeCount: owner.count,
      share: totalAssignments === 0 ? 0 : owner.count / totalAssignments,
    }))
    .sort(
      (left, right) =>
        right.activeCount - left.activeCount || left.ownerId.localeCompare(right.ownerId),
    );
  const unowned = active.filter((task) => task.ownerIds.length === 0);
  return result("workload_distribution", snapshot, {
    status,
    value: {
      totalActive: active.length,
      totalAssignments,
      unownedCount: unowned.length,
      owners,
    },
    unit: "distribution",
    summary: `${active.length} active items are distributed across ${owners.length} ${owners.length === 1 ? "owner" : "owners"}. This is workload, not individual productivity.`,
    sources: active.map((task) => taskSource(task, "Included in active workload distribution.")),
  });
}

function sameDateIdentifier(date: AnalyticsDate | null): string | null {
  return date?.value ?? null;
}

function milestoneRisk(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  options: Required<MetricOptions>,
): MetricResult<AnalyticsMetricValues["cross_product_milestone_risk"]> {
  const taskStatus = providerStatus(snapshot, "tasks", "task_read");
  const timelineStatus = providerStatus(snapshot, "timeline", "milestone_read");
  if (taskStatus === "unsupported" || timelineStatus === "unsupported") {
    return result("cross_product_milestone_risk", snapshot, {
      status: "unsupported",
      value: null,
      unit: "milestones",
      summary: "Milestone risk needs connected Tasks and Timeline records.",
    });
  }

  const noteStatus = providerStatus(snapshot, "notes", "decision_read");
  const linkStatus = combineStatuses([
    providerStatus(snapshot, "tasks", "cross_product_links"),
    providerStatus(snapshot, "timeline", "cross_product_links"),
  ]);
  const status = combineStatuses([taskStatus, timelineStatus, noteStatus, linkStatus]);
  const now = parseInstant(snapshot.capturedAt);
  const windowEnd = now + options.upcomingMilestoneDays * DAY_MS;
  const taskById = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const noteById = new Map(snapshot.notes.map((note) => [note.id, note]));
  const dependencyById = new Map(
    (snapshot.timelineDependencies ?? []).map((dependency) => [dependency.id, dependency]),
  );
  const riskItems: AnalyticsMetricValues["cross_product_milestone_risk"]["milestones"] = [];
  const sources: SourceReference[] = [];

  for (const milestone of snapshot.milestones) {
    if (
      !milestone.currentDate ||
      milestone.state === "completed" ||
      milestone.state === "cancelled"
    ) {
      continue;
    }
    const date =
      milestone.currentDate.kind === "date"
        ? dueExpiry(milestone.currentDate, query.period.timezone)
        : analyticsDateInstant(milestone.currentDate, query.period.timezone);
    if (date < now || date > windowEnd) continue;

    const connectedTasks = new Map<string, TaskRecord>();
    for (const id of milestone.linkedTaskIds) {
      const task = taskById.get(id);
      if (task) connectedTasks.set(id, task);
    }
    for (const task of snapshot.tasks) {
      if (task.linkedMilestoneIds.includes(milestone.id)) connectedTasks.set(task.id, task);
    }
    const tasks = [...connectedTasks.values()];
    const overdue = tasks.filter(
      (task) =>
        isOpen(task) &&
        task.due != null &&
        dueExpiry(task.due, query.period.timezone) < now,
    );
    const blocked = tasks.filter(
      (task) =>
        isOpen(task) &&
        (task.blocking.explicit || task.blocking.unresolvedDependencyIds.length > 0),
    );

    const connectedDecisions = new Map<string, NoteRecord>();
    for (const id of milestone.linkedDecisionIds) {
      const note = noteById.get(id);
      if (note) connectedDecisions.set(id, note);
    }
    for (const note of snapshot.notes) {
      if (note.linkedMilestoneIds.includes(milestone.id)) connectedDecisions.set(note.id, note);
    }
    for (const task of tasks) {
      for (const id of task.linkedDecisionIds) {
        const note = noteById.get(id);
        if (note) connectedDecisions.set(id, note);
      }
    }
    const openDecisionRecords = [...connectedDecisions.values()].filter(
      (note) => note.kind === "decision" && note.state === "open",
    );
    const candidateDependencyIds = [
      ...new Set([
        ...milestone.unresolvedDependencyIds,
        ...blocked.flatMap((task) => task.blocking.unresolvedDependencyIds),
      ]),
    ];
    // A missing provider row is unknown, not deterministic evidence that the
    // dependency is unresolved. The Timeline provider marks coverage partial;
    // only fetched, non-terminal dependencies may create a risk claim.
    const unresolvedDependencies = candidateDependencyIds.flatMap((id) => {
      const dependency = dependencyById.get(id);
      return dependency && !dependency.resolved ? [dependency] : [];
    });
    const unresolvedDependencyIds = unresolvedDependencies.map(
      (dependency) => dependency.id,
    );

    if (
      overdue.length === 0 &&
      blocked.length === 0 &&
      openDecisionRecords.length === 0 &&
      unresolvedDependencyIds.length === 0
    ) {
      continue;
    }

    const sourceTypes: Array<"tasks" | "notes" | "timeline"> = ["timeline"];
    if (overdue.length > 0 || blocked.length > 0) sourceTypes.push("tasks");
    if (openDecisionRecords.length > 0) sourceTypes.push("notes");
    riskItems.push({
      milestoneId: milestone.id,
      title: milestone.title,
      overdueTaskIds: overdue.map((task) => task.id),
      blockedTaskIds: blocked.map((task) => task.id),
      openDecisionIds: openDecisionRecords.map((note) => note.id),
      unresolvedDependencyIds,
      sourceTypes,
    });
    sources.push(
      milestoneSource(
        milestone,
        `Upcoming milestone ${sameDateIdentifier(milestone.currentDate) ?? ""} has connected unresolved work.`,
      ),
      ...overdue.map((task) => taskSource(task, "Overdue work connected to this milestone.")),
      ...blocked.map((task) => taskSource(task, "Blocked work connected to this milestone.")),
      ...openDecisionRecords.map((note) =>
        noteSource(note, "Open decision connected to this milestone."),
      ),
      ...unresolvedDependencies.map((dependency) =>
        timelineDependencySource(
          dependency,
          "Unresolved Timeline dependency connected to this milestone.",
        ),
      ),
    );
  }

  return result("cross_product_milestone_risk", snapshot, {
    status,
    value: { count: riskItems.length, milestones: riskItems },
    unit: "milestones",
    summary: `${riskItems.length} upcoming ${riskItems.length === 1 ? "milestone has" : "milestones have"} connected unresolved work.`,
    sources,
  });
}

/** Calculate every deterministic metric once for a normalized, already-authorized snapshot. */
export function calculateMetrics(
  input: AnalyticsSnapshot,
  query: AnalyticsQuery,
  metricOptions: MetricOptions = {},
): AnalyticsMetricBundle {
  validatePeriod(query.period);
  const snapshot = scopeSnapshot(input, query);
  const options = { ...DEFAULT_OPTIONS, ...metricOptions };
  if (options.stalledAfterDays <= 0 || options.upcomingMilestoneDays <= 0) {
    throw new RangeError("Metric thresholds must be positive");
  }

  return {
    work_completed: workCompleted(snapshot, query),
    open_work: openWork(snapshot),
    open_overdue_work: overdueWork(snapshot, query),
    open_work_age: openWorkAge(snapshot),
    stalled_work: stalledWork(snapshot, options),
    blocked_work: blockedWork(snapshot),
    unowned_work: unownedWork(snapshot),
    completion_pace_change: completionPace(snapshot, query),
    milestone_movement: milestoneMovement(snapshot, query),
    open_decisions: openDecisions(snapshot),
    follow_up_completion: followUpCompletion(snapshot, query),
    workload_distribution: workloadDistribution(snapshot),
    cross_product_milestone_risk: milestoneRisk(snapshot, query, options),
  };
}

export function calculateMetric<K extends MetricKey>(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  key: K,
  options: MetricOptions = {},
): MetricResult<AnalyticsMetricValues[K]> {
  return calculateMetrics(snapshot, query, options)[key];
}

/** Exposed for response builders that need freshness without reinterpreting coverage. */
export function coverageFreshness(
  coverage: DataCoverage,
): "fresh" | "stale" | "partial" | "unavailable" {
  const providerStatuses = Object.values(coverage.providers).map(
    (item) => item?.status,
  );
  if (
    coverage.status === "unavailable" ||
    providerStatuses.length > 0 &&
      providerStatuses.every(
        (status) => status === "unavailable" || status === "unsupported",
      )
  ) {
    return "unavailable";
  }
  if (
    coverage.status === "stale" ||
    providerStatuses.some((status) => status === "stale")
  ) {
    return "stale";
  }
  if (
    coverage.status === "partial" ||
    providerStatuses.some(
      (status) =>
        status === "partial" || status === "unavailable" || status === "unsupported",
    )
  ) {
    return "partial";
  }
  return "fresh";
}
