"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { openTaskCount } from "@/lib/tasks/selectors";
import { useCurrentUser } from "@/lib/auth-context";
import { UserButtonWithSuite } from "@/components/app/user-button-with-suite";
import { usePalette } from "@/components/app/palette/command-palette";

const NAV_TOP = [
  { href: "/app/inbox", label: "Inbox", icon: "inbox" },
  { href: "/app/my-tasks", label: "My week", icon: "user" },
  { href: undefined, label: "Search", icon: "search" },
];

const VIEWS = [
  { href: "/app/board", label: "Board", icon: "board" },
  { href: "/app/list", label: "List", icon: "list" },
  { href: "/app/timeline", label: "Timeline", icon: "timeline" },
  { href: "/app/calendar", label: "Calendar", icon: "calendar" },
];

// TEAMS removed 2026-05-19: Teams was never built, the const was a
// placeholder that rendered non-functional "+ add team" / team-list UI.
// Dead affordances erode trust faster than missing features. Deleted per
// product-freeze scope (T·69).

const NAV_BOTTOM = [
  { href: "/app/import", label: "Import", icon: "import" },
  { href: "/app/settings", label: "Settings", icon: "settings" },
];

export function AppSidebar({ active: activeProp }: { active?: string }) {
  const pathname = usePathname();
  const active = activeProp ?? pathname ?? "";
  return (
    <>
      {/*
       * MobileSuiteBar removed, L4 SuiteChrome (suite-chrome.tsx) is now
       * the persistent top bar on all /app/* surfaces (mobile + desktop).
       * It renders above this sidebar in the layout. Content pt-9 on mobile
       * was the MobileSuiteBar clearance; now the chrome is sticky (not
       * fixed) so that padding is gone from /app/layout.tsx.
       */}
      <MobileTabBar active={active} />
      <DesktopSidebar active={active} />
    </>
  );
}

function DesktopSidebar({ active }: { active: string }) {
  return (
    <aside className="hidden h-full w-[252px] flex-shrink-0 flex-col border-r border-line-soft bg-bg-sunken/40 md:flex">
      <div className="flex h-12 items-center justify-between border-b border-line-soft/70 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {/*
           * SuiteLauncher + "/" umbrella breadcrumb removed 2026-05-19:
           * the always-visible SuiteSwitcher pills row (suite-chrome.tsx,
           * shipped S·63/T·68) now renders the "signal studio." umbrella
           * anchor + 4-product switch directly above this rail. Keeping the
           * launcher here stacked a SECOND "signal studio." ~12px below the
           * first (operator-reported regression). The pills fully serve the
           * popover's purpose (discoverability), the sidebar header now
           * carries only product context. SuiteLauncher is still retained
           * in unauthed marketing nav + Roadmap public header (no pills
           * there). See memory project-suite-switcher-pills-2026-05-19.
           */}
          <Wordmark size="md" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <Group items={NAV_TOP} active={active} />

        <div className="mt-4 px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
          Views
        </div>
        <div className="mt-1">
          <Group items={VIEWS} active={active} />
        </div>

        <div className="mt-5 border-t border-line-soft/70 pt-3">
          <Group items={NAV_BOTTOM} active={active} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-line-soft/70 p-3">
        <UserButtonWithSuite current="tasks" />
        <span className="text-[12px] text-ink-quiet">Account</span>
      </div>
    </aside>
  );
}

