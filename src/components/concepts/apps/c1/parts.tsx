"use client";

import { motion, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { PRODUCT_APP_PATHS } from "@/lib/product-urls";
import {
  CORE_APPS,
  hueVar,
  PROJECTS,
  projectById,
  toolById,
  TOOLS,
  type ProjectId,
  type Size,
  type Tool,
  type ToolId,
  type Widget,
} from "./data";
import { WidgetBody, type BodyApi } from "./bodies";
import { CheckIcon, CloseIcon, Glyph, LockIcon, MinusIcon, PlusIcon, ResizeIcon, SearchIcon } from "./glyphs";
import s from "./c1.module.css";

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");
export const SIZE_NAME: Record<Size, string> = { s: "Small", m: "Wide", l: "Large" };
const SIZE_CLASS: Record<Size, string> = { s: s.sizeS, m: s.sizeM, l: s.sizeL };
export const sizeClass = (z: Size) => SIZE_CLASS[z];

/* ── widget frame ────────────────────────────────────────────────── */

type FrameProps = {
  w: Widget;
  showProject: boolean;
  arranging: boolean;
  fresh: boolean;
  wobbleIndex: number;
  api: BodyApi;
  onOpen: (w: Widget) => void;
  onRemove: (w: Widget) => void;
  onResize: (w: Widget, size: Size) => void;
  onReorderOver: (wid: string, overWid: string) => void;
  onMove: (wid: string, delta: -1 | 1) => void;
  onLongPress: () => void;
};

function nearestSize(tool: Tool, cols: number, rows: number): Size {
  const want: Size = cols >= 2 && rows >= 2 ? "l" : cols >= 2 ? "m" : "s";
  if (tool.sizes.includes(want)) return want;
  if (want === "l" && tool.sizes.includes("m")) return "m";
  return tool.sizes[0];
}

export function WidgetFrame(p: FrameProps) {
  const { w, arranging, fresh } = p;
  const tool = toolById(w.tool);
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const lastOver = useRef<string | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);
  const resize = useRef<{ x: number; y: number; w: number; h: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<Size | null>(null);
  const locked = w.state === "locked";
  const canResize = tool.sizes.length > 1 && !locked;

  const cancelPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const onCardPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (arranging && !locked) {
      controls.start(e);
      return;
    }
    if (e.pointerType === "touch") {
      pressStart.current = { x: e.clientX, y: e.clientY };
      pressTimer.current = window.setTimeout(() => {
        pressTimer.current = null;
        p.onLongPress();
      }, 480);
    }
  };

  const onHandleDown = (e: RPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const el = cellRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    resize.current = { x: e.clientX, y: e.clientY, w: r.width, h: r.height, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const st = resize.current;
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) st.moved = true;
    const unitW = w.size === "s" ? st.w : st.w / 2;
    const unitH = w.size === "l" ? st.h / 2 : st.h;
    const cols = Math.max(1, Math.min(2, Math.round((st.w + dx) / unitW)));
    const rows = Math.max(1, Math.min(2, Math.round((st.h + dy) / unitH)));
    setGhost(nearestSize(tool, cols, rows));
  };
  const onHandleUp = () => {
    const st = resize.current;
    resize.current = null;
    if (!st) return;
    if (!st.moved) {
      setGhost(null);
      setMenu((m) => !m);
      return;
    }
    if (ghost && ghost !== w.size) p.onResize(w, ghost);
    setGhost(null);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!arranging || locked) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      p.onMove(w.wid, -1);
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      p.onMove(w.wid, 1);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      p.onRemove(w);
    }
  };

  const shown = ghost ?? w.size;
  const label = `${tool.name}${p.showProject ? `, ${projectById(w.project).name}` : ""}`;

  return (
    <motion.div
      ref={cellRef}
      layout
      data-wid={w.wid}
      className={cx(s.cell, sizeClass(shown), dragging && s.cellDragging, menu && s.cellMenu)}
      drag={arranging && !locked}
      dragControls={controls}
      dragListener={false}
      dragSnapToOrigin
      dragElastic={1}
      onDragStart={() => {
        setDragging(true);
        lastOver.current = null;
      }}
      onDrag={(e) => {
        const ev = e as PointerEvent;
        const hit = document
          .elementsFromPoint(ev.clientX, ev.clientY)
          .map((el) => (el as HTMLElement).closest<HTMLElement>("[data-wid]"))
          .find((el) => el && el.dataset.wid !== w.wid);
        const over = hit?.dataset.wid;
        if (over && over !== lastOver.current) {
          lastOver.current = over;
          p.onReorderOver(w.wid, over);
        }
      }}
      onDragEnd={() => setDragging(false)}
      whileDrag={{ scale: 1.04, zIndex: 20 }}
      initial={false}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
      transition={{ layout: { type: "spring", stiffness: 520, damping: 42 } }}
    >
      <div className={cx(s.wobbler, arranging && !locked && s.wobble, arranging && s.arranging)} style={{ animationDelay: `${(p.wobbleIndex % 5) * -0.07}s` }}>
        <div
          className={cx(s.card, locked && s.cardLocked, fresh && s.cardFresh)}
          onPointerDown={onCardPointerDown}
          onPointerMove={(e) => {
            const st = pressStart.current;
            if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8) cancelPress();
          }}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onKeyDown={onKey}
          tabIndex={arranging && !locked ? 0 : undefined}
          role={arranging && !locked ? "group" : undefined}
          aria-label={arranging && !locked ? `${label}. Arrow keys move it. Delete turns it off.` : undefined}
          data-wid-card
        >
          {!arranging && (
            <button type="button" className={s.cover} aria-label={`About ${label}`} onClick={() => p.onOpen(w)} />
          )}
          <motion.div
            className={s.bodyWrap}
            initial={fresh ? (reduce ? { opacity: 0 } : { clipPath: "inset(38% 38% 38% 38% round 28px)", opacity: 0.4 }) : false}
            animate={fresh ? (reduce ? { opacity: 1 } : { clipPath: "inset(0% 0% 0% 0% round 18px)", opacity: 1 }) : undefined}
            transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <WidgetBody w={{ ...w, size: shown }} size={shown} showProject={p.showProject} api={p.api} />
          </motion.div>
          {fresh && !reduce && (
            <motion.span
              className={s.unfoldGlyph}
              style={{ background: hueVar(tool.hue) }}
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
              aria-hidden
            >
              <Glyph id={tool.id} size={22} />
            </motion.span>
          )}
          {locked && (
            <span className={s.lockMark} aria-hidden>
              <LockIcon />
            </span>
          )}
        </div>
        {arranging && !locked && (
          <button type="button" className={s.minus} aria-label={`Turn off ${label}`} onClick={() => p.onRemove(w)}>
            <MinusIcon />
          </button>
        )}
        {arranging && canResize && (
          <button
            type="button"
            className={s.handle}
            aria-label={`Resize ${label}. Now ${SIZE_NAME[w.size].toLowerCase()}.`}
            aria-expanded={menu}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setMenu((m) => !m);
              }
            }}
          >
            <ResizeIcon />
          </button>
        )}
        {menu && arranging && (
          <SizeMenu
            tool={tool}
            value={w.size}
            onPick={(z) => {
              setMenu(false);
              if (z !== w.size) p.onResize(w, z);
            }}
            onClose={() => setMenu(false)}
          />
        )}
      </div>
      <button type="button" className={s.label} onClick={() => p.onOpen(w)} tabIndex={arranging ? -1 : 0}>
        {p.showProject && <span className={s.labelDot} style={{ background: hueVar(projectById(w.project).hue) }} aria-hidden />}
        <span className={s.labelText}>{tool.name}</span>
      </button>
    </motion.div>
  );
}

