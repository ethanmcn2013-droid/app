"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAddTask } from "@/components/app/add-task/add-task-context";
import { useDomain } from "@/lib/domain-context";
import { ShareButton } from "@/components/app/share/share-button";
import { ExportMenu } from "@/components/app/export-menu";
import { usePalette } from "@/components/app/palette/command-palette";
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
    ? "My tasks"
    : isInbox
      ? "Inbox"
      : shortenTitle(pack.workspaceTitle);
  // Inbox isn't a workspace view — hide Share + the lane tabs there.
  const showWorkspaceTabs = !isInbox;
  const showShare = !isInbox;

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
          {showShare ? (
            <span className="hidden md:inline-flex">
              <ExportMenu />
            </span>
          ) : null}
          {showShare ? (
            <Link
              href={printPath}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center justify-center rounded-md border border-line bg-white p-1.5 text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink md:inline-flex"
              aria-label="Open printable view"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </Link>
          ) : null}
          {showShare ? (
            <span className="hidden md:inline-flex">
              <ShareButton view={shareView} />
            </span>
          ) : null}

          {/* <md: overflow menu */}
          <OverflowMenu
            onSearch={openPalette}
            showShare={showShare}
            shareView={shareView}
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
 * Mobile overflow: collapses Filter + Search + Share into a single
 * popover. On ≥md it stays hidden — the row above takes over.
 *
 * Share is a server-action component; we re-mount the actual ShareButton
 * inside the menu so behavior matches desktop.
 */
function OverflowMenu({
  onSearch,
  showShare,
  shareView,
}: {
  onSearch: () => void;
  showShare: boolean;
  shareView: ShareView;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

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
    <div ref={ref} className="relative md:hidden">
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
          className="absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-lg border border-line-soft bg-white p-1 shadow-[0_18px_40px_-18px_rgba(20,21,26,0.22)]"
        >
          {/* C6: Filter affordance removed from DOM while inactive.
              Restore this disabled menu item when filtering ships. */}
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
            <div className="border-t border-line-soft pt-1">
              {/* ShareButton manages its own popover; nest it as a row */}
              <div className="[&>button]:!w-full [&>button]:!justify-start [&>button]:!rounded [&>button]:!border-0 [&>button]:!bg-transparent [&>button]:!px-2 [&>button]:!py-1.5 [&>button]:!text-[12.5px] [&>button]:!text-ink-soft hover:[&>button]:!bg-bg-sunken">
                <ShareButton view={shareView} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
