import Link from "next/link";

/**
 * `/for/freelancers`, long-form vertical landing for solo developers,
 * designers, and consultants. Wedding self-serve now lives on
 * studio `/weddings`; Tasks keeps the application/template surfaces.
 *
 * The strong commercial hook here is the multi-client structure:
 * the Workspace tier (€12/mo, canonical, see studio /pricing) is
 * unlimited workspaces with no per-seat tax, so five clients cost
 * the same as one. The old Pro/Team/Studio model this page used to
 * reference is retired; pricing here must track studio /pricing.
 *
 * Anchors on tax-season + new-client-onboarding templates.
 */
export function ForFreelancers() {
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
          Five clients,{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(79,70,229,0.28), rgba(79,70,229,0.16))",
              }}
            />
            one inbox.
          </span>
        </h1>

        <p className="mt-6 text-[17px] leading-[1.55] text-ink-soft">
          A freelance developer at any given moment has three clients,
          one half-finished portfolio, two invoices in flight, and
          Linear logins for four orgs they barely remember the
          subdomains for. The work is fine. The structure is the
          problem. We built the workspace where each client gets its
          own surface, without the per-seat tax, without the
          enterprise pretense, without an admin panel for things you do
          alone at 2pm.
        </p>

        <p className="mt-5 text-[15.5px] leading-[1.6] text-ink-quiet">
          One workspace per client. Each with its own board, list,
          timeline, calendar. Each with magic-link guests so the client
          point-of-contact can drop in without a credit card. None of
          it priced per seat. None of it requiring you to learn a new
          vocabulary just to track a contract review.
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
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[var(--brand)]"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="7" width="18" height="13" rx="2" />
                  <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  <path d="M3 13h18" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  New client onboarding
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  7 tasks · start clean
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              Kickoff doc, contract, payment terms, deposit invoice.
              The first two weeks of any engagement, sequenced.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
              Open the template
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:translate-x-0.5"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
          <Link
            href="/templates/tax-season"
            className="group block rounded-2xl border border-line-soft bg-white p-5 transition-all hover:border-ink-soft/30 hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-[var(--brand)]"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="9" y="2" width="6" height="4" rx="1" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  Tax season
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  7 tasks · finish in March
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              Receipts, VAT returns, contractor invoices, end-of-year accounts.
              The list that turns filing season from a cliff into a Tuesday afternoon.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
              Open the template
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:translate-x-0.5"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Why this beats Notion-plus-Linear-plus-a-spreadsheet.
        </h2>
        <ul className="mt-5 space-y-4">
          <Reason
            title="One bill for unlimited projects."
            body="Five clients, five workspaces, €12 a month total. Compare against Linear's per-seat math (which charges your client to invite you) or Notion's plan tiers (which gate things you actually need). Tasks charges the freelancer once and stops there."
          />
          <Reason
            title="The client can come in as a guest."
            body="Drop them a magic link. They open it. They can comment on a task. No Slack invite, no SAML, no calendar invite to a kickoff call to learn the tool. Three editing guests are free on every workspace."
          />
          <Reason
            title="No per-seat tax, ever."
            body="A workspace is a workspace, full stop. If a client wants their VP-of-engineering to look at the timeline, that's free. If your subcontractor needs to update a task, that's free. Charging you to invite people is one of the things on the no list."
          />
          <Reason
            title="It looks like the work."
            body="Board for momentum, list for triage, timeline for sequencing, calendar for delivery commitments. Same tasks, four lenses. No re-entering anything when the client wants to see the timeline and you want to see the board."
          />
        </ul>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The honest math.
        </h2>
        <p className="mt-5 text-[16.5px] leading-[1.6] text-ink-soft">
          There is one shape, and it does not get more expensive as
          you grow. The Workspace tier is €12 a month for unlimited
          workspaces, one per client, the full feature set on every
          one, and inviting the client (or their VP, or your
          subcontractor) never moves the price. Five clients is €12.
          Twelve clients is €12. The bill stops being something you
          model and starts being a single line you forget about. The
          Free tier still runs one workspace for nothing if you only
          have the one engagement that matters this quarter.
        </p>

        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            Workspace · €12 a month, unlimited workspaces
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            The cost of forgetting one deductible lunch. One bill.
            One inbox. Five clients, full feature set on each.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
            >
              See pricing
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
      <span className="mt-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "var(--brand)" }} aria-hidden />
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
        For freelancers
      </span>
      Five clients, one inbox, no per-seat tax
    </div>
  );
}
