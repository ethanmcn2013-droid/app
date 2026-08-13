import type { Metadata } from "next";
import type { ReactNode } from "react";
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
  type LabStateId,
} from "@/lib/analytics-lab/model";

/**
 * /lab/signal-analytics-w — "W · The Wire"
 *
 * THE WILDCARD. The register goes out the window on purpose. What is broken,
 * deliberately, and what is not:
 *
 * BROKEN
 *   · Typeface. Geist Mono sets the entire surface, including the display
 *     claims. The register makes mono a supporting face; here it is the voice.
 *   · Palette. The indigo anchor is absent. Ink on warm paper, plus one
 *     stamped vermilion that appears only on an exception and never alone —
 *     it is always accompanied by the word, so nothing is colour-only.
 *   · Paper. Warm, not the locked white.
 *   · Anatomy. Not a scrolled page. A briefing is PACED: one thing at a time,
 *     advanced deliberately, with a spine showing where you are in it.
 *   · Scale. Claims are set at display size, far past the heading step.
 *   · Motion. Generous and choreographed — each line sets itself like
 *     something being printed, and the stamp lands.
 *
 * NOT BROKEN, AND NOT NEGOTIABLE
 *   · Voice. Plain English, active, no exclamation marks.
 *   · Every truth rule. One Project and it says so; every label accounted for;
 *     five observations with three shown and five disclosed; unknown never
 *     rendered as zero; no chart; no invented portfolio.
 *   · Accessibility. Real headings and landmarks, keyboard-operable because
 *     advancing is a link, visible focus, reduced-motion resolves everything
 *     instantly, and "Read it all at once" renders the entire briefing as one
 *     linear document — the structured alternative to the paced experience,
 *     and what a reader gets with no JavaScript at all. There is none here.
 *
 * WHY IT MIGHT BE RIGHT. A brief is a thing someone gives you. Pacing it puts
 * one claim in front of the reader at a size they cannot skim past, which is
 * the opposite of a dashboard's invitation to graze. The close is the honest
 * one-Project gap, and giving it a whole card makes the product's biggest
 * current limit the last thing the reader is told rather than a footnote.
 */

export const metadata: Metadata = {
  title: "Analytics · W · The Wire · Lab",
  description: "Composition study for the Home analytics view. Review only.",
  robots: ANALYTICS_LAB_ROBOTS,
};

type Card = {
  key: string;
  kicker: string;
  node: ReactNode;
};

function cardHref(state: LabStateId, index: number, all: boolean): string {
  const params = new URLSearchParams();
  if (state !== "today") params.set("state", state);
  if (all) params.set("read", "all");
  else if (index > 0) params.set("card", String(index));
  const q = params.toString();
  return q ? `/lab/signal-analytics-w?${q}` : "/lab/signal-analytics-w";
}

