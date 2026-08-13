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
 * /lab/signal-analytics-ledger — "Evidence Ledger"
 *
 * THE IDEA. One table, not two sections. Most analytics surfaces show you the
 * exceptions at the top and then a table of everything underneath, which
 * quietly says the same thing twice and makes the reader reconcile the two by
 * eye. Here the ledger IS the exception list: every label in the Project sits
 * in one ordered table, the ranked exceptions are simply its first three rows,
 * and each of those carries its claim, its grammar and its evidence in place.
 * Reading order and completeness become the same object.
 *
 * The comparison is honest because it is inside one Project: every row shares
 * a denominator and a permission boundary. The cross-Project version of this
 * table never could be — the providers bind to one workspace, so a ledger of
 * Projects would be a fabrication (docs/wave/ANALYTICS_TRUTH.md).
 *
 * The "Waiting on" column is deliberately a column of dashes. The question is
 * worth asking and the answer does not exist, so the column stays and says so.
 * Deleting it would let a reader assume nothing is waiting on anything.
 *
 * Server-rendered, no client JavaScript, state carried in the URL.
 */

export const metadata: Metadata = {
  title: "Analytics · Evidence Ledger · Lab",
  description: "Composition study for the Home analytics view. Review only.",
  robots: ANALYTICS_LAB_ROBOTS,
};

const COLUMN = "mx-auto w-full max-w-[1000px] px-6 md:px-8";

const WAITING_ON_REASON =
  "No answer. The column that recorded this was retired in a data change.";

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

