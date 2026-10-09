"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { fmtTime, projectById, toolById, TOOLS, type Bench, type ProjectId, type Tool, type ToolId } from "./data";
import { cx, type DragItem } from "./ctx";
import { BenchIcon, CheckIcon, CloseIcon, EyeIcon, LinkIcon, NarrowIcon, PlusIcon, SearchIcon, ToolGlyph, UndoIcon, WidenIcon } from "./glyphs";
import s from "./c5.module.css";

const hue = (n: number) => `var(--v3-project-${n})`;

export function ToolTile({ tool, size = 36 }: { tool: ToolId; size?: number }) {
  const def = toolById(tool);
  return (
    <span className={s.tile} style={{ width: size, height: size, background: hue(def.hue), borderRadius: Math.round(size * 0.3) }} aria-hidden="true">
      <ToolGlyph tool={tool} size={Math.round(size * 0.55)} />
    </span>
  );
}

export function ProjectChip({ project }: { project: ProjectId }) {
  const p = projectById(project);
  return (
    <span className={s.projectChip}>
      <span className={s.projectDot} style={{ background: hue(p.hue) }} aria-hidden="true" />
      {p.name}
    </span>
  );
}

/* ── Tool rail ───────────────────────────────────────────────────── */

type RailProps = {
  project: ProjectId;
  on: ToolId[];
  open: Set<ToolId>;
  fresh: ToolId | null;
  onPick: (tool: ToolId) => void;
  onMore: () => void;
  moreOpen: boolean;
  onDragTool: (d: DragItem | null) => void;
  footer?: ReactNode;
};

