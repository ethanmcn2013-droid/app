import Link from "next/link";

/**
 * `/for/community` — long-form landing for public-facing professionals
 * who coordinate people who don't work for them: teachers, school
 * administrators, club coaches, parish coordinators, community
 * organisers. The §2.1 archetype whose hardest job is visibility into
 * other people's commitments — and whose tools have always been built
 * for engineering teams, not for parents, parishioners, and volunteers.
 *
 * Accent is community violet (#7c3aed) — distinct from brand indigo,
 * warm enough to read as people-coordination not engineering work.
 */
export function ForCommunity() {
  return (
    <section className="relative isolate overflow-hidden pb-32 pt-12 md:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124,58,237,0.16), rgba(124,58,237,0.04), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[820px] px-6">
        <Eyebrow />

        <h1 className="mt-6 text-balance text-[clamp(2.4rem,1.6rem+3.6vw,4.6rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-ink">
          Coordinating people who{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(124,58,237,0.32), rgba(99,102,241,0.16))",
              }}
            />
            don&rsquo;t work for you.
          </span>
        </h1>

        <p className="mt-6 text-[17px] leading-[1.55] text-ink-soft">
          The hardest job in coordinating a class, a club, a parish, or a
          community group is visibility into other people&rsquo;s
          commitments. The volunteer who said yes last month and hasn&rsquo;t
          replied this week. The parent meant to bring the forms. The
          coach handling the under-14s who is also taking exams. Nobody
          you coordinate works for you, and you cannot ask software to
          enforce on them.
        </p>

        <p className="mt-5 text-[15.5px] leading-[1.6] text-ink-quiet">
          One workspace. Volunteers, parents, players, parishioners,
          colleagues — invited as magic-link guests, free, no app to
          install. They see what concerns them. You see who said yes,
          who said maybe, who has gone quiet. No vocabulary anyone has
          to learn.
        </p>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Two templates for the two patterns this work falls into.
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link
            href="/templates/term-planner"
            className="group block rounded-2xl border border-line-soft bg-white p-5 transition-all hover:border-ink-soft/30 hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl font-mono text-[18px]"
                style={{ background: "rgba(124,58,237,0.10)", color: "#6d28d9" }}
              >
                01
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  Term planner
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  8 tasks · across one term
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              Lesson plans, parent communications, exam scheduling, the
              field trip permissions, the year-group meeting that keeps
              moving. The shape of a term as a coordinator actually
              experiences it.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
              Open the template
              <ArrowIcon />
            </div>
          </Link>
          <Link
            href="/templates/season-setup"
            className="group block rounded-2xl border border-line-soft bg-white p-5 transition-all hover:border-ink-soft/30 hover:shadow-[0_18px_42px_-18px_rgba(20,21,26,0.18)]"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl font-mono text-[18px]"
                style={{ background: "rgba(124,58,237,0.10)", color: "#6d28d9" }}
              >
                02
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
                  Season setup
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-quiet">
                  10 tasks · the pre-season run
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
              Fixtures, kits, transport, parent comms, the volunteer
              rota, the first-aid certificates that need renewing.
              Anything that decides whether the first match runs at all.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
              Open the template
              <ArrowIcon />
            </div>
          </Link>
        </div>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          Why a workspace beats a WhatsApp group and a paper diary.
        </h2>
        <ul className="mt-5 space-y-4">
          <Reason
            title="Magic-link guests for everyone you coordinate."
            body="Three free guests on the free tier. Each one opens the link from a phone, sees only their part of the work, and replies in the workspace — not in five different threads you have to reconcile in your head."
          />
          <Reason
            title="The roadmap is the parent email."
            body="Pair this workspace with a public Signal Roadmap. Parents and members read the plan at midnight on their phone. No login. No app. No follow-up email asking what was decided last week."
          />
          <Reason
            title="No project-manager vocabulary."
            body="Nothing here says sprint or stakeholder. Nothing here asks for a kanban. The empty state is the term, not a wiki you have to fill in before you can begin."
          />
          <Reason
            title="One bill. Inviting people is always free."
            body="Add the whole staff, the whole parents&rsquo; group, every coach. Same fee. Coordinating more people should not cost you more software."
          />
        </ul>

        <h2 className="mt-16 text-[26px] font-semibold tracking-[-0.02em] text-ink">
          The honest math.
        </h2>
        <p className="mt-5 text-[16.5px] leading-[1.6] text-ink-soft">
          Solo coordinator: Free tier covers one workspace and three
          editing guests — enough for you and two colleagues or one
          deputy. Larger group, multiple sub-teams: Pro at $4.99/mo for
          unlimited workspaces. School, club, or parish coordinating
          many strands at once: Team at $9.95/workspace flat — invite
          the whole staff, the parents&rsquo; rep, the volunteers, no
          per-seat surcharge. Studio at $14.95/mo if you run several
          workspaces under one operation.
        </p>

        <div className="mt-20 rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
          <div
            className="text-[11.5px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "#6d28d9" }}
          >
            Free tier covers the coordinator
          </div>
          <p className="mt-3 text-[18px] font-medium leading-[1.45] text-ink">
            One workspace, every view, three editing guests, the daily
            digest. Plain English. Visible to everyone you coordinate.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app/board"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
            >
              Open the workspace
              <ArrowIcon />
            </Link>
            <Link
              href="/templates/term-planner"
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
        style={{ background: "#7c3aed" }}
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
            "linear-gradient(135deg, #6d28d9 0%, #7c3aed 100%)",
          boxShadow: "0 4px 10px rgba(124, 58, 237, 0.32)",
        }}
      >
        For coordinators
      </span>
      Coordinating people who don&rsquo;t work for you
    </div>
  );
}
