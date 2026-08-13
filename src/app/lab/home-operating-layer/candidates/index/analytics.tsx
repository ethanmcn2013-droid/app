/**
 * Reading Index · Analytics.
 *
 * Prose first, and every number set at the size of a sentence rather than the
 * size of a poster. A claim is a question with an answer, then the records
 * that answer stands on: what it counted, what window it read, what it could
 * not see, and what to do if it is wrong. The receipt is one interaction away
 * because it is long, never because it is optional.
 *
 * The facts under a claim set in two columns once there is room for two, which
 * is what a records page does with a wide window and is where several hundred
 * pixels of scroll came back from. The measure itself breaks exactly once, for
 * the Project ledger: a widening that happens twice is a layout, a widening
 * that happens once is an argument about what matters.
 */

import type {
  AnalyticsClaimView,
  HomeCandidateProps,
} from "@/lib/home-layer/lab-shell";
import { Limits, PageHead, Section, ThisRead } from "./parts";

/**
 * The shell drops a Project's name when its route did not resolve, and this is
 * the only phrase this direction is allowed to put in its place. It is the
 * same wording the scope control already uses for the same fact, so the reader
 * meets one sentence for one condition rather than two.
 */
const NAME_UNREADABLE = "A project that could not be read";

function Sparkline({ points }: { points: readonly { value: number }[] }) {
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low === 0 ? 1 : high - low;
  const last = points.length - 1 === 0 ? 1 : points.length - 1;
  const path = points
    .map((point, index) => {
      const x = (index / last) * 100;
      const y = 32 - ((point.value - low) / span) * 32;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Claim({ claim, id }: { claim: AnalyticsClaimView; id: string }) {
  /**
   * What the number counted, when it read, and what it cannot say. Those three
   * change with the claim and decide whether the reader trusts it, so they are
   * on the surface. Coverage and permission join them only when there is
   * something wrong to report.
   *
   * The baseline, the truth class and the correction route are identical on
   * every claim in a window, so seven claims repeating them is seven times the
   * height and no extra information. They sit in the receipt with the counts,
   * one interaction away and never optional.
   */
  const facts = [
    claim.populationLine,
    claim.windowLine,
    claim.limitationLine,
    claim.coverageLine,
    claim.permissionLine,
  ].filter((line): line is string => typeof line === "string" && line.length > 0);

  const receiptFacts = [
    `Counted ${claim.receipt.includedCount} records. Left out ${claim.receipt.excludedCount}.`,
    ...claim.receipt.exclusionLines,
    claim.receipt.ingestionLine,
    claim.receipt.versionLine,
    claim.truthClassLabel,
    claim.baselineLine,
    claim.correctionLine,
  ];

  return (
    <Section id={id} heading={claim.question}>
      {claim.valueLabel === null ? (
        <p className="ri-claim-withheld">{claim.statusLine}</p>
      ) : (
        <p className="ri-claim-value">
          <span className="ri-claim-number">{claim.valueLabel}</span>
          <span className="ri-label">{claim.metricLabel}</span>
        </p>
      )}
      {claim.valueLabel !== null && claim.statusLine ? (
        <p className="ri-claim-withheld">{claim.statusLine}</p>
      ) : null}

      <ul className="ri-facts-list">
        {facts.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <details className="ri-receipt">
        <summary className="ri-summary">{claim.evidenceLabel}</summary>
        <div className="ri-receipt-body">
          <ul className="ri-facts-list">
            {receiptFacts.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
          <p className="ri-more">
            <a className="ri-jump" href={claim.evidenceHref}>
              {claim.evidenceLabel}
            </a>
          </p>
        </div>
      </details>
    </Section>
  );
}

export function AnalyticsMode({ props }: { props: HomeCandidateProps }) {
  const { analytics, copy } = props;

  return (
    <div className="ri-page">
      <PageHead props={props}>
        <p className="ri-standfirst">{analytics.leadLine}</p>
        {analytics.lens.line ? (
          <p className="ri-lens">
            {analytics.lens.projectName
              ? `${analytics.lens.projectName}. ${analytics.lens.line}`
              : analytics.lens.line}
            {analytics.lens.closeHref ? (
              <a href={analytics.lens.closeHref}>{analytics.lens.closeLabel}</a>
            ) : null}
          </p>
        ) : null}
        <Limits
          disclosures={analytics.disclosures}
          extra={analytics.windowMismatchLine ? [analytics.windowMismatchLine] : []}
        />
      </PageHead>

      <div className="ri-body">
        {analytics.claims.length === 0 ? (
          <p className="ri-lead">{copy.empty.analytics}</p>
        ) : null}

        {analytics.claims.map((claim, index) => (
          <Claim key={claim.id} id={`ri-claim-${index + 1}`} claim={claim} />
        ))}

        {analytics.exceptions.length > 0 ? (
          <Section id="ri-exceptions" heading={analytics.exceptionsHeading}>
            <ul className="ri-entries">
              {analytics.exceptions.map((exception) => (
                <li className="ri-entry" key={exception.id}>
                  <a className="ri-entry-link" href={exception.evidenceHref}>
                    <span aria-hidden="true" />
                    <div>
                      <h3 className="ri-entry-title">{exception.headline}</h3>
                      <span className="ri-entry-reason">
                        {exception.suggestion}
                      </span>
                      <span className="ri-facts">
                        <span className="ri-prov">
                          {exception.provenance.text}
                        </span>
                        <span>{exception.evidenceLabel}</span>
                      </span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section id="ri-trend" heading={analytics.trend.heading}>
          {analytics.trend.renderChart &&
          analytics.trend.source.kind === "trend" ? (
            <div className="ri-trend">
              <figure className="ri-trend-figure">
                <div className="ri-trend-scale" aria-hidden="true">
                  <span>
                    {Math.max(
                      ...analytics.trend.source.points.map((p) => p.value),
                    )}
                  </span>
                  <span>
                    {Math.min(
                      ...analytics.trend.source.points.map((p) => p.value),
                    )}
                  </span>
                </div>
                <Sparkline points={analytics.trend.source.points} />
                <figcaption>{analytics.trend.line}</figcaption>
              </figure>
            </div>
          ) : (
            <p className="ri-claim-withheld">{analytics.trend.line}</p>
          )}
        </Section>
      </div>

      {/*
        THE ONE WIDENING. Everything above sits in one reading measure; the
        ledger breaks it, and it is the only thing in the direction that does.
      */}
      <div className="ri-wide">
        <Section
          id="ri-ledger"
          heading={analytics.ledgerHeading}
          note={analytics.ledgerCoverageLine}
        >
          <div className="ri-scroller" tabIndex={0}>
            <table className="ri-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">State</th>
                  <th scope="col">Open work</th>
                  <th scope="col">Late</th>
                </tr>
              </thead>
              <tbody>
                {analytics.ledger.map((row) => (
                  <tr key={row.projectId}>
                    <th scope="row">
                      {row.href ? (
                        <a href={row.href}>
                          {row.projectName ?? NAME_UNREADABLE}
                        </a>
                      ) : (
                        (row.projectName ?? NAME_UNREADABLE)
                      )}
                    </th>
                    <td>{row.stateLabel}</td>
                    <td
                      className={
                        row.openWorkLabel === copy.unreadableCount
                          ? "ri-cell-unknown"
                          : undefined
                      }
                    >
                      {row.openWorkLabel}
                    </td>
                    <td
                      className={
                        row.overdueLabel === copy.unreadableCount
                          ? "ri-cell-unknown"
                          : undefined
                      }
                    >
                      {row.overdueLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <ThisRead props={props} lines={[analytics.windowLine]} />
    </div>
  );
}
