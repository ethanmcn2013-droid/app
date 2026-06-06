"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAddTask } from "@/components/app/add-task/add-task-context";
import { useDomain } from "@/lib/domain-context";
import { useActiveWorkspace } from "@/lib/domain-context";
import { ShareButton } from "@/components/app/share/share-button";
import { usePalette } from "@/components/app/palette/command-palette";
import { useTasks } from "@/lib/tasks/tasks-context";
import { useToast } from "@/components/primitives/toast";
import {
  formatTasksAsCsv,
  formatTasksAsMarkdown,
} from "@/lib/exports";
import type { ShareView } from "@/server/actions/share";

const TABS = [
  { href: "/app/board", label: "Board" },
  { href: "/app/list", label: "List" },
  { href: "/app/timeline", label: "Timeline" },
  { href: "/app/calendar", label: "Calendar" },
];

/** Pull the part of the workspace title before " · " for the H1.
 *  e.g. "Q3 Launch · Plays in motion" → "Q3 Launch". */
function shortenTitle(t: string): string {
  const idx = t.indexOf(" · ");
  return idx > 0 ? t.slice(0, idx) : t;
}

function inferShareView(pathname: string): ShareView {
  if (pathname.startsWith("/app/list")) return "list";
  if (pathname.startsWith("/app/timeline")) return "timeline";
  if (pathname.startsWith("/app/calendar")) return "calendar";
  return "board";
}

/** Map the current lens path to its /print equivalent. */
function inferPrintPath(pathname: string): string {
  if (pathname.startsWith("/app/list")) return "/print/list";
  if (pathname.startsWith("/app/timeline")) return "/print/timeline";
  if (pathname.startsWith("/app/calendar")) return "/print/calendar";
  return "/print/board";
}

export function AppPageHeader({ active: activeProp }: { active?: string }) {
  const pathname = usePathname();
  const active = activeProp ?? pathname ?? "";
  const { openDialog } = useAddTask();
  const { openPalette } = usePalette();
  const pack = useDomain();

  const isMyTasks = pathname === "/app/my-tasks";
  const isInbox = pathname === "/app/inbox";
  // Breadcrumb mini-row removed 2026-05-18: SuiteChrome already establishes
  // the "signal studio. / tasks" context one row up, so lead › trail here
  // was a redundant second context line that made this read as a stacked
  // bar. Workspace identity now lives only in the title.
  const title = isMyTasks
    ? "My week"
    : isInbox
      ? "Inbox"
      : shortenTitle(pack.workspaceTitle);
  // Inbox + My Tasks aren't workspace views — hide Share + lane tabs.
  // My Tasks is a personal filtered view; sharing it is meaningless.
  // "New task" becomes the sole primary CTA on My Tasks (M2).
  const showWorkspaceTabs = !isInbox && !isMyTasks;
  const showShare = !isInbox && !isMyTasks;

  const shareView = inferShareView(pathname ?? "/app/board");
  const printPath = inferPrintPath(pathname ?? "/app/board");

  // De-stacked 2026-05-18: no border-b and lighter top padding so this
  // reads as one continuous header region beneath the sticky SuiteChrome
  // switcher, not a second stacked bar. SuiteChrome owns the only hairline
  // (its scroll border); a second border here was the "two header rows" /
  // amateur tell.
  return (
    <header className="px-4 pb-3 pt-3 md:px-8 md:pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {/* Redundant Tasks-logo glyph box removed 2026-05-18: SuiteChrome
              already carries product identity (signal studio. + tasks·);
              repeating the brand mark next to every workspace title read
              as duplicated branding. Title now stands on its own. */}
          <h1 className="text-[20px] font-semibold tracking-tight md:text-[24px]">
            <span className="block truncate">{title}</span>
          </h1>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* ≥md: full chip row */}
          {/* C6: Filter affordance removed from DOM while inactive.
              Restore this disabled chip when filtering ships. */}
          <button
            type="button"
            onClick={openPalette}
            className="hidden items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink md:inline-flex"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Search
            <kbd className="ml-1 inline-flex h-[15px] select-none items-center rounded border border-line-soft bg-white px-1 font-mono text-[9.5px] text-ink-quiet">
              ⌘P
            </kbd>
          </button>

          {/* M4: Export + Print demoted from primary toolbar → overflow menu.
              Share stays primary — it's an active collaboration gesture.
              Export/Print are utility actions used infrequently. */}
          {showShare ? (
            <span className="hidden md:inline-flex">
              <ShareButton view={shareView} />
            </span>
          ) : null}

          {/* Overflow: visible on all screen sizes (M4).
              Mobile: Search + Share + Export/Print.
              Desktop: Export/Print (Search + Share already in toolbar). */}
          <OverflowMenu
            onSearch={openPalette}
            showShare={showShare}
            shareView={shareView}
            printPath={printPath}
          />

          <button
            type="button"
            onClick={openDialog}
            className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-[12px] font-medium text-white shadow-sm transition-colors hover:bg-ink-soft"
          >
            New task
            <kbd className="hidden h-[16px] items-center rounded border border-white/15 bg-white/10 px-1 font-mono text-[10px] text-white/70 md:inline-flex">
              C
            </kbd>
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <nav
          className={
            "flex items-center gap-1 overflow-x-auto rounded-lg bg-bg-sunken/70 p-0.5 thin-scroll " +
            (showWorkspaceTabs ? "" : "hidden")
          }
        >
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

        <div className="hidden items-center gap-1.5 text-[11.5px] text-ink-quiet sm:flex">
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          <span>Live</span>
        </div>
      </div>
    </header>
  );
}

