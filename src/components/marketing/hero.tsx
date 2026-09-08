import { HeroRelay } from "@/components/marketing/hero-relay";

// Marketing CTAs point at the waitlist, never an auth wall
// (scripts/check-marketing-waitlist-contract.mjs). Same source/product
// tagging as the header and the closing CTA.
const WAITLIST_URL = "https://signalstudio.ie/waitlist?source=hero&product=tasks";

/**
 * The front door. The locked suite headline on the left, and on the right
 * the three product cards from the 2 September 2026 front-door directions
 * (A · Floor and sheet, the founder's pick): a note, the task it becomes,
 * and the date that goes live on the couple's timeline. The relay plays
 * once as it arrives and can be replayed; reduced motion gets the settled
 * state. "not" is indigo at the founder's request.
 */
export function Hero() {
  return (
    <section
      className="relative isolate overflow-hidden pt-[clamp(48px,6vw,88px)] pb-[clamp(40px,5vw,72px)]"
      aria-labelledby="hero-title"
    >
      <div className="mx-auto grid w-full max-w-[1240px] gap-[clamp(40px,6vw,88px)] px-5 md:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <h1
            id="hero-title"
            className="max-w-[12ch] text-balance text-[clamp(2.6rem,1.8rem+4.6vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.045em] text-ink"
          >
            Project management for people <span className="text-brand">not</span>{" "}
            in tech.
          </h1>
          <p className="mt-[28px] max-w-[38ch] text-[17px] leading-[1.6] text-ink-soft">
            Notes, Tasks and Timeline. One calm system for people with work to
            manage, not software to manage.
          </p>
          <div className="mt-[36px] flex flex-wrap items-center gap-3">
            <a
              href={WAITLIST_URL}
              className="group inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ink px-5 text-[14px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(20,21,26,0.4)] transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Join the waitlist
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </a>
            <a
              href="#anatomy"
              className="inline-flex min-h-[44px] items-center rounded-full border border-line bg-white px-5 text-[14px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              See inside a card
            </a>
          </div>
          <p className="mt-[56px] inline-flex items-center gap-2.5 text-[13px] text-ink-faint">
            <span
              className="block h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
              aria-hidden="true"
            />
            In private preview with wedding venues. Access opens in stages.
          </p>
        </div>

        <HeroRelay />
      </div>
    </section>
  );
}