/* ── size menu ───────────────────────────────────────────────────── */

export function SizeGlyph({ z }: { z: Size }) {
  const box = { s: [0, 0, 8, 8], m: [0, 0, 18, 8], l: [0, 0, 18, 18] }[z];
  return (
    <svg width={20} height={20} viewBox="-1 -1 20 20" aria-hidden className={s.sizeGlyph}>
      <rect x={0} y={0} width={8} height={8} rx={2} className={s.sizeGrid} />
      <rect x={10} y={0} width={8} height={8} rx={2} className={s.sizeGrid} />
      <rect x={0} y={10} width={8} height={8} rx={2} className={s.sizeGrid} />
      <rect x={10} y={10} width={8} height={8} rx={2} className={s.sizeGrid} />
      <rect x={box[0]} y={box[1]} width={box[2]} height={box[3]} rx={2.5} className={s.sizeFill} />
    </svg>
  );
}

const SIZE_HINT: Record<Size, string> = { s: "The one number", m: "Number and chart", l: "Everything, with a list" };

function SizeMenu({ tool, value, onPick, onClose }: { tool: Tool; value: Size; onPick: (z: Size) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("[aria-checked='true']")?.focus();
  }, []);
  return (
    <>
      <div className={s.menuScrim} onPointerDown={onClose} aria-hidden />
      <div
        ref={ref}
        className={s.sizeMenu}
        role="radiogroup"
        aria-label={`${tool.name} size`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {tool.sizes.map((z) => (
          <button key={z} type="button" role="radio" aria-checked={z === value} className={s.sizeOption} onClick={() => onPick(z)}>
            <SizeGlyph z={z} />
            <span className={s.sizeText}>
              <span className={s.sizeName}>{SIZE_NAME[z]}</span>
              <span className={s.sizeHint}>{SIZE_HINT[z]}</span>
            </span>
            {z === value && <CheckIcon />}
          </button>
        ))}
      </div>
    </>
  );
}

