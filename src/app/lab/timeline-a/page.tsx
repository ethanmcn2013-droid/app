import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_MARKETING_URLS } from "@/lib/product-urls";

/**
 * /lab/timeline-a: "the intentional vertical scroll"
 *
 * One exploration of the Shared Timeline, the public keepsake page a
 * venue-hosted couple publishes for family and friends. Mobile-native,
 * one moment at a time, paced like something read on a phone at a
 * kitchen table. Desktop widens the same column, never a different
 * layout. Vertical rhythm (what is shown, when, and how much room
 * each moment gets) carries the whole idea: a year narrowing to a day.
 *
 * Self-contained: fixture data inline, motion is plain CSS (scroll-
 * driven `animation-timeline: view()`, with a fully resolved static
 * state as the fallback for browsers without support and for
 * prefers-reduced-motion). No client JavaScript. Review-only: noindex,
 * not wired to real data.
 */

export const metadata: Metadata = {
  title: "Shared Timeline · Lab A",
  description:
    "Vertical scroll exploration of the Shared Timeline artifact. Review only, not for production.",
  robots: { index: false, follow: false },
};

type TimelineItem = {
  title: string;
  detail: string;
  date: string;
};

type TimelineSection = {
  id: string;
  label: string;
  note: string;
  items: TimelineItem[];
};

const sections: TimelineSection[] = [
  {
    id: "now",
    label: "Now",
    note: "The decisions that make the next month easier.",
    items: [
      {
        title: "Confirm the ceremony outline",
        detail: "Readings, music, and the people taking part.",
        date: "This week",
      },
      {
        title: "Send the final menu choices",
        detail: "One reply to Glenmara House.",
        date: "28 July",
      },
    ],
  },
  {
    id: "soon",
    label: "Soon",
    note: "Booked work that is close enough to prepare.",
    items: [
      {
        title: "Supplier check-in",
        detail: "Photographer, flowers, music, and transport.",
        date: "12 August",
      },
      {
        title: "Final guest count",
        detail: "The number the venue needs for rooms and dinner.",
        date: "22 August",
      },
    ],
  },
  {
    id: "later",
    label: "Later",
    note: "The shape of the day, held without false urgency.",
    items: [
      {
        title: "Walk through the day",
        detail: "One calm run-through with the venue coordinator.",
        date: "5 September",
      },
      {
        title: "Wedding day",
        detail: "Ceremony at 14:00. Dinner at 17:30.",
        date: "19 September",
      },
    ],
  },
];

// One column throughout. Desktop is a considered widening of this same
// measure, never a second track or a different layout.
const COLUMN = "mx-auto w-full max-w-[640px] px-6 md:max-w-[720px] md:px-8";

