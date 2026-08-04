import "server-only";

import Link from "next/link";

/**
 * Signal's delivery provider is intentionally not active in the consolidated
 * app. Keep this route as a truthful description of the in-app briefing until
 * scheduled delivery has its own verified provider and release gate.
 */
export function SignalNotificationsPage() {
  return (
    <section
      aria-labelledby="signal-briefing-settings-title"
      className="mx-auto w-full max-w-[960px] px-6 py-8 sm:px-8"
    >
      <div className="max-w-[600px]">
        <p
          className="mb-[14px] text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--ink-soft)" }}
        >
          Settings · Signal
        </p>
        <h1
          id="signal-briefing-settings-title"
          className="mb-3 text-[36px] font-semibold leading-[1.06] tracking-[-0.035em] text-balance"
          style={{ color: "var(--ink)" }}
        >
          The briefing is ready when you open it.
        </h1>
        <p
          className="mb-8 max-w-[510px] text-[15px] leading-[1.6]"
          style={{ color: "var(--ink-soft)" }}
        >
          Signal builds one short in-app read from the work you can access. It
          surfaces at most three signals and stays quiet when nothing crosses
          Signal&rsquo;s attention rules.
        </p>

        <div
          className="rounded-lg border p-6"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--paper)",
          }}
        >
          {/* Nested label, not a second page kicker: it takes the ledger's
              mono metadata register (11px / 0.06em / --ink-quiet) so the
              uppercase-sans kicker above keeps page rank to itself. */}
          <p
            className="text-[11px] tracking-[0.06em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--ink-quiet)",
            }}
          >
            Current delivery
          </p>
          <p
            className="mt-2 text-[17px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            In app only
          </p>
          <p
            className="mt-2 max-w-[510px] text-[15px] leading-[1.6]"
            style={{ color: "var(--ink-soft)" }}
          >
            No scheduled delivery service is active in this app. Open Signal
            whenever you want a current read of the available work.
          </p>
          {/* No component-level ring: the suite's global :focus-visible
              outline is the only focus mark. transition-[color] rather than
              transition-colors, which also animates outline-color and made
              the focus ring fade in. */}
          <Link
            href="/app/home/briefing"
            className="mt-2 inline-flex min-h-[44px] items-center text-[13px] font-medium transition-[color] hover:text-[color:var(--ink)]"
            style={{ color: "var(--ink)" }}
          >
            Open Signal <span aria-hidden>&nbsp;→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
