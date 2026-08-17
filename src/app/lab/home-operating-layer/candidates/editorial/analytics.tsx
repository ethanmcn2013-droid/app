/**
 * Analytics — prose first, then one earned widening.
 *
 * Every claim is written as a question with its answer, its population, its
 * limitation and its window in reading order, and the exact records behind it
 * one disclosure away. A number with no receipt is not a claim, it is a rumour.
 *
 * The trend renders as a chart only in the one world whose history earned it.
 * Everywhere else there is a sentence and no axis: a flat line drawn from two
 * readings is a picture of nothing that looks like a picture of something.
 *
 * ROUND 1 said two things about this page and both were right. The metadata
 * "degrades into a slab — four to five sentences of near-identical grey in an
 * undifferentiated stack with no fielding, no rules and no weight change." It
 * is now a fielded ledger: each sentence has a term in the margin naming what
 * sort of fact it is, so the eye can go straight to the limit or straight to
 * the window. And the Project ledger, which is the one genuinely tabular thing
 * in the mode, now takes the whole page grid instead of sitting in a reading
 * measure with the canvas empty beside it.
 */

import type {
  AnalyticsClaimView,
  AnalyticsView,
  HomeCandidateProps,
} from "@/lib/home-layer/lab-shell";
import { Provenance } from "./shell";

/**
 * ROUND 4 corrected two things about how a claim is set, one compositional and
 * one semantic.
 *
 * THE FIGURE IS BOUND TO ITS CLAIM. The question began at the left of the
 * measure and the numeral sat hard against the page edge, ~800px away, and at
 * high zoom the association was lost. Another ballot protects exactly that
 * right-edge numeral as part of the three-axis ledger. Both hold: question and
 * figure are one flex line, and above 70rem a dotted leader is struck between
 * them — the contents-page device that has always bound a title to its
 * right-aligned figure. Below 70rem the figure stacks directly under its
 * question.
 *
 * THE FIELD LEDGER NOW READS TRUE ALOUD. "WHAT THE RECORDS SAY" was the term
 * over the value "No accepted baseline" — a description list stating a false
 * relationship verbatim. The truth class is now the VALUE of "Where this comes
 * from"; the baseline is the value of "Baseline"; and what a count excluded
 * surfaces under its own term, "Left out", instead of sitting unlabelled
 * inside the receipt. The fixed-slot ledger the passing ballots protect is
 * intact and gained a slot: a claim that leaves records out is now visibly
 * incomplete without them. Each term/value pair is wrapped so the pairing
 * holds in the grid as well as in the markup.
 */
function Claim({ claim }: Readonly<{ claim: AnalyticsClaimView }>) {
  return (
    <li className="ed-claim">
      <div className="ed-rowline">
        <h3 className="ed-claim-q">{claim.question}</h3>
        <span className="ed-leader" aria-hidden="true" />
        <p className="ed-figure">
          {claim.valueLabel === null ? (
            <span className="ed-withheld">No number</span>
          ) : (
            <span className="ed-figure-value">{claim.valueLabel}</span>
          )}
          <span className="ed-label">{claim.metricLabel}</span>
        </p>
      </div>

      {claim.statusLine === null ? null : <p className="ed-claim-status">{claim.statusLine}</p>}

      <dl className="ed-fields">
        <div>
          <dt>Counted</dt>
          <dd>{claim.populationLine}</dd>
        </div>
        <div>
          <dt>Cannot say</dt>
          <dd>{claim.limitationLine}</dd>
        </div>
        <div>
          <dt>Window</dt>
          <dd>{claim.windowLine}</dd>
        </div>
        {claim.coverageLine === null ? null : (
          <div>
            <dt>Coverage</dt>
            <dd>{claim.coverageLine}</dd>
          </div>
        )}
        {claim.permissionLine === null ? null : (
          <div>
            <dt>Access</dt>
            <dd>{claim.permissionLine}</dd>
          </div>
        )}
        {claim.receipt.exclusionLines.length === 0 ? null : (
          <div>
            <dt>Left out</dt>
            {claim.receipt.exclusionLines.map((line) => (
              <dd key={line}>{line}</dd>
            ))}
          </div>
        )}
        <div>
          <dt>Where this comes from</dt>
          <dd>{claim.truthClassLabel}</dd>
        </div>
        <div>
          <dt>Baseline</dt>
          <dd>{claim.baselineLine}</dd>
        </div>
      </dl>

      <details className="ed-receipt">
        <summary>{claim.evidenceLabel}</summary>
        <p>
          <span className="ed-num">{claim.receipt.includedCount}</span> records counted,{" "}
          <span className="ed-num">{claim.receipt.excludedCount}</span> left out.
        </p>
        <p>{claim.receipt.ingestionLine}</p>
        <p>{claim.receipt.versionLine}</p>
        <p>{claim.correctionLine}</p>
      </details>
    </li>
  );
}

