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
  type LabView,
  type Observation,
} from "@/lib/analytics-lab/model";

/**
 * /lab/signal-analytics-hybrid — "Hybrid"
 *
 * THE SYNTHESIS, AND THE ARGUMENT FOR IT. Three things earned their place:
 *
 *   · From Editorial — the read at the top, with numbers set as receipts
 *     inside the sentence. It is the clearest expression of "numbers are
 *     receipts for a written conclusion" of anything in this lab.
 *   · From Ledger — the exceptions living INSIDE the completeness table
 *     rather than above it, so reading order and accounting are one object
 *     and the reader never reconciles two lists by eye.
 *   · From Trace — not the drawing, which needs history that does not exist,
 *     but its best instinct: state the limit at the place the reader would
 *     otherwise assume the opposite.
 *
 * The structural bet: because the exceptions fuse into the ledger, two
 * sections do the work of three. The freed weight goes to "What this cannot
 * tell you" — normally a footnote, here a full section set at the same scale
 * as the ledger. On a surface whose whole claim is trustworthiness, the list
 * of things it refuses to answer is not an apology, it is the product.
 *
 * The trend still refuses to draw, and says so in one line rather than
 * occupying a section it cannot fill.
 */

export const metadata: Metadata = {
  title: "Analytics · Hybrid · Lab",
  description: "Composition study for the Home analytics view. Review only.",
  robots: ANALYTICS_LAB_ROBOTS,
};

const COLUMN = "mx-auto w-full max-w-[860px] px-6 md:px-8";

const NUMERIC =
  /\b(\d+(?:st|nd|rd|th)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|eighteen|twenty|twenty-one|thirty)\b/gi;

function withReceipts(text: string, key: string) {
  // Odd indices are the captured numbers; see the note in the Editorial
  // variant on why the regex is not re-tested here.
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

function TruthWord({ truthClass }: { truthClass: Observation["truthClass"] }) {
  const rule =
    truthClass === "reported"
      ? "border-t-[2px] border-solid border-ink"
      : truthClass === "observed"
        ? "border-t border-solid border-accent"
        : "border-t border-dashed border-ink-faint";
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`inline-block w-5 ${rule}`} />
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
        {TRUTH_CLASS_LABEL[truthClass]}
      </span>
    </span>
  );
}

function orderedRows(view: LabView) {
  const shown = view.observations.slice(0, 3);
  const rankOf = new Map<string, number>();
  const byLabel = new Map<string, Observation>();
  shown.forEach((o, i) => {
    if (!rankOf.has(o.labelId)) {
      rankOf.set(o.labelId, i + 1);
      byLabel.set(o.labelId, o);
    }
  });
  const rows = [...view.ledger.rows].sort((a, b) => {
    const ra = rankOf.get(a.id) ?? 99;
    const rb = rankOf.get(b.id) ?? 99;
    if (ra !== rb) return ra - rb;
    return b.open - a.open;
  });
  return rows.map((row) => ({
    row,
    rank: rankOf.get(row.id) ?? null,
    observation: byLabel.get(row.id) ?? null,
  }));
}

