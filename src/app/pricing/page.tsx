import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SectionHeading } from "@/components/marketing/features";
import Link from "next/link";

const TIERS = [
  {
    name: "Solo",
    price: "Free",
    cadence: "forever",
    blurb: "For one mind running their own work.",
    features: [
      "Unlimited tasks",
      "All four views",
      "Personal AI nudges",
      "Up to 3 boards",
    ],
    cta: "Open the app",
    href: "/app/board",
    accent: false,
  },
  {
    name: "Team",
    price: "$12",
    cadence: "per person / month",
    blurb: "When the work is shared.",
    features: [
      "Real-time presence and cursors",
      "Inline comments and threads",
      "Cross-team dependencies",
      "Burndown signals & weekly digest",
      "SSO and audit log",
    ],
    cta: "Start a team",
    href: "/app/board",
    accent: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    blurb: "For organizations with rituals to honor.",
    features: [
      "Custom rollout and migration",
      "Advanced security review",
      "Tasks AI for org-wide signals",
      "Dedicated success partner",
    ],
    cta: "Talk to us",
    href: "#",
    accent: false,
  },
];

export default function PricingPage() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <section className="pt-16 md:pt-24">
          <div className="mx-auto w-full max-w-[1240px] px-6">
            <SectionHeading
              eyebrow="Pricing"
              title={
                <>
                  Priced like a tool you&rsquo;ll{" "}
                  <span className="text-ink-soft/60">actually open.</span>
                </>
              }
            />
            <p className="mt-5 max-w-[58ch] text-[16px] leading-[1.55] text-ink-soft">
              No per-seat surprises, no &ldquo;reach out for an enterprise
              quote&rdquo; on basics. The team plan is everything you need —
              enterprise just adds the institutional bits.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-6 md:grid-cols-3">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={
                  "relative flex flex-col rounded-2xl border p-7 " +
                  (t.accent
                    ? "border-ink/15 bg-bg-elevated shadow-[0_24px_60px_-30px_rgba(20,21,26,0.32)]"
                    : "border-line-soft bg-bg-elevated/70")
                }
              >
                {t.accent ? (
                  <div className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Most teams
                  </div>
                ) : null}
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                  {t.name}
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[34px] font-semibold tracking-tight">
                    {t.price}
                  </span>
                  <span className="text-[12.5px] text-ink-quiet">
                    {t.cadence}
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-ink-soft">{t.blurb}</p>
                <ul className="mt-5 space-y-2 text-[13.5px] text-ink-soft">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mt-0.5 flex-shrink-0 text-emerald-600"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={t.href}
                  className={
                    "mt-7 inline-flex items-center justify-center rounded-full px-4 py-2 text-[13px] font-medium transition-transform hover:-translate-y-px " +
                    (t.accent
                      ? "bg-ink text-white"
                      : "border border-line bg-white text-ink-soft hover:text-ink")
                  }
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
