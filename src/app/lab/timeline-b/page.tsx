/**
 * /lab/timeline-b: "B: the editorial spread".
 *
 * A design exploration of the public Shared Timeline (see
 * src/app/the-wedding/page.tsx for the production reference). This variant
 * treats the page as a kept object, a programme or order of service that
 * happens to be a live page, rather than a list view with nicer fonts.
 *
 * Review-only: static content, no auth, no data fetching, noindex.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Timeline · Lab B",
  description:
    "Editorial-spread exploration of the Shared Timeline public page. Review only, not for production.",
  robots: { index: false, follow: false },
};

const WEDDING_DATE = "19 September";
const [weddingDay, weddingMonth] = WEDDING_DATE.split(" ");

const sections = [
  {
    ordinal: "01",
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
    ordinal: "02",
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
    ordinal: "03",
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
        date: WEDDING_DATE,
      },
    ],
  },
] as const;

/**
 * "28 July" -> { day: "28", month: "JUL" }. Returns null for dates with no
 * leading day number ("This week") so the caller can fall back to a literal
 * label instead of forcing every date into the same numeral treatment.
 */
function splitDate(value: string): { day: string; month: string } | null {
  const match = /^(\d{1,2})\s+([A-Za-z]+)$/.exec(value);
  if (!match) return null;
  const [, day, month] = match;
  return { day, month: month.slice(0, 3).toUpperCase() };
}

export default function TimelineLabEditorialSpreadPage() {
  return (
    <>
      <main className="min-h-screen bg-white text-ink">
        {/* ── Cover ─────────────────────────────────────────────────── */}
        <header className="border-b border-line-soft bg-paper-soft">
          <div className="mx-auto w-full max-w-[1160px] px-6 py-16 sm:px-10 sm:py-20 lg:px-12 lg:py-24">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-quiet">
              Kept for family and friends
            </p>

            <div className="mt-8 flex flex-col gap-10 md:grid md:grid-cols-[1fr_auto] md:items-end md:gap-16">
              <h1 className="leading-[0.92]">
                <span className="block text-[clamp(3rem,1.6rem+6vw,8rem)] font-semibold tracking-[-0.045em] text-ink">
                  Mara <span className="text-brand">&amp;</span> Finn
                </span>
                <span className="mt-3 block text-[clamp(1.05rem,0.85rem+0.7vw,1.375rem)] font-normal tracking-[-0.01em] text-ink-soft">
                  their wedding plan
                </span>
              </h1>

              <div className="relative text-left md:text-right">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-x-8 -inset-y-10 -z-10 rounded-full blur-3xl"
                  style={{
                    background:
                      "radial-gradient(closest-side, var(--accent-soft), transparent)",
                  }}
                />
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-quiet">
                  The wedding
                </p>
                <p className="mt-2 text-[clamp(2.5rem,1.6rem+4vw,5rem)] font-semibold leading-[0.9] tracking-[-0.03em] text-ink">
                  {weddingDay}
                </p>
                <p className="mt-1 font-mono text-[13px] uppercase tracking-[0.16em] text-ink-soft">
                  {weddingMonth}
                </p>
              </div>
            </div>

            <p className="mt-10 max-w-[34rem] text-[17px] leading-[1.65] text-ink-soft md:mt-14">
              What is settled. What comes next. What can still wait. Kept the
              way Mara and Finn chose to share it.
            </p>
          </div>
        </header>

        {/* ── Sections ──────────────────────────────────────────────── */}
        <div className="px-6 sm:px-10 lg:px-12">
          <div className="mx-auto w-full max-w-[1160px]">
            {sections.map((section) => {
              const isNow = section.label === "Now";
              const headingId = `timeline-b-${section.label.toLowerCase()}`;

              return (
                <section
                  key={section.label}
                  aria-labelledby={headingId}
                  className="border-t border-line-soft py-14 md:grid md:grid-cols-[72px_1fr] md:gap-10 md:py-20"
                >
                  <div aria-hidden="true" className="hidden md:flex md:items-start">
                    <span
                      className={`inline-block font-mono text-[11px] uppercase tracking-[0.22em] ${
                        isNow ? "text-brand" : "text-ink-quiet"
                      }`}
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                      }}
                    >
                      {section.ordinal} · {section.label}
                    </span>
                  </div>

                  <div>
                    <p
                      aria-hidden="true"
                      className={`mb-2 font-mono text-[11px] tracking-[0.1em] md:hidden ${
                        isNow ? "text-brand" : "text-ink-quiet"
                      }`}
                    >
                      {section.ordinal}
                    </p>
                    <h2
                      id={headingId}
                      className="text-[clamp(1.5rem,1.2rem+1.2vw,2.25rem)] font-semibold tracking-[-0.025em] text-ink"
                    >
                      {section.label}
                    </h2>
                    <p className="mt-3 max-w-[30rem] text-[15px] leading-[1.6] text-ink-soft">
                      {section.note}
                    </p>

                    <ol className="mt-9 divide-y divide-line-soft md:mt-11">
                      {section.items.map((item) => {
                        const parsed = splitDate(item.date);

                        return (
                          <li
                            key={item.title}
                            className="grid grid-cols-[64px_1fr] gap-5 py-7 first:pt-0 sm:grid-cols-[88px_1fr] sm:gap-8"
                          >
                            <div>
                              {parsed ? (
                                <>
                                  <span
                                    className={`block text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums sm:text-[34px] ${
                                      isNow ? "text-brand" : "text-ink"
                                    }`}
                                  >
                                    {parsed.day}
                                  </span>
                                  <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet">
                                    {parsed.month}
                                  </span>
                                </>
                              ) : (
                                <span className="block text-[13px] font-semibold uppercase leading-tight tracking-[0.04em] text-brand">
                                  {item.date}
                                </span>
                              )}
                            </div>
                            <div>
                              <h3 className="text-[17px] font-medium tracking-[-0.015em] text-ink">
                                {item.title}
                              </h3>
                              <p className="mt-1.5 max-w-[28rem] text-[14px] leading-[1.6] text-ink-soft">
                                {item.detail}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* ── Colophon ──────────────────────────────────────────────── */}
        <footer className="border-t border-line-soft">
          <div className="mx-auto w-full max-w-[1160px] px-6 py-9 sm:px-10 lg:px-12">
            <p className="text-[12px] text-ink-quiet">
              Shared by Glenmara House for Mara and Finn.
            </p>
          </div>
        </footer>
      </main>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-4 left-4 z-50 rounded-full border border-ink/10 bg-white/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-quiet shadow-float backdrop-blur-sm"
      >
        Lab B · editorial spread
      </div>
    </>
  );
}
