import Link from "next/link";
import type {
  HomeComingRow,
  HomeData,
  HomeReviewRow,
  HomeSignalRow,
} from "@/app/app/home/home-data";
import { BRIEFING_APP_PATH } from "@/lib/product-urls";
import { HomeItemLink, HomeViewedPing } from "./home-analytics";

/**
 * Home — the authenticated front door. One question: what matters now?
 *
 * Three principal sections, never more (PROJECT.md): Today's Signal
 * (dominant, ≤3 rows straight from the briefing engine), Coming up
 * (≤4 dated rows), Needs review (≤3 rows). Sections other than Today's
 * Signal render only when they have something true to say — a stack of
 * empty placeholders is dashboard furniture, not calm.
 *
 * Server component: the page is a read. The only client JS is the
 * analytics ping and per-row open events (no content in payloads).
 */
export function HomeView({ data }: { data: Extract<HomeData, { kind: "ok" }> }) {
  return (
    <div className="thin-scroll flex-1 overflow-auto bg-bg px-5 py-6 md:px-10 md:py-9">
      <HomeViewedPing />
      <div className="mx-auto max-w-[760px]">
        <header className="mb-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            {data.dateLabel}
          </p>
          <h1 className="mt-2 text-[24px] font-medium tracking-tight text-ink md:text-[28px]">
            {data.greeting}
          </h1>
          <p className="mt-1.5 text-[13px] text-ink-soft">{data.scopeLabel}</p>
        </header>

        <TodaysSignal rows={data.signalRows} allClear={data.allClear} />

        {data.comingUp.length > 0 ? <ComingUp rows={data.comingUp} /> : null}

        {data.needsReview.length > 0 ? (
          <NeedsReview rows={data.needsReview} />
        ) : null}
      </div>
    </div>
  );
}

function SectionLabel({
  id,
  children,
  withDot = false,
}: {
  id: string;
  children: React.ReactNode;
  withDot?: boolean;
}) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-quiet"
    >
      {withDot ? (
        <span
          aria-hidden
          className="inline-block h-[7px] w-[7px] rounded-full"
          style={{ background: "var(--brand, #4f46e5)" }}
        />
      ) : null}
      {children}
    </h2>
  );
}

function TodaysSignal({
  rows,
  allClear,
}: {
  rows: HomeSignalRow[];
  allClear: Extract<HomeData, { kind: "ok" }>["allClear"];
}) {
  return (
    <section aria-labelledby="todays-signal" className="mb-10">
      <SectionLabel id="todays-signal" withDot>
        Today&rsquo;s Signal
      </SectionLabel>

      {allClear ? (
        <div className="mt-5 rounded-xl border border-line-soft bg-bg-elevated px-6 py-8">
          <p className="text-[17px] font-medium tracking-tight text-ink">
            {allClear.headline}
          </p>
          <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-soft">
            {allClear.body}
          </p>
          {allClear.readLine ? (
            <p className="mt-4 text-[12px] text-ink-quiet">{allClear.readLine}</p>
          ) : null}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft">
          {rows.map((row) => (
            <li key={`${row.trigger}:${row.id}`}>
              <HomeItemLink
                href={row.href}
                event="home_signal_item_opened"
                properties={{ trigger: row.trigger, due: row.due }}
                className="group flex items-baseline gap-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium leading-snug text-ink group-hover:underline group-hover:decoration-line group-hover:underline-offset-4">
                    {row.title}
                  </span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-ink-soft">
                    {row.why}
                  </span>
                  <span className="mt-1.5 block text-[11.5px] text-ink-quiet">
                    {row.source}
                    {row.due ? <> · {row.due}</> : null}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="flex-shrink-0 text-[13px] text-ink-quiet transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                >
                  Open →
                </span>
              </HomeItemLink>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <HomeItemLink
          href={BRIEFING_APP_PATH}
          event="home_briefing_opened"
          properties={{}}
          className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-ink-soft outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
        >
          <span>Open full briefing</span>
          <span aria-hidden>→</span>
        </HomeItemLink>
      </div>
    </section>
  );
}

function ComingUp({ rows }: { rows: HomeComingRow[] }) {
  return (
    <section aria-labelledby="coming-up" className="mb-10">
      <SectionLabel id="coming-up">Coming up</SectionLabel>
      <ul className="mt-3 divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="group flex items-baseline gap-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
            >
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink group-hover:underline group-hover:underline-offset-4">
                {row.title}
              </span>
              <span className="hidden flex-shrink-0 text-[11.5px] text-ink-quiet sm:block">
                {row.source}
              </span>
              <span className="w-[9ch] flex-shrink-0 text-right text-[12px] font-medium text-ink-soft">
                {row.due}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NeedsReview({ rows }: { rows: HomeReviewRow[] }) {
  return (
    <section aria-labelledby="needs-review" className="mb-10">
      <SectionLabel id="needs-review">Needs review</SectionLabel>
      <ul className="mt-3 divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              className="group flex items-baseline gap-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]"
            >
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink group-hover:underline group-hover:underline-offset-4">
                {row.title}
              </span>
              <span className="hidden flex-shrink-0 text-[11.5px] text-ink-quiet sm:block">
                {row.source}
              </span>
              <span className="flex-shrink-0 text-[12px] text-ink-soft">
                {row.idleDays > 0
                  ? `waiting ${row.idleDays}d`
                  : "in review"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * New-user Home: no workspace connected yet. Welcoming, not empty —
 * points at the three products and the guided setup.
 */
export function HomeNewUser() {
  return (
    <div className="thin-scroll flex-1 overflow-auto bg-bg px-5 py-6 md:px-10 md:py-9">
      <div className="mx-auto flex min-h-[60dvh] max-w-[560px] flex-col justify-center">
        <span
          aria-hidden
          className="mb-5 inline-block h-[9px] w-[9px] rounded-full"
          style={{ background: "var(--brand, #4f46e5)" }}
        />
        <h1 className="text-[24px] font-medium tracking-tight text-ink md:text-[28px]">
          Welcome to Signal Studio.
        </h1>
        <p className="mt-3 max-w-[44ch] text-[14px] leading-relaxed text-ink-soft">
          Home is where the system tells you what matters — the briefing
          fills as your work does. Start by setting up your workspace, or
          step straight into a product.
        </p>
        <div className="mt-7">
          <Link
            href="/welcome"
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-[13.5px] font-medium text-white outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2"
          >
            Set up your workspace
            <span aria-hidden>→</span>
          </Link>
        </div>
        <ul className="mt-9 divide-y divide-line-soft border-t border-line-soft">
          {[
            { href: "/app/notes", name: "Notes", line: "Capture the thinking." },
            { href: "/app/tasks", name: "Tasks", line: "Move the work forward." },
            { href: "/app/timeline", name: "Timeline", line: "Make the plan visible." },
          ].map((product) => (
            <li key={product.href}>
              <Link
                href={product.href}
                className="group flex items-baseline justify-between gap-4 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
              >
                <span className="text-[14px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">
                  {product.name}
                </span>
                <span className="text-[12.5px] text-ink-quiet">
                  {product.line}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