export default async function AnalyticsWireLab({
  searchParams,
}: {
  searchParams: Promise<{
    state?: string | string[];
    card?: string | string[];
    read?: string | string[];
  }>;
}) {
  await requireAnalyticsLabReviewer();
  const params = await searchParams;
  const stateId = parseLabState(params.state);
  const view = labView(stateId);
  const readAll =
    (Array.isArray(params.read) ? params.read[0] : params.read) === "all";
  const shown = view.observations.slice(0, 3);

  // ── The briefing, as a sequence ───────────────────────────────────────────
  const cards: Card[] = [];

  cards.push({
    key: "read",
    kicker: "The reading",
    node: (
      <>
        <p className="wire-line wire-d0 text-[12px] uppercase tracking-[0.2em] text-wire-soft">
          {view.scope.projectName}
          {view.scope.periodName ? ` · ${view.scope.periodName}` : ""}
        </p>
        <p className="wire-line wire-d1 mt-2 text-[12px] uppercase tracking-[0.2em] text-wire-soft">
          read {view.scope.readAt}
        </p>
        <h2 className="wire-line wire-d2 mt-9 max-w-[22ch] text-[clamp(2rem,1.2rem+3.4vw,3.6rem)] font-medium leading-[1.12] tracking-[-0.035em]">
          {view.read[0]}
        </h2>
        {view.read.slice(1).map((line, i) => (
          <p
            key={line.slice(0, 20)}
            className={`wire-line wire-d${3 + i} mt-6 max-w-[46ch] text-[clamp(0.95rem,0.9rem+0.3vw,1.1rem)] leading-[1.65] text-wire-soft`}
          >
            {line}
          </p>
        ))}
        <p className="wire-line wire-d5 mt-9 max-w-[46ch] border-t border-wire-rule pt-4 text-[13px] leading-[1.6] text-wire-soft">
          {view.scope.declaration}
        </p>
      </>
    ),
  });

  if (view.banner) {
    cards.push({
      key: "banner",
      kicker: "Read this first",
      node: (
        <>
          <h2 className="wire-line wire-d0 max-w-[20ch] text-[clamp(1.8rem,1.1rem+3vw,3.1rem)] font-medium leading-[1.15] tracking-[-0.03em]">
            {view.banner.headline}
          </h2>
          <p className="wire-line wire-d2 mt-6 max-w-[48ch] text-[clamp(0.95rem,0.9rem+0.3vw,1.1rem)] leading-[1.65] text-wire-soft">
            {view.banner.detail}
          </p>
        </>
      ),
    });
  }

  shown.forEach((o, i) => {
    cards.push({
      key: o.id,
      kicker: `Attention ${i + 1} of ${view.suppression.total}`,
      node: (
        <>
          <div className="wire-line wire-d0 flex items-center gap-4">
            {/* Emphasis on top of the claim, never the carrier of it: the
                same fact is stated in words in the heading below, so hiding
                the mark from assistive technology loses nothing. */}
            <span className="wire-stamp" aria-hidden="true">
              {o.stamp}
            </span>
            <span className="text-[12px] uppercase tracking-[0.18em] text-wire-soft">
              {TRUTH_CLASS_LABEL[o.truthClass]}
              <span className="sr-only">
                . This is one of {view.suppression.total} observations.
              </span>
            </span>
          </div>

          <h2 className="wire-line wire-d1 mt-8 max-w-[24ch] text-[clamp(1.6rem,1rem+2.6vw,2.9rem)] font-medium leading-[1.16] tracking-[-0.03em]">
            {o.claim}
          </h2>

          <dl className="mt-9 max-w-[52ch] space-y-5">
            {[
              ["Changed", o.changed],
              ["Matters", o.matters],
            ].map(([term, detail], k) => (
              <div key={term} className={`wire-line wire-d${2 + k}`}>
                <dt className="text-[11px] uppercase tracking-[0.18em] text-wire-faint">
                  {term}
                </dt>
                <dd className="mt-1.5 text-[15px] leading-[1.62] text-wire-soft">
                  {detail}
                </dd>
              </div>
            ))}
            <div className="wire-line wire-d4 border-t border-wire-rule pt-5">
              <dt className="text-[11px] uppercase tracking-[0.18em] text-wire-faint">
                Next
              </dt>
              <dd className="mt-1.5 text-[16px] leading-[1.6] text-wire-ink">
                {o.action.text}
                {o.action.rule ? (
                  <span className="mt-1.5 block text-[13px] leading-[1.55] text-wire-faint">
                    Suggested by a rule, not by a person: {o.action.rule}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          {o.limitation ? (
            <p className="wire-line wire-d5 mt-6 max-w-[52ch] border-l-2 border-wire-rule pl-4 text-[13px] leading-[1.6] text-wire-faint">
              {o.limitation}
            </p>
          ) : null}

          <p className="wire-line wire-d5 mt-6 text-[12px] leading-[1.6] text-wire-faint">
            {o.coverage} {o.freshness}
          </p>

          <details className="wire-line wire-d5 mt-5">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-wire-faint underline underline-offset-4 outline-none hover:text-wire-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp">
              {o.evidence.length === 1 ? "1 record" : `${o.evidence.length} records`}
            </summary>
            <ol className="mt-4 max-w-[60ch] divide-y divide-wire-rule border-y border-wire-rule">
              {o.evidence.map((ev) => (
                <li key={ev.id} className="py-2.5">
                  <Link
                    href={ev.route}
                    className="block outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp"
                  >
                    <span className="block text-[13px] leading-[1.5] text-wire-ink">
                      {ev.title}
                    </span>
                    <span className="block text-[11px] uppercase tracking-[0.1em] text-wire-faint">
                      {ev.source} &middot; {ev.meta}
                    </span>
                  </Link>
                  {ev.caveat ? (
                    <p className="mt-1 text-[12px] leading-[1.5] text-wire-soft">
                      {ev.caveat}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
        </>
      ),
    });
  });

  cards.push({
    key: "ledger",
    kicker: "The whole Project",
    node: (
      <>
        <h2 className="wire-line wire-d0 text-[clamp(1.5rem,1rem+2.2vw,2.4rem)] font-medium leading-[1.18] tracking-[-0.03em]">
          Every label in {view.scope.projectName}
        </h2>
        <p className="wire-line wire-d1 mt-4 max-w-[52ch] text-[14px] leading-[1.62] text-wire-soft">
          {view.suppression.disclosure} {view.ledger.accounting}
        </p>

        {view.ledger.rows.length > 0 ? (
          <table className="wire-line wire-d2 mt-8 w-full max-w-[640px] border-collapse text-left">
            <caption className="sr-only">
              Open work by label. {view.ledger.denominator}
            </caption>
            <thead>
              <tr className="border-b border-wire-ink">
                <th
                  scope="col"
                  className="py-2 pr-4 text-[11px] font-normal uppercase tracking-[0.14em] text-wire-faint"
                >
                  Label
                </th>
                <th
                  scope="col"
                  className="py-2 pl-4 text-right text-[11px] font-normal uppercase tracking-[0.14em] text-wire-faint"
                >
                  Open
                </th>
                <th
                  scope="col"
                  className="py-2 pl-4 text-right text-[11px] font-normal uppercase tracking-[0.14em] text-wire-faint"
                >
                  Past date
                </th>
                <th
                  scope="col"
                  className="py-2 pl-4 text-right text-[11px] font-normal uppercase tracking-[0.14em] text-wire-faint"
                >
                  Recorded
                </th>
              </tr>
            </thead>
            <tbody>
              {view.ledger.rows.map((row) => (
                <tr key={row.id} className="border-b border-wire-rule">
                  <th
                    scope="row"
                    className="py-2.5 pr-4 text-left text-[14px] font-normal leading-[1.45] text-wire-ink"
                  >
                    {row.name}
                    {row.carriesException ? (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-wire-stamp">
                        seen above
                      </span>
                    ) : null}
                  </th>
                  <td className="py-2.5 pl-4 text-right text-[14px] tabular-nums text-wire-ink">
                    {row.open}
                  </td>
                  <td className="py-2.5 pl-4 text-right text-[14px] tabular-nums text-wire-soft">
                    {row.pastDate}
                  </td>
                  <td className="py-2.5 pl-4 text-right text-[12px] tabular-nums text-wire-soft">
                    {row.lastRecorded ?? (
                      <>
                        <span aria-hidden="true">{UNKNOWN_MARK}</span>
                        <span className="sr-only">Nothing recorded.</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="wire-line wire-d2 mt-8 max-w-[52ch] text-[15px] leading-[1.62] text-wire-soft">
            {"headline" in view.ledger.status ? view.ledger.status.headline : ""}{" "}
            {"because" in view.ledger.status ? view.ledger.status.because : ""}
          </p>
        )}

        <p className="wire-line wire-d3 mt-5 max-w-[52ch] text-[13px] leading-[1.6] text-wire-faint">
          {view.ledger.denominator}
        </p>
        <div className="wire-line wire-d4">
          <SuppressedObservations view={view} tone="wire" />
        </div>
      </>
    ),
  });

  cards.push({
    key: "limits",
    kicker: "What is not known",
    node: (
      <>
        <h2 className="wire-line wire-d0 max-w-[20ch] text-[clamp(1.6rem,1rem+2.4vw,2.6rem)] font-medium leading-[1.16] tracking-[-0.03em]">
          {view.unsupported.length + 1} questions this cannot answer.
        </h2>
        <p className="wire-line wire-d1 mt-4 max-w-[46ch] text-[15px] leading-[1.62] text-wire-soft">
          None of them is answered with a zero. A zero would be a claim, and
          there is nothing here to claim it with.
        </p>
        <ol className="mt-9 max-w-[60ch] divide-y divide-wire-rule border-y border-wire-rule">
          {view.unsupported.map((metric, i) => (
            <li key={metric.name} className={`wire-line wire-d${2 + Math.min(i, 3)} py-4`}>
              <h3 className="text-[15px] leading-[1.45] text-wire-ink">
                {metric.name}
              </h3>
              <p className="mt-1 text-[13px] leading-[1.6] text-wire-soft">
                {metric.because}
              </p>
              <p className="mt-1 text-[12px] leading-[1.55] text-wire-faint">
                Would need: {metric.wouldNeed}
              </p>
            </li>
          ))}
          <li className="wire-line wire-d5 py-4">
            <h3 className="text-[15px] leading-[1.45] text-wire-ink">
              {view.trend.title}
            </h3>
            <p className="mt-1 text-[13px] leading-[1.6] text-wire-soft">
              {"headline" in view.trend.status ? view.trend.status.headline : ""}{" "}
              {"because" in view.trend.status ? view.trend.status.because : ""}
            </p>
          </li>
        </ol>
      </>
    ),
  });

  cards.push({
    key: "gap",
    kicker: "The end of the wire",
    node: (
      <>
        <h2 className="wire-line wire-d0 max-w-[22ch] text-[clamp(1.7rem,1rem+2.8vw,3rem)] font-medium leading-[1.15] tracking-[-0.032em]">
          {view.portfolioGap.statement}
        </h2>
        <p className="wire-line wire-d2 mt-6 max-w-[48ch] text-[15px] leading-[1.65] text-wire-soft">
          {view.portfolioGap.because}
        </p>
        <div className="wire-line wire-d3 mt-8">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-wire-faint">
            The {view.portfolioGap.otherProjectCount} you can open
          </h3>
          <ul className="mt-3 grid max-w-[62ch] gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {view.portfolioGap.others.map((p) => (
              <li key={p.id}>
                <Link
                  href={p.route}
                  className="block text-[13px] leading-[1.55] text-wire-soft underline decoration-wire-rule underline-offset-4 outline-none hover:text-wire-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="wire-line wire-d5 mt-10 border-t border-wire-rule pt-5">
          <h3 className="text-[11px] uppercase tracking-[0.18em] text-wire-faint">
            Where this came from
          </h3>
          <dl className="mt-3 grid max-w-[62ch] gap-x-8 gap-y-2 sm:grid-cols-3">
            {view.coverage.map((source) => (
              <div key={source.source}>
                <dt className="text-[13px] text-wire-ink">{source.source}</dt>
                <dd className="text-[12px] leading-[1.55] text-wire-soft">
                  {source.detail}
                  {source.status.kind !== "available" && "headline" in source.status ? (
                    <span className="block text-wire-faint">
                      {source.status.headline}
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </>
    ),
  });

  const rawCard = Array.isArray(params.card) ? params.card[0] : params.card;
  const parsed = Number.parseInt(rawCard ?? "0", 10);
  const index = Number.isFinite(parsed)
    ? Math.max(0, Math.min(cards.length - 1, parsed))
    : 0;
  const current = cards[index];

  return (
    <>
      <div className="wire-root min-h-screen">
        {/* ── The spine. Where you are in the briefing. ───────────────── */}
        <nav
          aria-label="Briefing position"
          className="fixed inset-y-0 left-0 z-10 hidden w-[58px] flex-col items-center justify-center gap-3 border-r border-wire-rule md:flex"
        >
          {cards.map((card, i) => (
            <Link
              key={card.key}
              href={cardHref(stateId, i, false)}
              aria-current={!readAll && i === index ? "step" : undefined}
              className="group flex h-[26px] w-[26px] items-center justify-center outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp"
            >
              <span className="sr-only">{card.kicker}</span>
              <span
                aria-hidden="true"
                className={`block h-px transition-all ${
                  !readAll && i === index
                    ? "w-[22px] bg-wire-stamp"
                    : "w-[12px] bg-wire-rule group-hover:w-[18px] group-hover:bg-wire-soft"
                }`}
              />
            </Link>
          ))}
        </nav>

        <main className="md:pl-[58px]">
          {readAll ? (
            /* The structured alternative: the whole briefing, linear. */
            <div className="mx-auto w-full max-w-[760px] px-6 py-16 md:px-10">
              <h1 className="text-[12px] uppercase tracking-[0.2em] text-wire-faint">
                {view.scope.projectName} &middot; the whole briefing
              </h1>
              {cards.map((card) => (
                <section
                  key={card.key}
                  aria-label={card.kicker}
                  className="wire-perf mt-12 pt-12 first:mt-8 first:border-0 first:pt-0"
                >
                  <p className="mb-6 text-[11px] uppercase tracking-[0.18em] text-wire-faint">
                    {card.kicker}
                  </p>
                  {card.node}
                </section>
              ))}
              <p className="mt-14 border-t border-wire-rule pt-5 text-[12px] text-wire-faint">
                <Link
                  href={cardHref(stateId, 0, false)}
                  className="underline underline-offset-4 outline-none hover:text-wire-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp"
                >
                  Read it one at a time instead
                </Link>
              </p>
            </div>
          ) : (
            <div className="mx-auto flex min-h-screen w-full max-w-[860px] flex-col px-6 py-10 md:px-10 md:py-14">
              <p className="text-[11px] uppercase tracking-[0.2em] text-wire-faint">
                {current.kicker}
              </p>

              <section
                key={`${stateId}-${current.key}`}
                aria-label={current.kicker}
                className="flex flex-1 flex-col justify-center py-10"
              >
                <h1 className="sr-only">
                  {view.scope.projectName} briefing &middot; {current.kicker}
                </h1>
                {current.node}
              </section>

              {/* ── Advance. Links, so the keyboard already works. ────── */}
              <nav
                aria-label="Move through the briefing"
                className="flex flex-wrap items-center justify-between gap-4 border-t border-wire-rule pt-5"
              >
                <span className="text-[12px] tabular-nums text-wire-faint">
                  {index + 1} / {cards.length}
                </span>
                <div className="flex items-center gap-5">
                  <Link
                    href={cardHref(stateId, 0, true)}
                    className="text-[12px] uppercase tracking-[0.14em] text-wire-faint underline underline-offset-4 outline-none hover:text-wire-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp"
                  >
                    Read it all at once
                  </Link>
                  {index > 0 ? (
                    <Link
                      href={cardHref(stateId, index - 1, false)}
                      className="text-[13px] uppercase tracking-[0.14em] text-wire-soft outline-none hover:text-wire-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp"
                    >
                      &larr; Back
                    </Link>
                  ) : null}
                  {index < cards.length - 1 ? (
                    <Link
                      href={cardHref(stateId, index + 1, false)}
                      className="wire-next text-[13px] uppercase tracking-[0.14em] text-wire-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp"
                    >
                      Next &rarr;
                    </Link>
                  ) : (
                    <Link
                      href={cardHref(stateId, 0, false)}
                      className="text-[13px] uppercase tracking-[0.14em] text-wire-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire-stamp"
                    >
                      Start again
                    </Link>
                  )}
                </div>
              </nav>
            </div>
          )}
        </main>
      </div>

      <AnalyticsLabChrome variant="w" state={stateId} proves={view.proves} />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .wire-root {
              /* The register's white paper and indigo anchor are both gone. */
              --wire-paper: #f3efe6;
              --wire-ink: #17150f;
              --wire-soft: #4a4436;
              --wire-faint: #6f6857;
              --wire-rule: rgba(23, 21, 15, 0.20);
              --wire-stamp: #a83a22;
              background:
                repeating-linear-gradient(
                  to bottom,
                  rgba(23,21,15,0.014) 0px,
                  rgba(23,21,15,0.014) 1px,
                  transparent 1px,
                  transparent 4px
                ),
                var(--wire-paper);
              color: var(--wire-ink);
              font-family: var(--font-mono);
              font-feature-settings: "tnum" 1;
            }
            .wire-root .text-wire-ink { color: var(--wire-ink); }
            .wire-root .text-wire-soft { color: var(--wire-soft); }
            .wire-root .text-wire-faint { color: var(--wire-faint); }
            .wire-root .text-wire-stamp { color: var(--wire-stamp); }
            .wire-root .border-wire-rule { border-color: var(--wire-rule); }
            .wire-root .border-wire-ink { border-color: var(--wire-ink); }
            .wire-root .divide-wire-rule > * + * { border-color: var(--wire-rule); }
            .wire-root .decoration-wire-rule { text-decoration-color: var(--wire-rule); }
            .wire-root .bg-wire-rule { background-color: var(--wire-rule); }
            .wire-root .bg-wire-soft { background-color: var(--wire-soft); }
            .wire-root .bg-wire-stamp { background-color: var(--wire-stamp); }
            .wire-root .outline-wire-stamp { outline-color: var(--wire-stamp); }

            /* The stamp. Never the only carrier of meaning: the word is the
               meaning, and the mark is emphasis on top of it. */
            .wire-stamp {
              display: inline-block;
              padding: 3px 9px;
              border: 2px solid var(--wire-stamp);
              border-radius: 3px;
              color: var(--wire-stamp);
              font-size: 11px;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              transform: rotate(-2.4deg);
            }

            /* A torn perforation instead of a hairline. */
            .wire-perf {
              border-top: 1px dashed var(--wire-rule);
            }

            @media (prefers-reduced-motion: no-preference) {
              .wire-line {
                animation: wire-set 460ms var(--ease-out) both;
              }
              .wire-d0 { animation-delay: 0ms; }
              .wire-d1 { animation-delay: 70ms; }
              .wire-d2 { animation-delay: 150ms; }
              .wire-d3 { animation-delay: 230ms; }
              .wire-d4 { animation-delay: 310ms; }
              .wire-d5 { animation-delay: 390ms; }
              .wire-stamp {
                animation: wire-stamp-land 420ms var(--ease-out) both;
                animation-delay: 260ms;
              }
              .wire-next:hover { letter-spacing: 0.2em; }
              .wire-next { transition: letter-spacing 220ms var(--ease-out); }
            }

            @keyframes wire-set {
              from { opacity: 0; transform: translateY(9px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes wire-stamp-land {
              from { opacity: 0; transform: rotate(-11deg) scale(1.5); }
              60%  { opacity: 1; }
              to { opacity: 1; transform: rotate(-2.4deg) scale(1); }
            }
          `,
        }}
      />
    </>
  );
}
