import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export const metadata = {
  title: "Not found, Tasks",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="px-6 pt-6">
        <Wordmark size="md" />
      </div>

      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[520px] text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-quiet">
            404 · this page took the day off
          </div>

          <h1 className="mt-3 text-balance text-[clamp(2rem,1.4rem+2.4vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
            Couldn&rsquo;t find that one.{" "}
            <span className="text-ink-soft/65">
              The link, the task, or both.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-[44ch] text-[15px] leading-[1.55] text-ink-soft">
            It might have moved. Or expired. Or someone clicked the
            wrong key once and rolled it into the void. Pick a real
            destination and let&rsquo;s try again.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white transition-transform hover:-translate-y-px"
            >
              Home
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/app/tasks"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
            >
              Open the workspace
            </Link>
            <a
              href="https://signalstudio.ie/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
            >
              Pricing
            </a>
          </div>

          <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-line-soft bg-bg-elevated/60 px-3 py-1 text-[11.5px] text-ink-quiet">
            <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Everything else is still moving
          </div>
        </div>
      </main>
    </div>
  );
}
