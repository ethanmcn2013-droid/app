import Link from "next/link";
import type {
  BreakdownKey,
  MetricKey,
  TrendsResponse,
} from "../../lib/analytics/contracts";
import { DataCoverageNotice } from "./data-coverage-notice";
import { SourceRecordList } from "./source-record-list";
import { TrendChart } from "./trend-chart";

interface TrendsViewProps {
  trends: TrendsResponse;
  metricHref: (metric: MetricKey) => string;
  breakdownHref: (breakdown: BreakdownKey) => string;
  evidenceHref: (evidenceId: string) => string;
  pageHref: (page: number) => string;
  ownerNames: Readonly<Record<string, string>>;
  projectNames: Readonly<Record<string, string>>;
}

const METRICS: ReadonlyArray<{ key: MetricKey; label: string }> = [
  { key: "work_completed", label: "Work completed" },
  { key: "open_work", label: "Open work" },
  { key: "open_overdue_work", label: "Overdue work" },
  { key: "open_work_age", label: "How long work has been waiting" },
  { key: "blocked_work", label: "Blocked work" },
  { key: "workload_distribution", label: "Ownership distribution" },
  { key: "milestone_movement", label: "Milestone movement" },
  { key: "open_decisions", label: "Open decisions" },
  { key: "follow_up_completion", label: "Follow-up completion" },
];

const BREAKDOWNS: ReadonlyArray<{ key: BreakdownKey; label: string }> = [
  { key: "project", label: "Project" },
  { key: "owner", label: "Owner" },
  { key: "status", label: "Status" },
  { key: "work_type", label: "Work type" },
];

export function TrendsView({
  trends,
  metricHref,
  breakdownHref,
  evidenceHref,
  pageHref,
  ownerNames,
  projectNames,
}: TrendsViewProps) {
  const totalPages = Math.max(
    1,
    Math.ceil(trends.pagination.total / trends.pagination.perPage),
  );
  const maxBreakdown = Math.max(
    ...(trends.breakdown?.items.map((item) => item.value) ?? [1]),
    1,
  );

  return (
    <>
      <DataCoverageNotice coverage={trends.meta.coverage} />

      <section className="signal-section" aria-labelledby="trend-explorer-heading">
        <div className="signal-section-heading">
          <div>
            <p className="signal-eyebrow">Selected metric</p>
            <h2 id="trend-explorer-heading">{trends.title}</h2>
            <p>{trends.interpretation}</p>
          </div>
        </div>

        <nav aria-label="Trend metric" className="signal-controls">
          {METRICS.map((metric) => (
            <Link
              className={
                metric.key === trends.metric
                  ? "signal-button"
                  : "signal-button-secondary"
              }
              href={metricHref(metric.key)}
              aria-current={metric.key === trends.metric ? "page" : undefined}
              key={metric.key}
            >
              {metric.label}
            </Link>
          ))}
        </nav>

        <div className="signal-panel" style={{ marginTop: "var(--space-6)" }}>
          {trends.status === "unsupported" ? (
            <div className="signal-notice" role="status">
              <h3>This metric is not available from the connected sources.</h3>
              <p>{trends.interpretation}</p>
            </div>
          ) : (
            <TrendChart
              title={trends.title}
              summary={trends.interpretation}
              points={trends.points}
              evidenceHref={evidenceHref}
              unitLabel={trends.pointUnit}
            />
          )}
          {trends.comparison ? (
            <p className="signal-chart-summary">
              Comparison: {trends.comparison.basis}
            </p>
          ) : null}
        </div>
      </section>

      <section className="signal-section signal-two-column">
        <div className="signal-panel">
          <div className="signal-section-heading">
            <div>
              <p className="signal-eyebrow">Breakdown</p>
              <h2>
                {trends.breakdown
                  ? `By ${trends.breakdown.key.replace("_", " ")}`
                  : "Choose a breakdown"}
              </h2>
            </div>
          </div>
          <nav aria-label="Trend breakdown" className="signal-actions">
            {BREAKDOWNS.map((breakdown) => (
              <Link
                className="signal-button-secondary"
                href={breakdownHref(breakdown.key)}
                aria-current={
                  trends.breakdown?.key === breakdown.key ? "page" : undefined
                }
                key={breakdown.key}
              >
                {breakdown.label}
              </Link>
            ))}
          </nav>
          {trends.breakdown ? (
            <ul className="signal-breakdown-list" style={{ marginTop: "var(--space-5)" }}>
              {trends.breakdown.items.map((item) => (
                <li className="signal-breakdown-row" key={item.key}>
                  {item.evidenceId ? (
                    <Link href={evidenceHref(item.evidenceId)} scroll={false}>
                      {item.label}
                    </Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                  <span className="signal-breakdown-track" aria-hidden="true">
                    <span
                      className="signal-breakdown-fill"
                      style={{ width: `${(item.value / maxBreakdown) * 100}%` }}
                    />
                  </span>
                  <span className="signal-queue-count">{item.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="signal-panel">
          <div className="signal-section-heading">
            <div>
              <p className="signal-eyebrow">Coverage</p>
              <h2>What this conclusion includes</h2>
            </div>
          </div>
          <div className="signal-coverage-grid">
            {Object.values(trends.meta.coverage.providers)
              .filter((provider) => provider !== undefined)
              .map((provider) => (
                <div className="signal-coverage-row" key={provider.provider}>
                  <span>{provider.provider}</span>
                  <span>
                    {provider.status} · {provider.sourceRecordCount} records
                  </span>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="signal-section" aria-labelledby="trend-records-heading">
        <div className="signal-section-heading">
          <div>
            <p className="signal-eyebrow">Underlying work</p>
            <h2 id="trend-records-heading">
              {trends.status === "unsupported"
                ? "Contributing records unavailable"
                : `${trends.pagination.total} contributing records`}
            </h2>
          </div>
        </div>
        <SourceRecordList
          records={trends.records}
          timezone={trends.meta.period.timezone}
          ownerNames={ownerNames}
          projectNames={projectNames}
          emptyMessage={
            trends.status === "unsupported"
              ? "The required connected source is unavailable. Signal has not treated missing records as an empty result."
              : undefined
          }
        />
        {totalPages > 1 ? (
          <nav className="signal-actions" aria-label="Contributing records pages">
            {trends.pagination.page > 1 ? (
              <Link
                className="signal-button-secondary"
                href={pageHref(trends.pagination.page - 1)}
              >
                Previous
              </Link>
            ) : null}
            <span className="signal-freshness">
              Page {trends.pagination.page} of {totalPages}
            </span>
            {trends.pagination.page < totalPages ? (
              <Link
                className="signal-button-secondary"
                href={pageHref(trends.pagination.page + 1)}
              >
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}
