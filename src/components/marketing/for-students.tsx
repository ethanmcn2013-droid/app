import Link from "next/link";

/**
 * `/for/students`, long-form vertical landing for college students.
 * Sister to `/for/freelancers`. Wedding self-serve now lives on
 * studio `/weddings`; Tasks keeps the application/template surfaces.
 *
 * Distinct from the existing `/students` page, which is the action
 * surface (student-email verification + the €9.99/yr student rate). This
 * page is the top-of-funnel SEO landing that links to `/students`
 * for the student-rate offer at the bottom of the page.
 *
 * Anchors on final-paper-push + midterm-week templates.
 */
export function ForStudents() {
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
          The semester{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(79,70,229,0.28), rgba(79,70,229,0.16))",
              }}
            />
            in one place.
          </span>
        </h1>

        <p className="mt-6 text-[17px] leading-[1.55] text-ink-soft">
          A college semester has four classes, three group projects,
          two midterms in the same week, one job application that
          should have gone out last Tuesday, and the part-time shift
          that pays for it. The tools you&rsquo;re given to manage that
          are a notebook, the LMS that hates you, and a Notes app full
          of nine half-finished lists. We built the workspace where
          all of it lives in one shape, without sprints, without
          epics, without a tutorial.
        </p>

        <p className="mt-5 text-[15.5px] leading-[1.6] text-ink-quiet">
          The Free tier runs forever: one workspace, three editing
          guests, which is exactly the size of a study group. The full
          Workspace tier is €9.99 a year for students, verified with any
          student email: unlimited workspaces, unlimited guests.
        </p>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The two templates that survive a hard week.
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link
            href="/templates/final-paper-push"
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
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5" />
                  <path d="M9 13h6M9 17h4" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  Final paper push
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  8 tasks · thesis to submit
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              Pick a thesis, gather sources, outline, draft, edit,
              submit. The order that beats the 4am panic.
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
            href="/templates/midterm-week"
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
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" />
                  <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5H6.5A2.5 2.5 0 0 0 4 19.5z" />
                </svg>
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  Midterm week
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  7 tasks · review · sleep
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              Review sheets, redo practice problems, study group, eight
              hours of sleep, breakfast. The boring stuff that wins.
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
          Why this beats the LMS, the Notes app, and the productivity influencer.
        </h2>
        <ul className="mt-5 space-y-4">
          <Reason
            title="Group projects work better when everyone can edit."
            body="Three editing guests are free on every workspace, including yours. Your two group-project teammates drop in via magic link, no email-the-Google-doc, no dance over who has edit access. They open the link and write."
          />
          <Reason
            title="No sprints, no epics, no jargon."
            body="The whole industry has spent twenty years convincing people that getting work done requires a vocabulary. It doesn't. You write what you have to do, when it's due, and who's doing it. That's it."
          />
          <Reason
            title="Four lenses for the same list."
            body="Board for what's-where, list for triage, calendar for the day-to-day, timeline for the four classes laid out across the semester. Same tasks, four views. Useful when the LMS gives you only one."
          />
          <Reason
            title="Daily digest, no notification spam."
            body="One email each morning with what's due. No red dots, no buzzing phone, no Slack pings. The internet has enough of those."
          />
        </ul>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The student rate.
        </h2>
        <p className="mt-5 text-[16.5px] leading-[1.6] text-ink-soft">
          The full Workspace tier is €9.99 a year for students. Verify
          with any student email, no .edu needed. Unlimited workspaces:
          one per class, one for the job search, one for the part-time
          shift, one for the trip you&rsquo;re planning over spring
          break. Recurring tasks for weekly problem sets. Stuck-work
          nudges for the stuff that&rsquo;s slipping. Verify once, get
          the code, run the rest of your degree on it.
        </p>

        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            Free forever, or the full tier for €9.99 a year as a student
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            Open a workspace today. Bring a friend. Bring two more
            friends. The whole study group fits.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/students"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
            >
              Get the student rate
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
              href="/templates/final-paper-push"
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
        For students
      </span>
      A semester in one workspace
    </div>
  );
}
