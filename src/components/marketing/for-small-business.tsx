import Link from "next/link";

/**
 * `/for/small-business`, long-form landing for small-business operators:
 * restaurant owners, shop owners, clinic operators, studio owners.
 * The §2.1 archetype whose work is part operations, part people, part
 * sales, all without a status meeting or a manager to surface what is
 * slipping.
 *
 * Anchored on a weekly + monthly cadence, the two patterns that
 * separate a business that holds together from one that limps. Carries
 * the single suite indigo, like every wedge page.
 */
export function ForSmallBusiness() {
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
          The shop, the books, the people,{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(79,70,229,0.28), rgba(79,70,229,0.16))",
              }}
            />
            one place.
          </span>
        </h1>

        <p className="mt-6 text-[17px] leading-[1.55] text-ink-soft">
          Running a small business is not running a project. There is no
          status meeting. There is no manager whose job is to notice when
          something is slipping. There is no quarterly review. There is the
          shop, the back of house, the books, the staff, the suppliers,
          and the customer who left a voice note about Friday, and all of
          it has to hold together at once, every week, without anyone
          else watching for you.
        </p>

        <p className="mt-5 text-[15.5px] leading-[1.6] text-ink-quiet">
          One workspace per business. Operations, payroll, suppliers,
          marketing, the renewal coming up, the staff one-to-ones you
          keep postponing. No project-manager vocabulary. No app that
          assumes you have a team of fifteen and a Friday demo.
        </p>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The cadence that keeps a business honest.
        </h2>
        <div className="mt-5">
          <Link
            href="/templates/local-business-monthly-rhythm"
            className="group block rounded-2xl border border-line-soft bg-white p-6 transition-all hover:border-ink-soft/30 hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl font-mono text-[18px]"
                style={{ background: "rgba(79,70,229,0.10)", color: "var(--accent-deep)" }}
              >
                01
              </span>
              <div className="min-w-0">
                <div className="text-[16px] font-semibold tracking-[-0.005em] text-ink">
                  Monthly business rhythm
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  18 tasks · across one full operating month
                </div>
              </div>
            </div>
            <p className="mt-3 text-[14px] leading-[1.6] text-ink-soft">
              Month-end close, payroll, supplier invoices, marketing post,
              renewal review, staff one-to-ones, accountant summary. The
              full pattern that turns reactive months into ones that hold,
              ready to remix into your own operation.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
              Open the template
              <ArrowIcon />
            </div>
          </Link>
        </div>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Why a workspace beats five group chats and a whiteboard.
        </h2>
        <ul className="mt-5 space-y-4">
          <Reason
            title="The work lives somewhere durable."
            body="Group chats lose things. Whiteboards get wiped. The thing the chef said about the supplier two weeks ago needs to be findable next month, not pinned to the wall behind the bar."
          />
          <Reason
            title="Three free guests for the people who actually show up."
            body="The bookkeeper, the front-of-house manager, the cleaner who handles the supply order. They get magic-link access, no app to install, no login to remember. They see only what they need to see."
          />
          <Reason
            title="No project-manager voice."
            body="Nothing here calls you a stakeholder. Nothing here asks for a sprint plan. The empty state is the shop, not a wiki you have to fill in first."
          />
          <Reason
            title="One bill. The whole operation."
            body="Add the entire team. Same workspace fee. Adding people to your business shouldn't be a budget conversation with your software."
          />
        </ul>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The honest math.
        </h2>
        <p className="mt-5 text-[16.5px] leading-[1.6] text-ink-soft">
          Solo operator: the Free tier covers a single business
          workspace and three editing guests, enough for you, the
          bookkeeper, and a right hand, no card. Two locations, two
          operating modes, or a team across departments: Workspace is
          €12 a month for unlimited workspaces, and inviting the
          staff, the suppliers, and the accountant never moves the
          price. There is no per-seat surcharge at any size. A
          one-off, a launch, a fit-out, a move: Event is €89 once
          and that workspace keeps reading for twelve months after.
        </p>

        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
          <div
            className="text-[11.5px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent-deep)" }}
          >
            Free tier covers the operator
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            One workspace, every view, three editing guests, the daily
            digest. Open it Monday morning. Close it Friday afternoon.
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
              href="/templates/local-business-monthly-rhythm"
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
        For small business
      </span>
      The shop, the books, the people · one place
    </div>
  );
}
