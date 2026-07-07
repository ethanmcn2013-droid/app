export function CallToAction() {
  return (
    <section className="mt-32 md:mt-40 border-t border-line-soft">
      <div className="mx-auto w-full max-w-[1240px] px-6 py-20 md:py-28">
        <div className="max-w-[46ch]">
          <p
            className="font-mono text-[11px] font-semibold uppercase text-indigo-600"
            style={{ letterSpacing: "0.18em" }}
          >
            Live workspace
          </p>
          <h2 className="mt-4 text-balance text-[clamp(2rem,1.5rem+2.6vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">
            Stop reading.{" "}
            <span className="text-ink-ghost">Start moving.</span>
          </h2>
          <p className="mt-5 text-[16.5px] leading-[1.55] text-ink-soft">
            Tasks runs on your rhythm. No setup, no
            imports, just open a board and start moving cards. Everything
            else assembles around the work.
          </p>
          <div className="mt-8 flex flex-wrap items-start gap-3">
            <a
              href="mailto:hello@signalstudio.ie?subject=Tasks%20access"
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
            >
              Request access
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
            </a>
            <a
              href="https://signalstudio.ie/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-5 py-2.5 text-[14px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
            >
              See pricing
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
