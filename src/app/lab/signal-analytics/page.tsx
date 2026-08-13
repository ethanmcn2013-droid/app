import type { Metadata } from "next";
import Link from "next/link";
import {
  ANALYTICS_LAB_ROBOTS,
  requireAnalyticsLabReviewer,
} from "@/lib/analytics-lab/gate";
import {
  LAB_STATES,
  VARIANTS,
  labView,
  parseLabState,
} from "@/lib/analytics-lab/model";

/**
 * /lab/signal-analytics — the index the founder gate opens on.
 *
 * Five compositions of one product, arguing from one derivation of one
 * fixture. This page exists to make the choice a fair one: the same state can
 * be carried into every composition from here, so no variant is ever compared
 * against a different set of facts.
 *
 * It also states, before anything is looked at, what the product can honestly
 * say today. A composition that reads well against data the product cannot
 * produce is not a candidate, it is a mistake waiting to ship.
 */

export const metadata: Metadata = {
  title: "Signal Analytics · design lab",
  description: "Five compositions of the Home analytics view. Review only.",
  robots: ANALYTICS_LAB_ROBOTS,
};

const COLUMN = "mx-auto w-full max-w-[900px] px-6 md:px-8";

const GROUND_TRUTH = [
  {
    title: "One Project, never a portfolio",
    detail:
      "Every source binds to one workspace, so a reading covers one Project " +
      "and says so. A table of Projects would be invented, not read.",
  },
  {
    title: "No trend, in any composition",
    detail:
      "No reading has ever been kept, so there is nothing to compare. Every " +
      "composition says Not enough history and draws no chart at all.",
  },
  {
    title: "Three questions have no answer",
    detail:
      "Work waiting on something else, decisions from notes, and how a " +
      "commitment date moved. Each resolves to no answer, never to zero.",
  },
  {
    title: "Labels are not Projects",
    detail:
      "The ledger rows are labels inside one Project. The word Project is " +
      "never used for them, which is the whole point of the truth gate.",
  },
];

export default async function AnalyticsLabIndex({
  searchParams,
}: {
  searchParams: Promise<{ state?: string | string[] }>;
}) {
  await requireAnalyticsLabReviewer();
  const { state } = await searchParams;
  const stateId = parseLabState(state);
  const view = labView(stateId);

  const href = (route: string) =>
    stateId === "today" ? route : `${route}?state=${stateId}`;

  return (
    <main className="min-h-screen bg-white text-ink">
      <div className={`${COLUMN} py-16 md:py-24`}>
        <header>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            Wave 5 &middot; review only
          </p>
          <h1 className="mt-4 max-w-[20ch] text-[clamp(2rem,1.5rem+2.4vw,3.1rem)] font-semibold leading-[1.08] tracking-[-0.032em]">
            Five ways to read one Project.
          </h1>
          <p className="mt-5 max-w-[64ch] text-[17px] leading-[1.62] text-ink-soft">
            One derivation of one fixture, five compositions. Pick a state
            first and it follows you into every composition, so nothing is
            compared against a different set of facts.
          </p>
        </header>

        {/* ── What is true today, stated before anything is judged. ───── */}
        <section aria-labelledby="ground-heading" className="mt-14">
          <h2
            id="ground-heading"
            className="border-b border-ink pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink"
          >
            What the product can honestly say today
          </h2>
          <dl className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {GROUND_TRUTH.map((item) => (
              <div key={item.title}>
                <dt className="text-[15px] font-medium leading-[1.4] text-ink">
                  {item.title}
                </dt>
                <dd className="mt-1 text-[14px] leading-[1.6] text-ink-soft">
                  {item.detail}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── The five. ──────────────────────────────────────────────── */}
        <section aria-labelledby="variants-heading" className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-ink pb-2">
            <h2
              id="variants-heading"
              className="font-mono text-[11px] uppercase tracking-[0.13em] text-ink"
            >
              The five compositions
            </h2>
            <p className="font-mono text-[11px] text-ink-faint">
              carrying: {view.label}
            </p>
          </div>
          <ol className="divide-y divide-hairline-soft">
            {VARIANTS.map((variant, i) => (
              <li key={variant.id} className="py-6">
                <div className="flex gap-4 md:gap-6">
                  <span
                    aria-hidden="true"
                    className="mt-1 font-mono text-[12px] tabular-nums text-ink-ghost"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[19px] font-medium leading-[1.35] tracking-[-0.016em]">
                      <Link
                        href={href(variant.route)}
                        className="text-ink underline decoration-hairline underline-offset-[6px] outline-none hover:decoration-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                      >
                        {variant.name}
                      </Link>
                    </h3>
                    <p className="mt-2 max-w-[64ch] text-[15px] leading-[1.6] text-ink-soft">
                      {variant.idea}
                    </p>
                    <p className="mt-2 font-mono text-[11px] text-ink-faint">
                      {variant.route}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── The states. ────────────────────────────────────────────── */}
        <section aria-labelledby="states-heading" className="mt-14">
          <h2
            id="states-heading"
            className="border-b border-ink pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink"
          >
            Ten states, each a link
          </h2>
          <p className="mt-4 max-w-[64ch] text-[14px] leading-[1.6] text-ink-soft">
            Choosing one here carries it into whichever composition you open
            next. Every state is a real URL, so a screen can be sent to someone
            else exactly as it was seen.
          </p>
          <ul className="mt-5 divide-y divide-hairline-soft border-t border-hairline-soft">
            {LAB_STATES.map((s) => (
              <li key={s.id} className="py-3.5 md:flex md:items-baseline md:gap-6">
                <Link
                  href={s.id === "today" ? "?" : `?state=${s.id}`}
                  aria-current={s.id === stateId ? "true" : undefined}
                  className={`shrink-0 text-[15px] leading-[1.45] underline decoration-hairline underline-offset-4 outline-none hover:decoration-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 md:w-[220px] ${
                    s.id === stateId ? "text-accent" : "text-ink"
                  }`}
                >
                  {s.label}
                </Link>
                <p className="mt-1 max-w-[62ch] text-[14px] leading-[1.6] text-ink-soft md:mt-0 md:flex-1">
                  {s.proves}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── How this is gated. ─────────────────────────────────────── */}
        <section aria-labelledby="gate-heading" className="mt-14">
          <h2
            id="gate-heading"
            className="border-b border-ink pb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-ink"
          >
            How this lab is gated
          </h2>
          <p className="mt-4 max-w-[68ch] text-[14px] leading-[1.62] text-ink-soft">
            These routes carry their own front door rather than borrowing the
            analytics one. Four things must all be true before a single line
            renders: an explicit flag is on, the deployment is not production,
            the access mode is neither demo nor review, and a real signed-in
            person resolves. Anything else returns a 404 rather than a redirect,
            because a redirect would confirm the route exists.
          </p>
          <p className="mt-3 max-w-[68ch] text-[14px] leading-[1.62] text-ink-faint">
            The honest consequence: those conditions make this unreachable on
            every environment this repo can currently deploy, so it is a local
            review surface. Serving it from a protected preview needs a review
            posture that authenticates for real, which does not exist yet.
          </p>
        </section>
      </div>
    </main>
  );
}