/** Ranked exceptions first, in rank order, then everything else. */
function orderedRows(view: LabView) {
  const shown = view.observations.slice(0, 3);
  const rankOf = new Map<string, number>();
  shown.forEach((o, i) => {
    if (!rankOf.has(o.labelId)) rankOf.set(o.labelId, i + 1);
  });
  const byLabel = new Map<string, Observation>();
  shown.forEach((o) => {
    if (!byLabel.has(o.labelId)) byLabel.set(o.labelId, o);
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

export default async function AnalyticsLedgerLab({
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
        <div className={`${COLUMN} pt-14 md:pt-20`}>
          {/* ── Scope. Stated before anything is counted. ─────────────── */}
          <header className="flex flex-col gap-3 border-b border-ink pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.022em] text-ink md:text-[26px]">
                {view.scope.projectName}
              </h1>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-soft">
                {view.scope.declaration}
              </p>
            </div>
            <p className="font-mono text-[11px] uppercase leading-[1.6] tracking-[0.12em] text-ink-faint sm:text-right">
              {view.scope.periodName ?? "No planning period"}
              <span className="block">read {view.scope.readAt}</span>
            </p>
          </header>

          {view.banner ? (
            <div className="mt-6 border-l-2 border-ink pl-4">
              <p className="text-[15px] leading-[1.6] text-ink">
                {view.banner.headline}
              </p>
              <p className="mt-1 text-[14px] leading-[1.6] text-ink-soft">
                {view.banner.detail}
              </p>
            </div>
          ) : null}

          {/* ── The written conclusion survives the table. ────────────── */}
          <section aria-labelledby="read-heading" className="pt-8">
            <h2 id="read-heading" className="sr-only">
              What this reading found
            </h2>
            <div className="max-w-[62ch]">
              {view.read.map((line, i) => (
                <p
                  key={line.slice(0, 24)}
                  className={
                    i === 0
                      ? "text-[19px] font-medium leading-[1.5] tracking-[-0.015em] text-ink md:text-[21px]"
                      : "mt-3 text-[15px] leading-[1.62] text-ink-soft"
                  }
                >
                  {line}
                </p>
              ))}
            </div>
          </section>
        </div>

        {/* ── Section 1 + 2 fused · the ordered ledger. ───────────────── */}
        <section aria-labelledby="ledger-heading" className={`${COLUMN} pt-12`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink pb-2">
            <h2
              id="ledger-heading"
              className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink"
            >
              Every label, ranked
            </h2>
            <p className="font-mono text-[11px] text-ink-faint">
              {view.suppression.disclosure}
            </p>
          </div>

          {view.ledger.rows.length === 0 ? (
            <div className="py-10">
              <p className="text-[16px] leading-[1.6] text-ink">
                {"headline" in view.ledger.status ? view.ledger.status.headline : ""}
              </p>
              <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.62] text-ink-soft">
                {"because" in view.ledger.status ? view.ledger.status.because : ""}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <caption className="sr-only">
                  Every label in this Project, the ranked exceptions first.{" "}
                  {view.ledger.denominator}
                </caption>
                <thead>
                  <tr className="border-b border-hairline">
                    <th
                      scope="col"
                      className="w-[46%] py-2.5 pr-4 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
                    >
                      Label
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 pl-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
                    >
                      Open
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 pl-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
                    >
                      Past date
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 pl-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
                    >
                      Last recorded
                    </th>
                    <th
                      scope="col"
                      className="py-2.5 pl-4 text-right font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-ink-faint"
                    >
                      Waiting on
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ row, rank, observation }) => (
                    <tr
                      key={row.id}
                      className={`border-b border-hairline-soft align-top ${
                        rank ? "bg-accent-tint/40" : ""
                      }`}
                    >
                      <th
                        scope="row"
                        className={`py-4 pr-4 text-left font-normal ${
                          rank ? "border-l-2 border-accent pl-3" : "pl-0"
                        }`}
                      >
                        <span className="flex items-baseline gap-2.5">
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
                        </span>

                        {observation ? (
                          <>
                            <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.55] text-ink">
                              {observation.claim}
                            </p>
                            <details className="group mt-2.5">
                              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                                <span>Why, and what to do</span>
                                <span
                                  aria-hidden="true"
                                  className="transition-transform group-open:rotate-90"
                                >
                                  &rsaquo;
                                </span>
                              </summary>
                              <div className="mt-3 max-w-[58ch] space-y-2.5 border-l border-hairline pl-3">
                                <p className="text-[13px] leading-[1.6] text-ink-soft">
                                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                                    Changed
                                  </span>{" "}
                                  {observation.changed}
                                </p>
                                <p className="text-[13px] leading-[1.6] text-ink-soft">
                                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                                    Matters
                                  </span>{" "}
                                  {observation.matters}
                                </p>
                                <p className="text-[13px] leading-[1.6] text-ink">
                                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                                    Next
                                  </span>{" "}
                                  {observation.action.text}
                                  {observation.action.rule ? (
                                    <span className="mt-0.5 block text-[12px] leading-[1.5] text-ink-faint">
                                      Suggested by a rule, not by a person:{" "}
                                      {observation.action.rule}
                                    </span>
                                  ) : null}
                                </p>
                                {observation.limitation ? (
                                  <p className="text-[12px] leading-[1.55] text-ink-faint">
                                    {observation.limitation}
                                  </p>
                                ) : null}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1">
                                  <TruthWord truthClass={observation.truthClass} />
                                  <p className="font-mono text-[10px] text-ink-faint">
                                    {observation.coverage} {observation.freshness}
                                  </p>
                                </div>
                                <ol className="space-y-2 pt-1">
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
                              </div>
                            </details>
                          </>
                        ) : row.quiet ? (
                          <p className="mt-1 text-[12px] leading-[1.5] text-ink-faint">
                            Nothing to report.
                          </p>
                        ) : null}
                      </th>

                      <td className="py-4 pl-4 text-right font-mono text-[14px] tabular-nums text-ink">
                        {row.open}
                      </td>
                      <td className="py-4 pl-4 text-right font-mono text-[14px] tabular-nums text-ink-soft">
                        {row.pastDate}
                      </td>
                      <td className="py-4 pl-4 text-right font-mono text-[12px] tabular-nums text-ink-soft">
                        {row.lastRecorded ?? (
                          <>
                            <span aria-hidden="true" className="text-ink-faint">
                              {UNKNOWN_MARK}
                            </span>
                            <span className="sr-only">
                              Nothing recorded for this label.
                            </span>
                          </>
                        )}
                        {row.daysSinceRecorded !== null ? (
                          <span className="block text-[11px] text-ink-faint">
                            {row.daysSinceRecorded}d ago
                          </span>
                        ) : null}
                      </td>
                      {/* A column of dashes, on purpose. The question is real
                          and the answer does not exist; hiding the column
                          would let a reader assume the answer is "none". */}
                      <td className="py-4 pl-4 text-right font-mono text-[14px] text-ink-faint">
                        <span aria-hidden="true">{UNKNOWN_MARK}</span>
                        <span className="sr-only">{WAITING_ON_REASON}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 grid gap-x-10 gap-y-3 md:grid-cols-2">
            <div>
              <p className="text-[13px] leading-[1.6] text-ink-soft">
                {view.ledger.accounting}
              </p>
              <p className="mt-2 text-[13px] leading-[1.6] text-ink-faint">
                {view.ledger.denominator}
              </p>
            </div>
            <div>
              <p className="text-[13px] leading-[1.6] text-ink-faint">
                <span className="text-ink-soft">Waiting on</span> is a column of
                dashes because nothing records that answer today, not because
                nothing is waiting. {WAITING_ON_REASON}
              </p>
              {view.observations.length > 0 ? (
                <p className="mt-2 text-[13px] leading-[1.6] text-ink-faint">
                  {view.rankingRule}
                </p>
              ) : null}
            </div>
          </div>

          <SuppressedObservations view={view} />
        </section>

        <section aria-labelledby="trend-heading" className={`${COLUMN} pt-12`}>
          <h2
            id="trend-heading"
            className="border-b border-hairline pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink-faint"
          >
            {view.trend.title}
          </h2>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <p className="text-[16px] leading-[1.5] text-ink">
              {"headline" in view.trend.status ? view.trend.status.headline : ""}
            </p>
            <p className="max-w-[58ch] text-[13px] leading-[1.6] text-ink-soft">
              {"because" in view.trend.status ? view.trend.status.because : ""}
            </p>
          </div>
          {view.trend.status.kind === "insufficient-history" ? (
            <p className="mt-3 font-mono text-[12px] text-ink-faint">
              {view.trend.status.comparableReadings} readings kept &middot;{" "}
              {view.trend.status.readingsNeeded} needed
            </p>
          ) : null}
        </section>

        {/* ── Provenance and limits, outside the section budget. ──────── */}
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
              <details className="mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint underline decoration-dotted underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                  The {view.portfolioGap.otherProjectCount} others you can open
                </summary>
                <ul className="mt-2 space-y-1">
                  {view.portfolioGap.others.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={p.route}
                        className="block text-[12px] leading-[1.5] text-ink-soft underline decoration-hairline underline-offset-4 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        </footer>
      </main>

      <AnalyticsLabChrome variant="ledger" state={stateId} proves={view.proves} />
    </>
  );
}
