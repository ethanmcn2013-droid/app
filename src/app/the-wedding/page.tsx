import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_MARKETING_URLS } from "@/lib/product-urls";

export const metadata: Metadata = {
  title: "Your wedding plan · Signal Timeline",
  description:
    "A public Signal Timeline example showing the useful shape of a wedding plan without exposing private work.",
  alternates: {
    canonical: "https://timeline.signalstudio.ie/the-wedding",
  },
};

const sections = [
  {
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
        detail: "One reply to Glenmara House, including dietary notes.",
        date: "28 July",
      },
    ],
  },
  {
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
] as const;

export default function WeddingTimelineExamplePage() {
  return (
    <main className="min-h-screen bg-white text-ink">
      <header className="border-b border-line-soft">
        <div className="mx-auto flex min-h-16 w-full max-w-[1040px] items-center justify-between gap-6 px-6">
          <p className="text-[15px] font-semibold tracking-[-0.03em]">
            timeline<span className="text-brand">.</span>
          </p>
          <Link
            href={PRODUCT_MARKETING_URLS.timeline}
            className="text-[13px] text-ink-quiet transition-colors hover:text-ink"
          >
            Signal Timeline
          </Link>
        </div>
      </header>

      <section className="border-b border-line-soft px-6 py-14 md:py-20">
        <div className="mx-auto w-full max-w-[1040px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-quiet">
            A plan kept by Glenmara House
          </p>
          <h1 className="mt-5 max-w-4xl text-[clamp(2.8rem,1.8rem+4vw,6rem)] font-semibold leading-[0.96] tracking-[-0.055em]">
            Your wedding plan.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-[1.65] text-ink-soft">
            One readable view of what is settled, what comes next, and what can
            wait. The couple chose every item shown here.
          </p>
        </div>
      </section>

      <section className="px-6 py-12 md:py-16">
        <div className="mx-auto w-full max-w-[1040px]">
          {sections.map((section) => (
            <section
              key={section.label}
              className="grid border-t border-line-soft py-9 md:grid-cols-[220px_1fr] md:gap-12 md:py-12"
            >
              <div>
                <h2 className="text-[20px] font-semibold tracking-[-0.025em]">
                  {section.label}
                </h2>
                <p className="mt-2 max-w-[210px] text-[13px] leading-[1.55] text-ink-quiet">
                  {section.note}
                </p>
              </div>
              <ol className="mt-7 divide-y divide-line-soft md:mt-0">
                {section.items.map((item) => (
                  <li
                    key={item.title}
                    className="grid gap-3 py-6 first:pt-0 md:grid-cols-[1fr_auto] md:items-start md:gap-8"
                  >
                    <div>
                      <h3 className="text-[16px] font-medium tracking-[-0.015em]">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-[1.55] text-ink-soft">
                        {item.detail}
                      </p>
                    </div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-quiet">
                      {item.date}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </section>

      <footer className="border-t border-line-soft px-6 py-9">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-3 text-[12px] text-ink-quiet sm:flex-row sm:items-center sm:justify-between">
          <p>Published deliberately. Private notes and tasks stay private.</p>
          <Link
            href={PRODUCT_MARKETING_URLS.timeline}
            className="text-ink-soft transition-colors hover:text-ink"
          >
            Made with Signal Timeline
          </Link>
        </div>
      </footer>
    </main>
  );
}
