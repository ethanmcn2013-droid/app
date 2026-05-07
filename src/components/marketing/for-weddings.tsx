import Link from "next/link";

/**
 * `/for/weddings` — long-form vertical landing for couples and
 * planners. Sister to the eventual `/for/students` and
 * `/for/freelancers`. Voice: manifesto, dry, observational.
 *
 * The two strongest CTAs on this page are the wedding-3-month
 * countdown template and the day-of run-of-show template — both
 * already shipped. The pricing line ($79 once, for the workspace
 * that matters most) is the load-bearing commercial argument.
 */
export function ForWeddings() {
  return (
    <section className="relative isolate overflow-hidden pb-32 pt-12 md:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(244,114,182,0.16), rgba(244,114,182,0.05), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[820px] px-6">
        <Eyebrow />

        <h1 className="mt-6 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink">
          Plan the wedding{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(244,114,182,0.30), rgba(236,72,153,0.16))",
              }}
            />
            in one place.
          </span>
        </h1>

        <p className="mt-6 text-[18.5px] leading-[1.55] text-ink-soft">
          A wedding has 73 vendors, 14 family members with opinions, and
          one couple holding it all together with a Google Sheet. We
          built the workspace where the whole thing actually lives.
          Vendors, RSVPs, run-of-show, vows, the marriage license, the
          welcome bag the maid of honor is assembling at her kitchen
          table at midnight. One place.
        </p>

        <p className="mt-5 text-[15.5px] leading-[1.6] text-ink-quiet">
          You can pay $79 once and have it forever — bridal-shower-night
          to honeymoon and beyond. Not a subscription that you cancel
          the week after the wedding. Not a per-seat fee that makes
          inviting your parents a budget decision. One workspace, one
          fee, one wedding.
        </p>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The two templates that do most of the work.
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link
            href="/templates/wedding-3-month-countdown"
            className="group block rounded-2xl border border-line-soft bg-white p-5 transition-all hover:border-ink-soft/30 hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-pink-500"
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
                  <circle cx="12" cy="14" r="6" />
                  <path d="M9 5l3-3 3 3" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  3-month countdown
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  9 tasks · the home stretch
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              RSVPs, seating, vows, marriage license. The 90-day window
              where vendors get slow and the math gets real.
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
            href="/templates/wedding-day-of-run-of-show"
            className="group block rounded-2xl border border-line-soft bg-white p-5 transition-all hover:border-ink-soft/30 hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-pink-500"
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
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  Day-of run-of-show
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  10 tasks · 8am to 11pm
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              Hair and makeup at 8, florals at 10, ceremony at 3, sparkler
              send-off at 11. Every minute, in order.
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
          Why couples like this better than a spreadsheet.
        </h2>
        <ul className="mt-5 space-y-4">
          <Reason
            title="Both moms can edit. So can the maid of honor."
            body="Three editing guests are free on the workspace, including the wedding tier. Inviting people doesn't cost money. Inviting them also doesn't cost a calendar invite to learn the tool — drop them a magic link, they just open it."
          />
          <Reason
            title="The vendor list lives next to the timeline."
            body="The florist's email, the contract status, the deposit amount, and the day-of-arrival time all sit on the same task. No more flipping between four tabs to answer one question."
          />
          <Reason
            title="The day-of timeline lives on every phone."
            body="Magic-link your photographer, your DJ, your day-of coordinator. They open the link, they see the same run-of-show you do, in real time. Updates ripple. No re-emailing the binder at 6am."
          />
          <Reason
            title="It outlives the wedding."
            body="The workspace stays. Anniversaries, vow renewals, the friend who gets engaged next year and asks how you stayed sane — your run-of-show is right there to share."
          />
        </ul>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          For wedding planners.
        </h2>
        <p className="mt-5 text-[16.5px] leading-[1.6] text-ink-soft">
          If you run multiple weddings a year, the math is different.
          Every wedding is its own workspace; every couple is its own
          three guests; every binder is its own printable run-of-show.
          We&rsquo;re working on a planner-tier price that fits a 10-or-
          20-weddings-a-year studio without forcing $79 × 20. In the
          meantime, you can run them on Team workspaces ($9.95/mo
          flat per workspace, no per-seat tax) and the cost is a single
          line on a wedding invoice.
        </p>

        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            $79, once, for the workspace that matters most
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            One fee. One wedding. Forever a memory you can hand someone.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
            >
              Buy the wedding tier
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
              href="/templates/wedding-3-month-countdown"
              className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-white px-5 py-2.5 text-[14px] font-medium text-ink transition-colors hover:border-ink-soft/30"
            >
              Open a template free
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
      <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-pink-400" aria-hidden />
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
            "linear-gradient(135deg, #db2777 0%, #f472b6 100%)",
          boxShadow: "0 4px 10px rgba(236, 72, 153, 0.32)",
        }}
      >
        For weddings
      </span>
      The workspace where the whole day lives
    </div>
  );
}
