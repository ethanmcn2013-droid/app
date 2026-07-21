import {
  localDateEndExclusive,
  localDateStart,
  resolvePeriod,
} from "../../lib/analytics/time";
import type { ParsedAnalyticsQuery } from "./query";

/** Apply the saved analytics-user timezone to canonical metric boundaries. */
export function normalizeAnalyticsQueryTimezone(
  query: ParsedAnalyticsQuery,
  timezone: string,
): ParsedAnalyticsQuery {
  if (query.period !== "custom") {
    const period = resolvePeriod(query.period, query.end.toISOString(), timezone);
    return {
      ...query,
      timezone,
      start: new Date(period.start),
      end: new Date(period.end),
    };
  }
  if (
    !query.customStart ||
    !query.customEnd ||
    !/^\d{4}-\d{2}-\d{2}$/.test(query.customStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(query.customEnd)
  ) {
    return { ...query, timezone };
  }
  return {
    ...query,
    timezone,
    start: new Date(localDateStart(query.customStart, timezone)),
    end: new Date(localDateEndExclusive(query.customEnd, timezone)),
  };
}
