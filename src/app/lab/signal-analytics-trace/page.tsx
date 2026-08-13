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
  labView,
  parseLabState,
  type Commitment,
  type Observation,
} from "@/lib/analytics-lab/model";

/**
 * /lab/signal-analytics-trace — "Plan Trace"
 *
 * WHAT CHANGED, AND WHY. This variant was briefed as accepted-versus-current
 * plan movement. That device cannot be built: `milestone_movement` needs
 * Timeline `activity` rows that nothing writes, no snapshot writer has ever
 * run, and no authoritative acceptance event exists to serve as a baseline
 * (docs/wave/ANALYTICS_TRUTH.md R4/R7). Drawing plan movement here would have
 * meant inventing the history it plots.
 *
 * So the trace is re-founded on the comparison that IS real without any
 * history at all: a dated commitment somebody wrote down, against the current
 * state of the work behind it. Every date on screen exists in a record right
 * now. Nothing is interpolated, smoothed, or remembered.
 *
 * All three truth classes appear in one device, and are told apart by shape
 * and by word, never by colour alone:
 *   · REPORTED — the commitment date, with its author and the day they wrote it.
 *   · OBSERVED — each piece of linked work, at its own recorded date.
 *   · INFERRED — the gap between them, with its rule stated.
 *
 * The honest cost is drawn rather than hidden: where a line showing how the
 * commitment date itself moved would go, there is a dashed stub and the
 * sentence saying nothing records that. A reader learns the limit at the exact
 * moment they would otherwise assume the opposite.
 *
 * The trace is the one graphical device on the page, and it carries a
 * structured table alternative. The trend section still refuses to draw.
 */

export const metadata: Metadata = {
  title: "Analytics · Plan Trace · Lab",
  description: "Composition study for the Home analytics view. Review only.",
  robots: ANALYTICS_LAB_ROBOTS,
};

const COLUMN = "mx-auto w-full max-w-[880px] px-6 md:px-8";

/** The window the trace is drawn across, in days either side of the reading. */
const WINDOW_BEFORE = 12;
const WINDOW_AFTER = 14;
const SPAN = WINDOW_BEFORE + WINDOW_AFTER;

