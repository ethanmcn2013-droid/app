/**
 * Meridian · Analytics.
 *
 * THE ONE MODE THAT READS BACKWARDS, and saying so out loud is the point. Every
 * other mode runs forward from the meridian into what is coming. Analytics runs
 * back from it into the records, and its horizon is the far edge of what those
 * records cover. Same two rules, same meaning — the edge of this read — pointed
 * the other way, and the gutter carries each claim's own window so a reader can
 * see, without opening anything, that seven numbers were not all taken over the
 * same stretch of time.
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
  ScopeAccount,
  TheRead,
  type ModeArgs,
} from "./parts";
import { accountOf, bySeverity } from "./reading";

/** The name a project that did not resolve is allowed to carry. No metadata. */
const UNREADABLE_PROJECT = "A project that could not be read";

function Claim({ claim }: { claim: AnalyticsClaimView }) {
  return (
    <Entry time={claim.windowLine}>
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
      <p className="mr-claim-pop">{claim.populationLine}</p>
      {claim.valueLabel !== null && claim.statusLine ? (
        <p className="mr-warn" data-band="partial">
          {claim.statusLine}
        </p>
      ) : null}
      <p className="mr-claim-limit">{claim.limitationLine}</p>
      <details className="mr-act">
        <summary className="mr-act-summary">{claim.evidenceLabel}</summary>
        <div className="mr-act-body">
          <Fields
            rows={[
              ["What it counts", claim.definitionLine],
              ["Window", claim.windowLine],
              ["Kind of truth", claim.truthClassLabel],
              ["Baseline", claim.baselineLine],
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

  /* Every claim that fell short, in the shell's own words. A claim can fall
     short in three ways and all three belong together: it could not be
     computed, it was computed over incomplete coverage, or the reader's access
     held part of it back. The mode opens by promising to say what it could not
     see; this is the payment. */
  const limits = analytics.claims
    .map((claim) => {
      const line =
        (claim.status !== "available" ? claim.statusLine : null) ??
        claim.coverageLine ??
        claim.permissionLine;
      return line === null ? null : ([claim.question, line] as const);
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  return (
    <Chronology
      when={chrome.asOf.line}
      material={here.material}
      notice={worst ? <ReadNotice band={here.material}>{worst.text}</ReadNotice> : null}
      horizonMark={HORIZON_MARK}
      horizonLine={analytics.windowLine}
      stream={
        firstRun ? (
          <FirstRun view={firstRun} />
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
                <Entries>
                  {analytics.claims.map((claim) => (
                    <Claim key={claim.id} claim={claim} />
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
        <TheRead>
          <Notices items={accountOf(analytics.disclosures, worst)} />
          <p className="mr-account">{analytics.windowLine}</p>
          {analytics.ledgerCoverageLine ? (
            <p className="mr-account">{analytics.ledgerCoverageLine}</p>
          ) : null}
          <ScopeAccount
            scopeLabel={chrome.scope.label}
            coverageLine={chrome.scope.coverageLine}
          />
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
          {/* Every claim that fell short, beside the claims rather than 1,300px
              under them. Two rounds asked for the account to sit at the top; on
              the mode densest in numbers this is where it belongs. */}
          {limits.length > 0 ? (
            <div className="mr-schedule">
              <Label>What fell short</Label>
              <Fields rows={limits} />
            </div>
          ) : null}
          <p className="mr-active">{chrome.activeProject.line}</p>
        </TheRead>
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
        <>
          <p className="mr-beyond-caption">
            Below this line is what these records cannot reach yet.
          </p>
          {analytics.trend.renderChart ? null : <Trend trend={analytics.trend} />}
          <section className="mr-band" aria-labelledby="mr-h-cover">
            <h2 className="mr-h2" id="mr-h-cover">
              What these numbers do not cover
            </h2>
            <p className="mr-beyond-empty">
              Every claim above was counted from the records named under it, prints its
              own limit, and reaches its own records. What fell short is set out beside
              the claims, above.
            </p>
          </section>
        </>
      }
    />
  );
}
