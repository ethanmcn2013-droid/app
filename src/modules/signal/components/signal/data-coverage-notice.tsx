import type { DataCoverage } from "../../lib/analytics/contracts";

interface DataCoverageNoticeProps {
  coverage: DataCoverage;
}

export function DataCoverageNotice({ coverage }: DataCoverageNoticeProps) {
  if (coverage.status === "complete") return null;

  const providers = Object.values(coverage.providers).filter(
    (provider) => provider !== undefined,
  );
  const headline =
    coverage.status === "unavailable"
      ? "Signal cannot reach the source data right now."
      : coverage.status === "stale"
        ? "This view is using an older calculation."
        : "Some connected context is not available yet.";

  return (
    <aside className="signal-notice" role="status" aria-live="polite">
      <h2>{headline}</h2>
      <p>
        Available facts are still shown. Missing sources are excluded from every
        conclusion rather than treated as healthy work.
      </p>
      {providers.length > 0 ? (
        <div className="signal-coverage-grid" style={{ marginTop: "var(--space-5)" }}>
          {providers.map((provider) => (
            <div className="signal-coverage-row" key={provider.provider}>
              <span>{providerLabel(provider.provider)}</span>
              <span>
                {provider.status}
                {provider.issues.length > 0
                  ? ` · ${friendlyIssues(provider.issues).join("; ")}`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

const ISSUE_LABELS: Readonly<Record<string, string>> = {
  tasks_provider_not_configured: "Tasks is not connected",
  tasks_provider_failed: "Tasks is temporarily unavailable",
  notes_provider_not_configured: "Notes is not connected",
  notes_provider_failed: "Notes is temporarily unavailable",
  timeline_provider_not_configured: "Timeline is not connected",
  timeline_provider_failed: "Timeline is temporarily unavailable",
  decisions_not_structured_in_notes: "Structured decisions are not available yet",
  unlinked_notes_excluded: "Notes without an approved work link are excluded",
  note_record_actions_unsupported: "Direct Note actions are not available",
  milestone_date_history_unavailable: "Milestone date history is not available yet",
  completion_timestamp_missing_for_terminal_tasks:
    "Some completed work has no completion time",
};

function friendlyIssues(issues: string[]): string[] {
  return [...new Set(issues.map((issue) => ISSUE_LABELS[issue] ?? "Some source detail is unavailable"))];
}

function providerLabel(provider: string): string {
  return provider.length > 0
    ? provider[0].toUpperCase() + provider.slice(1)
    : "Source";
}
