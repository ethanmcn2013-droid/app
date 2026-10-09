"use client";

import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { addDays, daysFromToday, formatDay, PEOPLE, TODAY, type Doc, type PersonId } from "./data";
import type { Nodes, Stat } from "./tree";
import { Avatar, Icon } from "./glyphs";
import s from "./outline.module.css";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/* ── Branch colours: identity hues, lifted in dark (see CSS) ──────── */
export const branchVar = (i: number) => `var(--lo-b${(i % 6) + 1})`;

/* ── Roll-up bar: one segment per branch, width by size ───────────── */

export function RollupBar({
  nodes,
  stats,
  zoom,
  onZoom,
}: {
  nodes: Nodes;
  stats: Record<string, Stat>;
  zoom: string;
  onZoom: (id: string) => void;
}) {
  const kids = nodes[zoom].children;
  if (!kids.length) return null;
  if (kids.every((k) => !nodes[k].children.length)) {
    const st = stats[zoom];
    return (
      <div className={s.rollup}>
        <div className={s.rollBar} role="img" aria-label={`${st.done} of ${st.total} done`}>
          <span className={s.rollSeg} style={{ flexGrow: 1, "--hue": "var(--v3-success)" } as CSSProperties}>
            <motion.span
              className={s.rollFill}
              initial={false}
              animate={{ width: `${(st.done / st.total) * 100}%` }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
            />
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className={s.rollup}>
      <div className={s.rollBar} role="img" aria-label="Progress by part">
        {kids.map((k, i) => {
          const st = stats[k];
          return (
            <span key={k} className={s.rollSeg} style={{ flexGrow: st.total, "--hue": branchVar(i) } as CSSProperties}>
              <motion.span
                className={s.rollFill}
                initial={false}
                animate={{ width: `${(st.done / st.total) * 100}%` }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.25 }}
              />
            </span>
          );
        })}
      </div>
      <ul className={s.legend}>
        {kids.map((k, i) => {
          const st = stats[k];
          return (
            <li key={k}>
              <button type="button" className={s.legendItem} onClick={() => onZoom(k)}>
                <span className={s.legendDot} style={{ "--hue": branchVar(i) } as CSSProperties} aria-hidden />
                <span className={s.legendName}>{nodes[k].title || "Untitled"}</span>
                <span className={s.legendFrac}>
                  {st.done} of {st.total}
                </span>
                {st.overdue > 0 && <span className={s.legendLate}>{st.overdue} late</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Minimap: the outline's shape, click to jump ──────────────────── */

export function Minimap({
  nodes,
  stats,
  zoom,
  visible,
  cursor,
  onJump,
}: {
  nodes: Nodes;
  stats: Record<string, Stat>;
  zoom: string;
  visible: Set<string>;
  cursor: string | null;
  onJump: (id: string) => void;
}) {
  const rows: { id: string; depth: number; branch: number }[] = [];
  const walk = (id: string, depth: number, branch: number) => {
    rows.push({ id, depth, branch });
    nodes[id].children.forEach((k) => walk(k, depth + 1, branch));
  };
  nodes[zoom].children.forEach((k, i) => walk(k, 0, i));
  if (!rows.some((r) => r.depth > 0)) return null;
  return (
    <nav className={s.minimap} aria-label="Outline map">
      <p className={s.miniLabel}>Shape of the plan</p>
      <div className={s.miniRows}>
        {rows.map((r) => {
          const n = nodes[r.id];
          const st = stats[r.id];
          const parent = n.children.length > 0;
          const late = st.overdue > 0 && !parent;
          const w = Math.min(100 - r.depth * 9, 34 + (n.title.length || 8) * 1.5);
          return (
            <button
              key={r.id}
              type="button"
              className={[
                s.miniRow,
                r.depth === 0 && s.miniHead,
                !visible.has(r.id) && s.miniHidden,
                cursor === r.id && s.miniCursor,
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ paddingLeft: r.depth * 9 } as CSSProperties}
              onClick={() => onJump(r.id)}
              aria-label={`Jump to ${n.title || "untitled"}`}
              tabIndex={r.depth === 0 ? 0 : -1}
            >
              <span
                className={[s.miniBar, st.complete ? s.miniDone : late ? s.miniLate : s.miniOpen].join(" ")}
                style={{ width: `${w}%`, ...(r.depth === 0 ? { "--hue": branchVar(r.branch) } : {}) } as CSSProperties}
              />
            </button>
          );
        })}
      </div>
      <p className={s.miniKey}>
        <span className={`${s.miniSwatch} ${s.miniDone}`} aria-hidden /> Done
        <span className={`${s.miniSwatch} ${s.miniOpen}`} aria-hidden /> Open
        <span className={`${s.miniSwatch} ${s.miniLate}`} aria-hidden /> Late
      </p>
    </nav>
  );
}

/* ── Pickers ──────────────────────────────────────────────────────── */

export function DatePicker({
  current,
  eventDay,
  onPick,
  sheet,
}: {
  current?: string;
  eventDay: string;
  onPick: (iso: string | undefined) => void;
  sheet?: boolean;
}) {
  const dayBefore = addDays(eventDay, -1);
  const opts: { label: string; iso: string | undefined; hint?: string }[] = [
    { label: "Today", iso: TODAY, hint: formatDay(TODAY) },
    { label: "Tomorrow", iso: addDays(TODAY, 1), hint: formatDay(addDays(TODAY, 1)) },
    { label: "This weekend", iso: addDays(TODAY, 3), hint: formatDay(addDays(TODAY, 3)) },
    { label: "The day before", iso: dayBefore, hint: formatDay(dayBefore) },
    { label: "On the day", iso: eventDay, hint: formatDay(eventDay) },
  ];
  return (
    <div
      className={sheet ? s.sheetPop : s.pop}
      role="dialog"
      aria-label="Choose a date"
      onMouseDown={(e) => e.preventDefault()}
    >
      <p className={s.popTitle}>Due</p>
      {opts.map((o) => (
        <button
          key={o.label}
          type="button"
          className={o.iso === current ? `${s.popItem} ${s.popItemOn}` : s.popItem}
          onClick={() => onPick(o.iso)}
        >
          <Icon name="calendar" size={14} />
          <span>{o.label}</span>
          <span className={s.popHint}>{o.hint}</span>
        </button>
      ))}
      {current && (
        <button type="button" className={s.popItem} onClick={() => onPick(undefined)}>
          <Icon name="close" size={14} />
          <span>No date</span>
          <span className={s.popHint}>{daysFromToday(current) < 0 ? "Clears the late flag" : ""}</span>
        </button>
      )}
    </div>
  );
}

export function PersonPicker({
  current,
  people,
  onPick,
  sheet,
}: {
  current?: PersonId;
  people: PersonId[];
  onPick: (p: PersonId | undefined) => void;
  sheet?: boolean;
}) {
  return (
    <div
      className={sheet ? s.sheetPop : s.pop}
      role="dialog"
      aria-label="Choose a person"
      onMouseDown={(e) => e.preventDefault()}
    >
      <p className={s.popTitle}>Who is doing this</p>
      {people.map((p) => (
        <button
          key={p}
          type="button"
          className={p === current ? `${s.popItem} ${s.popItemOn}` : s.popItem}
          onClick={() => onPick(p)}
        >
          <Avatar person={p} size={20} />
          <span>{PEOPLE[p].name}</span>
          <span className={s.popHint}>{PEOPLE[p].role}</span>
        </button>
      ))}
      {current && (
        <button type="button" className={s.popItem} onClick={() => onPick(undefined)}>
          <Icon name="close" size={14} />
          <span>No one yet</span>
          <span className={s.popHint} />
        </button>
      )}
    </div>
  );
}

/* ── Phone edit toolbar ───────────────────────────────────────────── */

export function EditToolbar({
  onIndent,
  onOutdent,
  onUp,
  onDown,
  onDate,
  onPerson,
  onDone,
}: Record<"onIndent" | "onOutdent" | "onUp" | "onDown" | "onDate" | "onPerson" | "onDone", () => void>) {
  const items = [
    { k: "Indent", icon: "indent", fn: onIndent },
    { k: "Outdent", icon: "outdent", fn: onOutdent },
    { k: "Up", icon: "up", fn: onUp },
    { k: "Down", icon: "down", fn: onDown },
    { k: "Date", icon: "calendar", fn: onDate },
    { k: "Person", icon: "person", fn: onPerson },
  ] as const;
  return (
    <motion.div
      className={s.toolbar}
      role="toolbar"
      aria-label="Edit line"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 24, opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
    >
      {items.map((it) => (
        <button
          key={it.k}
          type="button"
          className={s.toolBtn}
          onClick={it.fn}
          aria-label={it.k === "Up" || it.k === "Down" ? `Move ${it.k.toLowerCase()}` : it.k}
        >
          <Icon name={it.icon} size={18} />
          <span className={s.toolLabel}>{it.k}</span>
        </button>
      ))}
      <button type="button" className={`${s.toolBtn} ${s.toolDone}`} onClick={onDone}>
        Done
      </button>
    </motion.div>
  );
}

/* ── Keyboard sheet ───────────────────────────────────────────────── */

const KEYS: [string, string][] = [
  ["↑ ↓", "Move between lines"],
  ["← →", "Fold or unfold"],
  ["Enter", "Edit the line, or add a line below while editing"],
  ["Tab", "Indent under the line above"],
  ["Shift Tab", "Outdent one level"],
  ["Alt ↑ ↓", "Move the line"],
  ["Space", "Mark done"],
  ["Z", "Zoom into the line"],
  ["Esc", "Stop editing, or zoom out one level"],
  ["H", "Hide or show done"],
  ["Ctrl Z", "Undo"],
];

export function KeySheet({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className={s.keys}
      role="dialog"
      aria-label="Keyboard shortcuts"
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.16, ease: EASE }}
    >
      <div className={s.keysHead}>
        <p className={s.keysTitle}>Shortcuts</p>
        <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Close shortcuts">
          <Icon name="close" size={14} />
        </button>
      </div>
      <dl className={s.keysList}>
        {KEYS.map(([k, v]) => (
          <div key={k} className={s.keysRow}>
            <dt>
              {k.split(" ").map((part) => (
                <kbd key={part} className={s.kbd}>
                  {part}
                </kbd>
              ))}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </motion.div>
  );
}

/* ── Plan switcher ────────────────────────────────────────────────── */

export function Switcher({
  docs,
  active,
  onPick,
}: {
  docs: Record<Doc["key"], Doc>;
  active: Doc["key"];
  onPick: (k: Doc["key"]) => void;
}) {
  return (
    <motion.div
      className={s.switcher}
      role="menu"
      aria-label="Switch plan"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.14, ease: EASE }}
    >
      <p className={s.popTitle}>Plans</p>
      {(Object.keys(docs) as Doc["key"][]).map((k, i) => {
        const d = docs[k];
        return (
          <button
            key={k}
            type="button"
            role="menuitemradio"
            aria-checked={k === active}
            className={k === active ? `${s.switchItem} ${s.popItemOn}` : s.switchItem}
            onClick={() => onPick(k)}
          >
            <span className={s.tile} style={{ background: i === 0 ? "var(--v3-project-3)" : "var(--v3-project-2)" }}>
              {d.nodes[d.rootId].title.slice(0, 1)}
            </span>
            <span className={s.switchText}>
              <span className={s.switchName}>{d.nodes[d.rootId].title}</span>
              <span className={s.popHint}>{d.place}</span>
            </span>
            {k === active && <Icon name="check" size={14} className={s.switchTick} />}
          </button>
        );
      })}
    </motion.div>
  );
}
