import { cn } from "@/lib/utils";

const FEATURES = [
  {
    eyebrow: "Multi-view",
    title: "Four ways to see the same plan",
    body: "Board for momentum, list for triage, timeline for sequencing, calendar for commitments. The same tasks, instantly morphed via shared layout, no reloads, no losing your spot.",
    glyph: "views",
  },
  {
    eyebrow: "Real-time",
    title: "Presence that feels physical",
    body: "Cursors carry weight. Cards lock when someone's in them. Comments stream in with typing indicators. You can feel where the room's attention is.",
    glyph: "presence",
  },
  {
    eyebrow: "Nudges",
    title: "Stuck work surfaces itself",
    body: "Every idle card, every blocked dependency, every quiet review, surfaced as a one-tap nudge. Built on your team's actual rhythm, not generic reminders.",
    glyph: "ai",
  },
  {
    eyebrow: "Dependencies",
    title: "Hand-drawn sequencing",
    body: "Link cards across columns, tracks, and views. When upstream lands, downstream pulses. Critical paths become visible without the spreadsheet hangover.",
    glyph: "deps",
  },
  {
    eyebrow: "Live signals",
    title: "A pulse on every plan",
    body: "A sparkline corner-mounted to every plan. Pace, idle ratio, review-to-done lag, surfaced as motion, not as a separate analytics tab.",
    glyph: "spark",
  },
  {
    eyebrow: "Crafted",
    title: "Motion is the interface",
    body: "Every transition is hand-tuned: spring picks, easing on view morphs, anticipation on cursors, follow-through on drops. Software that earns the verb feel.",
    glyph: "motion",
  },
];

export function Features() {
  return (
    <section id="features" className="mt-28 md:mt-36">
      <div className="mx-auto w-full max-w-[1240px] px-6">
        <SectionHeading
          eyebrow="What's inside"
          title={
            <>
              Six parts.{" "}
              <span className="text-ink-soft/60">
                One feel.
              </span>
            </>
          }
        />
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-line-soft md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCell key={f.eyebrow} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCell({
  feature,
}: {
  feature: (typeof FEATURES)[number];
}) {
  return (
    <div className="group relative overflow-hidden bg-bg-elevated p-7">
      <div className="flex items-start gap-3">
        <FeatureGlyph kind={feature.glyph} />
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand">
            {feature.eyebrow}
          </div>
          <h3 className="mt-1.5 text-[18px] font-semibold tracking-tight text-ink">
            {feature.title}
          </h3>
        </div>
      </div>
      <p className="mt-4 max-w-[36ch] text-[14px] leading-[1.55] text-ink-soft">
        {feature.body}
      </p>
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-10 h-32 w-32 rounded-full bg-brand-soft opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-80"
      />
    </div>
  );
}

function FeatureGlyph({ kind }: { kind: string }) {
  const wrap = "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-line-soft bg-bg-sunken/70 text-ink-soft";
  if (kind === "views")
    return (
      <span className={wrap}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="18" rx="1.4" />
          <rect x="14" y="3" width="7" height="11" rx="1.4" />
        </svg>
      </span>
    );
  if (kind === "presence")
    return (
      <span className={wrap}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="11" r="2.4" />
          <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
          <path d="M14 20c0-2.3 1.4-4 3-4s3 1.7 3 4" />
        </svg>
      </span>
    );
  if (kind === "ai")
    return (
      <span className={wrap}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
        </svg>
      </span>
    );
  if (kind === "deps")
    return (
      <span className={wrap}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="6" cy="7" r="2" />
          <circle cx="18" cy="17" r="2" />
          <path d="M8 7h6a4 4 0 0 1 4 4v4" strokeLinecap="round" />
        </svg>
      </span>
    );
  if (kind === "spark")
    return (
      <span className={wrap}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l4-6 4 3 4-7 6 9" />
        </svg>
      </span>
    );
  if (kind === "motion")
    return (
      <span className={wrap}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12c4-9 14-9 18 0M3 12c4 9 14 9 18 0" />
        </svg>
      </span>
    );
  return <span className={wrap} />;
}

export function SectionHeading({
  eyebrow,
  title,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-[44ch]", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-balance text-[clamp(1.875rem,1.4rem+2.2vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-ink">
        {title}
      </h2>
    </div>
  );
}