export default function TimelineLabAPage() {
  return (
    <>
      <main className="min-h-screen bg-white text-ink">
        {/* Opening moment: who, and the day itself. */}
        <div className={`${COLUMN} pt-24 pb-20 md:pt-32 md:pb-28`}>
          <p className="tla-hero-kicker font-mono text-[11px] uppercase tracking-[0.16em] text-ink-quiet">
            Shared with family and friends
          </p>
          <h1 className="tla-hero-title mt-5 text-[clamp(2.25rem,1.5rem+3.6vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
            Mara and Finn are getting married on{" "}
            <span className="marker">19 September</span>.
          </h1>
          <p className="tla-hero-sub mt-6 max-w-[46ch] text-[17px] leading-[1.65] text-ink-soft md:text-[18px]">
            A few parts of their plan. The parts they chose to share.
          </p>
        </div>

        {/* The journey: Now, then Soon, then Later. Each chapter is one
            large moment; each item inside it is another. */}
        {sections.map((section, i) => {
          const isLater = section.id === "later";
          const listItems = isLater ? section.items.slice(0, -1) : section.items;
          const finale = isLater ? section.items[section.items.length - 1] : null;

          return (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-heading`}
              className={`${COLUMN} py-16 md:py-24`}
            >
              {i > 0 ? (
                <div
                  className={i === 1 ? "tla-thread tla-thread--long" : "tla-thread tla-thread--short"}
                  aria-hidden="true"
                >
                  <span className="tla-thread-fill" />
                </div>
              ) : null}

              <div className="tla-reveal">
                <h2
                  id={`${section.id}-heading`}
                  className="flex items-center gap-4 text-[clamp(3rem,1.8rem+7vw,6.5rem)] font-semibold leading-[0.86] tracking-[-0.045em]"
                >
                  <span className="tla-node" aria-hidden="true" />
                  <span className="uppercase">{section.label}</span>
                </h2>
                <p className="mt-5 max-w-[42ch] text-[16px] leading-[1.65] text-ink-soft md:text-[18px]">
                  {section.note}
                </p>
              </div>

              <ol className="mt-10 divide-y divide-line-soft md:mt-14">
                {listItems.map((item) => (
                  <li key={item.title} className="tla-reveal py-9 first:pt-0 md:py-11">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                      {item.date}
                    </p>
                    <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.02em] md:text-[21px]">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-[46ch] text-[15px] leading-[1.6] text-ink-soft md:text-[16px]">
                      {item.detail}
                    </p>
                  </li>
                ))}
              </ol>

              {finale ? (
                <div className="tla-reveal mt-10 overflow-hidden rounded-[20px] border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white px-7 py-10 shadow-[var(--shadow-indigo)] md:mt-14 md:px-10 md:py-12">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
                    {finale.date}
                  </p>
                  <h3 className="mt-4 text-[clamp(2rem,1.4rem+3vw,2.9rem)] font-semibold leading-[1.05] tracking-[-0.03em]">
                    {finale.title}
                  </h3>
                  <p className="mt-4 text-[17px] leading-[1.6] text-ink-soft md:text-[19px]">
                    {finale.detail}
                  </p>
                </div>
              ) : null}
            </section>
          );
        })}

        {/* One line of venue attribution. Nothing else names the venue. */}
        <footer className="border-t border-line-soft px-6 py-10 md:px-8">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3 text-[12px] text-ink-quiet sm:flex-row sm:items-center sm:justify-between">
            <p>Mara and Finn chose what is shown here. Private notes and tasks stay private.</p>
            <div className="flex items-center gap-3">
              <span>Kept with Glenmara House</span>
              <span aria-hidden="true">&middot;</span>
              <Link
                href={PRODUCT_MARKETING_URLS.timeline}
                className="text-ink-soft transition-colors hover:text-ink"
              >
                Made with Signal Timeline
              </Link>
            </div>
          </div>
        </footer>
      </main>

      {/* Lab identification only, not part of the artifact. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-4 top-4 z-50 rounded-full border border-line-soft bg-white/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet shadow-[var(--shadow-float)] backdrop-blur"
      >
        Lab A &middot; vertical scroll
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .tla-node {
              display: inline-block;
              width: 11px;
              height: 11px;
              border-radius: 999px;
              background: var(--accent);
              flex: none;
            }
            .tla-thread {
              position: relative;
              width: 2px;
              margin-left: 5px;
              overflow: hidden;
              border-radius: 2px;
              background: var(--hairline);
            }
            .tla-thread--long { height: clamp(64px, 10vw, 120px); }
            .tla-thread--short { height: clamp(40px, 6vw, 80px); }
            .tla-thread-fill {
              position: absolute;
              inset: 0;
              background: var(--accent);
              transform-origin: top;
            }
            @media (prefers-reduced-motion: no-preference) {
              .tla-hero-kicker,
              .tla-hero-title,
              .tla-hero-sub {
                animation: tla-rise 760ms var(--ease-out) both;
              }
              .tla-hero-kicker { animation-delay: 0ms; }
              .tla-hero-title { animation-delay: 100ms; }
              .tla-hero-sub { animation-delay: 220ms; }

              @supports (animation-timeline: view()) {
                .tla-reveal {
                  animation: tla-fade-rise 420ms var(--ease-out) both;
                  animation-timeline: view();
                  animation-range: entry 0% entry 35%;
                }
                .tla-node {
                  animation: tla-node-in 320ms var(--ease-out) both;
                  animation-timeline: view();
                  animation-range: entry 0% entry 90%;
                }
                .tla-thread-fill {
                  animation: tla-thread-grow 400ms linear both;
                  animation-timeline: view();
                  animation-range: entry 0% entry 100%;
                }
              }
            }
            @keyframes tla-rise {
              from { opacity: 0; transform: translateY(16px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes tla-fade-rise {
              from { opacity: 0; transform: translateY(14px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes tla-node-in {
              from { transform: scale(0.4); opacity: 0.5; }
              to { transform: scale(1); opacity: 1; }
            }
            @keyframes tla-thread-grow {
              from { transform: scaleY(0); }
              to { transform: scaleY(1); }
            }
          `,
        }}
      />
    </>
  );
}
