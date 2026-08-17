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
import { Fields, Page, Section } from "./parts";

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

/**
 * The window most of the claims were read over, stated once above them.
 *
 * Seven claims repeating "Over four weeks, in Europe/Dublin." is seven times
 * the height and no extra information, and it is roughly 280px of the tallest
 * document in the lab. So the shared window becomes a line under the standfirst
 * and a claim only carries its own WINDOW field when it read a different one,
 * which is exactly when the reader needs to be told.
 */
function sharedWindow(claims: readonly AnalyticsClaimView[]): string | null {
  const counts = new Map<string, number>();
  for (const claim of claims) {
    counts.set(claim.windowLine, (counts.get(claim.windowLine) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 1;
  for (const [line, count] of counts) {
    if (count > bestCount) {
      best = line;
      bestCount = count;
    }
  }
  return best;
}

function Claim({
  claim,
  id,
  window: sharedWindowLine,
}: {
  claim: AnalyticsClaimView;
  id: string;
  /** Stated above the claims. A claim repeats it only when it differs. */
  window: string | null;
}) {
  /**
   * EVERY FACT UNDER A CLAIM IS NAMED AS THE KIND OF FACT IT IS.
   *
   * Round 2 set these as an unlabelled grey run, and a director put the cost
   * exactly: the sentence "Done means the column named Done in this Project"
   * sat beside the number 19 with no word saying it was the claim's limit
   * rather than more description. Same facts, weaker trust. So each one takes
   * its field name, and the two that round 2 buried come back to the surface:
   *
   *   LEFT OUT   a count is not visible together with what was excluded from
   *              it if the exclusion lives behind a control. The total and the
   *              fact that there IS a total left out are here; the reason for
   *              each exclusion is in the receipt.
   *   BASELINE   "No accepted baseline" is not decoration. It says the number
   *              has no reference point, and it belongs on every claim that
   *              has none, not on none of them.
   *
   * The truth class and the correction route are identical on every claim in a
   * window, so seven claims repeating them is seven times the height and no
   * extra information. They stay in the receipt.
   */
  const fields = [
    { label: "Counted", value: claim.populationLine },
    claim.receipt.excludedCount > 0
      ? {
          label: "Left out",
          value: `${claim.receipt.excludedCount} of ${
            claim.receipt.includedCount + claim.receipt.excludedCount
          } records were left out of this.`,
        }
      : null,
    claim.windowLine === sharedWindowLine
      ? null
      : { label: "Window", value: claim.windowLine },
    { label: "Cannot say", value: claim.limitationLine },
    { label: "Baseline", value: claim.baselineLine },
    claim.coverageLine ? { label: "Coverage", value: claim.coverageLine } : null,
    claim.permissionLine ? { label: "Access", value: claim.permissionLine } : null,
  ].filter(
    (field): field is Readonly<{ label: string; value: string }> => field !== null,
  );

  const receiptFacts = [
    ...claim.receipt.exclusionLines,
    claim.receipt.ingestionLine,
    claim.receipt.versionLine,
    claim.truthClassLabel,
    claim.correctionLine,
  ];

  return (
    <Section id={id} heading={claim.question} tier="claim">
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

      <Fields fields={fields} />

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
  const window = sharedWindow(analytics.claims);

  return (
    <Page
      props={props}
      disclosures={analytics.disclosures}
      extra={analytics.windowMismatchLine ? [analytics.windowMismatchLine] : []}
      head={
        <>
          <p className="ri-standfirst">{analytics.leadLine}</p>
          {window ? <p className="ri-window">{window}</p> : null}
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
        </>
      }
      wide={
        /*
          THE ONE WIDENING. Everything above sits in one reading measure; the
          ledger breaks it and runs the whole sheet, and it is the only thing
          in the direction that does. LAB_BRIEF Amendment 1 names this as a
          legitimate use of the width, and it is the one place where a
          Project-by-Project account genuinely wants columns.
        */
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
                        <a href={row.href}>{row.projectName ?? NAME_UNREADABLE}</a>
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
      }
    >
      {analytics.claims.length === 0 && !props.firstRun ? (
        <p className="ri-lead">{copy.empty.analytics}</p>
      ) : null}

      {analytics.claims.map((claim, index) => (
        <Claim
          key={claim.id}
          id={`ri-claim-${index + 1}`}
          claim={claim}
          window={window}
        />
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
                    <span className="ri-entry-reason">{exception.suggestion}</span>
                    <span className="ri-facts">
                      <span className="ri-prov">{exception.provenance.text}</span>
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
        {analytics.trend.renderChart && analytics.trend.source.kind === "trend" ? (
          <div className="ri-trend">
            <figure className="ri-trend-figure">
              <div className="ri-trend-scale" aria-hidden="true">
                <span>
                  {Math.max(...analytics.trend.source.points.map((p) => p.value))}
                </span>
                <span>
                  {Math.min(...analytics.trend.source.points.map((p) => p.value))}
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
    </Page>
  );
}
