import { Fragment, type ReactNode } from "react";
import type {
  AnalyticsPreferences,
  OverviewResponse,
} from "../../lib/analytics/contracts";
import { resolveCardOrder } from "../../lib/analytics/preferences";
import { ActionQueue } from "./action-queue";
import { CustomizeMode } from "./customize-mode";
import { DataCoverageNotice } from "./data-coverage-notice";
import { ObservationCard } from "./observation-card";
import { LabelStatusTable } from "./label-status-table";
import { SummaryRow } from "./summary-row";
import { TrendChart } from "./trend-chart";

interface OverviewViewProps {
  overview: OverviewResponse;
  evidenceHref: (observationId: string) => string;
  preferences: AnalyticsPreferences;
  preferencesEndpoint: string;
  scopeLabel: string;
  ownerNames: Readonly<Record<string, string>>;
}

const OVERVIEW_CARDS = [
  { id: "summary", label: "Scope summary" },
  { id: "labels", label: "Labels" },
  { id: "primary_trend", label: "Primary change" },
  { id: "action_queue", label: "Actionable queue" },
  { id: "connected_context", label: "Connected context" },
] as const;

export function OverviewView({
  overview,
  evidenceHref,
  preferences,
  preferencesEndpoint,
  scopeLabel,
  ownerNames,
}: OverviewViewProps) {
  const orderedCards = resolveCardOrder(
    OVERVIEW_CARDS.map((card) => card.id),
    preferences,
  );
  const cards = new Map<string, ReactNode>([
    [
      "summary",
      <section
        key="summary"
        className="signal-overview-card"
        data-card-id="summary"
        aria-labelledby="overview-summary-heading"
      >
        <div className="signal-section-heading">
          <div>
            <p className="signal-eyebrow">At a glance</p>
            <h2 id="overview-summary-heading">What is true right now</h2>
          </div>
        </div>
        <SummaryRow items={overview.summary} evidenceHref={evidenceHref} />
      </section>,
    ],
    [
      "labels",
      <section
        key="labels"
        className="signal-overview-card"
        data-card-id="labels"
        aria-labelledby="overview-labels-heading"
      >
        <div className="signal-section-heading">
          <div>
            <p className="signal-eyebrow">Comparable work</p>
            <h2 id="overview-labels-heading">Labels and their reasons</h2>
          </div>
        </div>
        <LabelStatusTable
          labels={overview.labels}
          availability={overview.availability.labels}
          evidenceHref={evidenceHref}
          ownerNames={ownerNames}
          timezone={overview.meta.period.timezone}
        />
      </section>,
    ],
    [
      "primary_trend",
      <section
        key="primary_trend"
        className="signal-panel signal-overview-card"
        data-card-id="primary_trend"
      >
        <div className="signal-section-heading">
          <div>
            <p className="signal-eyebrow">Primary change</p>
            <h2>
              {overview.primaryTrend?.title ?? (
                overview.availability.primaryTrend === "unsupported"
                  ? "Work completion data is unavailable"
                  : "Not enough history yet"
              )}
            </h2>
          </div>
        </div>
        {overview.primaryTrend ? (
          <TrendChart
            title={overview.primaryTrend.title}
            summary={overview.primaryTrend.interpretation}
            points={overview.primaryTrend.points}
            evidenceHref={evidenceHref}
          />
        ) : (
          <p>
            {overview.availability.primaryTrend === "unsupported"
              ? "Signal has not treated missing task records as zero. This trend will return when the connected task source is available."
              : "Signal will show change once complete historical periods have trustworthy source coverage."}
          </p>
        )}
      </section>,
    ],
    [
      "action_queue",
      <section
        key="action_queue"
        className="signal-panel signal-overview-card"
        data-card-id="action_queue"
      >
        <div className="signal-section-heading">
          <div>
            <p className="signal-eyebrow">Actionable queue</p>
            <h2>Work that can be moved</h2>
          </div>
        </div>
        <ActionQueue
          items={overview.actionQueue}
          availability={overview.availability.actionQueue}
          evidenceHref={evidenceHref}
        />
      </section>,
    ],
    [
      "connected_context",
      overview.observations.length > 0 ? (
        <section
          key="connected_context"
          className="signal-overview-card"
          data-card-id="connected_context"
          aria-labelledby="overview-context-heading"
        >
          <div className="signal-section-heading">
            <div>
              <p className="signal-eyebrow">Across Notes, Tasks and Timeline</p>
              <h2 id="overview-context-heading">Connected context</h2>
            </div>
          </div>
          <ol className="signal-observation-list">
            {overview.observations.slice(0, 3).map((observation) => (
              <li key={observation.id}>
                <ObservationCard
                  observation={observation}
                  evidenceHref={evidenceHref(observation.id)}
                  headingLevel={3}
                  scopeLabel={scopeLabel}
                />
              </li>
            ))}
          </ol>
        </section>
      ) : null,
    ],
  ]);

  return (
    <>
      <DataCoverageNotice coverage={overview.meta.coverage} />

      <div className="signal-section-heading">
        <div>
          <p className="signal-eyebrow">Recommended composition</p>
          <p>Useful by default. Personalization changes presentation only.</p>
        </div>
        <CustomizeMode
          key={overview.meta.scope.workspaceId}
          cards={[...OVERVIEW_CARDS]}
          preferences={preferences}
          endpoint={preferencesEndpoint}
        />
      </div>

      <div className="signal-overview-grid">
        {orderedCards.map((cardId) => (
          <Fragment key={cardId}>{cards.get(cardId) ?? null}</Fragment>
        ))}
      </div>
    </>
  );
}
