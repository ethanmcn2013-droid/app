/**
 * Signal Desk · Analytics.
 *
 * Prose first. Each claim is a question with an answer under it and its own
 * receipt one fold away, at the same reading measure as Today. Nothing is a
 * card, nothing is a tile, and the only number set at any size is the claim's
 * own value at 20px — the same size as a section heading, deliberately, because
 * a figure that outweighs its own definition is how a dashboard starts.
 *
 * THE ONE EARNED WIDENING, and what changed about it. Round 1 widened the whole
 * page for this mode, which moved the masthead with it: the header rule ran
 * 296–1144 here and 376–1064 on Today, and page furniture that changes width
 * depending on which mode you are in reads as unresolved rather than as
 * responsive. The sheet is now one measure in all five modes and the widening
 * belongs to the Project ledger alone. It steps out of the reading column into
 * its own wider one, with its own spine, which is the only thing on this page
 * that has to account for every project rather than say something.
 */

import type {
  AnalyticsClaimView,
  AnalyticsLedgerRowView,
  AnalyticsView,
  HomeCandidateProps,
  HomeCopy,
} from "@/lib/home-layer/lab-shell";
import {
  Entry,
  FirstRun,
  Foot,
  indexCount,
  legendEntries,
  Meta,
  ReadIndex,
  ReadLine,
  readVerdict,
  type IndexItem,
  type MarkKind,
  type ReadVerdict,
} from "./parts";

/**
 * The state word leads the readline and the shell's sentence follows it, so a
 * sentence that opens with the same words says them twice: "Not enough history.
 * Not enough history yet. 6 of 14 comparable daily readings." The echo is
 * removed by an EXACT prefix test and nothing looser — if the sentence does not
 * literally begin with the word, every character of it renders.
 */
function withoutEcho(word: string, sentence: string): string {
  if (!sentence.startsWith(word)) return sentence;
  const stop = sentence.indexOf(". ");
  if (stop === -1) return sentence;
  return sentence.slice(stop + 2);
}

/**
 * ANALYTICS HAS A SECOND WAY OF BEING LIMITED, and the coverage notes never
 * carry it.
 *
 * Every source can answer in full and this page can still be unable to say
 * something: a claim that could not be computed, or a trend withheld because
 * there is not enough history behind it. Round 2 opened Analytics with the word
 * "Read." while the trend under it said "Not enough history yet", and marked the
 * other three modes as limited in a row where Analytics stayed silent, which in
 * a row that names its neighbours reads as a clean one.
 *
 * One derivation, used by the mode row and by this page's own readline, is the
 * only way those two stay the same word. The sentence beneath it is the shell's,
 * not invented here: whatever was withheld says why in its own words.
 */
