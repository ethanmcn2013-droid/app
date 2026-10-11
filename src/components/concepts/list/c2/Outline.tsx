"use client";

import { createContext, useContext, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { dueLabel, daysFromToday, PEOPLE, type OutlineNode, type PersonId } from "./data";
import type { Nodes, Stat } from "./tree";
import { Avatar, Check, Icon, ProgressRing } from "./glyphs";
import s from "./outline.module.css";

export type Picker = { kind: "date" | "person"; id: string } | null;

export type OutlineCtx = {
  nodes: Nodes;
  stats: Record<string, Stat>;
  zoom: string;
  isPhone: boolean;
  hideDone: boolean;
  cursor: string | null;
  editing: string | null;
  wave: { key: number; order: Record<string, number> } | null;
  flash: string | null;
  isOpen: (id: string) => boolean;
  canExpand: (id: string, depth: number) => boolean;
  onToggleOpen: (id: string) => void;
  onZoom: (id: string) => void;
  onToggleDone: (id: string) => void;
  onCursor: (id: string) => void;
  onEdit: (id: string | null) => void;
  onTitle: (id: string, title: string) => void;
  onEditKey: (e: KeyboardEvent<HTMLInputElement>, id: string) => void;
  onBlurEdit: (id: string) => void;
  onPicker: (p: Picker) => void;
  picker: Picker;
  renderPicker: (id: string) => ReactNode;
};

const Ctx = createContext<OutlineCtx | null>(null);
export const OutlineProvider = Ctx.Provider;
const useOutline = () => useContext(Ctx)!;

const EASE = [0.2, 0.8, 0.2, 1] as const;

export function Branch({ id, depth }: { id: string; depth: number }) {
  const c = useOutline();
  const n = c.nodes[id];
  const st = c.stats[id];
  const hasKids = n.children.length > 0;
  const allDone = hasKids && st.complete;
  const reachable = c.canExpand(id, depth);
  const open = hasKids && reachable && c.isOpen(id);
  const kids = open ? n.children.filter((k) => !(c.hideDone && c.stats[k].complete)) : [];

  return (
    <div className={s.branch} data-depth={depth}>
      <Line node={n} stat={st} depth={depth} open={open} reachable={reachable} summary={allDone && !open} />
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="kids"
            className={s.group}
            style={{ "--d": depth } as CSSProperties}
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            <span className={s.guide} aria-hidden />
            {kids.map((k) => (
              <Branch key={k} id={k} depth={depth + 1} />
            ))}
            {kids.length === 0 && c.hideDone && (
              <p className={s.hiddenNote} style={{ "--d": depth + 1 } as CSSProperties}>
                Everything here is done
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Line({
  node: n,
  stat: st,
  depth,
  open,
  reachable,
  summary,
}: {
  node: OutlineNode;
  stat: Stat;
  depth: number;
  open: boolean;
  reachable: boolean;
  summary: boolean;
}) {
  const c = useOutline();
  const hasKids = n.children.length > 0;
  const section = depth === 0 && hasKids;
  const editing = c.editing === n.id;
  const isCursor = c.cursor === n.id;
  const late = !n.done && !hasKids && !!n.due && daysFromToday(n.due) < 0;
  const hiddenLate = hasKids && !open && st.overdue > 0;
  const delay = c.wave?.order[n.id] ?? 0;
  const ringSize = section ? 22 : 16;
  const frac = `${st.done} of ${st.total}`;

  const cls = [
    s.line,
    section && s.section,
    hasKids && s.parent,
    n.done && !hasKids && s.isDone,
    summary && s.summaryLine,
    isCursor && s.cursor,
    editing && s.editingLine,
    c.flash === n.id && s.flash,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cls}
      style={{ "--d": depth } as CSSProperties}
      data-line={n.id}
      onMouseDown={() => c.onCursor(n.id)}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasKids ? open : undefined}
      aria-selected={isCursor}
    >
      <motion.div className={s.lineInner} layout="position" transition={{ duration: 0.22, ease: EASE }}>
        <span className={s.chevCol}>
          {hasKids && reachable && (
            <button
              type="button"
              className={open ? `${s.chev} ${s.chevOpen}` : s.chev}
              onClick={() => c.onToggleOpen(n.id)}
              aria-label={open ? `Collapse ${n.title}` : `Expand ${n.title}`}
            >
              <Icon name="chevron" size={14} />
            </button>
          )}
        </span>

        <span className={s.markerCol} style={{ width: ringSize + 6 }}>
          {hasKids ? (
            <button
              type="button"
              className={s.ringBtn}
              onClick={() => c.onZoom(n.id)}
              aria-label={`${n.title}: ${frac} done. Zoom in`}
            >
              <ProgressRing
                done={st.done}
                total={st.total}
                size={ringSize}
                delay={delay}
                pulseKey={c.wave && n.id in c.wave.order ? c.wave.key : null}
              />
              <span className={s.tip} role="presentation">
                {frac} done · zoom in
              </span>
            </button>
          ) : (
            <button
              type="button"
              className={s.checkBtn}
              onClick={() => c.onToggleDone(n.id)}
              aria-label={n.done ? `Mark ${n.title} not done` : `Mark ${n.title} done`}
              aria-pressed={n.done}
            >
              <Check done={n.done} />
            </button>
          )}
        </span>

        <span className={s.titleCol}>
          {editing ? (
            <input
              className={s.titleInput}
              value={n.title}
              placeholder={hasKids ? "Name this part" : "Name this step"}
              aria-label="Line title"
              ref={(el) => {
                if (el && document.activeElement !== el) {
                  el.focus();
                  el.setSelectionRange(el.value.length, el.value.length);
                }
              }}
              onChange={(e) => c.onTitle(n.id, e.target.value)}
              onKeyDown={(e) => c.onEditKey(e, n.id)}
              onBlur={() => c.onBlurEdit(n.id)}
            />
          ) : (
            <motion.span
              layoutId={`title-${n.id}`}
              className={s.title}
              onClick={() => c.onEdit(n.id)}
              transition={{ duration: 0.42, ease: EASE }}
            >
              {n.title || <span className={s.untitled}>Untitled</span>}
            </motion.span>
          )}
          {summary && (
            <span className={s.summaryText}>
              <span aria-hidden> · </span>all {st.total} done
            </span>
          )}
          {hiddenLate && (
            <span className={s.lateDot} title={`${st.overdue} overdue inside`}>
              <span className={s.srOnly}>{st.overdue} overdue inside</span>
            </span>
          )}
          {n.count && !hasKids && <Meter {...n.count} />}
        </span>

        <span className={s.facts}>
          {hasKids && !summary && <span className={section ? s.fracAlways : s.frac}>{frac}</span>}
          {hasKids && !reachable && !summary && (
            <button type="button" className={s.zoomChip} onClick={() => c.onZoom(n.id)}>
              {n.children.length} steps
              <Icon name="chevron" size={12} />
            </button>
          )}
          {!editing && !summary && (
            <button
              type="button"
              className={s.ghost}
              onClick={() => c.onZoom(n.id)}
              aria-label={`Zoom into ${n.title}`}
              title="Zoom in"
            >
              <Icon name="zoom" size={14} />
            </button>
          )}
          {n.due && !summary ? (
            <button
              type="button"
              className={late ? `${s.due} ${s.dueLate}` : s.due}
              onClick={() => c.onPicker({ kind: "date", id: n.id })}
              aria-label={`Due ${dueLabel(n.due, n.done)}. Change date`}
            >
              {dueLabel(n.due, n.done)}
            </button>
          ) : (
            !summary &&
            !hasKids && (
              <button
                type="button"
                className={s.ghost}
                onClick={() => c.onPicker({ kind: "date", id: n.id })}
                aria-label="Add a date"
                title="Add a date"
              >
                <Icon name="calendar" size={14} />
              </button>
            )
          )}
          {n.owner && !summary ? (
            <button
              type="button"
              className={s.personBtn}
              onClick={() => c.onPicker({ kind: "person", id: n.id })}
              aria-label={`${PEOPLE[n.owner].name}. Change person`}
            >
              <Avatar person={n.owner as PersonId} />
            </button>
          ) : (
            !summary &&
            !hasKids && (
              <button
                type="button"
                className={s.ghost}
                onClick={() => c.onPicker({ kind: "person", id: n.id })}
                aria-label="Add a person"
                title="Add a person"
              >
                <Icon name="person" size={14} />
              </button>
            )
          )}
        </span>
      </motion.div>
      {c.picker?.id === n.id && !c.isPhone && c.renderPicker(n.id)}
    </div>
  );
}

function Meter({ n, of, unit }: { n: number; of: number; unit: string }) {
  return (
    <span className={s.meter}>
      <span className={s.meterTrack} aria-hidden>
        <span className={s.meterFill} style={{ width: `${(n / of) * 100}%` }} />
      </span>
      <span className={s.meterText}>
        {n} of {of} {unit}
      </span>
    </span>
  );
}
