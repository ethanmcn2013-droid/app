import type { BriefingResponse } from "../../lib/analytics/contracts";
import { DataCoverageNotice } from "./data-coverage-notice";
import { ObservationCard } from "./observation-card";

interface BriefingViewProps {
  briefing: BriefingResponse;
  evidenceHref: (observationId: string) => string;
  scopeLabel: string;
}

export function BriefingView({
  briefing,
  evidenceHref,
  scopeLabel,
}: BriefingViewProps) {
  const observations = briefing.observations.slice(0, 3);

  return (
    <>
      <DataCoverageNotice coverage={briefing.meta.coverage} />
      {observations.length > 0 ? (
        <section
          className="signal-section"
          aria-labelledby="briefing-observations-heading"
        >
          <div className="signal-section-heading">
            <div>
              <p className="signal-eyebrow">Ranked for you</p>
              <h2 id="briefing-observations-heading">
                {observations.length === 1
                  ? "One thing genuinely needs you."
                  : `${observations.length} things genuinely need you.`}
              </h2>
            </div>
          </div>
          <ol className="signal-observation-list">
            {observations.map((observation) => (
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
      ) : briefing.emptyState ? (
        <section className="signal-empty-state" aria-labelledby="signal-empty-heading">
          <div>
            <p className="signal-eyebrow">Briefing complete</p>
            <h2 id="signal-empty-heading">{briefing.emptyState.headline}</h2>
            <p>{briefing.emptyState.body}</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
