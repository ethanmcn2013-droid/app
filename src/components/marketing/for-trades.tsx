import Link from "next/link";

/**
 * `/for/trades`, long-form landing for the trades audience:
 * electricians, carpenters, plumbers, HVAC techs, contractors,
 * and anyone whose work is dispatched as a list of calls and
 * finished with a signature.
 *
 * Sister landing to `/for/freelancers` and `/for/students`. All wedge
 * pages carry the single suite indigo. Wedding self-serve lives on studio
 * `/weddings`.
 *
 * Anchors on `new-client-onboarding` + `tax-season` templates —
 * the same shape as freelance, just with tooling and a license
 * board attached.
 */
export function ForTrades() {
  return (
    <section className="relative isolate overflow-hidden pb-32 pt-12 md:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(79,70,229,0.16), rgba(79,70,229,0.04), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[820px] px-6">
        <Eyebrow />

        <h1 className="mt-6 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink">
          Calls, jobs, invoices,{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(79,70,229,0.28), rgba(79,70,229,0.16))",
              }}
            />
            one binder.
          </span>
        </h1>

        <p className="mt-6 text-[17px] leading-[1.55] text-ink-soft">
          A working day in the trades is a list of addresses, parts
          orders, signatures, and invoices that didn&rsquo;t go out
          last week. The clipboard works. So does the spreadsheet.
          The phone is mostly fine. The thing that&rsquo;s missing is
          a place where all of it lives at once, readable on the
          truck, share-able with the office, and not built for
          office workers.
        </p>

        <p className="mt-5 text-[15.5px] leading-[1.6] text-ink-quiet">
          One workspace per route. Calls, quotes, materials,
          permits, invoices, the truck inspection that&rsquo;s due
          next month. No sprint vocabulary. No boards labelled
          backlog. No app pretending the work is software.
        </p>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The two templates that pay for themselves.
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link
            href="/templates/new-client-onboarding"
            className="group block rounded-2xl border border-line-soft bg-white p-5 transition-all hover:border-ink-soft/30 hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[18px] font-mono"
                style={{ background: "rgba(79,70,229,0.10)", color: "var(--accent-deep)" }}
              >
                01
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  New client onboarding
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  7 tasks · the first week
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              Quote, deposit, materials list, permit pickup, schedule
              the rough-in. The work that decides whether the job
              runs at your number or theirs.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
              Open the template
              <ArrowIcon />
            </div>
          </Link>
          <Link
            href="/templates/jobsite-punchlist"
            className="group block rounded-2xl border border-line-soft bg-white p-5 transition-all hover:border-ink-soft/30 hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-[18px] font-mono"
                style={{ background: "rgba(79,70,229,0.10)", color: "var(--accent-deep)" }}
              >
                02
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  Jobsite punchlist
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  10 tasks · the closeout
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              Walkthrough callbacks, touch-ups, final inspection,
              warranty docs, the invoice. The end-of-job list that
              decides whether the check clears this week or next.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
              Open the template
              <ArrowIcon />
            </div>
          </Link>
        </div>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Why a workspace beats a clipboard and a group text.
        </h2>
        <ul className="mt-5 space-y-4">
          <Reason
            title="One link to the crew, not a screenshot at 6am."
            body="Magic-link guests are free, three of them. The new apprentice opens the link from his phone in the truck and sees today's calls in order. No login, no app to install."
          />
          <Reason
            title="Pinned materials list per job."
            body="Every job has a tags row for its parts. When you're at the supply house pricing a panel, the list is on your phone, not a sticky note that fell out of the visor."
          />
          <Reason
            title="Invoice the day you closed it."
            body="The Done lane is the to-invoice list. End of the day, you sweep the closed jobs into the billing column. The week stops being a guessing game in March."
          />
          <Reason
            title="No per-seat tax."
            body="Add the apprentice, the bookkeeper, your dispatcher, the partner who handles QuickBooks. Same price. Inviting people is free, on every tier."
          />
        </ul>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The honest math.
        </h2>
        <p className="mt-5 text-[16.5px] leading-[1.6] text-ink-soft">
          One-truck operation: the Free tier covers the route, one
          workspace, all three products, three editing guests for a
          small crew, no card. Running more than one truck: Workspace
          is €12 a month for unlimited workspaces, one per truck if
          you dispatch them separately, and inviting people never
          moves the price, so the whole site, the GC and the
          inspector cost the same as just you. A single big job that
          runs for months, a full fit-out, a site that lasts a
          season: Event is €89 once, and the workspace keeps reading
          for twelve months after it&rsquo;s done.
        </p>

        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
          <div
            className="text-[11.5px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent-deep)" }}
          >
            Free tier covers a one-truck route
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            One workspace, every view, three editing guests, the
            daily digest. Open it in the morning, close it from the
            truck.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app/tasks"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
            >
              Open the workspace
              <ArrowIcon />
            </Link>
            <Link
              href="/templates/new-client-onboarding"
              className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-white px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:border-ink-soft/30"
            >
              Start with a template
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <li className="grid grid-cols-[24px_1fr] gap-3">
      <span
        className="mt-1.5 inline-block h-2 w-2 rounded-full"
        style={{ background: "var(--brand)" }}
        aria-hidden
      />
      <div>
        <div className="text-[15.5px] font-semibold text-ink">{title}</div>
        <p className="mt-1 text-[14.5px] leading-[1.55] text-ink-soft">
          {body}
        </p>
      </div>
    </li>
  );
}

function ArrowIcon() {
  return (
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
        For trades
      </span>
      Calls, jobs, invoices · one binder
    </div>
  );
}
