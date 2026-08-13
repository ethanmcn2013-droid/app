/**
 * Signal Desk · Analytics.
 *
 * Prose first. Each claim is a question with an answer under it and its own
 * receipt one fold away, at the same reading measure as Today. Nothing is a
 * card, nothing is a tile, and the only number set at any size is the claim's
 * own value at 20px — the same size as a section heading, deliberately, because
 * a figure that outweighs its own definition is how a dashboard starts.
 *
 * The ledger is the one earned widening: it leaves the 34rem measure and lays
 * out on three columns at 56rem, because it is the only thing on the page that
 * is a list of every project rather than a piece of writing. The trend is one
 * chart, drawn only when history earned it.
 */

import type {
  AnalyticsClaimView,
  AnalyticsLedgerRowView,
  AnalyticsView,
  HomeCandidateProps,
} from "@/lib/home-layer/lab-shell";
import { Entry, LimitFlag, Limits, Meta, type MarkKind } from "./parts";

/**
 * The trend as the fixture derived it. Reached through the view model rather
 * than imported from the fixture universe: a candidate has one import, and the
 * contract test walks the graph to prove it.
 */
type TrendSource = AnalyticsView["trend"]["source"];

/*
 * On Analytics the spine marks only what is WRONG.
 *
 * A claim that computed and a project that answered take no mark, so the line
 * runs clean past them; a claim that could not be computed and a project that
 * did not answer cut it. Reading down the spine on this mode is reading a list
 * of everything the page could not establish, which is the only list on an
 * evidence surface worth having at a glance.
 */
function markForClaim(claim: AnalyticsClaimView): MarkKind {
  if (claim.status === "available") return "plain";
  if (claim.status === "partial") return "waiting";
  return "broken";
}

function markForLedgerRow(row: AnalyticsLedgerRowView): MarkKind {
  if (row.state === "unavailable" || row.state === "unresolved") return "broken";
  if (row.state === "archived") return "held";
  return "plain";
}

/**
 * One trend, drawn only when `renderChart` is true. No flat line, no single
 * point, no greyed axis: when history has not earned it the shell's sentence is
 * the whole of the answer and this component renders nothing.
 *
 * The line is a plain polyline in a viewBox with a non-scaling stroke, so it
 * carries no library, no animation and no gradient. Its readings are also in a
 * fold underneath as text, because a picture is not evidence.
 */
