import Link from "next/link";

/**
 * The demo/review posture's stand-in for a real auth form.
 *
 * `bare` drops the card chrome, for when the caller (AuthStage) is already
 * rendering the card and the headline. Without it this would be a card
 * inside a card, with the same sentence at the top of both.
 */
export function DemoAuthCard({
  mode,
  bare = false,
}: {
  mode: "sign-in" | "sign-up";
  bare?: boolean;
}) {
  const returning = mode === "sign-in";

  const body = (
    <>
      {bare ? null : (
        <>
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-brand">
            Review workspace
          </div>
          <h1
            id="demo-auth-heading"
            className="mt-2 text-balance text-[24px] font-semibold leading-tight tracking-[-0.025em] text-ink"
          >
            {returning
              ? "You’re already signed in here."
              : "No account is needed here."}
          </h1>
        </>
      )}
      <p
        className={
          bare
            ? "text-[13.5px] leading-[1.55] text-ink-soft"
            : "mx-auto mt-3 max-w-[38ch] text-[13.5px] leading-[1.55] text-ink-soft"
        }
      >
        This review session uses a synthetic workspace. It never opens a real
        account or reads customer data.
      </p>
      <div
        className={
          bare
            ? "mt-5 flex flex-col gap-2"
            : "mt-6 flex flex-wrap items-center justify-center gap-2"
        }
      >
        <Link
          href="/app/tasks"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-[13.5px] font-medium text-white transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Open the demo workspace
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-white px-5 text-[13.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Back to Signal Studio
        </Link>
      </div>
    </>
  );

  if (bare) return <div>{body}</div>;

  return (
    <section
      aria-labelledby="demo-auth-heading"
      className="w-full max-w-[440px] rounded-2xl border border-line-soft bg-bg-elevated p-7 text-center shadow-[0_24px_60px_-24px_rgba(20,21,26,0.18)]"
    >
      {body}
    </section>
  );
}