/* ── add cell, placeholder, suggestion ───────────────────────────── */

export function AddCell({ onClick, open }: { onClick: () => void; open: boolean }) {
  return (
    <motion.div layout className={cx(s.cell, s.sizeS)} transition={{ layout: { type: "spring", stiffness: 520, damping: 42 } }}>
      <button type="button" className={s.addCell} onClick={onClick} aria-expanded={open}>
        <span className={s.addPlus}>
          <PlusIcon size={18} />
        </span>
        <span className={s.addText}>Add a tool</span>
      </button>
      <span className={s.labelSpacer} aria-hidden />
    </motion.div>
  );
}

export function Placeholder({ size, tool }: { size: Size; tool: ToolId }) {
  const t = toolById(tool);
  return (
    <motion.div
      layout
      className={cx(s.cell, sizeClass(size))}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ layout: { type: "spring", stiffness: 520, damping: 42 }, duration: 0.16 }}
    >
      <div className={s.placeholder}>
        <span className={s.tile} style={{ background: hueVar(t.hue) }}>
          <Glyph id={t.id} size={13} />
        </span>
        <span className={s.placeholderText}>Drop to add {t.name}</span>
      </div>
      <span className={s.labelSpacer} aria-hidden />
    </motion.div>
  );
}

export function SuggestionCell({ tool, title, reason, onPlace }: { tool: ToolId; title: string; reason: string; onPlace: () => void }) {
  const t = toolById(tool);
  return (
    <motion.div layout className={cx(s.cell, s.sizeM)} exit={{ opacity: 0, scale: 0.9 }} transition={{ layout: { type: "spring", stiffness: 520, damping: 42 } }}>
      <button type="button" className={s.suggest} onClick={onPlace}>
        <span className={s.suggestTile} style={{ color: hueVar(t.hue) }}>
          <Glyph id={t.id} size={18} />
        </span>
        <span className={s.suggestText}>
          <span className={s.suggestTitle}>{title}</span>
          <span className={s.suggestReason}>{reason}</span>
        </span>
        <span className={s.suggestGo}>Place it</span>
      </button>
      <span className={s.labelSpacer} aria-hidden />
    </motion.div>
  );
}

/* ── dock and dots ───────────────────────────────────────────────── */

const DOCK_HREF: Record<(typeof CORE_APPS)[number]["id"], string> = {
  tasks: PRODUCT_APP_PATHS.tasks,
  timeline: PRODUCT_APP_PATHS.timeline,
  notes: PRODUCT_APP_PATHS.notes,
  files: "/app/files",
};

export function Dock() {
  return (
    <nav className={s.dock} aria-label="Core apps">
      {CORE_APPS.map((a) => (
        <a key={a.id} href={DOCK_HREF[a.id]} className={s.dockApp}>
          <span className={s.dockTile} style={{ background: hueVar(a.hue) }}>
            <Glyph id={a.id} size={22} />
            {a.badge > 0 && (
              <span className={cx(s.dockBadge, s.num)} aria-label={a.badgeLabel}>
                {a.badge}
              </span>
            )}
          </span>
          <span className={s.dockName}>{a.name}</span>
        </a>
      ))}
    </nav>
  );
}

export type ScreenRef = { key: string; group: string; index: number; count: number; name: string; hue: string | null };

export function PageDots({ screens, current, onGo }: { screens: ScreenRef[]; current: number; onGo: (i: number) => void }) {
  return (
    <div className={s.dotsRow} role="group" aria-label="Pages">
      {screens.map((sc, i) => {
        const gap = i > 0 && screens[i - 1].group !== sc.group;
        return (
          <button
            key={sc.key}
            type="button"
            className={cx(s.pageDot, gap && s.pageDotGap)}
            aria-label={`${sc.name}${sc.count > 1 ? `, page ${sc.index + 1} of ${sc.count}` : ""}`}
            aria-current={i === current ? "page" : undefined}
            onClick={() => onGo(i)}
          >
            <span className={cx(s.pageDotMark, i === current && s.pageDotOn)} />
          </button>
        );
      })}
    </div>
  );
}

