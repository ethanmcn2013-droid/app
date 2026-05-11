import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ANALYTICS_URL, NOTES_URL, ROADMAP_URL, STUDIO_URL } from "@/lib/product-urls";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/app/board", label: "App" },
  { href: "/pricing", label: "Pricing" },
  { href: "/changelog", label: "Changelog" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line-soft/60 bg-bg/72 backdrop-blur-md backdrop-saturate-150">
      {/* ── Suite chrome — cross-product strip ──────────────────── */}
      <div
        className="border-b border-border-soft"
        style={{ background: "color-mix(in srgb, var(--bg-deep) 55%, transparent)" }}
      >
        <div
          className="mx-auto flex h-7 w-full max-w-[1240px] items-center px-6"
          style={{ gap: 16 }}
        >
          <a
            href={STUDIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="suite-link"
            style={{ fontSize: 11, color: "var(--ink-quiet)", fontWeight: 400, textDecoration: "none", letterSpacing: "-0.01em" }}
          >
            signal studio<span style={{ color: "#4f46e5" }}>.</span>
          </a>
          <span aria-hidden style={{ color: "var(--ink-faint)", fontSize: 10 }}>·</span>
          <span style={{ fontSize: 11, color: "var(--ink)", fontWeight: 600, letterSpacing: "-0.01em" }}>
            tasks
          </span>
          <a
            href={ROADMAP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="suite-link"
            style={{ fontSize: 11, color: "var(--ink-quiet)", fontWeight: 400, textDecoration: "none", letterSpacing: "-0.01em" }}
          >
            roadmap
          </a>
          <a
            href={ANALYTICS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="suite-link"
            style={{ fontSize: 11, color: "var(--ink-quiet)", fontWeight: 400, textDecoration: "none", letterSpacing: "-0.01em" }}
          >
            analytics
          </a>
          <a
            href={NOTES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="suite-link"
            style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 400, textDecoration: "none", letterSpacing: "-0.01em" }}
          >
            notes
          </a>
        </div>
      </div>

      <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between px-6">
        {/* Brand lockup: Tasks wordmark */}
        <div className="flex items-center gap-0">
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