/**
 * Secondary actions menu — collapses Export/Print (always) and
 * Search/Share (mobile-only) into a single ··· popover.
 *
 * M4 (2026-05-28): Export + Print demoted from primary toolbar here.
 * Visible on all screen sizes; desktop shows ··· for utility actions.
 */
function OverflowMenu({
  onSearch,
  showShare,
  shareView,
  printPath,
}: {
  onSearch: () => void;
  showShare: boolean;
  shareView: ShareView;
  printPath: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Export hooks — only active when workspace is available.
  const { toast } = useToast();
  const { state } = useTasks();
  const pack = useDomain();
  const ws = useActiveWorkspace();
  const [copying, setCopying] = useState<string | null>(null);

  const handleCopy = useCallback(
    async (key: string, text: string, label: string, body: string) => {
      setCopying(key);
      const doWrite = async (t: string) => {
        try {
          await navigator.clipboard.writeText(t);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = t;
          ta.style.cssText = "position:fixed;opacity:0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
      };
      try {
        await doWrite(text);
        toast(label, { tone: "success", body });
      } catch {
        toast("Couldn't copy", { tone: "error" });
      }
      setTimeout(() => {
        setCopying(null);
        setOpen(false);
      }, 700);
    },
    [toast],
  );

  const onCopyCsv = () => {
    if (!ws) return;
    handleCopy(
      "csv",
      formatTasksAsCsv(state.tasks),
      "CSV copied",
      "Paste into Google Sheets, Excel, or Numbers.",
    );
  };
  const onCopyMarkdown = () => {
    if (!ws) return;
    handleCopy(
      "md",
      formatTasksAsMarkdown(state.tasks, pack.workspaceTitle),
      "Markdown copied",
      "Paste into Google Docs, Notion, or anything markdown.",
    );
  };
  const onCopyCalendar = () => {
    if (!ws) return;
    const origin = window.location.origin.replace(/^https?/, "webcal");
    handleCopy(
      "ical",
      `${origin}/api/calendar/${ws.id}`,
      "Calendar link copied",
      "Paste into Calendar's 'Add subscription' dialog.",
    );
  };

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-lg border border-line-soft bg-white p-1 shadow-[0_18px_40px_-18px_rgba(20,21,26,0.22)]"
        >
          {/* Mobile-only: Search + Share */}
          <div className="md:hidden">
            {/* C6: Filter affordance removed. Restore when filtering ships. */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSearch();
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Search
            </button>
            {showShare ? (
              <div className="[&>button]:!w-full [&>button]:!justify-start [&>button]:!rounded [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:!px-2 [&>button]:!py-1.5 [&>button]:!text-[12.5px] [&>button]:!text-ink-soft hover:[&>button]:!bg-bg-sunken">
                <ShareButton view={shareView} />
              </div>
            ) : null}
            {ws ? <div className="my-1 border-t border-line-soft" /> : null}
          </div>

          {/* Export section — shown when workspace is active */}
          {ws ? (
            <>
              <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-quiet">
                Export
              </p>
              <OverflowItem
                label="Copy as CSV"
                active={copying === "csv"}
                onClick={onCopyCsv}
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="3" y1="15" x2="21" y2="15" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                  </svg>
                }
              />
              <OverflowItem
                label="Copy as Markdown"
                active={copying === "md"}
                onClick={onCopyMarkdown}
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M4 12h10M4 17h16" />
                  </svg>
                }
              />
              <OverflowItem
                label="Subscribe in Calendar"
                active={copying === "ical"}
                onClick={onCopyCalendar}
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                }
              />
              <div className="my-1 border-t border-line-soft" />
              <Link
                href={printPath}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print view
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OverflowItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] transition-colors " +
        (active
          ? "bg-emerald-50 text-emerald-800"
          : "text-ink-soft hover:bg-bg-sunken hover:text-ink")
      }
    >
      <span className={active ? "text-emerald-700" : "text-ink-quiet"}>
        {icon}
      </span>
      {active ? "Copied" : label}
    </button>
  );
}
