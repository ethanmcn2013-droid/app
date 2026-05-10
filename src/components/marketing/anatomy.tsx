import { SectionHeading } from "./features";

export function Anatomy() {
  return (
    <section className="mt-32 md:mt-40">
      <div className="mx-auto w-full max-w-[1240px] px-6">
        <SectionHeading
          eyebrow="Anatomy of a card"
          title={
            <>
              Every detail{" "}
              <span className="text-ink-soft/60">
                earns its place.
              </span>
            </>
          }
        />
        <p className="mt-5 max-w-[58ch] text-[16px] leading-[1.55] text-ink-soft">
          A card holds twelve signals. Most of them are quiet — they only step
          forward when the moment calls for them. Idle days appear when work
          stalls. The lock outline shows when someone is in the card. Comments
          stream when the conversation is live.
        </p>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <DemoCard />
          <Annotations />
        </div>
      </div>
    </section>
  );
}

function DemoCard() {
  return (
    <div className="relative flex items-center justify-center rounded-3xl border border-line-soft bg-gradient-to-b from-bg-elevated to-bg-sunken/60 px-6 py-20">
      <div
        className="absolute inset-0 -z-10 rounded-3xl"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(124,92,255,0.08), transparent 60%)",
        }}
      />
      <div className="relative w-[300px] rounded-[12px] border bg-white p-3.5 shadow-[0_18px_44px_-16px_rgba(20,21,26,0.22),0_0_0_1px_rgba(20,21,26,0.04)]">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[14px] font-medium leading-snug text-ink">
            Launch demo video — final cut
          </span>
          <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-red-600">
            P0
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-soft">
              Tomorrow
            </span>
            <span className="text-[10.5px] text-ink-quiet">8h</span>
          </div>
          <div className="flex -space-x-1.5">
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold uppercase text-white ring-2 ring-white"
              style={{ background: "var(--user-david)" }}
            >
              DV
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-amber-200/70 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
            Idle 4d
          </span>
          <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-quiet">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
            11
          </span>
        </div>
      </div>

      {/* Annotation lines */}
      <svg
        className="pointer-events-none absolute inset-0"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="annLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(20,21,26,0.16)" />
            <stop offset="100%" stopColor="rgba(20,21,26,0)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

const ANN = [
  { label: "Title", note: "Plain language. No jargon, no IDs." },
  {
    label: "Priority chip",
    note: "Surfaces only when above P2. Quiet rest of the time.",
  },
  {
    label: "Due date",
    note: "Relative when near, absolute when far. Auto-formatted.",
  },
  {
    label: "Idle indicator",
    note: "Appears at 2 days. Drives the stuck-work prompt.",
  },
  {
    label: "Comment count",
    note: "A single click opens the thread inline. No modal.",
  },
  {
    label: "Assignee stack",
    note: "Live presence — pulses when the user is actively in the card.",
  },
];

function Annotations() {
  return (
    <ol className="space-y-4">
      {ANN.map((a, i) => (
        <li
          key={a.label}
          className="grid grid-cols-[auto_1fr] items-start gap-3"
        >
          <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-line-soft bg-white text-[11px] font-semibold text-ink-soft">
            {i + 1}
          </span>
          <div>
            <div className="text-[13.5px] font-medium text-ink">{a.label}</div>
            <div className="mt-0.5 text-[13px] leading-[1.55] text-ink-soft">
              {a.note}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
