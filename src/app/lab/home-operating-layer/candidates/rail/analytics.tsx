/**
 * Meridian · Analytics.
 *
 * THE ONE MODE THAT READS BACKWARDS, and saying so out loud is the point. Every
 * other mode runs forward from the meridian into what is coming. Analytics runs
 * back from it into the records, and its horizon is the far edge of what those
 * records cover. Same two rules, same meaning — the edge of this read — pointed
 * the other way.
 *
 * THE WINDOW IS PRINTED WHERE IT VARIES, NOT WHERE IT REPEATS. Round 4 counted
 * "As read on Thursday 16 July." three times in a single fold, once per claim,
 * in a gutter whose whole argument is that a reader can run their eye down it.
 * A column of one repeated sentence is not an axis. The window that every claim
 * shares is now stated once, under the heading; the gutter carries a claim's own
 * window only where that claim was taken over a different stretch of time, which
 * is exactly the fact the gutter exists to make visible.
 *
 * EVERY CLAIM SHOWS ITS ARITHMETIC ON ITS FACE. What was counted, what was left
 * out, and what it is measured against are on the page beside the numeral rather
 * than behind a disclosure. Round 4 found this the weakest of the four on
 * receipts: neither the left-out count nor the baseline was visible, and the page
 * then closed with a sentence asserting its own honesty in place of the figures
 * that would have proved it. The sentence is gone and the figures took its place,
 * which is the trade this lens exists to enforce.
 *
 * BELOW THE HORIZON IS THE FUTURE, which is the moment this direction was built
 * for. When there is not enough history, the shell says so and names the date
 * the trend becomes answerable: "The earliest this can show a trend is 24 July
 * 2026." That is a fact about a day that has not happened. It sits below the
 * lower rule, past the edge of what the records reach, which is exactly where
 * it belongs, and no other composition in this lab has anywhere to put it.
 *
 * THE CLAIM LEADS, NOT THE NUMERAL. The order is the reading order: the
 * question the claim answers, then the value that answers it, then the
 * population it was drawn from, then the limit that keeps it honest. The value
 * is set at reading weight with its metric named beside it, so it is a figure
 * inside a sentence rather than a billboard.
 *
 * THE LEDGER IS THE ONE THING THAT BREAKS THE MEASURE. Eighteen projects and
 * four comparable fields read worse in a reading width than they do given the
 * page, so it takes the page. It is a real table, so a screen reader announces
 * which project a cell belongs to, and at narrow widths it scrolls inside its
 * own region rather than pushing the document sideways.
 */

import type { AnalyticsClaimView, AnalyticsView } from "@/lib/home-layer/lab-shell";
import {
  Chronology,
  EmptyField,
  Entries,
  Entry,
  Fields,
  FirstRun,
  HORIZON_MARK,
  Label,
  Meta,
  Notice,
  Notices,
  Prov,
  ReadNotice,
  TheRead,
  type ModeArgs,
} from "./parts";
import { accountOf, bySeverity } from "./reading";

/** The name a project that did not resolve is allowed to carry. No metadata. */
const UNREADABLE_PROJECT = "A project that could not be read";

/** "22 counted · 2 left out" — the arithmetic, on the face, every time. */
function countedLine(claim: AnalyticsClaimView): string {
  const included = `${claim.receipt.includedCount} counted`;
  return claim.receipt.excludedCount === 0
    ? `${included}, none left out`
    : `${included}, ${claim.receipt.excludedCount} left out`;
}