export function ToolRail({ project, on, open, fresh, onPick, onMore, moreOpen, onDragTool, footer }: RailProps) {
  return (
    <nav className={s.rail} aria-label={`Tools that are on for ${projectById(project).name}`}>
      <ul className={s.railList}>
        <AnimatePresence initial={false}>
          {on.map((id) => {
            const def = toolById(id);
            const isOpen = open.has(id);
            return (
              <motion.li key={id} layout initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}>
                <button
                  type="button"
                  className={cx(s.railItem, isOpen && s.railOpen, fresh === id && s.railFresh)}
                  onClick={() => onPick(id)}
                  aria-pressed={isOpen}
                  aria-label={isOpen ? `${def.name}, open on this bench. Show it` : `Open ${def.name} on this bench`}
                  title={isOpen ? `${def.name} is open` : `Open ${def.name} beside the others`}
                  draggable
                  onDragStart={(e: DragEvent) => {
                    e.dataTransfer.setData("text/plain", def.name);
                    e.dataTransfer.effectAllowed = "copy";
                    onDragTool({ kind: "tool", id, label: def.name });
                  }}
                  onDragEnd={() => onDragTool(null)}
                >
                  <span className={s.railMark} aria-hidden="true" />
                  <ToolTile tool={id} size={34} />
                  <span className={s.railLabel}>{def.name}</span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <span className={s.railDivider} aria-hidden="true" />
      <button type="button" data-more="" className={cx(s.railItem, s.railMore)} onClick={onMore} aria-expanded={moreOpen} aria-haspopup="dialog">
        <span className={s.moreTile} aria-hidden="true">
          <PlusIcon size={18} />
        </span>
        <span className={s.railLabel}>More tools</span>
      </button>
      {footer}
    </nav>
  );
}

/* ── Bench bar ───────────────────────────────────────────────────── */

type BarProps = {
  benches: Bench[];
  active: Bench;
  onSwitch: (id: string) => void;
  onSave: () => void;
  onNew: () => void;
  onRename: (name: string) => void;
  justSaved: boolean;
};

export function BenchBar({ benches, active, onSwitch, onSave, onNew, onRename, justSaved }: BarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(active.name);
  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== active.name) onRename(draft.trim());
  };
  return (
    <header className={s.bar}>
      <div className={s.barTitle}>
        <span className={s.barKicker}>
          <BenchIcon size={14} /> Apps and tools · your bench
        </span>
        {editing ? (
          <input
            className={s.nameInput}
            value={draft}
            autoFocus
            aria-label="Bench name"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setDraft(active.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <h1 className={s.benchName}>
            <button
              type="button"
              className={s.nameBtn}
              onClick={() => {
                setDraft(active.name);
                setEditing(true);
              }}
              title="Rename this bench"
            >
              {active.name}
            </button>
            {!active.saved && <span className={s.unsavedPill}>Not saved</span>}
          </h1>
        )}
      </div>

      <div className={s.tabs} role="tablist" aria-label="Your benches">
        {benches.filter((b) => b.saved || b.id !== active.id).map((b) => {
          const on = b.id === active.id;
          const p = projectById(b.project);
          return (
            <motion.button
              layout
              key={b.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={cx(s.tab, on && s.tabOn, !b.saved && s.tabDraft)}
              onClick={() => onSwitch(b.id)}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
            >
              {on && <motion.span layoutId="c5-tab-bg" className={s.tabBg} transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
              <span className={s.tabDot} style={{ background: hue(p.hue) }} aria-hidden="true" />
              <span className={s.tabName}>{b.name}</span>
              {!b.saved && <span className={s.tabUnsaved}>not saved</span>}
            </motion.button>
          );
        })}
        {benches.every((b) => b.id === active.id) && <span className={s.tabsEmpty}>Benches you save show up here</span>}
        <button type="button" className={s.tabNew} onClick={onNew} aria-label="Start a new bench" title="Start a new bench">
          <PlusIcon size={15} />
        </button>
      </div>

      <div className={s.barEnd}>
        <AnimatePresence mode="wait" initial={false}>
          {active.saved ? (
            <motion.span key="saved" className={s.savedNote} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <CheckIcon size={14} /> {justSaved ? "Saved" : "Changes keep themselves"}
            </motion.span>
          ) : (
            <motion.button key="save" type="button" className={s.saveBtn} onClick={onSave} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              Save<span className={s.saveLong}> this bench</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

/* ── Pane ────────────────────────────────────────────────────────── */

type PaneProps = {
  tool: ToolId;
  project: ProjectId;
  children: ReactNode;
  wide: boolean;
  canWiden: boolean;
  onWiden: () => void;
  onClose: () => void;
  onTouch: () => void;
  readOnly?: boolean;
  accepts: boolean;
  dim: boolean;
  pulse: boolean;
  compact: boolean;
};

export function PaneFrame({ tool, project, children, wide, canWiden, onWiden, onClose, onTouch, readOnly, accepts, dim, pulse, compact }: PaneProps) {
  const def = toolById(tool);
  return (
    <div className={cx(s.pane, accepts && s.paneAccepts, dim && s.paneDim, pulse && s.panePulse, compact && s.paneCompact)} onPointerDownCapture={onTouch} onFocusCapture={onTouch} data-pane={tool}>
      <div className={s.paneHead}>
        <ToolTile tool={tool} size={26} />
        <h2 className={s.paneName}>{def.name}</h2>
        <ProjectChip project={project} />
        {readOnly && (
          <span className={s.viewOnly}>
            <EyeIcon size={13} /> <span className={s.viewOnlyText}>View only</span>
          </span>
        )}
        <span className={s.paneActions}>
          {canWiden && (
            <button type="button" className={s.paneBtn} onClick={onWiden} aria-label={wide ? `Put ${def.name} back beside the others` : `Widen ${def.name}`} title={wide ? "Back to side by side" : "Widen"}>
              {wide ? <NarrowIcon size={16} /> : <WidenIcon size={16} />}
            </button>
          )}
          <button type="button" className={s.paneBtn} onClick={onClose} aria-label={`Close ${def.name}. It stays on`} title="Close. The tool stays on">
            <CloseIcon size={16} />
          </button>
        </span>
      </div>
      <div className={s.paneBody}>{children}</div>
    </div>
  );
}

/* ── Resizer: pointer or arrow keys ──────────────────────────────── */

type ResizerProps = {
  left: Tool;
  right: Tool;
  share: number;
  linked: string | null;
  onDrag: (dx: number) => void;
  onStep: (delta: number) => void;
  onReset: () => void;
  onStart: () => void;
  onEnd: () => void;
};

export function PaneResizer({ left, right, share, linked, onDrag, onStep, onReset, onStart, onEnd }: ResizerProps) {
  const last = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    last.current = e.clientX;
    setActive(true);
    onStart();
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (last.current === null) return;
    const dx = e.clientX - last.current;
    last.current = e.clientX;
    if (dx) onDrag(dx);
  };
  const up = () => {
    last.current = null;
    setActive(false);
    onEnd();
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onStep(e.shiftKey ? -0.1 : -0.03);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onStep(e.shiftKey ? 0.1 : 0.03);
    } else if (e.key === "Enter" || e.key === "Home") {
      e.preventDefault();
      onReset();
    }
  };
  return (
    <div
      className={cx(s.resizer, active && s.resizerActive)}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${left.name} and ${right.name}. Use the left and right arrow keys, Enter to even them out`}
      aria-valuenow={Math.round(share * 100)}
      aria-valuemin={15}
      aria-valuemax={85}
      aria-valuetext={`${left.name} ${Math.round(share * 100)} percent`}
      tabIndex={0}
      title="Drag to resize. Double-click to even out"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDoubleClick={onReset}
      onKeyDown={key}
    >
      <span className={s.grip} aria-hidden="true" />
      {linked && (
        <span className={s.linkBadge} title={linked}>
          <LinkIcon size={12} />
          <span className={s.srOnly}>{linked}</span>
        </span>
      )}
    </div>
  );
}

/* ── Edge tab: a pane tucked away when the bench is narrow ────────── */

export function EdgeTab({ tool, onOpen }: { tool: ToolId; onOpen: () => void }) {
  const def = toolById(tool);
  return (
    <motion.button
      layout
      type="button"
      className={s.edgeTab}
      onClick={onOpen}
      aria-label={`${def.name} is tucked away. Bring it back`}
      title={`Bring ${def.name} back`}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
    >
      <ToolTile tool={tool} size={24} />
      <span className={s.edgeLabel}>{def.name}</span>
    </motion.button>
  );
}

/* ── Ghost pane: first visit ─────────────────────────────────────── */

const SUGGEST_WHY: Partial<Record<ToolId, string>> = {
  seating: "Place 149 guests at 18 tables",
  guests: "27 people still need a table",
  dayplan: "Saturday, hour by hour",
  suppliers: "Twelve numbers, one tap each",
  timer: "A countdown the whole team can see",
  outline: "One outline for the whole group",
  split: "Keep the work fair",
  study: "Focus together, 25 minutes at a time",
  social: "Nine posts this week",
  press: "Ten journalists to keep track of",
  proofs: "Four designs waiting",
};

export function GhostPane({ project, onPick, dropActive, onDropTool }: { project: ProjectId; onPick: (t: ToolId) => void; dropActive: boolean; onDropTool: () => void }) {
  const p = projectById(project);
  return (
    <div
      className={cx(s.ghost, dropActive && s.ghostDrop)}
      onDragOver={(e) => {
        if (dropActive) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropTool();
      }}
    >
      <div className={s.ghostInner}>
        <span className={s.ghostIcon} aria-hidden="true">
          <PlusIcon size={22} />
        </span>
        <h2 className={s.ghostTitle}>Open a tool next to your tasks</h2>
        <p className={s.ghostLine}>Work on both at once. Drag a task onto the day, or a guest onto a table. Here are three that suit {p.name}.</p>
        <ul className={s.ghostList}>
          {p.suggest.map((id) => (
            <li key={id}>
              <button type="button" className={s.ghostPick} onClick={() => onPick(id)}>
                <ToolTile tool={id} size={32} />
                <span className={s.ghostPickText}>
                  <span className={s.ghostPickName}>{toolById(id).name}</span>
                  <span className={s.ghostPickWhy}>{SUGGEST_WHY[id] ?? toolById(id).line}</span>
                </span>
                <span className={s.ghostOpen}>Open</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={s.ghostFoot}>Or drag any tool in from the left.</p>
      </div>
    </div>
  );
}

/* ── More tools popover ──────────────────────────────────────────── */

export function AddToolPopover({ project, on, onClose, onTurnOn }: { project: ProjectId; on: ToolId[]; onClose: () => void; onTurnOn: (t: ToolId) => void }) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const off = TOOLS.filter((x) => !on.includes(x.id) && (!q || `${x.name} ${x.line}`.toLowerCase().includes(q.toLowerCase())));
  const shelves = useMemo(() => {
    const m = new Map<Tool["shelf"], Tool[]>();
    for (const x of off) m.set(x.shelf, [...(m.get(x.shelf) ?? []), x]);
    return [...m.entries()];
  }, [off]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("[data-more]")) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className={s.popover}
      role="dialog"
      aria-label="More tools"
      initial={{ opacity: 0, x: -8, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 520, damping: 38 }}
    >
      <div className={s.popHead}>
        <h2 className={s.popTitle}>More tools for {projectById(project).name}</h2>
        <button type="button" className={s.paneBtn} onClick={onClose} aria-label="Close">
          <CloseIcon size={16} />
        </button>
      </div>
      <label className={s.popSearch}>
        <SearchIcon size={15} />
        <span className={s.srOnly}>Find a tool</span>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tool, like budget or forms" />
      </label>
      <div className={s.popScroll}>
        {shelves.map(([shelf, tools]) => (
          <section key={shelf} className={s.shelf}>
            <h3 className={s.shelfName}>{shelf}</h3>
            <ul>
              {tools.map((x) => (
                <li key={x.id} className={s.popRow}>
                  <ToolTile tool={x.id} size={32} />
                  <span className={s.popText}>
                    <span className={s.popName}>{x.name}</span>
                    <span className={s.popLine}>{x.line}</span>
                  </span>
                  <button type="button" className={s.popOn} onClick={() => onTurnOn(x.id)} aria-label={`Turn on ${x.name} and open it`}>
                    Turn on
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {shelves.length === 0 && <p className={s.popEmpty}>No tool by that name yet.</p>}
      </div>
      <p className={s.popFoot}>Turning a tool on adds it to the left for everyone in {projectById(project).name}. You can turn it off any time.</p>
    </motion.div>
  );
}

/* ── Send to: the no-drag way across panes ───────────────────────── */

export type SendOption = { id: string; title: string; sub?: string; disabled?: boolean; group?: string };

export function SendSheet({ title, lead, options, onPick, onClose, grid }: { title: string; lead: string; options: SendOption[]; onPick: (id: string) => void; onClose: () => void; grid?: boolean }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const firstIdx = options.findIndex((o) => !o.disabled);
  return (
    <motion.div className={s.scrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className={s.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 480, damping: 40 }}
      >
        <span className={s.sheetHandle} aria-hidden="true" />
        <div className={s.sheetHead}>
          <h2 className={s.sheetTitle}>{title}</h2>
          <button type="button" className={s.paneBtn} onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>
        <p className={s.sheetLead}>{lead}</p>
        <div className={cx(s.sheetOptions, grid && s.sheetGrid)}>
          {options.map((o, i) => {
            return (
              <button key={o.id} ref={i === firstIdx ? first : undefined} type="button" className={s.sheetOpt} disabled={o.disabled} onClick={() => onPick(o.id)}>
                <span className={s.sheetOptTitle}>{o.title}</span>
                {o.sub && <span className={s.sheetOptSub}>{o.sub}</span>}
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Toast ───────────────────────────────────────────────────────── */

export function Toast({ message, onUndo, onClose }: { message: string; onUndo?: () => void; onClose: () => void }) {
  return (
    <motion.div className={s.toast} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ type: "spring", stiffness: 520, damping: 36 }}>
      <span className={s.toastText}>{message}</span>
      {onUndo && (
        <button type="button" className={s.toastUndo} onClick={onUndo}>
          <UndoIcon size={14} /> Undo
        </button>
      )}
      <button type="button" className={s.toastClose} onClick={onClose} aria-label="Dismiss">
        <CloseIcon size={14} />
      </button>
    </motion.div>
  );
}

export const timeLabel = fmtTime;
