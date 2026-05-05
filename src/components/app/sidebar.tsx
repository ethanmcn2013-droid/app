"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { useTasksState } from "@/lib/tasks/tasks-context";
import { openTaskCount } from "@/lib/tasks/selectors";
import { CURRENT_USER } from "@/lib/data";

const NAV_TOP = [
  { href: "/app/inbox", label: "Inbox", icon: "inbox" },
  { href: "/app/my-tasks", label: "My tasks", icon: "user" },
  { href: "/app/search", label: "Search", icon: "search" },
];

const VIEWS = [
  { href: "/app/board", label: "Board", icon: "board" },
  { href: "/app/list", label: "List", icon: "list" },
  { href: "/app/timeline", label: "Timeline", icon: "timeline" },
  { href: "/app/calendar", label: "Calendar", icon: "calendar" },
];

const TEAMS = [
  { name: "Marketing", color: "#e4356d" },
  { name: "Engineering", color: "#00a3b8" },
  { name: "Design", color: "#7c5cff" },
  { name: "Customer Success", color: "#10b981" },
  { name: "Operations", color: "#f59e0b" },
];

export function AppSidebar({ active: activeProp }: { active?: string }) {
  const pathname = usePathname();
  const active = activeProp ?? pathname ?? "";
  return (
    <aside className="flex h-full w-[252px] flex-shrink-0 flex-col border-r border-line-soft bg-bg-sunken/40">
      <div className="flex h-12 items-center justify-between border-b border-line-soft/70 px-4">
        <Wordmark size="md" />
        <button className="rounded p-1 text-ink-quiet hover:bg-line-soft hover:text-ink-soft">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <Group items={NAV_TOP} active={active} />

        <div className="mt-4 px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
          Views
        </div>
        <div className="mt-1">
          <Group items={VIEWS} active={active} />
        </div>

        <div className="mt-5 flex items-center justify-between px-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
          <span>Teams</span>
          <button className="rounded p-0.5 hover:bg-line-soft hover:text-ink-soft">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <ul className="mt-1 space-y-px">
          {TEAMS.map((t) => (
            <li key={t.name}>
              <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-line-soft/60 hover:text-ink">
                <span
                  className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: t.color }}
                />
                {t.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-line-soft/70 p-3">
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-line-soft bg-white px-2.5 py-2 text-left text-[12.5px] text-ink-soft transition-colors hover:border-line">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold uppercase text-white"
            style={{ background: "var(--user-david)" }}
          >
            DV
          </span>
          <span className="flex-1">
            <span className="block text-ink">David Park</span>
            <span className="block text-[10.5px] text-ink-quiet">Marketing</span>
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-ink-quiet"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

function Group({
  items,
  active,
}: {
  items: { href: string; label: string; icon: string }[];
  active: string;
}) {
  // The sidebar lives inside <TasksProvider> for /app routes; this
  // hook will throw on routes that don't mount the provider. Today
  // the sidebar is only used in the /app shell, so this is safe.
  const tasks = useTasksState();
  const inboxCount = openTaskCount(tasks);
  const myCount = openTaskCount(tasks, { user: CURRENT_USER });

  return (
    <ul className="space-y-px">
      {items.map((it) => {
        const isActive = active === it.href;
        const count =
          it.icon === "inbox"
            ? inboxCount
            : it.icon === "user"
              ? myCount
              : null;
        return (
          <li key={it.href}>
            <Link
              href={it.href}
              className={
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors " +
                (isActive
                  ? "bg-white text-ink shadow-sm ring-1 ring-line-soft"
                  : "text-ink-soft hover:bg-line-soft/60 hover:text-ink")
              }
            >
              <NavIcon kind={it.icon} />
              <span className="flex-1">{it.label}</span>
              {count !== null ? (
                <span className="rounded bg-bg-sunken px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink-quiet">
                  {count}
                </span>
              ) : null}
            </Link>
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
  return null;
}
