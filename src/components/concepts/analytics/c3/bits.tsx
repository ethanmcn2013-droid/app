"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { projectById, type Scenario } from "./data";
import { canTake, columnName, longDay, type Assign, type ColumnVM, type TileVM } from "./model";
import styles from "./c3.module.css";

export const hueVar = (hue: number) => `var(--v3-project-${hue})`;

export function tileLabel(t: TileVM, owner: string | null) {
  const bits = [t.task.title, projectById(t.task.project).name, `due ${longDay(t.due)}`];
  if (t.overdue) bits.push("past its date");
  if (t.others.length) bits.push(`shared with ${t.others.join(" and ")}`);
  if (owner) bits.push(`with ${owner}`);
  return `${bits.join(", ")}. Press M to move.`;
}

export function Avatar({ col, size = 28 }: { col: ColumnVM; size?: number }) {
  if (!col.initials) {
    return (
      <span className={styles.avatarWeek} style={{ width: size, height: size }} aria-hidden>
        <CalendarIcon />
      </span>
    );
  }
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
      {col.initials}
    </span>
  );
}

/* ── icons ─────────────────────────────────────────────────────────── */

type IconProps = { size?: number };
export const CheckIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const ArrowIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const ChevronIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const BalanceIcon = ({ size = 15 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M8 2.5v11M4 13.5h8M2.5 5.5h11M4.5 5.5L2.5 10a2 2 0 004 0L4.5 5.5zm7 0L9.5 10a2 2 0 004 0l-2-4.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const CloseIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
export const UndoIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M5.5 4L2.5 7l3 3M3 7h6.5a3.5 3.5 0 010 7H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const CalendarIcon = ({ size = 14 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <rect x="2.5" y="3.5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
export const HandIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M5 8V3.8a1 1 0 012 0V7m0-.5V2.8a1 1 0 012 0V7m0-.3V3.8a1 1 0 012 0v5.4c0 2.8-1.8 4.8-4.4 4.8-1.6 0-2.7-.8-3.6-2.2L2.3 9a1 1 0 011.6-1.1L5 9.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── the move menu (keyboard path for drag) ────────────────────────── */

export type MenuState = { tileKey: string; x: number; y: number; returnFocus: string };

export function MoveMenu({
  scenario,
  assign,
  tile,
  columns,
  x,
  y,
  onPick,
  onClose,
}: {
  scenario: Scenario;
  assign: Assign;
  tile: TileVM;
  columns: ColumnVM[];
  x: number;
  y: number;
  onPick: (to: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const current = (assign[tile.task.id] ?? [])[tile.slot] ?? null;
  const options: { id: string | null; label: string; note: string; ok: boolean }[] = columns.map((c) => {
    const check = canTake(scenario, assign, tile.task, tile.slot, c.id);
    const future = c.count + (c.id === current ? 0 : 1);
    const note = !check.ok
      ? check.reason ?? ""
      : c.usual === null
        ? `${c.count} coming up`
        : future > c.usual
          ? `Would be ${future - c.usual} over`
          : `${c.count} of ${c.usual}, has room`;
    return { id: c.id, label: c.title, note, ok: check.ok };
  });
  if (scenario.id !== "solo" && current !== null) {
    options.push({ id: null, label: "Nobody for now", note: "Back to the tray", ok: true });
  }

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLButtonElement>("button[data-ok='true']");
    first?.focus();
  }, []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button[data-ok='true']") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      onClose();
    }
  };

  const left = Math.max(12, Math.min(x, (typeof window === "undefined" ? 1200 : window.innerWidth) - 292));
  const top = Math.max(12, Math.min(y, (typeof window === "undefined" ? 800 : window.innerHeight) - (options.length * 48 + 72)));

  return (
    <>
      <div className={styles.menuScrim} onClick={onClose} aria-hidden />
      <div
        ref={ref}
        className={styles.menu}
        role="menu"
        aria-label={`Move ${tile.task.title}`}
        style={{ left, top }}
        onKeyDown={onKey}
      >
        <div className={styles.menuHead}>
          <span className={styles.menuKicker}>Move to</span>
          <span className={styles.menuTitle}>{tile.task.title}</span>
        </div>
        {options.map((o) => (
          <button
            key={o.id ?? "nobody"}
            type="button"
            role="menuitem"
            data-ok={o.ok}
            disabled={!o.ok}
            className={styles.menuItem}
            onClick={() => onPick(o.id)}
          >
            <span className={styles.menuName}>
              {o.label}
            </span>
            <span className={styles.menuNote}>{o.note}</span>
          </button>
        ))}
        <div className={styles.menuFoot}>
          <kbd className={styles.kbd}>↑</kbd>
          <kbd className={styles.kbd}>↓</kbd> to choose, <kbd className={styles.kbd}>Esc</kbd> to close
        </div>
      </div>
    </>
  );
}

export const nameFor = columnName;
