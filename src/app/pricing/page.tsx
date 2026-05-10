import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SectionHeading } from "@/components/marketing/features";
import { TierCta } from "@/components/marketing/tier-cta";
import type { PaidTier } from "@/server/stripe";

export const metadata = {
  title: "Pricing — Tasks",
  description:
    "Free for solo, $4.99 for Pro, $9.95 per workspace for teams (no per-seat tax), $79 one-time for weddings.",
  openGraph: {
    title: "Tasks — priced honestly",
    description:
      "Free for solo. $4.99 Pro. $9.95 per workspace for teams (not per person). $79 one-time for weddings.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tasks — priced honestly",
    description:
      "Free for solo. Per workspace, never per seat. Couples pay once.",
  },
};

type Tier = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  /** Set for free tier — straight link to the workspace. */
  href?: string;
  /** Set for paid tiers — fires the Stripe checkout action. */
  tier?: PaidTier;
  accent?: "default" | "popular" | "specialty";
  footnote?: string;
};

const TIERS: Tier[] = [
  {
    name: "Solo",
    price: "Free",
    cadence: "forever, no card",
    blurb: "For one mind running their own work — plus three friends.",
    features: [
      "1 workspace, unlimited tasks",
      "All four views — board, list, timeline, calendar",
      "Three editing guests, free",
      "Daily digest, no notification spam",
      "Plain-English date capture",
    ],
    cta: "Open the workspace",
    href: "/app/board",
  },
  {
    name: "Pro",
    price: "$4.99",
    cadence: "/ month · or $39/yr",
    blurb: "Solo, but with all the gear.",
    features: [
      "Unlimited workspaces",
      "Recurring tasks — weekly psets, monthly invoices",
      "Calendar feed — Apple, Google, Outlook subscribe to your tasks",
      "Stuck-work nudges — surfaces quiet cards, never closes them",
      "Cross-workspace search and overdue triage",
    ],
    cta: "Start free trial",
    tier: "pro",
  },
  {
    name: "Team",
    price: "$9.95",
    cadence: "/ workspace / month",
    blurb: "When the work is shared.",
    features: [
      "Everything in Pro",
      "Unlimited members per workspace · zero per-seat tax",
      "Magic-link guests can comment + edit",
      "Share-link analytics — who clicked, what they opened",
      "Real-time presence and cursors",
      "Priority support",
    ],
    cta: "Start a team",
    tier: "team",
    accent: "popular",
    footnote: "Add the whole class, the whole studio, both moms — same price.",
  },
  {
    name: "Wedding",
    price: "$79",
    cadence: "one-time, for life",
    blurb: "For the one workspace that matters most.",
    features: [
      "Team-tier features for one workspace, forever",
      "Two wedding templates — 3-month countdown + day-of run-of-show",
      "Magic-link guests — both moms, the MOH, the DJ, no per-seat tax",
      "Public wedding-themed page at /p/your-slug for save-the-dates",
      "Custom OG cards on the share link, generated from your workspace",
    ],
    cta: "Buy once",
    tier: "wedding",
    accent: "specialty",
  },
];

/**
 * Studio is the operator-tier — a separate side-panel offer below
 * the four-up shelf. Kept off the primary grid because the audience
 * is narrower (multi-client freelancers, wedding planners) and the
 * scope is unusual (per-user instead of per-workspace).
 */
