import Link from "next/link";

export function CallToAction() {
  return (
    <section className="mt-32 md:mt-40">
      <div className="mx-auto w-full max-w-[1240px] px-6">
        <div
          className="relative isolate overflow-hidden rounded-3xl border border-line-soft px-8 py-16 md:px-16 md:py-24"
          style={{
            background:
              "radial-gradient(ellipse at top left, rgba(124,92,255,0.18), transparent 50%), radial-gradient(ellipse at bottom right, rgba(79,70,229,0.14), transparent 60%), #0e0f14",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.06), transparent 30%), radial-gradient(circle at 80% 60%, rgba(255,255,255,0.04), transparent 30%)",
            }}
          />
          <div className="relative z-10 max-w-[42ch]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Live workspace
            </div>
            <h2 className="mt-3 text-balance text-[clamp(2rem,1.5rem+2.6vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
              Stop reading.{" "}
              <span className="text-white/55">Start moving.</span>
            </h2>
            <p className="mt-5 text-[16.5px] leading-[1.55] text-white/70">
              Tasks runs entirely on your team&rsquo;s rhythm. No setup, no
              imports — just open a board and start moving cards. Everything
              else assembles around the work.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/app/board"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-ink transition-transform hover:-translate-y-px"
              >
                Open the workspace
                <svg
                  width="14"
                  height="14"
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
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-5 py-2.5 text-[14px] font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
