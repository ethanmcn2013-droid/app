"use client";

/**
 * /principles, the public refusal list. Sister page to /about.
 * Where /about says what Tasks is, /principles says what it never
 * will be. The voice is confident, dry, opinionated. The visual
 * signature: rose-tinted "no" pills on the numbered items vs the
 * brand-soft "yes" pills on the about-page promises.
 */
export function PrinciplesManifesto() {
  return (
    <section className="relative isolate overflow-hidden pb-32 pt-16 md:pt-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(244, 63, 94, 0.10), rgba(244, 63, 94, 0.04), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[820px] px-6">
        <Eyebrow />

        <h1 className="mt-6 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink">
          Eight features we&rsquo;ll{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(244,63,94,0.22), rgba(244,63,94,0.08))",
              }}
            />
            never ship.
          </span>
        </h1>

        <p className="mt-6 text-[18.5px] leading-[1.55] text-ink-soft">
          Most product roadmaps are a list of yeses. This is the other
          list. The features competitors keep asking for, the ones
          enterprise sales would pay us to add, the ones a clever
          product manager could justify in a one-pager. We keep saying
          no. Here&rsquo;s why each one stays a no.
        </p>

        <p className="mt-5 text-[15px] leading-[1.6] text-ink-quiet">
          Naming what we won&rsquo;t build is the brand spine. If a
          future cycle ships any of these, the manifesto is a lie. So
          we publish the list, in plain English, on a public URL.
        </p>

        <ul className="mt-14 space-y-7">
          {REFUSALS.map((r, i) => (
            <Refusal key={r.title} num={i + 1} {...r} />
          ))}
        </ul>

        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            Plain English
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            What we promise, we ship. What we refuse, stays refused.
            Both lists are public so you can hold us to them.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/about"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
            >
              Read what we promise
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
            <a
              href="https://signalstudio.ie/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-white px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:border-ink-soft/30"
            >
              See the pricing
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const REFUSALS: { title: string; body: string }[] = [
  {
    title: "No per-seat pricing.",
    body:
      "Inviting a collaborator is a budget decision in most tools, every new person is another line on the bill, which is exactly why teams stop inviting people. We charge per workspace, never per seat. Add the whole study group, both moms, the DJ. Same price.",
  },
  {
    title: "No Gantt charts.",
    body:
      "Timeline view is the friendly cousin: a sequence you can read at a glance. Gantt charts pile on cascading dependencies, milestone diamonds, percent-complete bars, the language of consultants, not collaborators. The timeline view earns its keep by staying on the friendly side of that line.",
  },
  {
    title: "No SSO as a marketing line.",
    body:
      "Companies that sell SSO are companies that sell fear, pay $20,000 a year or risk an audit finding. We may eventually build it quietly for teams that need it. We will not put it on the pricing page. There are enough things to be afraid of in 2026 without a productivity tool joining in.",
  },
  {
    title: "No AI agent that runs your tasks for you.",
    body:
      "The dopamine of crossing it off is not outsourceable. An agent that auto-completes the list trains you to dread the app, every visit becomes confirmation that the work happened without you. Signal Tasks surfaces what&rsquo;s stuck; it never closes the loop on your behalf.",
  },
  {
    title: "No real-time push notifications.",
    body:
      "The daily digest is the only scheduled outbound channel. The Inbox tab inside the app is a pull surface, you visit it when you want to; it doesn&rsquo;t reach for you. No red-dot, no desktop alert, no Slack ping, no phone buzz. If a tool&rsquo;s strategy is winning more of your attention, the tool isn&rsquo;t on your side.",
  },
  {
    title: "No story points, velocity, burndown, OKR alignment.",
    body:
      "These are on the strikethrough block of the /about page for a reason. They belong to a vocabulary we refuse to bring back through a side door. Not as opt-in, not as a power-user toggle, not as a flag buried in settings. Vocabulary creep is how brands die.",
  },
  {
    title: "No paid template marketplace.",
    body:
      "Templates are oxygen. The moment they cost money they become scarce; the moment they&rsquo;re scarce, the manifesto is a lie. User-submitted templates are welcome, attributed, and free. They stay free.",
  },
  {
    title: "No threaded comments-on-comments.",
    body:
      "A flat conversation works for projects under ten people, which is most projects. Threading is for organizations that hold meetings about meetings. Comments aren&rsquo;t the work, the tasks are.",
  },
];

function Refusal({
  num,
  title,
  body,
}: {
  num: number;
  title: string;
  body: string;
}) {
  return (
    /* Static, not a scroll-reveal: these refusals are the brand spine
       and primary crawlable content. A whileInView opacity:0 here left
       them invisible to no-JS and crawlers (proven, T·54). BRAND.md §5
       keeps motion to the Tasks homepage demo; manifesto prose is
       restrained by rule, not faded in. */
    <li className="grid grid-cols-[44px_1fr] gap-4">
      <span className="mt-px inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-[12px] font-semibold tabular-nums text-rose-600 ring-1 ring-inset ring-rose-100">
        {num.toString().padStart(2, "0")}
      </span>
      <div>
        <div className="text-[16.5px] font-semibold tracking-[-0.005em] text-ink">
          {title}
        </div>
        <p className="mt-1.5 text-[14.5px] leading-[1.6] text-ink-soft">
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
            "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
          boxShadow: "0 4px 10px rgba(244, 63, 94, 0.32)",
        }}
      >
        Principles
      </span>
      What we&rsquo;ll never build
    </div>
  );
}
