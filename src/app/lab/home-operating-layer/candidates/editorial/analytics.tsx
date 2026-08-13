/**
 * Analytics — prose first, then one earned widening.
 *
 * Every claim is written as a question with its answer, its population, its
 * limitation and its window in reading order, and the exact records behind it
 * one disclosure away. A number with no receipt is not a claim, it is a rumour.
 *
 * The page holds the reading measure the whole way down except once: the
 * Project ledger, which is a table of every project the reader can see and is
 * the one thing here that is genuinely tabular. At narrow widths it becomes a
 * stack of records rather than a sideways scroll.
 *
 * The trend renders as a chart only in the one world whose history earned it.
 * Everywhere else there is a sentence and no axis: a flat line drawn from two
 * readings is a picture of nothing that looks like a picture of something.
 */

import type {
  AnalyticsClaimView,
  AnalyticsView,
  HomeCandidateProps,
} from "@/lib/home-layer/lab-shell";
import { Disclosures, Provenance } from "./shell";

function Claim({ claim }: Readonly<{ claim: AnalyticsClaimView }>) {
  return (
    <li>
      <div className="ed-claim">
        <h3>{claim.question}</h3>

        <p className="ed-figure">
          {claim.valueLabel === null ? (
            <span className="ed-withheld">No number</span>
          ) : (
            <span className="ed-figure-value">{claim.valueLabel}</span>
          )}
          <span className="ed-label">{claim.metricLabel}</span>
        </p>

        {claim.statusLine === null ? null : <p className="ed-why">{claim.statusLine}</p>}

        <ul className="ed-claim-lines">
          <li>{claim.populationLine}</li>
          <li>{claim.limitationLine}</li>
          <li>{claim.windowLine}</li>
          {claim.coverageLine === null ? null : <li>{claim.coverageLine}</li>}
          {claim.permissionLine === null ? null : <li>{claim.permissionLine}</li>}
          <li>
            {claim.truthClassLabel} · {claim.baselineLine}
          </li>
        </ul>

        <details className="ed-receipt">
          <summary>{claim.evidenceLabel}</summary>
          <p>
            <span className="ed-num">{claim.receipt.includedCount}</span> records counted,{" "}
            <span className="ed-num">{claim.receipt.excludedCount}</span> left out.
          </p>
          {claim.receipt.exclusionLines.length === 0 ? null : (
            <ul>
              {claim.receipt.exclusionLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <p>{claim.receipt.ingestionLine}</p>
          <p>{claim.receipt.versionLine}</p>
          <p>{claim.correctionLine}</p>
        </details>
      </div>
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
        <span className="ed-label">
          {low} to {high} open
        </span>
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
      <p className="ed-lede">{analytics.leadLine}</p>
      <p className="ed-standing">
        {analytics.windowLine}
        {analytics.windowMismatchLine === null ? null : ` ${analytics.windowMismatchLine}`}
      </p>

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

      <Disclosures entries={analytics.disclosures} copy={copy} />

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
              <li key={exception.id}>
                <div className="ed-row">
                  <h3 className="ed-row-title">{exception.headline}</h3>
                  <div className="ed-row-meta">
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
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ed-section ed-ledger" aria-labelledby="ed-ledger">
        <div className="ed-section-head">
          <h2 id="ed-ledger">{analytics.ledgerHeading}</h2>
          <span className="ed-label">{analytics.ledger.length} projects</span>
        </div>

        {analytics.ledgerCoverageLine === null ? null : (
          <p className="ed-why ed-measure">{analytics.ledgerCoverageLine}</p>
        )}

        {analytics.ledger.length === 0 ? (
          <p className="ed-why ed-measure">{copy.empty.analytics}</p>
        ) : (
          <table className="ed-table">
            <caption>Every project in what Home is reading, including the ones it could not.</caption>
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
