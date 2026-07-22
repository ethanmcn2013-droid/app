import Link from "next/link";
import type { SignalObservation } from "../../lib/analytics/contracts";
import { ActionLink } from "./action-link";
import {
  confidenceLabel,
  formatInstant,
  formatPeriod,
  stateLabel,
} from "./format";

interface ObservationCardProps {
  observation: SignalObservation;
  evidenceHref: string;
  headingLevel?: 2 | 3;
  scopeLabel?: string;
}

export function ObservationCard({
  observation,
  evidenceHref,
  headingLevel = 2,
  scopeLabel,
}: ObservationCardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const primaryAction = observation.actions.find((action) => action.primary);
  const secondaryActions = observation.actions.filter((action) => !action.primary);
  const evidenceCount = observation.evidenceCount;

  return (
    <article className="signal-observation" data-state={observation.state}>
      <p className="signal-eyebrow">
        {stateLabel(observation.state)} · {confidenceLabel(observation.confidence)}
      </p>
      <Heading>{observation.title}</Heading>
      <p className="signal-observation-summary">{observation.summary}</p>
      <p className="signal-observation-impact">
        <strong>Why it matters:</strong> {observation.whyItMatters}
      </p>
      <div className="signal-observation-meta">
        <span>Scope: {scopeLabel ?? observation.scope.type.replace("_", " ")}</span>
        <span>{formatPeriod(observation.period)}</span>
        <span>
          {evidenceCount} evidence record{evidenceCount === 1 ? "" : "s"}
        </span>
        <span>
          Updated {formatInstant(observation.updatedAt, observation.period.timezone)}
        </span>
      </div>
      <div className="signal-actions">
        {primaryAction ? <ActionLink action={primaryAction} /> : null}
        <Link className="signal-button-secondary" href={evidenceHref} scroll={false}>
          See why
        </Link>
        {secondaryActions.slice(0, 1).map((action) => (
          <ActionLink action={action} key={action.id} />
        ))}
      </div>
    </article>
  );
}
