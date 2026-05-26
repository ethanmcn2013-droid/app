"use client";

import { useCallback, useState } from "react";
import { Popover } from "@/components/app/detail-panel/popover";
import { useToast } from "@/components/primitives/toast";
import { useTasks } from "@/lib/tasks/tasks-context";
import { useDomain, useActiveWorkspace } from "@/lib/domain-context";
import {
  formatTasksAsCsv,
  formatTasksAsMarkdown,
} from "@/lib/exports";

/**
 * Sprint 9 · Google bridges (export-side).
 *
 * Three options the user reaches at the page-header. Each is a pure
 * client-side formatter + clipboard write — no OAuth, no server
 * round-trip beyond what the page already loaded.
 *
 *   - Copy as CSV       → spreadsheet-ready (Google Sheets, Excel, Numbers)
 *   - Copy as Markdown  → Google Docs, Notion, GitHub, Slack, Discord
 *   - Subscribe in Calendar → webcal:// URL (cycle 24's iCal feed),
 *                             pasted into Google Calendar / Apple
 *                             Calendar / Outlook
 *
 * The brand thesis: Tasks owns the data; Google is a destination
 * people happen to use. We hand them the data, formatted for the
 * destination, without Tasks ever asking for an OAuth scope.
 */
export function ExportMenu() {
  const { toast } = useToast();
  const { state } = useTasks();
  const pack = useDomain();
  const ws = useActiveWorkspace();

  // Skip rendering when not in app shell — the marketing surfaces
  // mount the page-header but don't have an active workspace.
  if (!ws) return null;

  return (
    <Popover
      align="end"
      width={260}
      aria-label="Export options"
      trigger={({ onClick, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          className="hidden items-center justify-center rounded-md border border-line bg-white p-1.5 text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink md:inline-flex"
          aria-label="Export"
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      )}
    >
      {(close) => (
        <ExportMenuItems
          close={close}
          tasks={state.tasks}
          workspaceName={pack.workspaceTitle}
          workspaceId={ws.id}
        />
      )}
    </Popover>
  );
}

function ExportMenuItems({
  close,
  tasks,
  workspaceName,
  workspaceId,
}: {
  close: () => void;
  tasks: import("@/lib/data").Task[];
  workspaceName: string;
  workspaceId: string;
}) {
  const { toast } = useToast();
  const [copying, setCopying] = useState<string | null>(null);

  const copy = useCallback(
    async (key: string, text: string, successBody: string) => {
      setCopying(key);
      try {
        await navigator.clipboard.writeText(text);
        toast(`${labelFor(key)} copied`, {
          tone: "success",
          body: successBody,
        });
        // Brief visual ack before closing the popover.
        setTimeout(() => {
          setCopying(null);
          close();
        }, 800);
      } catch {
        // Fallback: hidden textarea + execCommand, mirrors the
        // cycle-22 share-this-week-button pattern.
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          toast(`${labelFor(key)} copied`, {
            tone: "success",
            body: successBody,
          });
          setTimeout(() => {
            setCopying(null);
            close();
          }, 800);
        } catch {
          toast("Couldn't copy", { tone: "error" });
          setCopying(null);
        }
      }
    },
    [close, toast],
  );

  const onCopyCsv = () => {
    const csv = formatTasksAsCsv(tasks);
    copy("csv", csv, "Paste into Google Sheets, Excel, or Numbers.");
  };

  const onCopyMarkdown = () => {
    const md = formatTasksAsMarkdown(tasks, workspaceName);
    copy("md", md, "Paste into Google Docs, Notion, or anything markdown.");
  };

  const onCopyCalendar = () => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin.replace(/^https?/, "webcal");
    const url = `${origin}/api/calendar/${workspaceId}`;
    copy("ical", url, "Paste into Calendar's 'Add subscription' dialog.");
  };

  return (
    <div className="flex flex-col p-1">
      <ExportItem
        label="Copy as CSV"
        sub="Sheets · Excel · Numbers"
        active={copying === "csv"}
        onClick={onCopyCsv}
        icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        }
      />
      <ExportItem
        label="Copy as Markdown"
        sub="Docs · Notion · Slack"
        active={copying === "md"}
        onClick={onCopyMarkdown}
        icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M4 12h10M4 17h16" />
          </svg>
        }
      />
      <ExportItem
        label="Subscribe in Calendar"
        sub="Google · Apple · Outlook"
        active={copying === "ical"}
        onClick={onCopyCalendar}
        icon={
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        }
      />
      <div className="mt-1 border-t border-line-soft pt-1">
        <a
          href="/embed/guide"
          className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] text-ink-soft transition-colors hover:bg-bg-sunken/60 hover:text-ink"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          Embed elsewhere
          <span className="ml-auto font-mono text-[10px] text-ink-quiet">
            guide
          </span>
        </a>
      </div>
    </div>
  );
}

function labelFor(key: string): string {
  if (key === "csv") return "CSV";
  if (key === "md") return "Markdown";
  if (key === "ical") return "Calendar link";
  return "Text";
}

function ExportItem({
  label,
  sub,
  icon,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors " +
        (active
          ? "bg-emerald-50 text-emerald-800"
          : "text-ink hover:bg-bg-sunken/60")
      }
    >
      <span
        className={
          "mt-0.5 flex-shrink-0 " +
          (active ? "text-emerald-700" : "text-ink-quiet")
        }
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-[13px] font-medium leading-tight">
          {active ? "Copied" : label}
        </span>
        <span className="block text-[11px] leading-tight text-ink-quiet">
          {sub}
        </span>
      </span>
    </button>
  );
}