/* ── the drawer ──────────────────────────────────────────────────── */

type DrawerProps = {
  phone: boolean;
  target: ProjectId;
  fromAll: boolean;
  onTarget: (p: ProjectId) => void;
  isOn: (tool: ToolId, project: ProjectId) => boolean;
  onAdd: (tool: ToolId) => void;
  onClose: () => void;
  onDragTool: (tool: ToolId | null) => void;
};

export function ToolDrawer(d: DrawerProps) {
  const [q, setQ] = useState("");
  const project = projectById(d.target);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!d.phone) closeRef.current?.focus({ preventScroll: true });
  }, [d.phone]);

  const { good, rest } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (t: Tool) => !needle || t.name.toLowerCase().includes(needle) || t.line.toLowerCase().includes(needle);
    const all = TOOLS.filter(match);
    const g = all.filter((t) => t.goodFor.includes(project.kind));
    const r = all.filter((t) => !t.goodFor.includes(project.kind)).sort((a, b) => a.name.localeCompare(b.name));
    return { good: g, rest: r };
  }, [q, project.kind]);

  const row = (t: Tool) => {
    const on = d.isOn(t.id, d.target);
    return (
      <li key={t.id}>
        <div
          className={cx(s.drawerRow, on && s.drawerRowOn)}
          draggable={!on && !d.phone}
          onDragStart={(e: DragEvent<HTMLDivElement>) => {
            e.dataTransfer.setData("text/plain", t.id);
            e.dataTransfer.effectAllowed = "copy";
            const tile = e.currentTarget.querySelector<HTMLElement>("[data-drag-tile]");
            if (tile) e.dataTransfer.setDragImage(tile, 16, 16);
            d.onDragTool(t.id);
          }}
          onDragEnd={() => d.onDragTool(null)}
        >
          <span className={s.drawerTile} style={{ background: hueVar(t.hue) }} data-drag-tile>
            <Glyph id={t.id} size={18} />
          </span>
          <span className={s.drawerText}>
            <span className={s.drawerName}>{t.name}</span>
            <span className={s.drawerLine}>{t.line}</span>
          </span>
          {on ? (
            <span className={s.onMark}>
              <CheckIcon size={12} /> On
            </span>
          ) : (
            <span className={s.drawerAct}>
              <span className={s.offMark}>Off</span>
              <button type="button" className={s.addBtn} onClick={() => d.onAdd(t.id)} aria-label={`Add ${t.name} to ${project.name}`}>
                Add
              </button>
            </span>
          )}
        </div>
      </li>
    );
  };

  const body = (
    <>
      <div className={s.drawerHead}>
        {d.phone && <span className={s.grab} aria-hidden />}
        <div className={s.drawerTitleRow}>
          <h2 className={s.drawerTitle} id="c1-drawer-title">
            Add a tool
          </h2>
          <button ref={closeRef} type="button" className={d.phone ? s.doneBtn : s.iconBtn} onClick={d.onClose} aria-label={d.phone ? undefined : "Close"}>
            {d.phone ? "Done" : <CloseIcon />}
          </button>
        </div>
        {d.fromAll ? (
          <div className={s.targetRow} role="radiogroup" aria-label="Add to which Project">
            {PROJECTS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={p.id === d.target} className={s.targetChip} onClick={() => d.onTarget(p.id)}>
                <span className={s.headDot} style={{ background: hueVar(p.hue) }} aria-hidden />
                {p.name}
              </button>
            ))}
          </div>
        ) : (
          <p className={s.drawerSub}>
            For <span className={s.drawerSubStrong}>{project.name}</span>. {d.phone ? "Tap Add to place it." : "Drag one onto your page, or press Add."}
          </p>
        )}
        <label className={s.search}>
          <SearchIcon />
          <input className={s.searchInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tool" aria-label="Find a tool" />
        </label>
      </div>
      <div className={s.drawerScroll}>
        {good.length > 0 && (
          <section aria-labelledby="c1-good">
            <h3 className={s.drawerGroup} id="c1-good">
              {project.goodForLabel}
            </h3>
            <ul className={s.drawerList}>{good.map(row)}</ul>
          </section>
        )}
        {rest.length > 0 && (
          <section aria-labelledby="c1-every">
            <h3 className={s.drawerGroup} id="c1-every">
              Everything
            </h3>
            <ul className={s.drawerList}>{rest.map(row)}</ul>
          </section>
        )}
        {good.length + rest.length === 0 && <p className={s.drawerEmpty}>No tool called “{q}” yet. Tell us what you need at hello@signalstudio.ie.</p>}
        <p className={s.drawerFoot}>Every tool is included. Turning one off keeps its data.</p>
      </div>
    </>
  );

  if (d.phone) {
    return (
      <>
        <motion.div className={s.scrim} onClick={d.onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden />
        <motion.div
          className={s.sheet}
          role="dialog"
          aria-modal="true"
          aria-labelledby="c1-drawer-title"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 40 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 600) d.onClose();
          }}
          onKeyDown={(e) => e.key === "Escape" && d.onClose()}
        >
          {body}
        </motion.div>
      </>
    );
  }
  return (
    <motion.aside
      className={s.drawer}
      aria-labelledby="c1-drawer-title"
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      onKeyDown={(e) => e.key === "Escape" && d.onClose()}
    >
      {body}
    </motion.aside>
  );
}

