"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import {
  getOverdueAcrossWorkspacesAction,
  selectWorkspaceAction,
  type CrossWorkspaceOverdueItem,
} from "@/server/actions/cross-workspace";

/**
 * Global ⌘. (Cmd+Period on macOS, Ctrl+Period elsewhere) toggles a
 * popover showing every overdue task across every workspace the user
 * belongs to. Clicking an item sets that workspace as active and
 * navigates to /app/board.
 *
 * Mounted once at the app layout level so the shortcut is live on
 * every /app/* page. Skips the listener when focus is inside an
 * editable surface, same rule as the existing keyboard-nav code in
 * board-app / list-app.
 */
export function CrossWorkspaceOverdue() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CrossWorkspaceOverdueItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const reduce = useReducedMotion();

  const close = useCallback(() => setOpen(false), []);

  // Global keyboard listener.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Match the existing keyboard-nav rule: skip when typing in any
      // editable surface (composer, detail-panel inputs, the
      // contenteditable description editor).
      const target = e.target as Element | null;
      if (
        target &&
        target instanceof HTMLElement &&
        (target.matches("input, textarea, [contenteditable], [contenteditable=\"true\"]") ||
          target.isContentEditable)
      ) {
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === ".") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lazy-load on first open and refresh on each subsequent open so
  // the popover never renders stale "overdue" state after a user
  // ticked something off in another tab.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      try {
        const fresh = await getOverdueAcrossWorkspacesAction();
        if (!cancelled) setItems(fresh);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load overdue tasks.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const grouped = useMemo(() => groupByWorkspace(items ?? []), [items]);
  const total = items?.length ?? 0;

  const onPick = useCallback(
    (item: CrossWorkspaceOverdueItem) => {
      // Optimistically close the popover so the click feels instant;
      // the server-action + navigation race ahead in the background.
      setOpen(false);
      startTransition(async () => {
        try {
          await selectWorkspaceAction(item.workspaceId);
        } catch {
          // Best-effort: even if the cookie write throws, navigating
          // to /app/board lands the user on whichever workspace
          // resolves, strictly better than freezing.
        }
        router.push("/app/board");
        router.refresh();
      });
    },
    [router],
  );

  // SSR safety, portal target only exists in the browser.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
            }
            onClick={close}
            className="fixed inset-0 z-[88]"
            style={{ background: "rgba(20, 21, 26, 0.18)" }}
            aria-hidden
          />
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cross-ws-overdue-title"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
            className="fixed right-5 top-5 z-[89] flex w-[440px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[12px] border border-line-soft bg-bg-elevated"
            style={{
              boxShadow:
                "0 24px 60px -22px rgba(20,21,26,0.32), 0 8px 18px -8px rgba(20,21,26,0.10)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-2 border-b border-line-soft/70 px-4 py-3">
              <h2
                id="cross-ws-overdue-title"
                className="flex-1 text-[12.5px] font-semibold tracking-[0.005em] text-ink"
              >
                Overdue{" "}
                <span className="text-ink-quiet">·</span>
                {" "}all workspaces
                {items ? (
                  <span className="ml-1.5 text-ink-quiet">
                    ({total} total)
                  </span>
                ) : null}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded p-1 text-ink-quiet transition-colors hover:bg-line-soft hover:text-ink-soft"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </header>

            <div className="max-h-[60vh] overflow-y-auto">
              {items === null && !loadError ? (
                <LoadingRow />
              ) : loadError ? (
                <p className="px-4 py-6 text-[12.5px] text-ink-quiet">
                  {loadError}
                </p>
              ) : total === 0 ? (
                <EmptyState />
              ) : (
                <ul className="py-1">
                  {grouped.map((group) => (
                    <li key={group.workspaceId}>
                      <div className="px-4 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
                        {group.workspaceName}
                      </div>
                      <ul>
                        {group.items.map((it) => (
                          <li key={it.taskId}>
                            <button
                              type="button"
                              onClick={() => onPick(it)}
                              className="group flex w-full items-start gap-3 px-4 py-2 text-left transition-colors hover:bg-line-soft/50 focus:bg-line-soft/50 focus:outline-none"
                            >
                              <span className="mt-[1px] inline-flex w-[78px] flex-shrink-0 text-[11px] tabular-nums text-rose-700/85">
                                {formatLateness(it.dueIsoDate)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[12.5px] text-ink">
                                  {it.title}
                                </span>
                                <span className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-ink-quiet">
                                  <span className="inline-block h-1 w-1 rounded-full bg-ink-quiet/60" />
                                  {it.workspaceName}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="flex items-center justify-between border-t border-line-soft/70 px-4 py-2 text-[10.5px] text-ink-quiet">
              <span>
                <kbd className="inline-flex h-[15px] select-none items-center rounded border border-line-soft bg-white px-1 font-mono text-[9.5px] text-ink-quiet">
                  ⌘.
                </kbd>{" "}to toggle
              </span>
              <span>esc to close</span>
            </footer>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function LoadingRow() {
  return (
    <div className="space-y-2 px-4 py-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-3 w-full animate-pulse rounded bg-line-soft/70"
          style={{ width: `${80 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  // Manifesto voice: dry, observational, lightly approving.
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-[12.5px] text-ink-soft">
        Nothing’s late. The rare clean inbox.
      </p>
    </div>
  );
}

type Group = {
  workspaceId: string;
  workspaceName: string;
  items: CrossWorkspaceOverdueItem[];
};

function groupByWorkspace(items: CrossWorkspaceOverdueItem[]): Group[] {
  const order: string[] = [];
  const map = new Map<string, Group>();
  for (const it of items) {
    let g = map.get(it.workspaceId);
    if (!g) {
      g = {
        workspaceId: it.workspaceId,
        workspaceName: it.workspaceName,
        items: [],
      };
      map.set(it.workspaceId, g);
      order.push(it.workspaceId);
    }
    g.items.push(it);
  }
  return order.map((id) => map.get(id)!).filter(Boolean);
}

/**
 * Render an ISO date as a relative-lateness label like "2 days late"
 * or "1 week late". Returns "—" when the date is missing.
 *
 * Computed in the browser so the client's local clock is the source
 * of truth, the server might be in a different timezone, and a task
 * the user thinks is "due yesterday" should read "1 day late" no
 * matter where the function ran.
 */
function formatLateness(iso: string | null): string {
  if (!iso) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseIsoStrict(iso);
  if (!due) return "—";
  const diffMs = today.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "due today";
  if (diffDays === 1) return "1 day late";
  if (diffDays < 7) return `${diffDays} days late`;
  if (diffDays < 14) return "1 week late";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks late`;
  if (diffDays < 60) return "1 month late";
  return `${Math.floor(diffDays / 30)} months late`;
}

function parseIsoStrict(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

