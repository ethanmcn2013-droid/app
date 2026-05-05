import { CinematicDemo } from "@/components/showcase/cinematic-demo";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-12 md:pt-20">
      {/* Soft gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[640px] w-[1100px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(124, 92, 255, 0.18), rgba(79, 70, 229, 0.08), transparent 70%)",
        }}
      />

      <div className="mx-auto w-full max-w-[1240px] px-6">
        <Eyebrow />
        <h1 className="mt-5 max-w-[18ch] text-balance text-[clamp(2.6rem,1.8rem+4.6vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.045em] text-ink">
          Work that moves itself{" "}
          <span className="relative inline-block whitespace-nowrap">
            <span
              aria-hidden
              className="absolute inset-x-1 -bottom-1 -z-10 h-[0.46em] rounded-md"
              style={{
                background:
                  "linear-gradient(110deg, rgba(124,92,255,0.32), rgba(79,70,229,0.18))",
              }}
            />
            forward
          </span>
          .
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17.5px] leading-[1.55] text-ink-soft">
          A live task workspace built for momentum. Real‑time presence, four
          synchronized views, AI nudges that surface what&rsquo;s stuck — all
          stitched together by motion that feels alive.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href="/app/board"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px"
          >
            Open the live demo
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
            href="#features"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-5 py-2.5 text-[14px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
          >
            See what's inside
          </a>
          <span className="ml-2 inline-flex items-center gap-2 text-[12.5px] text-ink-quiet">
            <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Demo above is fully autonomous · interact at any time
          </span>
        </div>

        {/* Demo */}
        <div className="mt-14 md:mt-16">
          <CinematicDemo />
        </div>
      </div>
    </section>
  );
}

function Eyebrow() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/60 py-1 pl-1 pr-3 text-[11.5px] font-medium text-ink-soft backdrop-blur">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-white"
        style={{
          background:
            "linear-gradient(135deg, var(--brand) 0%, #7c5cff 100%)",
          boxShadow: "0 4px 10px rgba(79, 70, 229, 0.32)",
        }}
      >
        New
      </span>
      Tasks 0.1 · realtime + multi‑view + AI
    </div>
  );
}
