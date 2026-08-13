/**
 * Context Rail · Analytics.
 *
 * PROSE FIRST, AND ONE WIDENING. The claims are sentences with a number set
 * into them, at reading measure, in one column: seven statements a reader can
 * go down in order. They are not seven tiles, and the numbers are set at
 * heading weight rather than at billboard weight, because a number this small
 * printed this large is the exact gesture the brief refuses.
 *
 * The Project ledger is the one place the measure widens, and it earns it by
 * being genuinely tabular: eighteen projects, four comparable fields, one
 * column the eye runs down. It is a real table, so a screen reader announces
 * the project a cell belongs to, and at narrow widths it scrolls inside its
 * own region rather than pushing the page sideways.
 *
 * THE TREND IS DRAWN ONLY WHEN IT WAS EARNED. Twelve of the thirteen worlds
 * have too little history, and every one of them gets the sentence, the count
 * of readings so far and the earliest date this could say anything. No flat
 * line, no single point, no greyed axis, no chart with a shrug on it. Where
 * the history does exist, the line is drawn once, with both endpoint values
 * printed as text beside it so the shape is never the only carrier.
 */

import type {
  AnalyticsClaimView,
  AnalyticsView,
  HomeCandidateProps,
} from "@/lib/home-layer/lab-shell";
import { Label, Masthead, Notice, Notices, Prov } from "./parts";

/** The name a project that did not resolve is allowed to carry. No metadata. */
const UNREADABLE_PROJECT = "A project that could not be read";

