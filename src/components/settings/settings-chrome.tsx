"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { SuiteLauncher } from "@/components/app/suite-launcher";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/notifications", label: "What we send you" },
  { href: "/settings/plan", label: "Your plan" },
];

export function SettingsChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line-soft bg-white">
        <div className="mx-auto flex h-12 max-w-[1080px] items-center gap-2 px-4 md:px-8">
          {/* isAuthed={true}: Settings is always an authed surface (IA_COHERENCE.md §3E) */}
          <SuiteLauncher current="tasks" isAuthed={true} />
          <span aria-hidden className="text-[12px] text-ink-faint">/</span>
          <Wordmark size="md" />
          <span aria-hidden className="text-[12px] text-ink-faint">/</span>
          <span className="text-[13px] text-ink-soft">Settings</span>
          <div className="flex-1" />
          <Link
            href="/app/board"
            className="hidden text-[12.5px] text-ink-quiet transition-colors hover:text-ink md:inline-flex"
          >
            Back to workspace
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1080px] flex-col gap-8 px-4 py-8 md:flex-row md:gap-12 md:px-8 md:py-12">
        <SettingsNav pathname={pathname} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function SettingsNav({ pathname }: { pathname: string }) {
  return (
    <>
      {/* Mobile: horizontal scroll tabs */}
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-line-soft px-4 pb-2 md:hidden">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={
                "flex-shrink-0 rounded-md px-3 py-1.5 text-[13px] transition-colors " +
                (active
                  ? "bg-bg-sunken font-medium text-ink"
                  : "text-ink-quiet hover:text-ink-soft")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop: sticky sidebar */}
      <aside className="hidden w-[200px] flex-shrink-0 md:block">
        <div className="sticky top-8 flex flex-col gap-0.5">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  "rounded-md px-3 py-1.5 text-[13px] transition-colors " +
                  (active
                    ? "bg-bg-sunken font-medium text-ink"
                    : "text-ink-quiet hover:bg-bg-sunken/60 hover:text-ink-soft")
                }
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}