export default async function AnalyticsHybridLab({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  await requireAnalyticsLabReviewer();
  const { state } = await searchParams;
  const stateId = parseLabState(state);
  const view = labView(stateId);
  const rows = orderedRows(view);

  return (
    <>
      <main className="min-h-screen bg-white text-ink">
        {/* ── Section 1 · The read. ───────────────────────────────────── */}
        <div className={`${COLUMN} pt-14 md:pt-20`}>
          <header>
            <p className="font-mono text-[11px] uppercase leading-[1.6] tracking-[0.13em] text-ink-faint">
              <span className="text-ink">{view.scope.projectName}</span>
              {view.scope.periodName ? (
                <>
                  <span aria-hidden="true"> &middot; </span>
                  {view.scope.periodName}
                </>
              ) : null}
              <span aria-hidden="true"> &middot; </span>read {view.scope.readAt}
            </p>
            <p className="mt-2 text-[13px] leading-[1.6] text-ink-soft">
              {view.scope.declaration}
            </p>
          </header>

          {view.banner ? (
            <div className="mt-7 border-l-2 border-ink pl-4">
              <p className="text-[15px] leading-[1.6] text-ink">
                {view.banner.headline}
              </p>
              <p className="mt-1 text-[14px] leading-[1.6] text-ink-soft">
                {view.banner.detail}
              </p>
            </div>
          ) : null}

          <section aria-labelledby="read-heading" className="pt-9">
            <h1 id="read-heading" className="sr-only">
              What this reading of {view.scope.projectName} found
            </h1>
            <div className="max-w-[46ch] text-[clamp(1.3rem,1.05rem+1vw,1.7rem)] font-medium leading-[1.44] tracking-[-0.021em] text-ink">
              {view.read.map((line, i) => (
                <p key={line.slice(0, 24)} className={i > 0 ? "mt-4 text-ink-soft" : ""}>
                  {withReceipts(line, `read-${i}`)}
                </p>
              ))}
            </div>
          </section>
        </div>

        {/* ── Section 2 · Ranked exceptions fused into the full ledger. ── */}
        <section aria-labelledby="ledger-heading" className={`${COLUMN} pt-12`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink pb-2">
            <h2
              id="ledger-heading"
              className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink"
            >
              What deserves attention, inside everything else
            </h2>
            <p className="font-mono text-[11px] text-ink-faint">
              {view.suppression.disclosure}
            </p>
          </div>

          {rows.length > 0 ? (
            <ul className="divide-y divide-hairline-soft">
              {rows.map(({ row, rank, observation }) => (
                <li
                  key={row.id}
                  className={`py-5 ${rank ? "border-l-2 border-accent pl-4" : "pl-0"}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <h3 className="flex items-baseline gap-2.5">
                      {rank ? (
                        <span className="font-mono text-[11px] tabular-nums text-accent">
                          {String(rank).padStart(2, "0")}
                        </span>
                      ) : null}
                      <span
                        className={`text-[15px] leading-[1.4] ${
                          row.quiet ? "text-ink-soft" : "text-ink"
                        }`}
                      >
                        {row.name}
                      </span>
                    </h3>
                    <p className="font-mono text-[12px] tabular-nums text-ink-soft">
                      {row.open} open
                      <span aria-hidden="true"> &middot; </span>
                      {row.pastDate} past date
                      <span aria-hidden="true"> &middot; </span>
                      {row.lastRecorded ? (
                        <>recorded {row.lastRecorded}</>
                      ) : (
                        <>
                          <span aria-hidden="true">{UNKNOWN_MARK}</span>
                          <span className="sr-only">Nothing recorded.</span>
                        </>
                      )}
                    </p>
                  </div>

                  {observation ? (
                    <>
                      <p className="mt-2.5 max-w-[58ch] text-[15px] leading-[1.5] text-ink">
                        {withReceipts(observation.claim, observation.id)}
                      </p>
                      <div className="mt-2.5 max-w-[62ch] space-y-1.5">
                        <p className="text-[13px] leading-[1.6] text-ink-soft">
                          {observation.changed} {observation.matters}
                        </p>
                        <p className="text-[13px] leading-[1.6] text-ink">
                          {observation.action.text}
                          {observation.action.rule ? (
                            <span className="mt-0.5 block text-[12px] leading-[1.5] text-ink-faint">
                              Suggested by a rule, not by a person:{" "}
                              {observation.action.rule}
                            </span>
                          ) : null}
                        </p>
                        {observation.limitation ? (
                          <p className="border-l border-hairline pl-3 text-[12px] leading-[1.55] text-ink-faint">
                            {observation.limitation}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <TruthWord truthClass={observation.truthClass} />
                        <p className="font-mono text-[10px] text-ink-faint">
                          {observation.coverage} {observation.freshness}
                        </p>
                      </div>
                      <details className="group mt-2.5">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                          <span>
                            {observation.evidence.length === 1
                              ? "1 record"
                              : `${observation.evidence.length} records`}
                          </span>
                          <span
                            aria-hidden="true"
                            className="transition-transform group-open:rotate-90"
                          >
                            &rsaquo;
                          </span>
                        </summary>
                        <ol className="mt-2 space-y-2 border-l border-hairline pl-3">
                          {observation.evidence.map((ev) => (
                            <li key={ev.id}>
                              <Link
                                href={ev.route}
                                className="block outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                              >
                                <span className="block text-[13px] leading-[1.45] text-ink-soft">
                                  {ev.title}
                                </span>
                                <span className="block font-mono text-[10px] text-ink-faint">
                                  {ev.source} &middot; {ev.meta}
                                </span>
                              </Link>
                              {ev.caveat ? (
                                <p className="text-[11px] leading-[1.5] text-ink-soft">
                                  {ev.caveat}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </details>
                    </>
                  ) : row.quiet ? (
                    <p className="mt-1 text-[12px] leading-[1.5] text-ink-faint">
                      Nothing to report.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 max-w-[60ch] text-[15px] leading-[1.6] text-ink-soft">
              {"headline" in view.ledger.status ? view.ledger.status.headline : ""}{" "}
              {"because" in view.ledger.status ? view.ledger.status.because : ""}
            </p>
          )}

          <div className="mt-4 space-y-1.5">
            <p className="text-[13px] leading-[1.6] text-ink-soft">
              {view.ledger.accounting}
            </p>
            <p className="text-[13px] leading-[1.6] text-ink-faint">
              {view.ledger.denominator}
            </p>
            {view.observations.length > 0 ? (
              <p className="text-[13px] leading-[1.6] text-ink-faint">
                {view.rankingRule}
              </p>
            ) : null}
          </div>

          <SuppressedObservations view={view} />
        </section>

        {/* ── Section 3 · The freed section. Not a footnote. ──────────── */}
        <section aria-labelledby="limits-heading" className={`${COLUMN} pt-14`}>
          <h2
            id="limits-heading"
            className="border-b border-ink pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink"
          >
            What this cannot tell you
          </h2>

          <p className="mt-5 max-w-[52ch] text-[clamp(1.1rem,1rem+0.5vw,1.3rem)] font-medium leading-[1.45] tracking-[-0.015em] text-ink">
            {view.unsupported.length + 1} questions this reading cannot answer.
            None of them is answered with a zero.
          </p>

          <ol className="mt-7 divide-y divide-hairline-soft border-t border-hairline-soft">
            {view.unsupported.map((metric) => (
              <li key={metric.name} className="py-4 md:flex md:gap-8">
                <h3 className="text-[15px] leading-[1.45] text-ink md:w-[240px] md:shrink-0">
                  {metric.name}
                </h3>
                <div className="mt-1 md:mt-0 md:flex-1">
                  <p className="max-w-[58ch] text-[14px] leading-[1.6] text-ink-soft">
                    {metric.because}
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.55] text-ink-faint">
                    Would need: {metric.wouldNeed}
                  </p>
                </div>
              </li>
            ))}

            {/* The trend takes its place in this list rather than occupying a
                section it cannot fill. */}
            <li className="py-4 md:flex md:gap-8">
              <h3 className="text-[15px] leading-[1.45] text-ink md:w-[240px] md:shrink-0">
                {view.trend.title}
              </h3>
              <div className="mt-1 md:mt-0 md:flex-1">
                <p className="max-w-[58ch] text-[14px] leading-[1.6] text-ink-soft">
                  {"headline" in view.trend.status ? view.trend.status.headline : ""}{" "}
                  {"because" in view.trend.status ? view.trend.status.because : ""}
                </p>
                {view.trend.status.kind === "insufficient-history" ? (
                  <p className="mt-1 font-mono text-[12px] text-ink-faint">
                    {view.trend.status.comparableReadings} readings kept &middot;{" "}
                    {view.trend.status.readingsNeeded} needed before a line means
                    anything
                  </p>
                ) : null}
              </div>
            </li>
          </ol>

          {/* The one-Project gap, given real weight rather than a footnote. */}
          <div className="mt-10 border-t border-hairline pt-8">
            <h3 className="text-[17px] font-medium leading-[1.45] tracking-[-0.014em] text-ink">
              {view.portfolioGap.statement}
            </h3>
            <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.62] text-ink-soft">
              {view.portfolioGap.because}
            </p>
            <details className="mt-4">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                The {view.portfolioGap.otherProjectCount} others you can open
              </summary>
              <ul className="mt-3 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
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
          </div>
        </section>

        <footer className={`${COLUMN} mt-14 border-t border-hairline py-10`}>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint">
            Where this came from
          </h2>
          <dl className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-3">
            {view.coverage.map((source) => (
              <div key={source.source}>
                <dt className="text-[13px] text-ink">{source.source}</dt>
                <dd className="text-[13px] leading-[1.55] text-ink-soft">
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
        </footer>
      </main>

      <AnalyticsLabChrome variant="hybrid" state={stateId} proves={view.proves} />
    </>
  );
}
