import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsLabChrome } from "@/components/lab/analytics-lab-chrome";
import { SuppressedObservations } from "@/components/lab/suppressed-observations";
import {
  ANALYTICS_LAB_ROBOTS,
  requireAnalyticsLabReviewer,
} from "@/lib/analytics-lab/gate";
import {
  TRUTH_CLASS_LABEL,
  UNKNOWN_MARK,
  labView,
  parseLabState,
  type Availability,
  type EvidenceRow,
  type Observation,
} from "@/lib/analytics-lab/model";

/**
 * /lab/signal-analytics-editorial — "Editorial Briefing"
 *
 * THE IDEA. The read is the product. One narrow column, the strongest written
 * hierarchy of the five, and every number set as a receipt INSIDE the sentence
 * it supports rather than lifted out into a tile. That inline receipt is the
 * signature device: it is the locked decision "numbers are receipts for a
 * written conclusion, never the headline" expressed as typography instead of
 * as a rule someone has to remember.
 *
 * Attention rows are deliberately subordinate to the read — smaller, quieter,
 * and set as a numbered list under it. The ledger is smaller again, closer to
 * a colophon than a table. The hierarchy is the argument: a reader who stops
 * after the first paragraph has still been told the truth.
 *
 * Server-rendered. State is a URL, not React state, so every screen a
 * reviewer can reach is a link they can send. No client JavaScript.
 */

export const metadata: Metadata = {
  title: "Analytics · Editorial Briefing · Lab",
  description: "Composition study for the Home analytics view. Review only.",
  robots: ANALYTICS_LAB_ROBOTS,
};

const COLUMN = "mx-auto w-full max-w-[672px] px-6 md:px-8";

/**
 * The signature device. Numbers inside the read carry a mono face and a
 * dotted indigo rule, so the eye reads them as citations rather than as
 * headlines. Spelled-out numbers count too — "two of the three" is a receipt
 * exactly as much as "2 of 3" is.
 */
const NUMERIC =
  /\b(\d+(?:st|nd|rd|th)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|eighteen|twenty|twenty-one|thirty)\b/gi;

function withReceipts(text: string, key: string) {
  // `split` with a capturing group alternates [text, capture, text, …], so the
  // odd indices ARE the numbers. Testing the regex again here would be wrong:
  // it carries the /g flag, and `test` on a global regex advances lastIndex
  // between calls, which would silently drop receipts further down the page.
  const parts = text.split(NUMERIC);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span
        key={`${key}-${i}`}
        className="font-mono text-[0.86em] tracking-[-0.01em] [border-bottom:1px_dotted_var(--accent)]"
      >
        {part}
      </span>
    ) : (
      <span key={`${key}-${i}`}>{part}</span>
    ),
  );
}

/** Non-colour encoding: the word, plus a rule style unique to each class. */
function TruthWord({ truthClass }: { truthClass: Observation["truthClass"] }) {
  const rule =
    truthClass === "reported"
      ? "border-t-[2px] border-solid border-ink"
      : truthClass === "observed"
        ? "border-t border-solid border-accent"
        : "border-t border-dashed border-ink-faint";
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`inline-block w-6 ${rule}`} />
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
        {TRUTH_CLASS_LABEL[truthClass]}
      </span>
    </span>
  );
}