function Trend({ analytics }: Readonly<{ analytics: AnalyticsView }>) {
  const source = analytics.trend.source;
  const points = source.kind === "trend" ? source.points : [];

  if (!analytics.trend.renderChart || points.length < 2) {
    return (
      <section className="ed-section" aria-labelledby="ed-trend">
        <div className="ed-section-head">
          <h2 id="ed-trend">{analytics.trend.heading}</h2>
        </div>
        <p className="ed-standing">{analytics.trend.line}</p>
      </section>
    );
  }

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low === 0 ? 1 : high - low;
  const width = 640;
  const height = 140;
  const line = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point.value - low) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <section className="ed-section" aria-labelledby="ed-trend">
      <div className="ed-section-head">
        <h2 id="ed-trend">{analytics.trend.heading}</h2>
        <p className="ed-section-note">
          {low} to {high} open
        </p>
      </div>
      <figure className="ed-chart">
        <svg viewBox={`0 -8 ${width} ${height + 16}`} aria-hidden="true" focusable="false">
          <polyline
            points={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            y1={height}
            x2={width}
            y2={height}
            stroke="var(--hairline)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <figcaption>{analytics.trend.line}</figcaption>
      </figure>
      <details className="ed-receipt">
        <summary>Every reading behind this line</summary>
        <ul>
          {points.map((point) => (
            <li key={point.capturedAtIso}>
              <span className="ed-num">{point.capturedAtIso.slice(0, 10)}</span> ·{" "}
              <span className="ed-num">{point.value}</span> open
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export function AnalyticsMode({ props }: Readonly<{ props: HomeCandidateProps }>) {
  const { analytics, copy } = props;

  return (
    <>
      {analytics.lens.line === null ? null : (
        <p className="ed-lens">
          {analytics.lens.projectName === null ? null : (
            <strong>{analytics.lens.projectName}. </strong>
          )}
          {analytics.lens.line}
          {analytics.lens.closeHref === null ? null : (
            <>
              {" "}
              <a href={analytics.lens.closeHref}>{analytics.lens.closeLabel}</a>
            </>
          )}
        </p>
      )}

      <section className="ed-section" aria-labelledby="ed-claims">
        <div className="ed-section-head">
          <h2 id="ed-claims">Each number, and what it counted</h2>
        </div>
        <ul className="ed-list ed-claims">
          {analytics.claims.map((claim) => (
            <Claim key={claim.id} claim={claim} />
          ))}
        </ul>
      </section>

      <Trend analytics={analytics} />

      {analytics.exceptions.length === 0 ? null : (
        <section className="ed-section" aria-labelledby="ed-exceptions">
          <div className="ed-section-head">
            <h2 id="ed-exceptions">{analytics.exceptionsHeading}</h2>
          </div>
          <ul className="ed-list ed-rows">
            {analytics.exceptions.map((exception) => (
              <li key={exception.id} className="ed-row">
                <div className="ed-row-body">
                  <h3 className="ed-row-title">{exception.headline}</h3>
                  <p className="ed-why">Suggested: {exception.suggestion}</p>
                  <ul className="ed-meta">
                    <li>
                      <Provenance provenance={exception.provenance} />
                    </li>
                    <li>
                      <a className="ed-more" href={exception.evidenceHref}>
                        {exception.evidenceLabel}
                      </a>
                    </li>
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ed-section ed-ledger" aria-labelledby="ed-ledger">
        <div className="ed-section-head">
          <h2 id="ed-ledger">{analytics.ledgerHeading}</h2>
          <p className="ed-section-note">{analytics.ledger.length} projects</p>
        </div>

        {analytics.ledger.length === 0 ? (
          <p className="ed-why ed-measure">{copy.empty.analytics}</p>
        ) : (
          <table className="ed-table">
            <caption>
              Every project in what Home is reading, including the ones it could not.
            </caption>
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">State</th>
                <th scope="col">Open</th>
                <th scope="col">Late</th>
              </tr>
            </thead>
            <tbody>
              {analytics.ledger.map((row) => (
                <tr key={row.projectId}>
                  <td data-head="Project">
                    {row.projectName === null ? (
                      <span className="ed-unnamed">A project that could not be read</span>
                    ) : row.href === null ? (
                      row.projectName
                    ) : (
                      <a href={row.href}>{row.projectName}</a>
                    )}
                  </td>
                  <td data-head="State">{row.stateLabel}</td>
                  <td className="ed-figures" data-head="Open">
                    {row.openWorkLabel === null ? copy.unreadableCount : row.openWorkLabel}
                  </td>
                  <td className="ed-figures" data-head="Late">
                    {row.overdueLabel === null ? copy.unreadableCount : row.overdueLabel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
