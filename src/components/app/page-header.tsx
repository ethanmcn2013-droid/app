"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDomain } from "@/lib/domain-context";
import { useActiveWorkspace } from "@/lib/domain-context";
import { ShareButton } from "@/components/app/share/share-button";
import { RoomViewBar } from "@/components/app/room/room-view-bar";
import { usePalette } from "@/components/app/palette/command-palette";
import { useTasks } from "@/lib/tasks/tasks-context";
import { useToast } from "@/components/primitives/toast";
import {
  formatTasksAsCsv,
  formatTasksAsMarkdown,
} from "@/lib/exports";
import type { ShareView } from "@/server/actions/share";

const TABS = [
  { href: "/app/tasks", label: "Board" },
  { href: "/app/tasks/list", label: "List" },
  { href: "/app/tasks/timeline", label: "Timeline" },
  { href: "/app/tasks/calendar", label: "Calendar" },
];

/** Pull the part of the workspace title before " · " for the H1.
 *  e.g. "Q3 Launch · Plays in motion" → "Q3 Launch". */
function shortenTitle(t: string): string {
  const idx = t.indexOf(" · ");
  return idx > 0 ? t.slice(0, idx) : t;
}

function inferShareView(pathname: string): ShareView {
  if (pathname.startsWith("/app/tasks/list")) return "list";
  if (pathname.startsWith("/app/tasks/timeline")) return "timeline";
  if (pathname.startsWith("/app/tasks/calendar")) return "calendar";
  return "board";
}

/** Map the current lens path to its /print equivalent. */
function inferPrintPath(pathname: string): string {
  if (pathname.startsWith("/app/tasks/list")) return "/print/list";
  if (pathname.startsWith("/app/tasks/timeline")) return "/print/timeline";
  if (pathname.startsWith("/app/tasks/calendar")) return "/print/calendar";
  return "/print/board";
}

export function AppPageHeader({
  active: activeProp,
  brief,
}: {
  active?: string;
  /** Editorial Project Room brief (Option B, 2026-07-17). When present it
   *  owns workspace identity (breadcrumb + h1 + purpose + receipts), so
   *  the header renders only the action row and view tabs around it. */
  brief?: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = activeProp ?? pathname ?? "";
  const { openPalette } = usePalette();
  const pack = useDomain();

  const isMyTasks = pathname === "/app/my-tasks";
  const isInbox = pathname === "/app/inbox";
  const isArchived = pathname === "/app/archived";
  // Breadcrumb mini-row removed 2026-05-18: SuiteChrome already establishes
  // the "signal studio. / tasks" context one row up, so lead › trail here
  // was a redundant second context line that made this read as a stacked
  // bar. Workspace identity now lives only in the title.
  const title = isMyTasks
    ? "My week"
    : isInbox
      ? "Inbox"
      : isArchived
        ? "Archived"
        : shortenTitle(pack.workspaceTitle);
  // Inbox + My Tasks aren't workspace views, hide Share + lane tabs.
  // My Tasks is a personal filtered view; sharing it is meaningless.
  // "New task" becomes the sole primary CTA on My Tasks (M2).
  const showWorkspaceTabs = !isInbox && !isMyTasks && !isArchived;
  const showShare = !isInbox && !isMyTasks && !isArchived;

  const shareView = inferShareView(pathname ?? "/app/tasks");
  const printPath = inferPrintPath(pathname ?? "/app/tasks");

  // T·95 lab parity: workspace views render the Editorial Project Room
  // header — the full-bleed brief band, then the 52px room view bar
  // carrying tabs + working tools (the lab composition, exactly).
  // Inbox / My week / Settings keep the simple title header below.
  if (brief) {
    return (
      <>
        {brief}
        <RoomViewBar />
      </>
    );
  }

  return (
    <header className="px-4 pb-3 pt-2.5 md:px-8 md:pt-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-semibold tracking-tight md:text-[24px]">
            <span className="block truncate">{title}</span>
          </h1>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* T·94: Search + New task live in the Studio Bar. The page
              header keeps only view-local actions. */}
          {showShare ? (
            <span className="hidden lg:inline-flex">
              <ShareButton view={shareView} />
            </span>
          ) : null}
          <PageActionsOverflow
            onSearch={openPalette}
            showShare={showShare}
            shareView={shareView}
            printPath={printPath}
          />
        </div>
      </div>

      <div className={"mt-4 items-center justify-between " + (showWorkspaceTabs ? "flex" : "hidden")}>
        <nav className="flex items-center gap-1 overflow-x-auto rounded-lg bg-bg-sunken/70 p-0.5 thin-scroll">
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
      </div>
    </header>
  );
}

/**
 * Secondary actions menu, collapses Export/Print (always) and
 * Search/Share (mobile/tablet) into a single ··· popover.
 *
 * M4 (2026-05-28): Export + Print demoted from primary toolbar here.
 * Visible on all screen sizes; desktop shows ··· for utility actions.
 * Exported since T·95: the room view bar (lab parity) hosts the same
 * overflow beside its tools. `onSearch` optional there — the bar has
 * the universal field.
 */
export function PageActionsOverflow({
  onSearch,
  showShare,
  shareView,
  printPath,
}: {
  onSearch?: () => void;
  showShare: boolean;
  shareView: ShareView;
  printPath: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Export hooks, only active when workspace is available.
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
          {/* Mobile/tablet: Search + Share */}
          <div className="lg:hidden">
            {onSearch ? (
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
            ) : null}
            {showShare ? (
              <div className="[&>button]:!w-full [&>button]:!justify-start [&>button]:!rounded [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:!px-2 [&>button]:!py-1.5 [&>button]:!text-[12.5px] [&>button]:!text-ink-soft hover:[&>button]:!bg-bg-sunken">
                <ShareButton view={shareView} />
              </div>
            ) : null}
            {ws ? <div className="my-1 border-t border-line-soft" /> : null}
          </div>

          {/* Export section, shown when workspace is active */}
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
                  /* pack: icon-copy-csv */
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="5.25" width="9.5" height="11" rx="2.25" />
                    <rect x="8.5" y="7.75" width="9.5" height="11" rx="2.25" />
                    <path d="M13.25 10.5V16" />
                    <path d="M10.75 13.25H15.75" />
                  </svg>
                }
              />
              <OverflowItem
                label="Copy as Markdown"
                active={copying === "md"}
                onClick={onCopyMarkdown}
                icon={
                  /* pack: icon-copy-markdown */
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="5.25" width="9.5" height="11" rx="2.25" />
                    <rect x="8.5" y="7.75" width="9.5" height="11" rx="2.25" />
                    <path d="M13.25 10.75V15" />
                    <path d="M11 12.75L13.25 15.25L15.5 12.75" />
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
                {/* pack: icon-print */}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 8.5V5.25A0.5 0.5 0 0 1 8.5 4.75H15.5A0.5 0.5 0 0 1 16 5.25V8.5" />
                  <rect x="4.75" y="8.5" width="14.5" height="7.25" rx="2" />
                  <path d="M8 12.75H16V18.5A0.75 0.75 0 0 1 15.25 19.25H8.75A0.75 0.75 0 0 1 8 18.5Z" />
                  <circle cx="7" cy="11.5" r="1.35" fill="currentColor" stroke="none" />
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
