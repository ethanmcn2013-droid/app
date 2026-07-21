import type { AnalyticsResponseMeta } from "../../lib/analytics/contracts";
import { formatInstant } from "./format";

interface FreshnessIndicatorProps {
  meta: AnalyticsResponseMeta;
}

export function FreshnessIndicator({ meta }: FreshnessIndicatorProps) {
  const label =
    meta.freshness === "fresh"
      ? "Current"
      : meta.freshness === "partial"
        ? "Partial coverage"
        : meta.freshness === "stale"
          ? "Update delayed"
          : "Data unavailable";

  return (
    <span
      className="signal-freshness"
      title={`Calculated ${formatInstant(meta.calculatedAt, meta.period.timezone)}`}
    >
      <span
        aria-hidden="true"
        className="signal-freshness-dot"
        data-state={meta.freshness}
      />
      {label} · {formatInstant(meta.calculatedAt, meta.period.timezone)}
    </span>
  );
}