function Claim({ claim, sharedWindow }: { claim: AnalyticsClaimView; sharedWindow: string | null }) {
  const ownWindow = claim.windowLine === sharedWindow ? null : claim.windowLine;
  return (
    <Entry time={ownWindow} fallback={null}>
      <h3 className="mr-claim-q">{claim.question}</h3>
      {claim.valueLabel !== null ? (
        <p className="mr-claim-value">
          <span className="mr-claim-number">{claim.valueLabel}</span>
          <span className="mr-claim-metric">{claim.metricLabel}</span>
        </p>
      ) : (
        /* No value could be computed, so the sentence takes the slot the number
           would have taken. Nothing here renders an unknown as zero. */
        <p className="mr-claim-none">{claim.statusLine}</p>
      )}
      {claim.valueLabel !== null && claim.statusLine ? (
        <p className="mr-warn" data-band="partial">
          {claim.statusLine}
        </p>
      ) : null}
      <p className="mr-claim-pop">{claim.populationLine}</p>
      {/* The arithmetic and the thing it is measured against, on the face. A
          reader who never opens the receipt still meets both. */}
      <Meta
        items={[
          <span key="counted">{countedLine(claim)}</span>,
          <span key="baseline">{claim.baselineLine}</span>,
          <span key="truth">{claim.truthClassLabel}</span>,
        ]}
      />
      <p className="mr-claim-limit">{claim.limitationLine}</p>
      <details className="mr-act mr-act-wide">
        <summary className="mr-act-summary">{claim.evidenceLabel}</summary>
        <div className="mr-act-body">
          <Fields
            rows={[
              ["What it counts", claim.definitionLine],
              ["Window", claim.windowLine],
              ...(claim.coverageLine ? [["Coverage", claim.coverageLine] as const] : []),
              ...(claim.permissionLine ? [["Your access", claim.permissionLine] as const] : []),
              ["To change it", claim.correctionLine],
            ]}
          />
          <Label>The records behind it</Label>
          <ul className="mr-receipt">
            {claim.receipt.exclusionLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>{claim.receipt.ingestionLine}</li>
            <li>{claim.receipt.versionLine}</li>
          </ul>
        </div>
      </details>
    </Entry>
  );
}

/**
 * The one trend. A level series, one stroke, no fill, no grid, no axis
 * furniture: the numbers that matter are printed, not measured off a picture.
 * Twelve of the thirteen worlds have too little history and every one of them
 * gets the sentence instead, below the horizon, where a fact about a future
 * date belongs.
 */
function Trend({ trend }: { trend: AnalyticsView["trend"] }) {
  const source = trend.source;
  if (source.kind !== "trend" || source.points.length < 2) {
    return (
      <div className="mr-trend-refused">
        <Label>{trend.heading}</Label>
        <p className="mr-trend-line">{trend.line}</p>
      </div>
    );
  }

  const points = source.points;
  const values = points.map((point) => point.value);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const span = high - low === 0 ? 1 : high - low;
  const width = 640;
  const height = 110;
  const pad = 8;
  const path = points
    .map((point, index) => {
      const x = pad + (index * (width - pad * 2)) / (points.length - 1);
      const y = pad + ((high - point.value) * (height - pad * 2)) / span;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <figure className="mr-trend">
      <Label>{trend.heading}</Label>
      <svg
        className="mr-trend-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-labelledby="mr-trend-cap"
      >
        {/* The box stretches to the column, so the strokes are told not to
            stretch with it. Without this the line thins as the page widens. */}
        <line
          className="mr-trend-base"
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          vectorEffect="non-scaling-stroke"
        />
        <path className="mr-trend-line-svg" d={path} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mr-trend-cap" id="mr-trend-cap">
        {trend.line}
      </figcaption>
      <Fields
        rows={[
          ["First reading", String(values[0] as number)],
          ["Last reading", String(values[values.length - 1] as number)],
        ]}
      />
    </figure>
  );
}

export function AnalyticsMode({ props, here }: ModeArgs) {
  const { analytics, chrome, firstRun } = props;
  const worst = firstRun ? null : (bySeverity(analytics.disclosures)[0] ?? null);

  /* The window every claim shares, if they share one. Stated once under the
     heading rather than once per claim in a column that then says nothing. */
  const windows = new Set(analytics.claims.map((claim) => claim.windowLine));
  const sharedWindow = windows.size === 1 ? ([...windows][0] as string) : null;

  /* Every claim that fell short, in the shell's own words. A claim can fall
     short in three ways and all three belong together: it could not be
     computed, it was computed over incomplete coverage, or the reader's access
     held part of it back. */
  const limits = analytics.claims
    .map((claim) => {
      const line =
        (claim.status !== "available" ? claim.statusLine : null) ??
        claim.coverageLine ??
        claim.permissionLine;
      return line === null ? null : ([claim.question, line] as const);
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  const setup = firstRun
    ? (analytics.disclosures.find((item) => item.tone === "setup") ?? null)
    : null;
  const rest = accountOf(analytics.disclosures, worst ?? setup);
  const hasRecord = rest.length > 0 || limits.length > 0 || !analytics.trend.renderChart;

  return (
    <Chronology
      when={chrome.asOf.line}
      statusLabel={chrome.statusRegionLabel}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={analytics.windowLine}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} lead={setup?.text ?? null} />
        ) : (
          <>
            {analytics.lens.line ? (
              <div className="mr-lens">
                <Label>{analytics.lens.projectName ?? "One project"}</Label>
                <p className="mr-day">{analytics.lens.line}</p>
                {analytics.lens.closeHref ? (
                  <a className="mr-inline-link" href={analytics.lens.closeHref}>
                    {analytics.lens.closeLabel}
                  </a>
                ) : null}
              </div>
            ) : null}
            {analytics.windowMismatchLine ? (
              <Notice state="partial">{analytics.windowMismatchLine}</Notice>
            ) : null}
            {analytics.claims.length === 0 ? (
              <EmptyField>{props.copy.empty.analytics}</EmptyField>
            ) : (
              <section className="mr-band" aria-labelledby="mr-h-claims">
                <h2 className="mr-h2" id="mr-h-claims">
                  What each number counts
                </h2>
                {sharedWindow ? <p className="mr-band-note">{sharedWindow}</p> : null}
                <Entries>
                  {analytics.claims.map((claim) => (
                    <Claim key={claim.id} claim={claim} sharedWindow={sharedWindow} />
                  ))}
                </Entries>
              </section>
            )}
            {analytics.exceptions.length > 0 ? (
              <section className="mr-band" aria-labelledby="mr-h-exc">
                <h2 className="mr-h2" id="mr-h-exc">
                  {analytics.exceptionsHeading}
                </h2>
                <ul className="mr-entries">
                  {analytics.exceptions.map((exception) => (
                    <li className="mr-exception" key={exception.id}>
                      <p className="mr-exc-head">{exception.headline}</p>
                      <p className="mr-exc-suggestion">
                        <span className="mr-exc-tag">Suggested</span>
                        {exception.suggestion}
                      </p>
                      <Meta items={[<Prov key="prov" provenance={exception.provenance} />]} />
                      <a className="mr-inline-link" href={exception.evidenceHref}>
                        {exception.evidenceLabel}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {analytics.trend.renderChart ? <Trend trend={analytics.trend} /> : null}
          </>
        )
      }
      record={
        hasRecord ? (
          <TheRead>
            <Notices items={rest} />
            {/* The mode's own headline limitation, at the top rather than only at
                the bottom. Every claim can be computable and Analytics still be
                unable to say anything about change, and the word under the mode
                name says so; this is where the page says why. */}
            {analytics.trend.renderChart ? null : (
              <div className="mr-schedule">
                <Label>{props.copy.states["insufficient-history"]}</Label>
                <p className="mr-account">{analytics.trend.line}</p>
              </div>
            )}
            {limits.length > 0 ? (
              <div className="mr-schedule">
                <Label>What fell short</Label>
                <Fields rows={limits} />
              </div>
            ) : null}
          </TheRead>
        ) : null
      }
      wide={
        analytics.ledger.length > 0 ? (
          <section aria-labelledby="mr-h-ledger">
            <h2 className="mr-h2" id="mr-h-ledger">
              {analytics.ledgerHeading}
            </h2>
            {analytics.ledgerCoverageLine ? (
              <p className="mr-band-note">{analytics.ledgerCoverageLine}</p>
            ) : null}
            <div
              className="mr-table-wrap"
              role="region"
              aria-label={analytics.ledgerHeading}
              tabIndex={0}
            >
              <table className="mr-table">
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
                          <a className="mr-inline-link" href={row.href}>
                            {row.projectName ?? UNREADABLE_PROJECT}
                          </a>
                        ) : (
                          <span>{row.projectName ?? UNREADABLE_PROJECT}</span>
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
        ) : null
      }
      beyond={
        firstRun ? null : analytics.trend.renderChart ? null : (
          <>
            <p className="mr-beyond-caption">
              Below this line is what these records cannot reach yet.
            </p>
            <Trend trend={analytics.trend} />
          </>
        )
      }
    />
  );
}
