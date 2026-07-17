"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { createPortal } from "react-dom";
import {
  searchAcrossWorkspacesAction,
  type CrossWorkspaceSearchItem,
} from "@/server/actions/cross-workspace-search";
import { selectWorkspaceAction } from "@/server/actions/cross-workspace";
import type { LaneId } from "@/lib/data";

/**
 * Global ⌘⇧K (Cmd+Shift+K on macOS, Ctrl+Shift+K elsewhere) toggles a search
 * popover that hits every workspace the user belongs to. Clicking a
 * result sets that workspace as active, navigates to /app/board, and
 * opens the task in the detail panel via `?task=<id>`.
 *
 * Mounted once at the app layout level, alongside `<CrossWorkspaceOverdue />`,
 * so the shortcut is live on every /app/* page. The keydown listener
 * skips when focus is inside an editable surface, except when that
 * surface is the popover's own search input.
 */
export function CrossWorkspaceSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<CrossWorkspaceSearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openSearch = useCallback(() => {
    setQuery("");
    setDebounced("");
    setItems(null);
    setLoading(false);
    setLoadError(null);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Global keyboard listener. Honors the same "skip when typing"
  // rule as cross-workspace-overdue, except the popover's own input
  // is whitelisted so ⌘K still toggles the popover closed from
  // inside the search box.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as Element | null;
      const insideOwnInput =
        target instanceof HTMLElement &&
        inputRef.current !== null &&
        inputRef.current === target;
      const insideEditable =
        target instanceof HTMLElement &&
        (target.matches(
          'input, textarea, [contenteditable], [contenteditable="true"]',
        ) ||
          target.isContentEditable);

      const meta = e.metaKey || e.ctrlKey;
      // ⌘⇧K since T·94: plain ⌘K now belongs to the Studio Bar's
      // universal "Search, jump or create" palette. Shift widens the
      // gesture to "across workspaces", same key family.
      if (meta && e.shiftKey && e.key.toLowerCase() === "k") {
        // Allowed even from inside another input, the user genuinely
        // wants the search overlay regardless of what's focused.
        // Mirrors VSCode / Linear behavior.
        e.preventDefault();
        if (open) close();
        else openSearch();
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }
      // Suppress everything else when focus is in an editable surface
      // (the input we don't own). The popover's own input stays live.
      if (insideEditable && !insideOwnInput) return;
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, openSearch]);

  // Debounce the query at 180ms, same cadence as the typeahead in
  // the import flow. Avoids hitting the action on every keystroke.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query, open]);

  // Fire the server action whenever the debounced query settles.
  // Cancel-on-rerun via a sequence number, not the cleanup function,
  // because a fresh query shouldn't blank the previous results until
  // the new ones arrive (avoids a flicker on every keystroke).
  const seqRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    const trimmed = debounced.trim();
    if (trimmed.length < 2) return;
    const mySeq = ++seqRef.current;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const fresh = await searchAcrossWorkspacesAction(trimmed);
        if (mySeq !== seqRef.current) return; // a newer query already raced ahead.
        setItems(fresh);
      } catch (err) {
        if (mySeq !== seqRef.current) return;
        setLoadError(
          err instanceof Error ? err.message : "Couldn’t reach the server.",
        );
      } finally {
        if (mySeq === seqRef.current) setLoading(false);
      }
    })();
  }, [debounced, open]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length >= 2) return;
    seqRef.current += 1;
    setItems(null);
    setLoading(false);
    setLoadError(null);
  }

  const grouped = useMemo(() => groupByWorkspace(items ?? []), [items]);

  const onPick = useCallback(
    (item: CrossWorkspaceSearchItem) => {
      // Optimistically close so the click feels instant; the cookie
      // write + navigation race ahead in the background.
      setOpen(false);
      startTransition(async () => {
        try {
          await selectWorkspaceAction(item.workspaceId);
        } catch {
          // Best-effort, proceed with navigation regardless.
        }
        router.push(`/app/board?task=${encodeURIComponent(item.taskId)}`);
        router.refresh();
      });
    },
    [router],
  );

  if (typeof document === "undefined") return null;

  const trimmed = debounced.trim();
  const showHint = trimmed.length < 2;
  const showEmpty =
    !showHint && !loading && items !== null && items.length === 0;
  const showResults = !showHint && items !== null && items.length > 0;

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
              reduce
                ? { duration: 0 }
                : { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
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
            aria-labelledby="cross-ws-search-title"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
            }
            className="fixed left-1/2 top-[14vh] z-[89] flex w-[480px] max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col overflow-hidden rounded-[12px] border border-line-soft bg-bg-elevated"
            style={{
              boxShadow:
                "0 24px 60px -22px rgba(20,21,26,0.32), 0 8px 18px -8px rgba(20,21,26,0.10)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-2 border-b border-line-soft/70 px-4 py-3">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-ink-quiet"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h2 id="cross-ws-search-title" className="sr-only">
                Search tasks across workspaces
              </h2>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search tasks across workspaces…"
                autoComplete="off"
                spellCheck={false}
                className="block flex-1 bg-transparent text-[13px] leading-snug text-ink placeholder:text-ink-faint focus:outline-none"
              />
              {loading ? (
                <span
                  aria-hidden
                  className="h-3 w-3 animate-pulse rounded-full bg-ink-quiet/40"
                />
              ) : null}
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

            <div className="max-h-[60vh] min-h-[120px] overflow-y-auto">
              {loadError ? (
                <p className="px-4 py-6 text-[12.5px] text-ink-quiet">
                  {loadError}
                </p>
              ) : showHint ? (
                <Hint />
              ) : showEmpty ? (
                <EmptyState />
              ) : showResults ? (
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
                              className="group flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-line-soft/50 focus:bg-line-soft/50 focus:outline-none"
                            >
                              <LaneDot lane={it.lane} />
                              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                                {it.title}
                              </span>
                              {it.due ? (
                                <span className="flex-shrink-0 text-[10.5px] tabular-nums text-ink-quiet">
                                  {it.due}
                                </span>
                              ) : null}
                              <span className="flex-shrink-0 rounded border border-line-soft bg-bg-sunken/40 px-1.5 py-px text-[10px] text-ink-quiet">
                                {group.workspaceName}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <footer className="flex items-center justify-between border-t border-line-soft/70 px-4 py-2 text-[10.5px] text-ink-quiet">
              <span>
                <kbd className="inline-flex h-[15px] select-none items-center rounded border border-line-soft bg-white px-1 font-mono text-[9.5px] text-ink-quiet">
                  ⌘⇧K
                </kbd>{" "}
                to toggle
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

function LaneDot({ lane }: { lane: LaneId }) {
  return (
    <span
      aria-hidden
      className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
      style={{ background: `var(--lane-${lane}-dot)` }}
    />
  );
}

function Hint() {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-[12.5px] text-ink-soft">
        Type to search across all your workspaces.
      </p>
    </div>
  );
}

function EmptyState() {
  // Manifesto voice: dry, observational. Not apologetic.
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-[12.5px] text-ink-soft">
        Nothing matched. The rest of the list is here.
      </p>
    </div>
  );
}

type Group = {
  workspaceId: string;
  workspaceName: string;
  items: CrossWorkspaceSearchItem[];
};

function groupByWorkspace(items: CrossWorkspaceSearchItem[]): Group[] {
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