/** Position on the rule, as a percentage. Linear and unsmoothed, on purpose. */
function positionOf(dayOffset: number): number {
  const clamped = Math.max(-WINDOW_BEFORE, Math.min(WINDOW_AFTER, dayOffset));
  return ((clamped + WINDOW_BEFORE) / SPAN) * 100;
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

function Trace({ commitment }: { commitment: Commitment }) {
  const todayPos = positionOf(0);
  const commitPos = positionOf(commitment.dayOffset);
  const late = commitment.items.filter((i) => i.state === "past-date");

  return (
    <article className="border-t border-hairline py-9 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-[17px] font-medium leading-[1.4] tracking-[-0.014em] text-ink md:text-[18px]">
          {commitment.title}
        </h3>
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-faint">
          {commitment.date} &middot; in {commitment.dayOffset} days
        </p>
      </div>

      <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-soft">
        Written by {commitment.authoredBy} on {commitment.authoredOn}.{" "}
        {late.length > 0
          ? `${late.length} of the ${commitment.items.length} pieces of work behind it are past their own dates.`
          : `All ${commitment.items.length} pieces of work behind it are still ahead of their dates.`}
      </p>

      {/* ── The device. Direct labels, no axis furniture, no smoothing. ── */}
      <div className="mt-7">
        <div className="relative h-[104px]" aria-hidden="true">
          {/* The base rule: the window this is drawn across. */}
          <div className="absolute inset-x-0 top-[52px] h-px bg-hairline" />

          {/* Today. The one earned indigo moment in this composition. */}
          <div
            className="absolute top-[34px] bottom-[26px] w-px bg-accent"
            style={{ left: `${todayPos}%` }}
          />
          <span
            className="absolute top-[16px] -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.1em] text-accent"
            style={{ left: `${todayPos}%` }}
          >
            today
          </span>

          {/* The commitment: reported truth, drawn as a solid stop. */}
          <div
            className="absolute top-[40px] h-[24px] w-[2px] bg-ink"
            style={{ left: `${commitPos}%` }}
          />
          <span
            className="absolute top-[70px] max-w-[180px] -translate-x-1/2 text-center font-mono text-[10px] leading-[1.3] text-ink"
            style={{ left: `${commitPos}%` }}
          >
            {commitment.date}
          </span>

          {/* The work: observed truth. Past its date is filled, ahead is
              hollow — shape, not colour, carries the meaning. */}
          {commitment.items.map((item) => (
            <span
              key={item.id}
              className={`absolute top-[46px] h-[13px] w-[13px] -translate-x-1/2 rounded-full border ${
                item.state === "past-date"
                  ? "border-ink bg-ink"
                  : "border-ink-faint bg-white"
              }`}
              style={{ left: `${positionOf(item.dayOffset)}%` }}
            />
          ))}
        </div>

        {/* The refusal, drawn where the movement line would have gone. */}
        <div className="mt-1 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-0 w-[72px] shrink-0 border-t border-dashed border-ink-ghost"
          />
          <p className="text-[12px] leading-[1.55] text-ink-faint">
            <span className="text-ink-soft">
              {"headline" in commitment.movement ? commitment.movement.headline : ""}
            </span>{" "}
            {"because" in commitment.movement ? commitment.movement.because : ""}
          </p>
        </div>
      </div>

      {/* The accessible structured alternative to the drawing above. */}
      <details className="group mt-5">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
          <span>The same thing as a table</span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">
            &rsaquo;
          </span>
        </summary>
        <table className="mt-3 w-full border-collapse text-left">
          <caption className="sr-only">
            {commitment.title}, due {commitment.date}, and the work behind it.
          </caption>
          <thead>
            <tr className="border-b border-hairline-soft">
              <th
                scope="col"
                className="py-2 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
              >
                Work
              </th>
              <th
                scope="col"
                className="py-2 pl-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
              >
                Its date
              </th>
              <th
                scope="col"
                className="py-2 pl-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
              >
                Where it stands
              </th>
            </tr>
          </thead>
          <tbody>
            {commitment.items.map((item) => (
              <tr key={item.id} className="border-b border-hairline-soft">
                <th
                  scope="row"
                  className="py-2.5 pr-4 text-left text-[13px] font-normal leading-[1.45] text-ink"
                >
                  <Link
                    href={item.route}
                    className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {item.title}
                  </Link>
                </th>
                <td className="py-2.5 pl-4 text-right font-mono text-[12px] tabular-nums text-ink-soft">
                  {item.date}
                </td>
                <td className="py-2.5 pl-4 text-right text-[12px] text-ink-soft">
                  {item.state === "past-date"
                    ? `${Math.abs(item.dayOffset)} days past its date`
                    : `${item.dayOffset} days to go`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </article>
  );
}

export default async function AnalyticsTraceLab({
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
        <div className={`${COLUMN} pt-14 md:pt-20`}>
          <header>
            <p className="font-mono text-[11px] uppercase leading-[1.6] tracking-[0.13em] text-ink-faint">
              <span className="text-ink">{view.scope.projectName}</span>
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

          {/* The read belongs to the section below it, not to one of its own:
              §3 allows three principal sections, and here they are the trace,
              the ledger and the trend. Splitting the conclusion into a fourth
              would buy a heading and spend a section. */}
          <div className="pt-9">
            <h1 className="max-w-[54ch] text-[clamp(1.3rem,1.05rem+0.9vw,1.6rem)] font-medium leading-[1.45] tracking-[-0.02em] text-ink">
              {view.read[0]}
            </h1>
            {view.read.slice(1).map((line) => (
              <p
                key={line.slice(0, 24)}
                className="mt-3 max-w-[62ch] text-[15px] leading-[1.62] text-ink-soft"
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* ── Section 1 · What is committed, and what stands behind it. ── */}
        <section aria-labelledby="trace-heading" className={`${COLUMN} pt-12`}>
          <h2
            id="trace-heading"
            className="border-b border-ink pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink"
          >
            What is committed, and what stands behind it
          </h2>

          {view.commitments.length > 0 ? (
            <div className="mt-2">
              {view.commitments.map((c) => (
                <Trace key={c.id} commitment={c} />
              ))}
            </div>
          ) : (
            <div className="py-9">
              <p className="max-w-[58ch] text-[16px] leading-[1.55] text-ink">
                No commitment could be read, so nothing is drawn here.
              </p>
              <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.62] text-ink-soft">
                That is not the same as having no commitments. This section is
                empty because the source could not be read, and an empty drawing
                would have said the opposite.
              </p>
            </div>
          )}

          {shown.length > 0 ? (
            <>
              <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-hairline pb-2">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint">
                  What deserves attention
                </h3>
                <p className="font-mono text-[11px] text-ink-faint">
                  {view.suppression.disclosure}
                </p>
              </div>
              <ol className="divide-y divide-hairline-soft">
                {shown.map((o, i) => (
                  <li key={o.id} className="flex gap-4 py-6 md:gap-6">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-ghost"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="max-w-[58ch] text-[16px] font-medium leading-[1.45] tracking-[-0.01em] text-ink">
                        {o.claim}
                      </h4>
                      <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.6] text-ink-soft">
                        {o.changed} {o.matters}
                      </p>
                      <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.6] text-ink">
                        {o.action.text}
                        {o.action.rule ? (
                          <span className="mt-0.5 block text-[12px] leading-[1.5] text-ink-faint">
                            Suggested by a rule, not by a person: {o.action.rule}
                          </span>
                        ) : null}
                      </p>
                      {o.limitation ? (
                        <p className="mt-2 max-w-[62ch] border-l border-hairline pl-3 text-[12px] leading-[1.55] text-ink-faint">
                          {o.limitation}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        <TruthWord truthClass={o.truthClass} />
                        <p className="font-mono text-[10px] text-ink-faint">
                          {o.coverage} {o.freshness}
                        </p>
                      </div>
                      <details className="group mt-3">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                          <span>
                            {o.evidence.length === 1
                              ? "1 record"
                              : `${o.evidence.length} records`}
                          </span>
                          <span
                            aria-hidden="true"
                            className="transition-transform group-open:rotate-90"
                          >
                            &rsaquo;
                          </span>
                        </summary>
                        <ol className="mt-2 space-y-2 border-l border-hairline pl-3">
                          {o.evidence.map((ev) => (
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
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[13px] leading-[1.6] text-ink-faint">
                {view.rankingRule}
              </p>
              <SuppressedObservations view={view} />
            </>
          ) : null}
        </section>

        {/* ── Section 2 · Every label, accounted for. ─────────────────── */}
        <section aria-labelledby="ledger-heading" className={`${COLUMN} pt-12`}>
          <h2
            id="ledger-heading"
            className="border-b border-hairline pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint"
          >
            Every label in this Project
          </h2>
          {view.ledger.rows.length > 0 ? (
            <ul className="divide-y divide-hairline-soft">
              {view.ledger.rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3"
                >
                  <span className="text-[14px] leading-[1.45] text-ink">
                    {row.name}
                  </span>
                  <span className="font-mono text-[12px] tabular-nums text-ink-soft">
                    {row.open} open
                    <span aria-hidden="true"> &middot; </span>
                    {row.pastDate} past date
                    <span aria-hidden="true"> &middot; </span>
                    {row.lastRecorded ? `recorded ${row.lastRecorded}` : "never recorded"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[14px] leading-[1.6] text-ink-soft">
              {"headline" in view.ledger.status ? view.ledger.status.headline : ""}{" "}
              {"because" in view.ledger.status ? view.ledger.status.because : ""}
            </p>
          )}
          <p className="mt-3 text-[13px] leading-[1.6] text-ink-soft">
            {view.ledger.accounting}
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-faint">
            {view.ledger.denominator}
          </p>
        </section>

        {/* ── Section 3 · The trend. Still refusing. ──────────────────── */}
        <section aria-labelledby="trend-heading" className={`${COLUMN} pt-12`}>
          <h2
            id="trend-heading"
            className="border-b border-hairline pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint"
          >
            {view.trend.title}
          </h2>
          <p className="mt-4 text-[16px] leading-[1.5] text-ink">
            {"headline" in view.trend.status ? view.trend.status.headline : ""}
          </p>
          <p className="mt-1.5 max-w-[62ch] text-[14px] leading-[1.62] text-ink-soft">
            {"because" in view.trend.status ? view.trend.status.because : ""}
          </p>
          <p className="mt-2 text-[12px] leading-[1.6] text-ink-faint">
            The trace above is not a trend. It plots dates that exist in records
            right now, and makes no claim about how any of them got there.
          </p>
        </section>

        <footer className={`${COLUMN} mt-14 border-t border-hairline py-12`}>
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint">
                Where this came from
              </h2>
              <dl className="mt-4 space-y-2.5">
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
            </div>
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint">
                What this cannot tell you
              </h2>
              <dl className="mt-4 space-y-3">
                {view.unsupported.map((metric) => (
                  <div key={metric.name}>
                    <dt className="text-[13px] text-ink">{metric.name}</dt>
                    <dd className="text-[13px] leading-[1.55] text-ink-soft">
                      {metric.because}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint">
                One Project at a time
              </h2>
              <p className="mt-4 text-[13px] leading-[1.6] text-ink-soft">
                {view.portfolioGap.statement}
              </p>
              <p className="mt-2 text-[13px] leading-[1.6] text-ink-faint">
                {view.portfolioGap.because}
              </p>
            </div>
          </div>
        </footer>
      </main>

      <AnalyticsLabChrome variant="trace" state={stateId} proves={view.proves} />
    </>
  );
}
