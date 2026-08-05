"use client";

// The keyboard reference. Replaces the permanent legend strip that sat
// under every view (2026-08-05 redesign): the strip taught three commands
// forever and printed a ⌘ glyph on Windows. This dialog lists the whole
// model, opens on "?" or from the view bar, and stays out of the way
// otherwise.

import { useSyncExternalStore } from "react";
import { Dialog } from "@/components/primitives/dialog";
import type { LabView } from "../types";

const subscribeNoop = () => () => {};
function useIsApplePlatform(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => /Mac|iPhone|iPad/.test(window.navigator.platform ?? ""),
    () => false,
  );
}

type ShortcutRow = { keys: string[]; does: string };

const EVERYWHERE: ShortcutRow[] = [
  { keys: ["C"], does: "New task" },
  { keys: ["mod", "K"], does: "Search, jump or create" },
  { keys: ["Enter"], does: "Open the focused task" },
  { keys: ["Esc"], does: "Close a panel or clear the selection" },
  { keys: ["?"], does: "Show this reference" },
];

const PER_VIEW: Record<LabView, ShortcutRow[]> = {
  board: [
    { keys: ["Arrows"], does: "Move between cards" },
    { keys: ["Alt", "Arrows"], does: "Move a card, or reorder it" },
    { keys: ["Space"], does: "Select a card" },
    { keys: ["F2"], does: "Edit the title" },
  ],
  list: [
    { keys: ["Up", "Down"], does: "Move between rows" },
    { keys: ["Space"], does: "Select a row" },
    { keys: ["F2"], does: "Edit the title" },
    { keys: ["Shift", "F10"], does: "Open the row's actions" },
  ],
  timeline: [
    { keys: ["Alt", "Left or Right"], does: "Move a task one day" },
    { keys: ["Alt", "Shift", "Left or Right"], does: "Change where a range ends" },
  ],
  calendar: [
    { keys: ["Arrows"], does: "Move between day controls" },
    { keys: ["Alt", "Left or Right"], does: "Move a focused task" },
  ],
};

const VIEW_HEADINGS: Record<LabView, string> = {
  board: "On the board",
  list: "In the list",
  timeline: "On the schedule",
  calendar: "On the calendar",
};

function Keys({ keys, mod }: { keys: string[]; mod: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {keys.map((key) => (
        <kbd
          className="rounded-[5px] border border-[var(--x-task-border)] bg-[var(--x-task-surface)] px-1.5 py-0.5 font-[inherit] text-[11px] text-[var(--x-task-text-secondary)]"
          key={key}
        >
          {key === "mod" ? mod : key}
        </kbd>
      ))}
    </span>
  );
}

export function ShortcutsDialog({
  open,
  onClose,
  view,
}: {
  open: boolean;
  onClose: () => void;
  view: LabView;
}) {
  const mod = useIsApplePlatform() ? "⌘" : "Ctrl";
  return (
    <Dialog ariaLabel="Keyboard shortcuts" onClose={onClose} open={open} width={420}>
      <div className="p-5">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--x-task-text)]">
            Keyboard shortcuts
          </h2>
          <button
            aria-label="Close keyboard shortcuts"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--x-task-text-muted)] hover:bg-[var(--x-task-hover)] hover:text-[var(--x-task-text)]"
            onClick={onClose}
            type="button"
          >
            <svg aria-hidden fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24" width="14"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <dl className="m-0">
          {EVERYWHERE.map((row) => (
            <div className="grid min-h-[34px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--x-task-border)] last:border-b-0" key={row.does}>
              <dt className="text-[12.5px] text-[var(--x-task-text-secondary)]">{row.does}</dt>
              <dd className="m-0"><Keys keys={row.keys} mod={mod} /></dd>
            </div>
          ))}
        </dl>
        <h3 className="mb-1 mt-4 text-[11.5px] font-medium text-[var(--x-task-text-muted)]">
          {VIEW_HEADINGS[view]}
        </h3>
        <dl className="m-0">
          {PER_VIEW[view].map((row) => (
            <div className="grid min-h-[34px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--x-task-border)] last:border-b-0" key={row.does}>
              <dt className="text-[12.5px] text-[var(--x-task-text-secondary)]">{row.does}</dt>
              <dd className="m-0"><Keys keys={row.keys} mod={mod} /></dd>
            </div>
          ))}
        </dl>
      </div>
    </Dialog>
  );
}