/* ── tool sheet ──────────────────────────────────────────────────── */

type SheetProps = {
  w: Widget;
  phone: boolean;
  api: BodyApi;
  onClose: () => void;
  onTurnOff: (w: Widget) => void;
  onResize: (w: Widget, z: Size) => void;
};

export function ToolSheet({ w, phone, api, onClose, onTurnOff, onResize }: SheetProps) {
  const tool = toolById(w.tool);
  const project = projectById(w.project);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const locked = w.state === "locked";
  const preview: Size = tool.sizes.includes("l") ? "l" : tool.sizes.includes("m") ? "m" : "s";
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <>
      <motion.div className={s.scrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden />
      <motion.div
        ref={ref}
        tabIndex={-1}
        className={phone ? s.sheet : s.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c1-sheet-title"
        initial={phone ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={phone ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={phone ? { y: "100%" } : { opacity: 0, scale: 0.97 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38 }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {phone && <span className={s.grab} aria-hidden />}
        <div className={s.sheetHead}>
          <span className={s.drawerTile} style={{ background: hueVar(tool.hue) }}>
            <Glyph id={tool.id} size={18} />
          </span>
          <div className={s.drawerText}>
            <h2 className={s.sheetTitle} id="c1-sheet-title">
              {tool.name}
            </h2>
            <span className={s.drawerLine}>
              <span className={s.headDot} style={{ background: hueVar(project.hue) }} aria-hidden /> {project.name}
            </span>
          </div>
          <button type="button" className={phone ? s.doneBtn : s.iconBtn} onClick={onClose} aria-label={phone ? undefined : "Close"}>
            {phone ? "Done" : <CloseIcon />}
          </button>
        </div>
        <div className={s.sheetScroll}>
          {!locked && (
            <div className={cx(s.preview, preview === "l" ? s.previewL : preview === "m" ? s.previewM : s.previewS)}>
              <div className={s.card}>
                <div className={s.bodyWrap}>
                  <WidgetBody w={{ ...w, size: preview }} size={preview} showProject={false} api={api} />
                </div>
              </div>
            </div>
          )}
          <dl className={s.facts}>
            <div className={s.fact}>
              <dt className={s.factTerm}>What it does</dt>
              <dd className={s.factDef}>{tool.does}</dd>
            </div>
            <div className={s.fact}>
              <dt className={s.factTerm}>What it reads from</dt>
              <dd className={s.factDef}>{tool.reads}</dd>
            </div>
            <div className={s.fact}>
              <dt className={s.factTerm}>Who sees it</dt>
              <dd className={s.factDef}>{locked ? `Nobody. ${w.lockedBy} turned it off for ${project.name}. Ask ${w.lockedBy} to turn it back on.` : `Everyone in ${project.name}`}</dd>
            </div>
          </dl>
          {!locked && tool.sizes.length > 1 && (
            <div className={s.sheetSizes} role="radiogroup" aria-label="Size on your page">
              {tool.sizes.map((z) => (
                <button key={z} type="button" role="radio" aria-checked={z === w.size} className={s.sheetSize} onClick={() => onResize(w, z)}>
                  <SizeGlyph z={z} />
                  {SIZE_NAME[z]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={s.sheetFoot}>
          {locked ? (
            <span className={s.lockedNote}>
              <LockIcon /> Only {w.lockedBy} can turn this on
            </span>
          ) : (
            <button type="button" className={s.dangerBtn} onClick={() => onTurnOff(w)}>
              Turn off for {project.name}
            </button>
          )}
          <button type="button" className={s.primaryBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </motion.div>
    </>
  );
}
