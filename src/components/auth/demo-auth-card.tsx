import Link from "next/link";

export function DemoAuthCard({ mode }: { mode: "sign-in" | "sign-up" }) {
  const returning = mode === "sign-in";
  return (
    <section
      aria-labelledby="demo-auth-heading"
      className="w-full max-w-[440px] rounded-2xl border border-line-soft bg-bg-elevated p-7 text-center shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)]"
    >
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
        Review workspace
      </div>
      <h1
        id="demo-auth-heading"
        className="mt-2 text-balance text-[24px] font-semibold leading-tight tracking-[-0.025em] text-ink"
      >
        {returning ? "You’re already signed in here." : "No account is needed here."}
      </h1>
      <p className="mx-auto mt-3 max-w-[38ch] text-[13.5px] leading-[1.55] text-ink-soft">
        This review session uses a synthetic workspace. It never opens a real
        account or reads customer data.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/app/tasks"
          className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-[13.5px] font-medium text-white transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Open the demo workspace
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-5 text-[13.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Back to Tasks
        </Link>
      </div>
    </section>
  );
}