const STUDIO_TIER: {
  price: string;
  cadence: string;
  features: string[];
} = {
  price: "$14.95",
  cadence: "/ month · per operator, not per workspace",
  features: [
    "Unlimited workspaces — one per client, one per project",
    "Team-tier features on every workspace you own",
    "No per-seat tax inside any of them",
    "One bill for all of them, instead of one per workspace",
    "Includes everything Pro gives you, plus the multiplier",
  ],
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "Why per-workspace and not per-person?",
    a: "Because charging per invite makes inviting people a budget decision, and that kills group adoption. We'd rather a wedding workspace fit the bride, groom, both moms, MOH, and DJ for $9.95 than charge you 6× $9.95 to do the same thing. The math works out for us; the math feels honest to you.",
  },
  {
    q: "Why Studio?",
    a: "Because a freelance dev with five clients shouldn't pay 5× $9.95 just to keep each engagement in its own workspace, and a wedding planner running ten weddings a year shouldn't pay $79 ten times to use the workspace they already know. Studio is the operator-tier — one bill ($14.95/mo) for unlimited workspaces you own as sole admin, with full Team features on every one. If you're running multiple projects under one roof, Studio is the right shape; if you're a team in one workspace, stay on Team.",
  },
  {
    q: "What does 'free forever' mean?",
    a: "It means free forever. One workspace, unlimited tasks, every view, the daily digest, magic-link sharing, and up to three editing guests — no time limit, no card needed, no feature degradation. We make money when teams scale up; we don't make money by squeezing solos.",
  },
  {
    q: "Why three editing guests?",
    a: "Because a list nobody else can edit isn't a shared list. Three is calibrated — it's a study group, a couple plus the maid of honor, two roommates and a dog-walker, a freelancer plus the client point-of-contact. It's not a team. The moment you grow past three, you're a team, and Team is $9.95 a workspace flat — still no per-seat tax. Until then, the basics belong to you.",
  },
  {
    q: "Why a one-time wedding tier?",
    a: "Couples plan once, intensely, for ~12 months. A monthly subscription is the wrong shape — you'd cancel right after the wedding anyway. $79 once captures the value while you're using it and lets the workspace live forever as a memory.",
  },
  {
    q: "What about students?",
    a: "The Solo Free tier covers a thesis, four classes, and a study group easily. If you genuinely need recurring tasks for weekly problem sets, Pro is $4.99 — less than one campus coffee. We'll happily verify .edu addresses for an extended Pro trial; email us.",
  },
  {
    q: "Can I switch between tiers?",
    a: "Anytime. Up, down, sideways. We don't do annual contracts on Pro or Team. Cancel today and you keep access through the end of the current month, then drop to Solo automatically.",
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
                  Priced honestly.{" "}
                  <span className="text-ink-soft/60">
                    Free where it counts.
                  </span>
                </>
              }
            />
            <p className="mt-5 max-w-[58ch] text-[16px] leading-[1.55] text-ink-soft">
              No per-seat tax. No &ldquo;contact sales for the basics.&rdquo;
              Solo is free forever. Teams pay per workspace, not per
              invite. Couples pay once.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <div className="mx-auto grid w-full max-w-[1240px] gap-5 px-6 md:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => (
              <TierCard key={t.name} tier={t} />
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="mx-auto w-full max-w-[1240px] px-6">
            <StudioPanel />
          </div>
        </section>

        <section className="mt-20">
          <div className="mx-auto w-full max-w-[820px] px-6">
            <SectionHeading
              eyebrow="Questions"
              title={
                <>
                  The fine print,{" "}
                  <span className="text-ink-soft/60">
                    in plain English.
                  </span>
                </>
              }
            />
            <ul className="mt-8 space-y-6">
              {FAQ.map((f) => (
                <li
                  key={f.q}
                  className="rounded-xl border border-line-soft bg-bg-elevated/60 px-5 py-4"
                >
                  <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                    {f.q}
                  </div>
                  <p className="mt-1.5 text-[14px] leading-[1.6] text-ink-soft">
                    {f.a}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-24 mb-12">
          <div className="mx-auto w-full max-w-[820px] px-6">
            <div className="rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
                The promise
              </div>
              <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
                The features that make this useful work without paying.
                Always. We make money on depth, not on basics.
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * The Studio side-panel — a horizontal card below the four-up shelf,
 * for operators (multi-client freelancers, wedding planners) who'd
 * pay 5× Team without it. Visually distinct from the main grid so
 * the primary tier shelf stays clean.
 */
function StudioPanel() {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-gradient-to-br from-ink/[0.02] via-bg-elevated to-brand-soft/30">
      <div className="grid gap-8 p-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-12 md:p-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            For operators
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-[42px] font-semibold tracking-tight">
              {STUDIO_TIER.price}
            </span>
          </div>
          <div className="mt-1 text-[12px] leading-tight text-ink-quiet">
            {STUDIO_TIER.cadence}
          </div>
          <h3 className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-ink">
            Studio
          </h3>
          <p className="mt-2 max-w-[34ch] text-[14px] leading-[1.55] text-ink-soft">
            One bill for unlimited workspaces you own. Built for the
            freelancer running five clients and the wedding planner
            running ten weddings — without paying per-workspace each
            time.
          </p>
          <div className="mt-6">
            <TierCta label="Start Studio" tier="studio" accent="default" />
          </div>
          <p className="mt-3 max-w-[34ch] text-[11.5px] italic leading-[1.4] text-ink-quiet">
            Per-operator subscription, not per-workspace. Inside any
            workspace, the no-per-seat-tax rule still holds.
          </p>
        </div>
        <ul className="space-y-2 self-center text-[13.5px] text-ink-soft">
          {STUDIO_TIER.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
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
              <span className="leading-[1.45]">{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TierCard({ tier: t }: { tier: Tier }) {
  const isPopular = t.accent === "popular";
  const isSpecialty = t.accent === "specialty";

  return (
    <div
      className={
        "relative flex flex-col rounded-2xl border p-6 " +
        (isPopular
          ? "border-ink/15 bg-bg-elevated shadow-[0_24px_60px_-30px_rgba(20,21,26,0.32)]"
          : isSpecialty
            ? "border-brand/25 bg-gradient-to-b from-brand-soft/40 to-bg-elevated"
            : "border-line-soft bg-bg-elevated/70")
      }
    >
      {isPopular ? (
        <div className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          Most popular
        </div>
      ) : null}
      {isSpecialty ? (
        <div className="absolute -top-3 right-5 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          For couples
        </div>
      ) : null}

      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
        {t.name}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[30px] font-semibold tracking-tight">
          {t.price}
        </span>
        <span className="text-[11.5px] leading-tight text-ink-quiet">
          {t.cadence}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] text-ink-soft">{t.blurb}</p>

      <ul className="mt-4 flex-1 space-y-1.5 text-[12.5px] text-ink-soft">
        {t.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <svg
              width="12"
              height="12"
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
            <span className="leading-[1.45]">{f}</span>
          </li>
        ))}
      </ul>

      {t.footnote ? (
        <p className="mt-3 text-[11.5px] italic leading-[1.4] text-ink-quiet">
          {t.footnote}
        </p>
      ) : null}

      <TierCta
        label={t.cta}
        href={t.href}
        tier={t.tier}
        accent={t.accent}
      />
    </div>
  );
}
