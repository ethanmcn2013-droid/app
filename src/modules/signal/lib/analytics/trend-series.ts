import type {
  AnalyticsEvent,
  AnalyticsQuery,
  AnalyticsSnapshot,
  MetricKey,
  MetricStatus,
  ProviderKey,
  TrendPoint,
} from "./contracts";

const DAY_MS = 86_400_000;

const TREND_PROVIDERS: Partial<Record<MetricKey, ProviderKey>> = {
  work_completed: "tasks",
  milestone_movement: "timeline",
  follow_up_completion: "notes",
};

/**
 * Build points only from time buckets that are wholly inside the provider's
 * successfully queried history window. This prevents missing history from
 * being zero-filled and described as a real trend.
 */
export function buildTrendPoints(
  snapshot: AnalyticsSnapshot,
  query: AnalyticsQuery,
  key: MetricKey,
): TrendPoint[] {
  const providerKey = TREND_PROVIDERS[key];
  if (!providerKey) return [];
  const coverage = snapshot.coverage.providers[providerKey];
  if (!coverage || coverage.status === "unavailable" || coverage.status === "unsupported") {
    return [];
  }

  const periodStart = new Date(query.period.start).getTime();
  const periodEnd = new Date(query.period.end).getTime();
  const coveredStart = coverage.historyStartAt
    ? Math.max(periodStart, new Date(coverage.historyStartAt).getTime())
    : periodStart;
  const coveredEnd = coverage.historyEndAt
    ? Math.min(periodEnd, new Date(coverage.historyEndAt).getTime())
    : periodEnd;
  if (!Number.isFinite(coveredStart) || !Number.isFinite(coveredEnd) || coveredStart >= coveredEnd) {
    return [];
  }

  const events = snapshot.events.filter((event) => eventMatchesMetric(event, key));
  const coveredEvents = events.filter((event) => {
    const at = new Date(event.at).getTime();
    return at >= coveredStart && at < coveredEnd;
  });
  if (!coveredEvents.length) return [];

  const duration = periodEnd - periodStart;
  const bucketMs = duration <= 93 * DAY_MS ? 7 * DAY_MS : 30 * DAY_MS;
  const points: TrendPoint[] = [];
  for (let cursor = periodStart; cursor < periodEnd; cursor += bucketMs) {
    const bucketEnd = Math.min(cursor + bucketMs, periodEnd);
    // A partial bucket could contain records but cannot safely represent zeroes
    // for the uncovered part of its interval.
    if (cursor < coveredStart || bucketEnd > coveredEnd) continue;
    const matching = coveredEvents.filter((event) => {
      const at = new Date(event.at).getTime();
      return at >= cursor && at < bucketEnd;
    });
    const annotationEvent = snapshot.events.find((event) => {
      const at = new Date(event.at).getTime();
      return at >= cursor && at < bucketEnd && isAnnotation(event);
    });
    points.push({
      start: new Date(cursor).toISOString(),
      end: new Date(bucketEnd).toISOString(),
      value: matching.length,
      label: new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: query.period.timezone,
      }).format(cursor),
      ...(annotationEvent ? { annotation: eventAnnotation(annotationEvent.kind) } : {}),
      sourceIds: matching.map((event) => event.entityId),
      evidenceId: matching.length ? `point:${key}:${new Date(cursor).toISOString()}` : null,
    });
  }
  return points;
}

/** Preserve source unavailability instead of relabelling it as missing history. */
export function resolveTrendStatus(
  metricStatus: MetricStatus,
  metricKey: MetricKey,
  pointCount: number,
): MetricStatus {
  if (metricStatus === "unsupported") return "unsupported";
  if (metricKey === "workload_distribution") return metricStatus;
  return pointCount >= 2 ? metricStatus : "insufficient_history";
}

function eventMatchesMetric(event: AnalyticsEvent, key: MetricKey): boolean {
  if (key === "work_completed") {
    return event.entityType === "task" && event.terminalTransition === true;
  }
  if (key === "milestone_movement") {
    return event.entityType === "milestone" && event.kind === "date_changed";
  }
  return key === "follow_up_completion" &&
    event.entityType === "note" &&
    event.kind === "follow_up_completed";
}

function isAnnotation(event: AnalyticsEvent): boolean {
  return [
    "date_changed",
    "decision_opened",
    "decision_resolved",
    "project_paused",
  ].includes(event.kind);
}

function eventAnnotation(kind: string): string {
  if (kind === "date_changed") return "A milestone date changed.";
  if (kind === "decision_opened") return "A decision opened.";
  if (kind === "decision_resolved") return "A decision was resolved.";
  if (kind === "project_paused") return "A project paused.";
  return "The plan changed.";
}
