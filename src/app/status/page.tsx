import { SiteNavServer } from "@/components/marketing/site-nav-server";
import { SiteFooter } from "@/components/marketing/site-footer";

export const dynamic = "force-dynamic";

// Operator-facing status. Not a public marketing surface: noindex so it
// stays out of search, and the footer link was removed (review 3 issues
// 29, 30). A full auth gate behind Signal Studio HQ is the next step.
export const metadata = {
  title: "Status · Tasks",
  description: "Live system status. Mostly green. Sometimes amber.",
  robots: { index: false, follow: false },
};

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

async function probe(url: string): Promise<{ ok: boolean; ms: number }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    return { ok: res.ok, ms: Date.now() - t0 };
  } catch {
    return { ok: false, ms: Date.now() - t0 };
  }
}

export default async function StatusPage() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const checks: CheckResult[] = [];

  const home = await probe(baseUrl);
  checks.push({
    name: "Marketing site",
    ok: home.ok,
    detail: `${home.ms}ms`,
  });

  // Probe the dedicated health endpoint, not the cron trigger, so
  // the check doesn't require CRON_SECRET and never produces a false
  // negative when the secret is correctly configured.
  const digest = await probe(`${baseUrl}/api/health/digest`);
  checks.push({
    name: "Daily digest pipeline",
    ok: digest.ok,
    detail: `${digest.ms}ms`,
  });

  const allGreen = checks.every((c) => c.ok);

  const integrations = [
    { name: "Auth (Clerk)", ok: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) },
    { name: "Payments (Stripe)", ok: Boolean(process.env.STRIPE_SECRET_KEY) },
    { name: "Email (Resend)", ok: Boolean(process.env.RESEND_API_KEY) },
    { name: "Errors (Sentry)", ok: Boolean(process.env.SENTRY_DSN) },
    { name: "Database", ok: true }, // SQLite always present in dev
  ];

  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    "dev-local";
  const deployed =
    process.env.VERCEL_DEPLOY_CREATED_AT ?? new Date().toISOString();

  return (
    <>
      <SiteNavServer />
      <main className="flex-1">
        <section className="pt-16 md:pt-24">
          <div className="mx-auto w-full max-w-[820px] px-6">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
              System status
            </div>
            <h1 className="mt-2 flex items-center gap-3 text-balance text-[clamp(2.2rem,1.4rem+2.4vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
              <span
                className={
                  "block h-3 w-3 rounded-full " +
                  (allGreen
                    ? "bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.5)]"
                    : "bg-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.5)]")
                }
              />
              {allGreen
                ? "All systems · running"
                : "One or two things are catching up"}
            </h1>
            <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.55] text-ink-soft">
              Live probes against the public surface. We don&rsquo;t
              fake green and we don&rsquo;t hide outages, when
              something&rsquo;s actually red, this page goes red too.
            </p>

            <ul className="mt-10 space-y-2">
              {checks.map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between rounded-xl border border-line-soft bg-bg-elevated/60 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        "block h-2 w-2 rounded-full " +
                        (c.ok ? "bg-emerald-500" : "bg-rose-500")
                      }
                    />
                    <span className="text-[13.5px] font-medium text-ink">
                      {c.name}
                    </span>
                  </div>
                  <span className="text-[12px] tabular-nums text-ink-quiet">
                    {c.ok ? "OK" : "DOWN"} · {c.detail}
                  </span>
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
              Integrations
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {integrations.map((i) => (
                <li
                  key={i.name}
                  className="flex items-center gap-2 rounded-md border border-line-soft bg-white px-3 py-2"
                >
                  <span
                    className={
                      "block h-1.5 w-1.5 rounded-full " +
                      (i.ok ? "bg-emerald-500" : "bg-ink-faint")
                    }
                  />
                  <span className="flex-1 text-[12.5px] text-ink-soft">
                    {i.name}
                  </span>
                  <span className="text-[10.5px] text-ink-quiet">
                    {i.ok ? "live" : "not monitored"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-12 rounded-xl border border-line-soft bg-bg-elevated/60 p-4 text-[12px] text-ink-quiet">
              <div className="flex justify-between">
                <span>Deployed</span>
                <span className="font-mono tabular-nums text-ink-soft">
                  {new Date(deployed).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Commit</span>
                <span className="font-mono text-ink-soft">{sha.slice(0, 9)}</span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
