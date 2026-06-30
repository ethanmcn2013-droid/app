import Link from "next/link";

const START_POINTS = [
  {
    title: "Assignment due Friday",
    body: "Paste the brief, pull out the next steps, and see what needs doing before the deadline arrives.",
  },
  {
    title: "Exam week",
    body: "Keep revision blocks, readings, practice questions, and recovery time visible in one place.",
  },
  {
    title: "Group project",
    body: "Everyone can see who owns the source list, the slides, the draft, and the final upload.",
  },
] as const;

const LOOP = [
  ["Notes", "The rough material. Lecture notes, chat decisions, links, and things you might need later."],
  ["Tasks", "The clear next steps. What needs doing, who owns it, and when it is due."],
  ["Timeline", "The semester view. Exams, projects, meetings, and hand-ins in one calm line."],
  ["Signal", "The short read. What needs attention today and what can wait."],
] as const;

export function ForStudents() {
  return (
    <section className="relative isolate overflow-hidden pb-32 pt-12 md:pt-16">
      <div className="mx-auto grid w-full max-w-[1120px] gap-12 px-6 md:grid-cols-[minmax(0,0.9fr)_minmax(420px,1fr)] md:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <Eyebrow />

          <h1 className="mt-6 text-balance text-[clamp(2.35rem,1.55rem+3.4vw,4.4rem)] font-semibold leading-[1] tracking-[-0.045em] text-ink">
            Your semester, without the noise.
          </h1>

          <p className="mt-6 max-w-[58ch] text-[17px] leading-[1.6] text-ink-soft">
            Signal Studio gives students one calm place for lecture notes,
            assignments, exams, group work, and the short read on what needs
            attention next.
          </p>

          <p className="mt-5 max-w-[56ch] text-[15.5px] leading-[1.6] text-ink-quiet">
            The student rate is €9.99 a year with any working student email.
            No .edu requirement. No transcript upload. Renew each year while
            you study.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/students"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[14px] font-medium text-white shadow-[0_8px_24px_-12px_rgba(20,21,26,0.42)] transition-transform hover:-translate-y-px"
            >
              Verify student email
            </Link>
            <Link
              href="/templates/final-paper-push"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-line-soft bg-white px-5 text-[14px] font-medium text-ink transition-colors hover:border-ink-soft/30"
            >
              Start with a template
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <StudentLoop />

          <div className="grid gap-3 sm:grid-cols-3">
            {START_POINTS.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-line-soft bg-white p-4"
              >
                <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
                  {item.title}
                </h2>
                <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">
                  {item.body}
                </p>
              </article>
            ))}
          </div>

          <section className="rounded-2xl border border-line-soft bg-bg-elevated p-5 md:p-6">
            <h2 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
              Start with the week in front of you.
            </h2>
            <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.6] text-ink-soft">
              Templates are not the product. They are a fast first step when
              the page is blank and the deadline is real.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <TemplateCard
                href="/templates/final-paper-push"
                title="Final paper push"
                meta="8 tasks. From thesis to upload."
                body="Choose the thesis, gather sources, outline, draft, edit, submit. The order that beats the 4am panic."
              />
              <TemplateCard
                href="/templates/midterm-week"
                title="Midterm week"
                meta="7 tasks. Review, practice, sleep."
                body="Review sheets, redo practice questions, meet the study group, eat breakfast, and protect the hours that matter."
              />
            </div>
          </section>

          <section className="rounded-2xl border border-line-soft bg-white p-5 md:p-6">
            <h2 className="text-[22px] font-semibold tracking-[-0.025em] text-ink">
              Built for students who do not want another system.
            </h2>
            <div className="mt-5 grid gap-3">
              <Reason
                title="Group work stays readable."
                body="Invite classmates with a link. Keep the plan separate from the chat."
              />
              <Reason
                title="No sprint vocabulary."
                body="Write the work in plain language. Signal Studio keeps the structure quiet."
              />
              <Reason
                title="One morning read."
                body="A short signal tells you what is slipping. No dashboard habit required."
              />
            </div>
          </section>

          <section className="rounded-2xl border border-line-soft bg-bg-elevated px-6 py-7 text-center md:px-10">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-quiet">
              Student rate
            </div>
            <p className="mx-auto mt-3 max-w-[48ch] text-[18px] font-medium leading-[1.45] text-ink">
              €9.99 a year. Any working student email. Notes, Tasks,
              Timeline, and Signal.
            </p>
            <div className="mt-6">
              <Link
                href="/students"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[14px] font-medium text-white shadow-[0_8px_24px_-12px_rgba(20,21,26,0.42)] transition-transform hover:-translate-y-px"
              >
                Get the student rate
              </Link>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function StudentLoop() {
  return (
    <div className="rounded-2xl border border-line-soft bg-white p-4 shadow-[0_24px_70px_-54px_rgba(20,21,26,0.3)] md:p-5">
      <div className="flex items-start justify-between gap-4 border-b border-line-soft pb-3">
        <div>
          <div className="text-[13px] font-semibold text-ink">
            Group assignment
          </div>
          <div className="mt-1 text-[12px] text-ink-quiet">
            Research methods. Due Friday.
          </div>
        </div>
        <div className="rounded-full bg-brand-soft px-3 py-1 font-mono text-[10px] font-semibold uppercase text-brand">
          Clear today
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {LOOP.map(([name, copy]) => (
          <div
            key={name}
            className="grid gap-3 rounded-xl border border-line-soft bg-bg-elevated/70 p-3 sm:grid-cols-[86px_1fr]"
          >
            <div className="text-[13px] font-semibold text-ink">{name}</div>
            <p className="text-[13px] leading-[1.5] text-ink-soft">{copy}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  href,
  title,
  meta,
  body,
}: {
  href: string;
  title: string;
  meta: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-line-soft bg-white p-4 transition-all hover:border-ink-soft/30 hover:shadow-[0_16px_42px_-24px_rgba(20,21,26,0.22)]"
    >
      <div className="text-[15px] font-semibold tracking-[-0.005em] text-ink">
        {title}
      </div>
      <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-quiet">
        {meta}
      </div>
      <p className="mt-3 text-[13.5px] leading-[1.55] text-ink-soft">
        {body}
      </p>
      <div className="mt-4 text-[12px] font-medium text-ink transition-transform group-hover:translate-x-0.5">
        Open template
      </div>
    </Link>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line-soft bg-bg-elevated/60 p-4">
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      <p className="mt-1 text-[13.5px] leading-[1.55] text-ink-soft">{body}</p>
    </div>
  );
}

function Eyebrow() {
  return (
    <div className="inline-flex items-center rounded-full border border-line-soft bg-white px-3 py-1.5 text-[11.5px] font-medium text-ink-soft">
      Signal Studio for Students
    </div>
  );
}
