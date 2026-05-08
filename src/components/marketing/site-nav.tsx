import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/app/board", label: "App" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
];

const STUDIO_URL =
  process.env.NEXT_PUBLIC_STUDIO_URL ??
  "https://studio-sigma-pied-75.vercel.app";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line-soft/60 bg-bg/72 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between px-6">
        {/* Brand lockup: studio. chip + divider + Tasks wordmark */}
        <div className="flex items-center gap-0">
          {/* studio. parent-brand chip — hidden below sm to avoid crowding */}
          <a
            href={STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center sm:flex"
            aria-label="studio. — parent brand"
          >
            <span
              className="text-[11px] font-medium tracking-[-0.01em] transition-colors hover:text-ink-soft"
              style={{ color: "var(--ink-quiet)" }}
            >
              studio.
            </span>
          </a>
          {/* Hairline vertical divider — hidden below sm with the chip */}
          <span
            aria-hidden
            className="mx-2.5 hidden h-3.5 w-px sm:block"
            style={{ background: "color-mix(in srgb, var(--ink-quiet) 35%, transparent)" }}
          />
          <Wordmark size="md" />
        </div>
        <nav className="hidden items-center gap-7 text-[13px] text-ink-soft md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-full px-3.5 py-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink md:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/app/board"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white shadow-sm transition-transform hover:-translate-y-px hover:shadow-md"
          >
            Open the workspace
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
        </div>
      </div>
    </header>
  );
}