export function analyticsRead(
  analytics: AnalyticsView,
  copy: HomeCopy,
): Readonly<{ verdict: ReadVerdict; lead: string | null }> {
  const base = readVerdict(analytics.state, analytics.disclosures, copy);
  if (base.klass !== "complete") return { verdict: base, lead: null };

  const withheld = analytics.claims.find((claim) => claim.status !== "available");
  if (!withheld && analytics.trend.renderChart) return { verdict: base, lead: null };

  const word =
    withheld && withheld.status !== "insufficient_history"
      ? copy.states.partial
      : copy.states["insufficient-history"];

  return {
    verdict: { klass: "partial", word, notes: [], clean: false },
    lead: withoutEcho(word, withheld?.statusLine ?? analytics.trend.line),
  };
}

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
        <summary>Every reading behind this line ({points.length} readings)</summary>
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

      {/* The truth class is a class, not a metadata field. It used to sit third
          on the rule-separated line, where it wrapped and left its separating
          hairline stranded at the start of the next line. It takes the label
          slot it belongs in. */}
      <p className="dk-key dk-claim-class">{claim.truthClassLabel}</p>

      {/* The population is a sentence and it is set as one. It used to sit in
          the rule-separated run beside the window, where the two together were
          long enough to wrap on every claim. A field is a field; a sentence is
          not made into one by putting a hairline next to it. */}
      <p className="dk-said">{claim.populationLine}</p>
      <Meta parts={[claim.windowLine]} />

      <p className="dk-said">{claim.limitationLine}</p>
      {claim.coverageLine ? <p className="dk-said">{claim.coverageLine}</p> : null}
      {claim.permissionLine ? <p className="dk-said">{claim.permissionLine}</p> : null}

      {/* A closed fold used to print as a bare label over empty space, because a
          flex `summary` drops its own marker. It carries a chevron now, and its
          label carries the two numbers, so the shut state states a fact rather
          than promising one. */}
      <details className="dk-fold">
        <summary>
          The records behind this ({claim.receipt.includedCount} counted,{" "}
          {claim.receipt.excludedCount} left out)
        </summary>
        <div className="dk-fold-body">
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
  const { analytics, copy, chrome, firstRun } = props;
  const { verdict, lead } = analyticsRead(analytics, copy);

  if (firstRun) {
    return (
      <>
        <ReadLine
          verdict={verdict}
          chrome={chrome}
          standing={[]}
          statusLabel={chrome.statusRegionLabel}
          lead={firstRun.line}
        />
        <FirstRun view={firstRun} />
        <Foot copy={copy} disclosures={[]} />
      </>
    );
  }

  const marks = new Set<MarkKind>();
  for (const claim of analytics.claims) marks.add(markForClaim(claim));
  if (analytics.exceptions.length > 0) marks.add("waiting");
  for (const row of analytics.ledger) marks.add(markForLedgerRow(row));
  const legendHref = legendEntries(marks).length > 0 ? "#dk-legend" : null;

  const indexItems: readonly IndexItem[] = [
    { id: "dk-claims", label: "What the records answer", count: indexCount(analytics.claims.length), lead: true },
    ...(analytics.exceptions.length > 0
      ? [
          {
            id: "dk-exceptions",
            label: analytics.exceptionsHeading,
            count: indexCount(analytics.exceptions.length),
          },
        ]
      : []),
    { id: "dk-trend", label: analytics.trend.heading, count: null },
    { id: "dk-ledger", label: analytics.ledgerHeading, count: indexCount(analytics.ledger.length) },
  ];

  return (
    <>
      <ReadLine
        verdict={verdict}
        chrome={chrome}
        standing={[]}
        statusLabel={chrome.statusRegionLabel}
        legendHref={legendHref}
        lead={lead}
      />

      <p className="dk-lead">{analytics.leadLine}</p>

      {analytics.lens.line ? (
        <div className="dk-open dk-lens">
          <p className="dk-key">{analytics.lens.projectName ?? "One project"}</p>
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

      <div className="dk-column" data-indexed="true">
        <ReadIndex label="Sections of this reading" items={indexItems} />

        <section className="dk-section" id="dk-claims" aria-labelledby="dk-claims-heading">
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
          <section className="dk-section" id="dk-exceptions" aria-labelledby="dk-exceptions-heading">
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

        <section className="dk-section" id="dk-trend" aria-labelledby="dk-trend-heading">
          <h2 className="dk-h2" id="dk-trend-heading">
            {analytics.trend.heading}
          </h2>
          <p className="dk-note">{analytics.trend.line}</p>
          <Trend trend={analytics.trend.source} />
        </section>
      </div>

      {/* The widening, and the only one on any of these five pages. The ledger
          leaves the reading column for a wider one of its own, spine and all,
          because it is the one thing here that is a list of every project rather
          than a piece of writing. */}
      <div className="dk-column dk-wide">
        <section className="dk-section" id="dk-ledger" aria-labelledby="dk-ledger-heading">
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
                      <a href={row.href}>
                        {row.projectName ?? "A project that could not be read"}
                      </a>
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

      <Foot copy={copy} disclosures={analytics.disclosures} marks={marks} />
    </>
  );
}