function Group({
  items,
  active,
}: {
  items: { href?: string; label: string; icon: string }[];
  active: string;
}) {
  // The sidebar lives inside <TasksProvider> for /app routes; this
  // hook will throw on routes that don't mount the provider. Today
  // the sidebar is only used in the /app shell, so this is safe.
  const tasks = useTasksState();
  const me = useCurrentUser();
  const { openPalette } = usePalette();
  const inboxCount = openTaskCount(tasks);
  const myCount = openTaskCount(tasks, { user: me });

  return (
    <ul className="space-y-px">
      {items.map((it) => {
        const isActive = it.href !== undefined && active === it.href;
        const count =
          it.icon === "inbox"
            ? inboxCount
            : it.icon === "user"
              ? myCount
              : null;
        const isSearch = it.icon === "search";
        const className =
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors " +
          (isActive
            ? "bg-white text-ink shadow-sm ring-1 ring-line-soft"
            : "text-ink-soft hover:bg-line-soft/60 hover:text-ink");
        const inner = (
          <>
            <NavIcon kind={it.icon} />
            <span className="flex-1">{it.label}</span>
            {isSearch ? (
              <kbd className="inline-flex h-[15px] select-none items-center rounded border border-line-soft bg-white px-1 font-mono text-[9.5px] text-ink-quiet">
                ⌘P
              </kbd>
            ) : count !== null ? (
              <span className="rounded bg-bg-sunken px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink-quiet">
                {count}
              </span>
            ) : null}
          </>
        );
        return (
          <li key={it.href ?? it.label}>
            {isSearch ? (
              <button
                type="button"
                onClick={openPalette}
                className={className + " w-full"}
              >
                {inner}
              </button>
            ) : it.href ? (
              <Link href={it.href} className={className}>
                {inner}
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function NavIcon({ kind }: { kind: string }) {
  const cls = "h-3.5 w-3.5 flex-shrink-0";
  if (kind === "inbox")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    );
  if (kind === "user")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  if (kind === "search")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    );
  if (kind === "board")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="11" rx="1" />
      </svg>
    );
  if (kind === "list")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    );
  if (kind === "timeline")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="6" width="11" height="3" rx="1" />
        <rect x="7" y="11" width="13" height="3" rx="1" />
        <rect x="5" y="16" width="9" height="3" rx="1" />
      </svg>
    );
  if (kind === "calendar")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  if (kind === "views")
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  if (kind === "import")
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    );
  if (kind === "settings")
    return (
      <svg
        className={cls}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  return null;
}

/**
 * Bottom tabbar for <768px. Replaces the desktop rail entirely.
 *
 * Inbox · My tasks · Search (palette) · Views (dropdown into Board/List/
 * Timeline/Calendar). Active state lights up with brand color; tapping
 * "Views" opens a popover above the bar.
 */
function MobileTabBar({ active }: { active: string }) {
  const tasks = useTasksState();
  const me = useCurrentUser();
  const { openPalette } = usePalette();
  const [viewsOpen, setViewsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const inboxCount = openTaskCount(tasks);
  const myCount = openTaskCount(tasks, { user: me });

  useEffect(() => {
    if (!viewsOpen) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setViewsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewsOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [viewsOpen]);

  // Close the views menu when route changes.
  useEffect(() => {
    setViewsOpen(false);
  }, [active]);

  const isViewActive = VIEWS.some((v) => active === v.href);
  const activeView = VIEWS.find((v) => active === v.href);

  return (
    <nav
      ref={wrapRef}
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {viewsOpen ? (
        <div
          role="menu"
          className="absolute bottom-full right-2 mb-2 w-44 overflow-hidden rounded-xl border border-line-soft bg-white p-1 shadow-[0_18px_40px_-18px_rgba(20,21,26,0.22)]"
        >
          {VIEWS.map((v) => {
            const isActive = active === v.href;
            return (
              <Link
                key={v.href}
                href={v.href}
                role="menuitem"
                onClick={() => setViewsOpen(false)}
                className={
                  "flex items-center gap-2 rounded-md px-2 py-2 text-[13px] transition-colors " +
                  (isActive
                    ? "bg-brand-soft text-brand"
                    : "text-ink-soft hover:bg-bg-sunken hover:text-ink")
                }
              >
                <NavIcon kind={v.icon} />
                {v.label}
              </Link>
            );
          })}
        </div>
      ) : null}

      <ul className="flex items-stretch justify-around px-1 pt-1">
        <TabbarItem
          href="/app/inbox"
          icon="inbox"
          label="Inbox"
          active={active === "/app/inbox"}
          badge={inboxCount}
        />
        <TabbarItem
          href="/app/my-tasks"
          icon="user"
          label="My week"
          active={active === "/app/my-tasks"}
          badge={myCount}
        />
        <TabbarButton
          icon="search"
          label="Search"
          onClick={openPalette}
          active={false}
        />
        <TabbarButton
          icon={activeView?.icon ?? "views"}
          label={activeView?.label ?? "Views"}
          onClick={() => setViewsOpen((v) => !v)}
          active={isViewActive}
          chevron
          ariaExpanded={viewsOpen}
          ariaHaspopup="menu"
        />
      </ul>
    </nav>
  );
}

function TabbarItem({
  href,
  icon,
  label,
  active,
  badge,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number | null;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        className={
          "relative flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10.5px] font-medium transition-colors " +
          (active ? "text-brand" : "text-ink-quiet hover:text-ink-soft")
        }
      >
        <span className="relative inline-flex">
          <span className="[&_svg]:!h-[18px] [&_svg]:!w-[18px]">
            <NavIcon kind={icon} />
          </span>
          {badge && badge > 0 ? (
            <span className="absolute -right-2 -top-1 inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold tabular-nums text-white">
              {badge}
            </span>
          ) : null}
        </span>
        {label}
      </Link>
    </li>
  );
}

function TabbarButton({
  icon,
  label,
  onClick,
  active,
  chevron,
  ariaExpanded,
  ariaHaspopup,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active: boolean;
  chevron?: boolean;
  ariaExpanded?: boolean;
  ariaHaspopup?: "menu" | "listbox" | "tree" | "grid" | "dialog" | boolean;
}) {
  return (
    <li className="flex-1">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHaspopup}
        className={
          "flex w-full flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10.5px] font-medium transition-colors " +
          (active ? "text-brand" : "text-ink-quiet hover:text-ink-soft")
        }
      >
        <span className="relative inline-flex items-center">
          <span className="[&_svg]:!h-[18px] [&_svg]:!w-[18px]">
            <NavIcon kind={icon} />
          </span>
          {chevron ? (
            <svg
              className="ml-0.5 h-2.5 w-2.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          ) : null}
        </span>
        {label}
      </button>
    </li>
  );
}
