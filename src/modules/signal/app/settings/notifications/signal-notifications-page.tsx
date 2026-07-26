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
      className="mx-auto w-full max-w-[640px] px-6 py-16"
    >
      <p
        className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--ink-soft)" }}
      >
        Settings · Signal
      </p>
      <h1
        id="signal-briefing-settings-title"
        className="mb-3 text-[32px] font-semibold leading-[1.15]"
        style={{ color: "var(--ink)" }}
      >
        The briefing is ready when you open it.
      </h1>
      <p
        className="mb-8 text-[15px] leading-[1.6]"
        style={{ color: "var(--ink-soft)" }}
      >
        Signal builds one short in-app read from the work you can access. It
        surfaces at most three findings and stays quiet when nothing crosses
        the reviewed attention rules.
      </p>

      <div
        className="mt-12 rounded-xl border p-5"
        style={{
          borderColor: "var(--line-soft, rgba(20,21,26,0.10))",
          background: "var(--bg-sunken, rgba(20,21,26,0.02))",
        }}
      >
        <p
          className="text-[12.5px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--ink-soft)" }}
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
          className="mt-2 text-[14px] leading-[1.6]"
          style={{ color: "var(--ink-soft)" }}
        >
          No scheduled delivery service is active in this app. Open Signal
          whenever you want a current read of the available work.
        </p>
        <Link
          href="/app/signal"
          className="mt-4 inline-flex text-[13px] font-medium outline-none transition-colors hover:text-[color:var(--brand)] focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]"
          style={{ color: "var(--ink)" }}
        >
          Open Signal <span aria-hidden>&nbsp;→</span>
        </Link>
      </div>
    </section>
  );
}
