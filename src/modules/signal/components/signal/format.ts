import type {
  AnalyticsPeriod,
  ObservationState,
  SourceReference,
} from "../../lib/analytics/contracts";

export function formatInstant(value: string, timezone: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "Unknown";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(instant);
  } catch {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(instant);
  }
}

export function formatPeriod(period: AnalyticsPeriod): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: period.timezone,
  });
  const start = formatter.format(new Date(period.start));
  const exclusiveEnd = new Date(new Date(period.end).getTime() - 1);
  return `${start} to ${formatter.format(exclusiveEnd)}`;
}

export function stateLabel(state: ObservationState | "unknown"): string {
  switch (state) {
    case "on_track":
      return "On track";
    case "watch":
      return "Watch";
    case "needs_attention":
      return "Needs attention";
    case "unknown":
      return "Not enough data";
  }
}

export function sourceTypeLabel(type: SourceReference["type"]): string {
  switch (type) {
    case "task":
      return "Task";
    case "note":
      return "Note";
    case "milestone":
      return "Milestone";
    case "label":
      return "Label";
  }
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return "High confidence";
  if (confidence >= 0.65) return "Moderate confidence";
  return "Limited coverage";
}