function Unknown({ reason }: { reason: string }) {
  return (
    <span className="text-ink-faint">
      <span aria-hidden="true">{UNKNOWN_MARK}</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}

function EvidenceList({
  rows,
  observationId,
}: {
  rows: readonly EvidenceRow[];
  observationId: string;
}) {
  return (
    <details className="group mt-4">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
        <span>
          {rows.length === 1 ? "1 record" : `${rows.length} records`}
        </span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">
          &rsaquo;
        </span>
      </summary>
      <ol className="mt-3 divide-y divide-hairline-soft border-y border-hairline-soft">
        {rows.map((row) => (
          <li key={`${observationId}-${row.id}`} className="py-2.5">
            <Link
              href={row.route}
              className="block outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <span className="block text-[14px] leading-[1.5] text-ink">
                {row.title}
              </span>
              <span className="mt-1 block font-mono text-[11px] text-ink-faint">
                {row.source} &middot; {row.meta}
              </span>
            </Link>
            {row.caveat ? (
              <p className="mt-1.5 text-[12px] leading-[1.5] text-ink-soft">
                {row.caveat}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function AvailabilityNote({ status }: { status: Availability }) {
  if (status.kind === "available") return null;
  const headline = "headline" in status ? status.headline : "";
  const because = "because" in status ? status.because : "";
  return (
    <p className="text-[13px] leading-[1.6] text-ink-soft">
      <span className="text-ink">{headline}</span> {because}
    </p>
  );
}

export default async function AnalyticsEditorialLab({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  await requireAnalyticsLabReviewer();
  const { state } = await searchParams;
  const stateId = parseLabState(state);
  const view = labView(stateId);
  const shown = view.observations.slice(0, 3);

  return (
    <>
      <main className="min-h-screen bg-white text-ink">
        {/* ── The dateline. What was read, and when. ─────────────────── */}
        <header className={`${COLUMN} pt-16 md:pt-24`}>
          <p className="font-mono text-[11px] uppercase leading-[1.6] tracking-[0.13em] text-ink-faint">
            <span className="text-ink">{view.scope.projectName}</span>
            {view.scope.periodName ? (
              <>
                <span aria-hidden="true"> &middot; </span>
                {view.scope.periodName}
              </>
            ) : null}
            <span aria-hidden="true"> &middot; </span>
            read {view.scope.readAt}
          </p>
          <p className="mt-3 text-[13px] leading-[1.6] text-ink-soft">
            {view.scope.declaration}
          </p>
        </header>

        {view.banner ? (
          <div className={`${COLUMN} mt-8`}>
            <div className="border-l-2 border-ink pl-4">
              <p className="text-[15px] leading-[1.6] text-ink">
                {view.banner.headline}
              </p>
              <p className="mt-1 text-[14px] leading-[1.6] text-ink-soft">
                {view.banner.detail}
              </p>
            </div>
          </div>
        ) : null}

        {/* ── Section 1 · The read, then the exceptions under it. ─────── */}
        <section aria-labelledby="read-heading" className={`${COLUMN} pt-10 md:pt-12`}>
          <h1 id="read-heading" className="sr-only">
            What this reading of {view.scope.projectName} found
          </h1>
          <div className="text-[clamp(1.35rem,1.05rem+1.1vw,1.75rem)] font-medium leading-[1.42] tracking-[-0.021em] text-ink">
            {view.read.map((line, i) => (
              <p key={line.slice(0, 24)} className={i > 0 ? "mt-5 text-ink-soft" : ""}>
                {withReceipts(line, `read-${i}`)}
              </p>
            ))}
          </div>

          {shown.length > 0 ? (
            <>
              <div className="mt-12 flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint">
                  What deserves attention
                </h2>
                <p className="font-mono text-[11px] text-ink-faint">
                  {view.suppression.shown} of {view.suppression.total}
                </p>
              </div>

              <ol className="divide-y divide-hairline-soft">
                {shown.map((o, i) => (
                  <li key={o.id} className="py-8">
                    <div className="flex gap-4 md:gap-6">
                      <span
                        aria-hidden="true"
                        className="mt-1 font-mono text-[12px] tabular-nums text-ink-ghost"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[17px] font-medium leading-[1.45] tracking-[-0.012em] text-ink md:text-[18px]">
                          {withReceipts(o.claim, o.id)}
                        </h3>

                        <dl className="mt-4 space-y-3">
                          {[
                            ["What changed", o.changed],
                            ["Why it matters", o.matters],
                          ].map(([term, detail]) => (
                            <div key={term} className="md:flex md:gap-5">
                              <dt className="font-mono text-[10px] uppercase leading-[1.9] tracking-[0.12em] text-ink-faint md:w-[104px] md:shrink-0">
                                {term}
                              </dt>
                              <dd className="text-[14px] leading-[1.6] text-ink-soft md:flex-1">
                                {detail}
                              </dd>
                            </div>
                          ))}
                          <div className="md:flex md:gap-5">
                            <dt className="font-mono text-[10px] uppercase leading-[1.9] tracking-[0.12em] text-ink-faint md:w-[104px] md:shrink-0">
                              Next
                            </dt>
                            <dd className="text-[14px] leading-[1.6] text-ink md:flex-1">
                              {o.action.text}
                              {o.action.kind === "deterministic-suggestion" ? (
                                <span className="mt-1 block text-[12px] leading-[1.55] text-ink-faint">
                                  Suggested by a rule, not by a person:{" "}
                                  {o.action.rule}
                                </span>
                              ) : (
                                <span className="mt-1 block text-[12px] leading-[1.55] text-ink-faint">
                                  Written by the person who owns this work.
                                </span>
                              )}
                            </dd>
                          </div>
                        </dl>

                        {o.limitation ? (
                          <p className="mt-4 border-l border-hairline pl-3 text-[13px] leading-[1.6] text-ink-soft">
                            {o.limitation}
                          </p>
                        ) : null}

                        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                          <TruthWord truthClass={o.truthClass} />
                          <p className="font-mono text-[11px] text-ink-faint">
                            {o.coverage} {o.freshness}
                          </p>
                        </div>

                        <EvidenceList rows={o.evidence} observationId={o.id} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="mt-2 text-[14px] leading-[1.6] text-ink-soft">
                {view.suppression.disclosure}
              </p>
              <SuppressedObservations view={view} />
              <p className="mt-4 text-[13px] leading-[1.6] text-ink-faint">
                {view.rankingRule}
              </p>
            </>
          ) : null}
        </section>

        {/* ── Section 2 · The ledger. Deliberately subordinate. ───────── */}
        <section
          id="ledger"
          aria-labelledby="ledger-heading"
          className={`${COLUMN} pt-14`}
        >
          <h2
            id="ledger-heading"
            className="border-b border-hairline pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint"
          >
            Every label in this Project
          </h2>

          {view.ledger.rows.length > 0 ? (
            <table className="mt-1 w-full border-collapse text-left">
              <caption className="sr-only">
                Open work by label. {view.ledger.denominator}
              </caption>
              <thead>
                <tr className="border-b border-hairline-soft">
                  <th
                    scope="col"
                    className="py-2 pr-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
                  >
                    Label
                  </th>
                  <th
                    scope="col"
                    className="py-2 pl-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
                  >
                    Open
                  </th>
                  <th
                    scope="col"
                    className="py-2 pl-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
                  >
                    Past date
                  </th>
                  <th
                    scope="col"
                    className="py-2 pl-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
                  >
                    Last recorded
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.ledger.rows.map((row) => (
                  <tr key={row.id} className="border-b border-hairline-soft">
                    <th
                      scope="row"
                      className="max-w-[220px] py-2.5 pr-3 text-left text-[14px] font-normal leading-[1.45] text-ink"
                    >
                      {row.name}
                      {row.carriesException ? (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                          above
                        </span>
                      ) : null}
                    </th>
                    <td className="py-2.5 pl-3 text-right font-mono text-[13px] tabular-nums text-ink">
                      {row.open}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono text-[13px] tabular-nums text-ink-soft">
                      {row.pastDate}
                    </td>
                    <td className="py-2.5 pl-3 text-right font-mono text-[12px] tabular-nums text-ink-soft">
                      {row.lastRecorded ?? (
                        <Unknown reason="Nothing recorded for this label." />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="mt-4">
              <AvailabilityNote status={view.ledger.status} />
            </div>
          )}

          <p className="mt-4 text-[13px] leading-[1.6] text-ink-soft">
            {view.ledger.accounting}
          </p>
          <p className="mt-2 text-[13px] leading-[1.6] text-ink-faint">
            {view.ledger.denominator}
          </p>
        </section>

        {/* ── Section 3 · The trend, refusing to draw itself. ─────────── */}
        <section aria-labelledby="trend-heading" className={`${COLUMN} pt-14`}>
          <h2
            id="trend-heading"
            className="border-b border-hairline pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint"
          >
            {view.trend.title}
          </h2>
          <div className="mt-4">
            <AvailabilityNote status={view.trend.status} />
            {view.trend.status.kind === "insufficient-history" ? (
              <p className="mt-3 font-mono text-[12px] text-ink-faint">
                {view.trend.status.comparableReadings} readings kept &middot;{" "}
                {view.trend.status.readingsNeeded} needed before a line means
                anything
              </p>
            ) : null}
          </div>
        </section>

        {/* ── The colophon. Provenance, limits, and the one-Project gap.
            None of this counts against the three sections above: the
            locked decisions put truth outside the layout budget. ─────── */}
        <footer className={`${COLUMN} mt-16 border-t border-hairline py-12`}>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint">
            Where this came from
          </h2>
          <dl className="mt-4 space-y-2.5">
            {view.coverage.map((source) => (
              <div key={source.source} className="sm:flex sm:gap-4">
                <dt className="text-[13px] text-ink sm:w-[80px] sm:shrink-0">
                  {source.source}
                </dt>
                <dd className="text-[13px] leading-[1.6] text-ink-soft sm:flex-1">
                  {source.detail}
                  {source.status.kind !== "available" &&
                  "headline" in source.status ? (
                    <span className="block text-ink-faint">
                      {source.status.headline} {source.status.because}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint">
            What this cannot tell you
          </h2>
          <dl className="mt-4 space-y-3">
            {view.unsupported.map((metric) => (
              <div key={metric.name} className="sm:flex sm:gap-4">
                <dt className="text-[13px] text-ink sm:w-[180px] sm:shrink-0">
                  {metric.name}
                </dt>
                <dd className="text-[13px] leading-[1.6] text-ink-soft sm:flex-1">
                  {metric.because}
                  <span className="block text-ink-faint">
                    Would need: {metric.wouldNeed}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-10 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint">
            One Project at a time
          </h2>
          <p className="mt-3 text-[14px] leading-[1.65] text-ink-soft">
            {view.portfolioGap.statement}
          </p>
          <p className="mt-2 text-[13px] leading-[1.6] text-ink-faint">
            {view.portfolioGap.because}
          </p>
          <details className="mt-4">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              The {view.portfolioGap.otherProjectCount} others you can open
            </summary>
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {view.portfolioGap.others.map((p) => (
                <li key={p.id}>
                  <Link
                    href={p.route}
                    className="block text-[13px] leading-[1.5] text-ink-soft underline decoration-hairline underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </footer>
      </main>

      <AnalyticsLabChrome variant="editorial" state={stateId} proves={view.proves} />
    </>
  );
}
