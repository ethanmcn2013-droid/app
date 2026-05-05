"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app/board", label: "Board" },
  { href: "/app/list", label: "List" },
  { href: "/app/timeline", label: "Timeline" },
  { href: "/app/calendar", label: "Calendar" },
];

export function AppPageHeader({ active: activeProp }: { active?: string }) {
  const pathname = usePathname();
  const active = activeProp ?? pathname ?? "";
  return (
    <header className="border-b border-line-soft px-8 pb-3 pt-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11.5px] text-ink-quiet">
            <span>Marketing</span>
            <span>›</span>
            <span>Q3 launch · Plays in motion</span>
          </div>
          <h1 className="mt-1.5 flex items-center gap-2 text-[24px] font-semibold tracking-tight">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-soft text-brand">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </span>
            Q3 launch
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="6" y1="12" x2="18" y2="12" />
              <line x1="9" y1="18" x2="15" y2="18" />
            </svg>
            Filter
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-ink-soft">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New task
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <nav className="flex items-center gap-1 rounded-lg bg-bg-sunken/70 p-0.5">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={
                "rounded-md px-3 py-1 text-[12.5px] font-medium transition-colors " +
                (active === t.href
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-quiet hover:text-ink-soft")
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 text-[11.5px] text-ink-quiet">
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span>Live · 3 here</span>
        </div>
      </div>
    </header>
  );
}
