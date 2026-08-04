import type { Metadata } from "next";
import Link from "next/link";

/**
 * /lab/welcome-a — venue-branded welcome, variant A: restrained.
 *
 * The first screen a couple sees after redeeming a venue-gifted code.
 * The venue gets exactly one line, set in Signal's own type, no logo.
 * Everything else on the page belongs to the couple. Review-only:
 * no auth, no data, no server actions. Fixture couple per brief:
 * Glenmara House · Mara and Finn · 19 September.
 */

export const metadata: Metadata = {
  title: "Compliments of Glenmara House · Signal Tasks",
  description:
    "Lab A: the restrained venue welcome. One line of attribution, then the workspace is the couple's.",
  robots: { index: false, follow: false },
};

export default function WelcomeRestrainedLabPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-ink">
      {/* Ambient field: a held breath of indigo and a whisper of the date.
          Both are texture, not content. Purely atmospheric. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none"
      >
        <div
          className="wa-glow absolute -right-24 -top-24 h-[520px] w-[520px] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(79,70,229,0.16), rgba(79,70,229,0.04) 60%, transparent 75%)",
          }}
        />
        <div
          className="absolute bottom-[-6vw] right-[-2vw] hidden select-none font-semibold leading-none text-[clamp(9rem,26vw,20rem)] tracking-[-0.05em] sm:block"
          style={{ opacity: 0.035 }}
        >
          19&middot;09
        </div>
      </div>

      {/* Corner mark: Signal Tasks, present because this is an owner
          surface. Small, quiet, and the only brand mark on the page. */}
      <div className="wa-fade absolute left-5 top-5 z-10 sm:left-8 sm:top-8">
        <Link
          href="/"
          aria-label="Tasks"
          className="wordmark-hover relative inline-flex select-none items-baseline text-base font-semibold"
          style={{ letterSpacing: "-0.05em" }}
        >
          <span className="wordmark" style={{ fontWeight: 600 }}>
            tasks
          </span>
          <span className="tasks-dot" aria-hidden="true" />
        </Link>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center sm:px-10">
        <div className="w-full max-w-[560px]">
          <p
            className="wa-rise mb-8 flex items-center justify-center gap-3 text-[13px] leading-none text-ink-soft sm:mb-10"
            style={{ animationDelay: "80ms" }}
          >
            <span aria-hidden="true" className="h-px w-7 bg-line-soft" />
            Compliments of Glenmara House
            <span aria-hidden="true" className="h-px w-7 bg-line-soft" />
          </p>

          <h1
            className="wa-rise h-display text-balance"
            style={{ animationDelay: "180ms" }}
          >
            Mara <span className="text-brand">&amp;</span> Finn
          </h1>

          <p
            className="wa-rise mt-4 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-quiet sm:mt-5"
            style={{ animationDelay: "280ms" }}
          >
            19 September
          </p>

          <p
            className="wa-rise mx-auto mt-7 max-w-[42ch] text-[17px] leading-[1.65] text-ink-soft sm:mt-8"
            style={{ animationDelay: "380ms" }}
          >
            Everything for the wedding lives in one place: what&rsquo;s
            decided, what&rsquo;s next, and what can wait. Only the two of
            you can see it or add to it.
          </p>

          <div
            className="wa-rise mt-10 sm:mt-12"
            style={{ animationDelay: "480ms" }}
          >
            <Link
              href="/welcome/plan?context=wedding_season"
              className="lift group inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-[15px] font-medium text-white shadow-[0_16px_40px_-16px_rgba(79,70,229,0.5)] focus-visible:outline-offset-4"
            >
              Begin your plan
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <p className="mt-4 text-[12.5px] text-ink-quiet">
              Nothing here needs deciding today.
            </p>
          </div>
        </div>
      </div>

      {/* Lab identification chip. Preview-only, not part of the product. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-full border border-line-soft bg-white/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-quiet shadow-float backdrop-blur"
      >
        Lab A &middot; restrained
      </div>

      <style>{`
        @keyframes wa-rise-kf {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wa-fade-kf {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes wa-glow-kf {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.72; transform: scale(0.94); }
        }
        .wa-rise {
          animation: wa-rise-kf 640ms var(--ease-out, cubic-bezier(0.23,1,0.32,1)) both;
        }
        .wa-fade {
          animation: wa-fade-kf 900ms var(--ease-out, cubic-bezier(0.23,1,0.32,1)) both;
        }
        .wa-glow {
          animation: wa-glow-kf 14s var(--ease-in-out, cubic-bezier(0.77,0,0.175,1)) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .wa-rise, .wa-fade, .wa-glow {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </main>
  );
}
