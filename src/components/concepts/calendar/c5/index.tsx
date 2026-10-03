"use client";

import { AnimatePresence, MotionConfig, animate, motion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ITEMS, PROJECTS, projectById, type Item, type ProjectId } from "./data";
import { RiverCtx, readDrop, type MoveHow, type RiverApi } from "./ctx";
import {
  STREAM_END,
  STREAM_START,
  buildWeeks,
  fmtDay,
  inLens,
  itemsOnDay,
  loadOf,
  monthLong,
  plural,
  relDay,
  type Lens,
} from "./model";
import { HelpSheet, Icon, ProjectDot, Toast, type ToastState } from "./parts";
import { EmptyAhead, FirstRun, LensChips, LensRail, NeedsDate, type LensCount } from "./rail";
import { TimeScrubber, WeekStrip, type DayStat } from "./scrubber";
import { DaySection, QuietWeeks, WeekSection } from "./stream";
import styles from "./river.module.css";

type Drag = { id: string; x: number; y: number; over: number | "none" | null } | null;
type Preview = "filled" | "first";

let seq = 0;
const hit = (x: number, y: number) => readDrop(document.elementFromPoint(x, y));
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function AgendaRiver() {
  const [items, setItems] = useState<Item[]>(ITEMS);
  const [preview, setPreview] = useState<Preview>("filled");
  const [lens, setLensState] = useState<Lens>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openDays, setOpenDays] = useState<Set<number>>(() => new Set());
  const [composerDay, setComposerDay] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [visible, setVisible] = useState({ from: 0, to: 6 });
  const [todayDir, setTodayDir] = useState<"up" | "down" | null>(null);
  const [arrivedDay, setArrivedDay] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [needsOpen, setNeedsOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const flight = useRef<AnimationPlaybackControls | null>(null);
  const measureFrame = useRef(0);
  const dragRef = useRef<{ id: string; over: number | "none" | null; x: number; y: number } | null>(null);
  const autoFrame = useRef(0);
  const toastTimer = useRef(0);
  const arrivedTimer = useRef(0);
  const lastUndo = useRef<(() => void) | null>(null);

  // ── Derived ───────────────────────────────────────────────────────
  const firstRun = !items.some((i) => i.day !== undefined);
  const noneAhead = !items.some((i) => i.day !== undefined && inLens(i, lens) && (i.endDay ?? i.day) >= 0);
  const sections = useMemo(() => buildWeeks(items, lens, { stopAfterToday: noneAhead }), [items, lens, noneAhead]);
  const undated = useMemo(() => items.filter((i) => i.day === undefined), [items]);

  const statMap = useMemo(() => {
    const m = new Map<number, DayStat>();
    for (let d = STREAM_START; d <= STREAM_END + 7; d++) {
      const occ = itemsOnDay(items, d, lens);
      const tasks = occ.filter((o) => o.item.kind === "task").length;
      const events = occ.filter((o) => o.item.kind === "event").length;
      const ms = occ.filter((o) => o.item.kind === "milestone");
      const bits = [tasks && plural(tasks, "task"), events && plural(events, "event")].filter(Boolean) as string[];
      if (ms.length) bits.unshift(ms[0].item.title);
      m.set(d, {
        load: loadOf(occ),
        label: bits.length ? bits.join(" · ") : "Nothing planned",
        milestones: ms.map((o) => projectById[o.item.project].color),
      });
    }
    return m;
  }, [items, lens]);
  const stats = useCallback((d: number): DayStat => statMap.get(d) ?? { load: 0, label: "Nothing planned", milestones: [] }, [statMap]);

  const counts = useMemo(() => {
    const c = { all: 0, mine: 0 } as LensCount;
    for (const p of PROJECTS) c[p.id] = 0;
    for (const i of items) {
      if (i.day === undefined || (i.endDay ?? i.day) < 0 || i.done || i.kind === "milestone") continue;
      c.all++;
      if (inLens(i, "mine")) c.mine++;
      c[i.project]++;
    }
    return c;
  }, [items]);

  // ── Measuring what is on screen ───────────────────────────────────
  const stickH = () => barRef.current?.offsetHeight ?? 0;

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const top = r.top + stickH() + 28;
    const bottom = r.bottom;
    let from: number | null = null;
    let to: number | null = null;
    root.querySelectorAll<HTMLElement>("[data-block]").forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.bottom > top && b.top < bottom) {
        const f = Number(el.dataset.from);
        const t = Number(el.dataset.to);
        if (from === null) {
          // If a block is mostly scrolled past, count from where the eye is.
          from = f;
        }
        to = t;
      }
    });
    if (from !== null && to !== null) {
      const next = { from, to };
      setVisible((v) => (v.from === next.from && v.to === next.to ? v : next));
    }
    const todayEl = root.querySelector("#river-day-0");
    let dir: "up" | "down" | null = null;
    if (todayEl) {
      const b = todayEl.getBoundingClientRect();
      if (b.bottom < top + 24) dir = "up";
      else if (b.top > bottom - 24) dir = "down";
    }
    setTodayDir(dir);
  }, []);

  const onScroll = () => {
    if (!anchored.current && rootRef.current && rootRef.current.scrollTop > 0) anchored.current = true;
    cancelAnimationFrame(measureFrame.current);
    measureFrame.current = requestAnimationFrame(measure);
  };

  const anchored = useRef(false);
  const anchorToday = () => {
    const root = rootRef.current;
    const el = root?.querySelector<HTMLElement>("#river-day-0");
    if (!root || !el) return;
    const y = root.scrollTop + el.getBoundingClientRect().top - root.getBoundingClientRect().top - (barRef.current?.offsetHeight ?? 0) + 1;
    root.scrollTop = y;
    if (y <= 0 || Math.abs(root.scrollTop - y) < 2) anchored.current = true;
  };

  // Keep sticky offsets and the rail height in CSS custom properties.
  useEffect(() => {
    const root = rootRef.current;
    const bar = barRef.current;
    if (!root || !bar) return;
    const ro = new ResizeObserver(() => {
      if (!anchored.current) anchorToday();
      root.style.setProperty("--river-h", `${root.clientHeight}px`);
      root.style.setProperty("--stick", `${bar.offsetHeight}px`);
      cancelAnimationFrame(measureFrame.current);
      measureFrame.current = requestAnimationFrame(measure);
    });
    ro.observe(root);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [measure]);

  // ── Flying through time ───────────────────────────────────────────
  const targetFor = useCallback((day: number) => {
    const root = rootRef.current;
    if (!root) return null;
    let el: HTMLElement | null = null;
    let best: HTMLElement | null = null;
    root.querySelectorAll<HTMLElement>("[data-block]").forEach((b) => {
      const f = Number(b.dataset.from);
      const t = Number(b.dataset.to);
      if (day >= f && day <= t) el = b;
      if (f <= day) best = b;
    });
    const target = (el ?? best) as HTMLElement | null;
    if (!target) return null;
    const y = root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - stickH() + 1;
    return { y: Math.max(0, Math.min(y, root.scrollHeight - root.clientHeight)), isDay: target.id.startsWith("river-day-") };
  }, []);

  const flyTo = useCallback(
    (day: number, mode: "drag" | "settle" | "instant") => {
      const root = rootRef.current;
      const t = targetFor(day);
      if (!root || !t) return;
      flight.current?.stop();
      if (mode === "instant" || reducedMotion()) {
        root.scrollTop = t.y;
      } else {
        flight.current = animate(root.scrollTop, t.y, {
          type: "spring",
          stiffness: mode === "drag" ? 320 : 150,
          damping: mode === "drag" ? 38 : 21,
          mass: 1,
          restDelta: 0.5,
          onUpdate: (v) => {
            root.scrollTop = v;
          },
        });
      }
      if (mode === "settle" && t.isDay) {
        window.clearTimeout(arrivedTimer.current);
        setArrivedDay(day);
        arrivedTimer.current = window.setTimeout(() => setArrivedDay(null), 1100);
      }
    },
    [targetFor],
  );

  // Open on today, with the past tucked above. The shell may still be
  // sizing the page on first paint, so keep trying until today sits on top.
  useLayoutEffect(() => {
    anchorToday();
    const f = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(f);
    // Only on first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(arrivedTimer.current);
      cancelAnimationFrame(autoFrame.current);
      cancelAnimationFrame(measureFrame.current);
      flight.current?.stop();
    },
    [],
  );

  const setLens = (l: Lens) => {
    setLensState(l);
    setExpandedId(null);
    requestAnimationFrame(() => {
      flyTo(0, "instant");
      measure();
    });
  };

  // ── Changes ───────────────────────────────────────────────────────
  const say = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(toastTimer.current);
    lastUndo.current = undo ?? null;
    setToast({ id: ++seq, text, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 5200);
  }, []);

  const move = useCallback(
    (id: string, day: number | undefined, how: MoveHow) => {
      const it = items.find((i) => i.id === id);
      if (!it || it.day === day) return;
      const prev = { day: it.day, endDay: it.endDay };
      const len = it.endDay !== undefined && it.day !== undefined ? it.endDay - it.day : undefined;
      setItems((list) =>
        list.map((i) => (i.id === id ? { ...i, day, endDay: len !== undefined && day !== undefined ? day + len : i.endDay } : i)),
      );
      if (how !== "key") setExpandedId(null);
      const where = day === undefined ? "back to Needs a date" : `to ${relDay(day) === "Today" || relDay(day) === "Tomorrow" ? relDay(day).toLowerCase() : fmtDay(day)}`;
      say(`Moved “${it.title}” ${where}`, () => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...prev } : i))));
    },
    [items, say],
  );

  const toggleDone = useCallback(
    (id: string) => {
      const it = items.find((i) => i.id === id);
      if (!it) return;
      setItems((list) => list.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
      if (!it.done) say(`Done: ${it.title}`, () => setItems((list) => list.map((i) => (i.id === id ? { ...i, done: false } : i))));
    },
    [items, say],
  );

  const add = useCallback(
    (day: number, title: string, project: ProjectId, start?: number) => {
      const item: Item = {
        id: `new-${++seq}`,
        kind: start !== undefined ? "event" : "task",
        title,
        project,
        day,
        start,
        end: start !== undefined ? start + 60 : undefined,
        people: ["you"],
      };
      setItems((list) => [...list, item]);
      say(`Added to ${fmtDay(day)} in ${projectById[project].short}`, () => setItems((list) => list.filter((i) => i.id !== item.id)));
    },
    [say],
  );

  const rename = useCallback((id: string, title: string) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, title } : i)));
  }, []);

  // ── Drag to reschedule ────────────────────────────────────────────

  const dragStart = useCallback((id: string, x: number, y: number) => {
    flight.current?.stop();
    dragRef.current = { id, over: null, x, y };
    setDrag({ id, x, y, over: null });
    setExpandedId(null);
    setComposerDay(null);
    cancelAnimationFrame(autoFrame.current);
    // Scroll the river when the pointer rests near its top or bottom edge.
    const tick = () => {
      const root = rootRef.current;
      const d = dragRef.current;
      if (!root || !d) return;
      const r = root.getBoundingClientRect();
      const top = r.top + (barRef.current?.offsetHeight ?? 0);
      const edge = 72;
      let v = 0;
      if (d.y < top + edge) v = -Math.ceil(((top + edge - d.y) / edge) * 18);
      else if (d.y > r.bottom - edge) v = Math.ceil(((d.y - (r.bottom - edge)) / edge) * 18);
      if (v) {
        root.scrollTop += v;
        const over = hit(d.x, d.y);
        if (over !== d.over) {
          d.over = over;
          setDrag((s) => (s ? { ...s, over } : s));
        }
      }
      autoFrame.current = requestAnimationFrame(tick);
    };
    autoFrame.current = requestAnimationFrame(tick);
  }, []);

  const dragMove = useCallback((x: number, y: number) => {
    const d = dragRef.current;
    if (!d) return;
    d.x = x;
    d.y = y;
    d.over = hit(x, y);
    const over = d.over;
    setDrag((s) => (s ? { ...s, x, y, over } : s));
  }, []);

  const dragEnd = useCallback(
    (commit: boolean) => {
      cancelAnimationFrame(autoFrame.current);
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d || !commit || d.over === null) return;
      move(d.id, d.over === "none" ? undefined : d.over, "drag");
    },
    [move],
  );

  const dragItem = drag ? items.find((i) => i.id === drag.id) : undefined;

  // ── Keyboard ──────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || isTyping(e.target)) return;
    const root = rootRef.current;
    if (!root) return;
    // Listen page-wide, but leave the app's own chrome alone.
    const t = e.target as Node | null;
    if (t && t !== document.body && !root.contains(t)) return;
    if (help && e.key !== "Escape") return;
    const active = document.activeElement as HTMLElement | null;
    const row = active?.closest<HTMLElement>("[data-row]") ?? null;
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-row]"));
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === "z") {
      if (lastUndo.current) {
        e.preventDefault();
        lastUndo.current();
        lastUndo.current = null;
        setToast(null);
      }
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "?") {
      e.preventDefault();
      setHelp(true);
      return;
    }
    if (k === "t") {
      e.preventDefault();
      flyTo(0, "settle");
      return;
    }
    if (k === "j" || k === "k" || ((e.key === "ArrowDown" || e.key === "ArrowUp") && row)) {
      e.preventDefault();
      const down = k === "j" || e.key === "ArrowDown";
      let idx = row ? rows.indexOf(row) + (down ? 1 : -1) : -1;
      if (!row) {
        const top = root.getBoundingClientRect().top + stickH();
        idx = rows.findIndex((r) => r.getBoundingClientRect().top > top);
      }
      rows[Math.max(0, Math.min(rows.length - 1, idx))]?.focus();
      return;
    }
    if (k === "n") {
      e.preventDefault();
      const day = row ? Number(row.dataset.day) : Math.max(0, visible.from);
      setComposerDay(day);
      return;
    }
    if (e.key === "Escape") {
      setExpandedId(null);
      setComposerDay(null);
      return;
    }
    if (!row) return;
    const id = row.dataset.id!;
    const day = Number(row.dataset.day);
    if (k === "x") {
      e.preventDefault();
      toggleDone(id);
    } else if (k === "d" || k === "w") {
      e.preventDefault();
      const idx = rows.indexOf(row);
      const nextFocus = rows[idx + 1] ?? rows[idx - 1];
      const nextId = nextFocus?.dataset.id;
      move(id, day + (k === "d" ? 1 : 7), "key");
      requestAnimationFrame(() => {
        if (nextId) root.querySelector<HTMLElement>(`[data-row][data-id="${nextId}"]`)?.focus({ preventScroll: true });
      });
    }
  };

  const keyRef = useRef(onKeyDown);
  useEffect(() => {
    keyRef.current = onKeyDown;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const api: RiverApi = {
    lens,
    expandedId,
    openDays,
    dragId: drag?.id ?? null,
    overDay: drag?.over ?? null,
    arrivedDay,
    toggleDone,
    move,
    rename,
    add,
    toggleExpand: (id) => setExpandedId((cur) => (cur === id ? null : id)),
    toggleDay: (day) =>
      setOpenDays((s) => {
        const n = new Set(s);
        if (n.has(day)) n.delete(day);
        else n.add(day);
        return n;
      }),
    dragStart,
    dragMove,
    dragEnd,
    isPhone: () => (rootRef.current?.clientWidth ?? 1000) < 720,
    composerDay,
    setComposerDay,
    items,
  };

  const monthLabel = `${monthLong(Math.max(STREAM_START, visible.from))} 2026`;
  const switchPreview = (p: Preview) => {
    setPreview(p);
    setItems(p === "first" ? ITEMS.filter((i) => i.day === undefined) : ITEMS);
    setLensState("all");
    setExpandedId(null);
    setOpenDays(new Set());
    requestAnimationFrame(() => {
      flyTo(0, "instant");
      measure();
    });
  };

  return (
    <RiverCtx.Provider value={api}>
      <MotionConfig reducedMotion="user">
        <div
          ref={rootRef}
          className={cx(styles.root, drag && styles.rootDragging)}
          onScroll={onScroll}
        >
          <div className={styles.layout}>
            <LensRail lens={lens} setLens={setLens} counts={counts} undated={undated} firstRun={firstRun} />

            <div className={styles.streamCol}>
              <div ref={barRef} className={styles.bar}>
                <div className={styles.barTop}>
                  <div className={styles.titleBlock}>
                    <h1 className={styles.h1}>Calendar</h1>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={monthLabel}
                        className={styles.monthLabel}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                      >
                        {monthLabel}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  <div className={styles.actions}>
                    <label className={styles.preview}>
                      <span className={styles.previewLabel}>Preview</span>
                      <select className={styles.previewSelect} value={preview} onChange={(e) => switchPreview(e.target.value as Preview)}>
                        <option value="filled">A busy month</option>
                        <option value="first">First day, nothing dated</option>
                      </select>
                      <Icon name="chevron-down" size={12} className={styles.previewChevron} />
                    </label>
                    <button type="button" className={styles.btn} onClick={() => flyTo(0, "settle")}>
                      Today
                    </button>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => {
                        const d = Math.max(0, visible.from);
                        setComposerDay(d);
                        flyTo(d, "settle");
                      }}
                    >
                      <Icon name="plus" size={14} />
                      <span className={styles.btnPrimaryLabel}>Add</span>
                    </button>
                    <button type="button" className={cx(styles.iconBtn, styles.helpBtn)} onClick={() => setHelp(true)} aria-label="Keyboard shortcuts">
                      <Icon name="keyboard" size={16} />
                    </button>
                  </div>
                </div>
                <div className={styles.chipsRow}>
                  <LensChips lens={lens} setLens={setLens} counts={counts} />
                  <button
                    type="button"
                    className={cx(styles.needsChip, needsOpen && styles.needsChipOn)}
                    onClick={() => setNeedsOpen((o) => !o)}
                    aria-expanded={needsOpen}
                  >
                    Needs a date <span className={styles.needsChipCount}>{undated.length}</span>
                  </button>
                </div>
                <div className={styles.stripRow}>
                  <WeekStrip focus={Math.max(STREAM_START, visible.from)} stats={stats} onFly={flyTo} />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {needsOpen && (
                  <motion.div
                    className={styles.needsDrawer}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <NeedsDate undated={undated} inline />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className={styles.stream}>
                {firstRun ? (
                  <>
                    <DaySection block={{ kind: "day", key: "d0", day: 0, occ: [] }} />
                    <FirstRun undated={undated} />
                  </>
                ) : (
                  <>
                    {sections.map((s) => (s.kind === "week" ? <WeekSection key={s.key} week={s} /> : <QuietWeeks key={s.key} block={s} />))}
                    {noneAhead ? (
                      <EmptyAhead lens={lens} onReset={() => setLens("all")} />
                    ) : (
                      <p className={styles.streamEnd}>
                        <span className={styles.streamEndRule} aria-hidden="true" />
                        That is everything planned up to {fmtDay(STREAM_END)}.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className={styles.dock}>
                <AnimatePresence>
                  {todayDir && !drag && (
                    <motion.button
                      type="button"
                      className={styles.todayPill}
                      onClick={() => flyTo(0, "settle")}
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 480, damping: 34 }}
                    >
                      <Icon name={todayDir === "up" ? "arrow-up" : "arrow-down"} size={14} />
                      Back to today
                    </motion.button>
                  )}
                </AnimatePresence>
                <Toast toast={toast} onClose={() => setToast(null)} />
              </div>
            </div>

            <div className={styles.scrubCol}>
              <TimeScrubber stats={stats} visible={visible} onFly={flyTo} dragActive={!!drag} overDay={drag?.over ?? null} />
            </div>
          </div>

          {drag && dragItem && (
            <div className={styles.ghost} style={{ transform: `translate(${drag.x + 14}px, ${drag.y - 18}px)` }} aria-hidden="true">
              <ProjectDot project={dragItem.project} />
              <span className={styles.ghostTitle}>{dragItem.title}</span>
              <span className={styles.ghostTarget}>
                {drag.over === null ? "Drop on a day" : drag.over === "none" ? "Needs a date" : relDay(drag.over)}
              </span>
            </div>
          )}

          <HelpSheet open={help} onClose={() => setHelp(false)} />
        </div>
      </MotionConfig>
    </RiverCtx.Provider>
  );
}