function Trend({ trend }: { trend: TrendSource }) {
  if (!trend.renderChart || trend.kind !== "trend") return null;
  const points = trend.points;
  if (points.length < 2) return null;

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 28 - ((point.value - low) / span) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;

  return (
    <div className="dk-trend">
      <svg
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Open work moved from ${first.value} to ${last.value} over ${points.length} daily readings.`}
      >
        <polyline
          points={path}
          fill="none"
          stroke="var(--dk-mark)"
          strokeWidth="1"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="dk-trend-ends">
        <span>{first.value} open</span>
        <span>{last.value} open</span>
      </p>
      <details className="dk-fold">
        <summary>Every reading behind this line</summary>
        <div className="dk-fold-body">
          <ul className="dk-offers">
            {points.map((point) => (
              <li key={point.capturedAtIso}>
                <b>{point.value} open</b> {point.capturedAtIso}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}

function Claim({ claim }: { claim: AnalyticsClaimView }) {
  return (
    <Entry mark={markForClaim(claim)}>
      {/* The question leads. The figure under it is set at the same size as a
          section heading and no larger, because a number that outweighs its own
          definition is where a dashboard starts. */}
      <h3 className="dk-title">{claim.question}</h3>

      {claim.valueLabel !== null ? (
        <p className="dk-value">
          <b>{claim.valueLabel}</b>
          <span>{claim.metricLabel}</span>
        </p>
      ) : (
        <p className="dk-said">{claim.statusLine}</p>
      )}

      <Meta parts={[claim.populationLine, claim.windowLine, claim.truthClassLabel]} />

      <p className="dk-said">{claim.limitationLine}</p>
      {claim.coverageLine ? <p className="dk-said">{claim.coverageLine}</p> : null}
      {claim.permissionLine ? <p className="dk-said">{claim.permissionLine}</p> : null}

      <details className="dk-fold">
        <summary>The records behind this</summary>
        <div className="dk-fold-body">
          <p className="dk-said">
            {claim.receipt.includedCount} counted, {claim.receipt.excludedCount} left out.
          </p>
          {claim.receipt.exclusionLines.length > 0 ? (
            <ul className="dk-offers">
              {claim.receipt.exclusionLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <p className="dk-said dk-said-quiet">{claim.receipt.ingestionLine}</p>
          <p className="dk-said dk-said-quiet">{claim.receipt.versionLine}</p>
          <p className="dk-said dk-said-quiet">{claim.baselineLine}</p>
          <p className="dk-said dk-said-quiet">{claim.correctionLine}</p>
        </div>
      </details>
    </Entry>
  );
}

export function AnalyticsMode(props: HomeCandidateProps) {
  const { analytics, copy } = props;

  return (
    <>
      <LimitFlag
        count={analytics.disclosures.length}
        state={analytics.state}
        copy={copy}
        href="#dk-limits"
      />

      <p className="dk-lead">{analytics.leadLine}</p>

      {analytics.lens.line ? (
        <div className="dk-open dk-lens">
          <p className="dk-key">
            {analytics.lens.projectName ?? "One project"}
          </p>
          <p className="dk-said">{analytics.lens.line}</p>
          {analytics.lens.closeHref ? (
            <p>
              <a className="dk-more" href={analytics.lens.closeHref}>
                {analytics.lens.closeLabel}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="dk-column">
        <section className="dk-section" aria-labelledby="dk-claims-heading">
          <h2 className="dk-h2" id="dk-claims-heading">
            What the records answer
          </h2>
          <p className="dk-note">{analytics.windowLine}</p>
          {analytics.windowMismatchLine ? (
            <p className="dk-note">{analytics.windowMismatchLine}</p>
          ) : null}
          {analytics.claims.length > 0 ? (
            <ul className="dk-entries">
              {analytics.claims.map((claim) => (
                <Claim key={claim.id} claim={claim} />
              ))}
            </ul>
          ) : (
            <p className="dk-note">{copy.empty.analytics}</p>
          )}
        </section>

        {analytics.exceptions.length > 0 ? (
          <section className="dk-section" aria-labelledby="dk-exceptions-heading">
            <h2 className="dk-h2" id="dk-exceptions-heading">
              {analytics.exceptionsHeading}
            </h2>
            <ul className="dk-entries">
              {analytics.exceptions.map((exception) => (
                <Entry key={exception.id} mark="waiting">
                  <h3 className="dk-title dk-title-sm">{exception.headline}</h3>
                  <p className="dk-said">{exception.suggestion}</p>
                  <Meta parts={[exception.provenance.text]} />
                  <p className="dk-note">
                    <a className="dk-more" href={exception.evidenceHref}>
                      {exception.evidenceLabel}
                    </a>
                  </p>
                </Entry>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="dk-section" aria-labelledby="dk-trend-heading">
          <h2 className="dk-h2" id="dk-trend-heading">
            {analytics.trend.heading}
          </h2>
          <p className="dk-note">{analytics.trend.line}</p>
          <Trend trend={analytics.trend.source} />
        </section>

        {/* The widening. Everything above sits at the reading measure; the
            ledger does not, because it is the one thing that has to account
            for every project rather than say something. */}
        <section className="dk-section" aria-labelledby="dk-ledger-heading">
          <h2 className="dk-h2" id="dk-ledger-heading">
            {analytics.ledgerHeading}
          </h2>
          {analytics.ledgerCoverageLine ? (
            <p className="dk-note">{analytics.ledgerCoverageLine}</p>
          ) : null}
          <ul className="dk-entries dk-ledger">
            {analytics.ledger.map((row) => (
              <Entry key={row.projectId} mark={markForLedgerRow(row)}>
                <div className="dk-ledger-row">
                  <p className="dk-title dk-title-sm">
                    {row.href ? (
                      <a href={row.href}>{row.projectName ?? "A project that could not be read"}</a>
                    ) : (
                      (row.projectName ?? "A project that could not be read")
                    )}
                  </p>
                  <Meta parts={[row.stateLabel]} />
                  <Meta parts={[row.openWorkLabel, row.overdueLabel]} />
                </div>
              </Entry>
            ))}
          </ul>
        </section>
      </div>

      <Limits id="dk-limits" copy={copy} disclosures={analytics.disclosures} />
    </>
  );
}