function Claim({ claim }: { claim: AnalyticsClaimView }) {
  return (
    <li className="rl-claim" data-status={claim.status}>
      {claim.valueLabel !== null ? (
        <p className="rl-claim-value">
          <span className="rl-claim-number">{claim.valueLabel}</span>
          <span className="rl-claim-metric">{claim.metricLabel}</span>
        </p>
      ) : (
        /* No value could be computed, so the sentence takes the slot the
           number would have taken. Nothing here renders an unknown as zero. */
        <p className="rl-claim-nonvalue">{claim.statusLine}</p>
      )}
      <h3 className="rl-claim-question">{claim.question}</h3>
      <p className="rl-claim-population">{claim.populationLine}</p>
      {claim.valueLabel !== null && claim.statusLine ? (
        <p className="rl-claim-status">{claim.statusLine}</p>
      ) : null}
      <p className="rl-claim-limit">{claim.limitationLine}</p>
      <details className="rl-claim-more">
        <summary className="rl-read-summary">{claim.evidenceLabel}</summary>
        <div className="rl-read-body">
          <dl className="rl-facts">
            <div className="rl-fact">
              <dt>What it counts</dt>
              <dd>{claim.definitionLine}</dd>
            </div>
            <div className="rl-fact">
              <dt>Window</dt>
              <dd>{claim.windowLine}</dd>
            </div>
            <div className="rl-fact">
              <dt>Kind of truth</dt>
              <dd>{claim.truthClassLabel}</dd>
            </div>
            <div className="rl-fact">
              <dt>Baseline</dt>
              <dd>{claim.baselineLine}</dd>
            </div>
            {claim.coverageLine ? (
              <div className="rl-fact">
                <dt>Coverage</dt>
                <dd>{claim.coverageLine}</dd>
              </div>
            ) : null}
            {claim.permissionLine ? (
              <div className="rl-fact">
                <dt>Your access</dt>
                <dd>{claim.permissionLine}</dd>
              </div>
            ) : null}
            <div className="rl-fact">
              <dt>To change it</dt>
              <dd>{claim.correctionLine}</dd>
            </div>
          </dl>
          <Label>The records behind it</Label>
          <ul className="rl-read-list">
            {claim.receipt.exclusionLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>{claim.receipt.ingestionLine}</li>
            <li>{claim.receipt.versionLine}</li>
          </ul>
        </div>
      </details>
    </li>
  );
}

/**
 * The one trend. A level series, one stroke, no fill, no grid, no axis
 * furniture: the numbers that matter are printed, not measured off a chart.
 */
function Trend({ trend }: { trend: AnalyticsView["trend"] }) {
  const source = trend.source;
  if (source.kind !== "trend" || source.points.length < 2) {
    return (
      <section className="rl-block" aria-labelledby="rl-h-trend">
        <h2 className="rl-h2" id="rl-h-trend">
          {trend.heading}
        </h2>
        <p className="rl-trend-refused">{trend.line}</p>
      </section>
    );
  }

  const points = source.points;
  const values = points.map((point) => point.value);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const span = high - low === 0 ? 1 : high - low;
  const width = 640;
  const height = 120;
  const pad = 10;
  const path = points
    .map((point, index) => {
      const x = pad + (index * (width - pad * 2)) / (points.length - 1);
      const y = pad + ((high - point.value) * (height - pad * 2)) / span;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const first = values[0] as number;
  const last = values[values.length - 1] as number;

  return (
    <section className="rl-block" aria-labelledby="rl-h-trend">
      <h2 className="rl-h2" id="rl-h-trend">
        {trend.heading}
      </h2>
      <figure className="rl-trend">
        <svg
          className="rl-trend-svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-labelledby="rl-trend-cap"
        >
          {/* The box is stretched to the column, so the strokes are told not
              to stretch with it. Without this the line thins as the page
              widens and thickens as it narrows. */}
          <line
            className="rl-trend-base"
            x1={pad}
            y1={height - pad}
            x2={width - pad}
            y2={height - pad}
            vectorEffect="non-scaling-stroke"
          />
          <path className="rl-trend-line" d={path} vectorEffect="non-scaling-stroke" />
        </svg>
        <figcaption className="rl-trend-cap" id="rl-trend-cap">
          {trend.line}
        </figcaption>
      </figure>
      <dl className="rl-facts rl-trend-ends">
        <div className="rl-fact">
          <dt>First reading</dt>
          <dd>{String(first)}</dd>
        </div>
        <div className="rl-fact">
          <dt>Last reading</dt>
          <dd>{String(last)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function AnalyticsMode(props: HomeCandidateProps) {
  const { analytics, chrome } = props;

  return (
    <>
      <Masthead
        eyebrow={chrome.modeEyebrow}
        line={analytics.headline}
        lead={analytics.leadLine}
      />

      <Notices items={analytics.disclosures} heading="What Home could not read" />

      {analytics.lens.line ? (
        <div className="rl-lens">
          <Label>{analytics.lens.projectName ?? "One project"}</Label>
          <p className="rl-lens-line">{analytics.lens.line}</p>
          {analytics.lens.closeHref ? (
            <a className="rl-inline-link" href={analytics.lens.closeHref}>
              {analytics.lens.closeLabel}
            </a>
          ) : null}
        </div>
      ) : null}

      <p className="rl-window">{analytics.windowLine}</p>
      {analytics.windowMismatchLine ? (
        <Notice tone="scope">{analytics.windowMismatchLine}</Notice>
      ) : null}

      <section className="rl-block" aria-labelledby="rl-h-claims">
        <h2 className="rl-h2" id="rl-h-claims">
          What the records support
        </h2>
        <ol className="rl-claims">
          {analytics.claims.map((claim) => (
            <Claim key={claim.id} claim={claim} />
          ))}
        </ol>
      </section>

      {analytics.exceptions.length > 0 ? (
        <section className="rl-block" aria-labelledby="rl-h-exc">
          <h2 className="rl-h2" id="rl-h-exc">
            {analytics.exceptionsHeading}
          </h2>
          <ul className="rl-exc-list">
            {analytics.exceptions.map((exception) => (
              <li className="rl-exc" key={exception.id}>
                <p className="rl-exc-head">{exception.headline}</p>
                <p className="rl-exc-suggestion">
                  <span className="rl-label-inline">Suggested</span>
                  {exception.suggestion}
                </p>
                <p className="rl-meta">
                  <Prov provenance={exception.provenance} />
                </p>
                <a className="rl-inline-link" href={exception.evidenceHref}>
                  {exception.evidenceLabel}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {analytics.ledger.length > 0 ? (
        <section className="rl-block rl-block-wide" aria-labelledby="rl-h-ledger">
          <h2 className="rl-h2" id="rl-h-ledger">
            {analytics.ledgerHeading}
            <span className="rl-h2-count">{analytics.ledger.length}</span>
          </h2>
          {analytics.ledgerCoverageLine ? (
            <p className="rl-ledger-coverage">{analytics.ledgerCoverageLine}</p>
          ) : null}
          <div
            className="rl-ledger-wrap"
            role="region"
            aria-label={analytics.ledgerHeading}
            tabIndex={0}
          >
            <table className="rl-ledger">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">How it read</th>
                  <th scope="col">Open work</th>
                  <th scope="col">Late work</th>
                </tr>
              </thead>
              <tbody>
                {analytics.ledger.map((row) => (
                  <tr key={row.projectId} data-state={row.state}>
                    <th scope="row">
                      {row.href ? (
                        <a className="rl-ledger-link" href={row.href}>
                          {row.projectName ?? UNREADABLE_PROJECT}
                        </a>
                      ) : (
                        <span className="rl-ledger-name">
                          {row.projectName ?? UNREADABLE_PROJECT}
                        </span>
                      )}
                    </th>
                    <td>{row.stateLabel}</td>
                    <td>{row.openWorkLabel}</td>
                    <td>{row.overdueLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <Trend trend={analytics.trend} />

      <p className="rl-read-line rl-block-foot">{chrome.asOf.line}</p>
    </>
  );
}
