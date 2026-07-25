"use client";

import { DOMAINS, DOMAIN_ORDER } from "@/lib/domains";

/**
 * About / manifesto page. Single column, opinionated. The visual
 * concept: contrast the strikethrough world (sprints, epics, tickets,
 * gantts, paywalls) with the clean ground-floor world (tasks).
 */
export function AboutManifesto() {
  return (
    <section className="relative isolate overflow-hidden pb-32 pt-16 md:pt-24">
      {/* Soft gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(79,70,229, 0.18), rgba(79, 70, 229, 0.06), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[820px] px-6">
        <Eyebrow />

        <h1 className="mt-6 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink">
          Project management shouldn&rsquo;t be{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(79,70,229,0.28), rgba(79,70,229,0.16))",
              }}
            />
            behind a paywall.
          </span>
        </h1>

        <p className="mt-6 text-[18.5px] leading-[1.55] text-ink-soft">
          Or behind a knowledge gap. Or behind a certification, a
          learning curve, or three onboarding videos before you can write
          your first task. We don&rsquo;t buy the idea that running a
          project should require a degree in someone else&rsquo;s
          vocabulary.
        </p>

        {/* The strikethrough block, the words we cut */}
        <Strikethroughs />

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          You don&rsquo;t need a vocabulary. You need a list.
        </h2>
        <div className="mt-5 space-y-4 text-[16.5px] leading-[1.6] text-ink-soft">
          <p>
            Sprints. Epics. Tickets. Issues. Stories. Backlogs.
            Burndowns. The whole industry has spent twenty years
            convincing people that getting something done together
            requires a special language, and that the special language
            requires a special tool, sold at a special price, configured
            by a special role.
          </p>
          <p>
            None of that is true. A college student writing her thesis
            doesn&rsquo;t need a backlog grooming session. A freelance
            developer juggling four clients doesn&rsquo;t need an epic.
            An event planner running a 200-guest wedding doesn&rsquo;t
            need a sprint review. They all need the same thing the
            engineering teams really need underneath all the jargon: a
            place to write what&rsquo;s on their plate, who&rsquo;s
            doing it, and when it&rsquo;s due, and a few clean ways to
            look at the same list.
          </p>
          <p>
            That&rsquo;s what Tasks is. We strip out the vocabulary, we
            strip out the gatekeeping, and what&rsquo;s left is a tool
            that fits whatever you do.
          </p>
        </div>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Built for whoever shows up.
        </h2>
        <p className="mt-5 text-[16.5px] leading-[1.6] text-ink-soft">
          Tasks doesn&rsquo;t assume you work in tech. It doesn&rsquo;t
          assume you have a team. It doesn&rsquo;t assume you&rsquo;ll
          ever pay us. The starter packs say it loud:
        </p>
        <DomainGrid />

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          What we promise.
        </h2>
        <ul className="mt-5 space-y-4">
          {PROMISES.map((p, i) => (
            <Promise key={i} num={i + 1} {...p} />
          ))}
        </ul>

        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            Plain English
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            Write down what you have to do. Look at it the way that
            helps. Cross it off. That&rsquo;s the whole product.
          </p>
          <a
            href="/app/tasks"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
          >
            Open the workspace
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

const STRIKES = [
  "sprint planning",
  "epic refinement",
  "ticket triage",
  "issue grooming",
  "story points",
  "burndown reviews",
  "stand-up rituals",
  "backlog dependencies",
  "gantt cascades",
  "OKR alignment",
];

function Strikethroughs() {
  return (
    <div className="mt-10 rounded-2xl border border-line-soft bg-white p-6 shadow-[0_1px_2px_rgba(20,21,26,0.04)] md:p-8">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
        We cut the jargon
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-medium text-ink-quiet">
        {STRIKES.map((s) => (
          // Static, not a scroll-reveal. The struck words are content
          // and the strike line is semantically load-bearing, it is
          // what marks the jargon as rejected. A whileInView opacity:0
          // / scaleX:0 left no-JS and crawlers reading the banned words
          // with no strike, inverting the meaning (proven, T·54).
          <span key={s} className="relative inline-block">
            <span>{s}</span>
            <span
              aria-hidden
              className="absolute left-0 right-0 top-1/2 h-[1.6px] -translate-y-1/2 rounded-full bg-gradient-to-r from-rose-300 via-rose-400 to-rose-300/0"
            />
          </span>
        ))}
        <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12.5px] font-semibold text-emerald-700">
          <span className="block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          tasks
        </span>
      </div>
    </div>
  );
}

function DomainGrid() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {DOMAIN_ORDER.map((id) => {
        const pack = DOMAINS[id];
        return (
          <div
            key={id}
            className="rounded-xl border border-line-soft bg-white px-4 py-3 transition-colors hover:border-ink-soft/30"
          >
            <div className="text-[13.5px] font-medium text-ink">
              {pack.label}
            </div>
            <div className="mt-0.5 text-[12.5px] text-ink-soft">
              {pack.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PROMISES: { title: string; body: string }[] = [
  {
    title: "Free where it counts.",
    body:
      "The features that make this useful, multi-view, real-time, shareable, work without paying. Always. We charge for power-user depth, not the basics. The basics belong to you.",
  },
  {
    title: "No vocabulary tax.",
    body:
      "If you can name what you have to do, you can use this app. There is no glossary. There is no sprint cadence to learn. There is no role you have to be assigned before you can ship something.",
  },
  {
    title: "It looks like the work.",
    body:
      "A board if you think in lanes, a list if you think in lines, a timeline if you think in shape, a calendar if you think in days. Same tasks, four lenses. No re-entering anything.",
  },
  {
    title: "Out of your way.",
    body:
      "Notifications are restrained, a daily digest, not a firehose. Capture is fast, write a sentence, the app picks out the date. The tool fades. The work stays.",
  },
];

function Promise({
  num,
  title,
  body,
}: {
  num: number;
  title: string;
  body: string;
}) {
  return (
    <li className="grid grid-cols-[40px_1fr] gap-3">
      <span className="mt-px inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-[12px] font-semibold tabular-nums text-brand">
        {num.toString().padStart(2, "0")}
      </span>
      <div>
        <div className="text-[15.5px] font-semibold text-ink">{title}</div>
        <p className="mt-1 text-[14.5px] leading-[1.55] text-ink-soft">
          {body}
        </p>
      </div>
    </li>
  );
}

function Eyebrow() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/60 py-1 pl-1 pr-3 text-[11.5px] font-medium text-ink-soft backdrop-blur">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white"
        style={{
          background:
            "linear-gradient(135deg, var(--brand) 0%, #4338ca 100%)",
          boxShadow: "0 4px 10px rgba(79, 70, 229, 0.32)",
        }}
      >
        About
      </span>
      What Tasks is, and isn&rsquo;t
    </div>
  );
}
