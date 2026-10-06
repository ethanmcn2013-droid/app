"use client";

/**
 * All projects: a calm wall of identical small multiples on shared scales,
 * with one crosshair that lights the same week on every card. Open a card to
 * read it in place; from there, ask about it or replay it.
 */

import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { askAbout, replayOf, useGoLens } from "./nav";
import { setScope, useAnalytics } from "./store";
import { CompareList, Table, sortRows, type ColKey, type ColSort } from "./wall-table";
import { Card, Detail, FinishedRow, PhoneRow } from "./wall-cards";
import { Keyboard, Pin, TableIcon, WallIcon } from "./wall-icons";
import { useWorld } from "./live";
import {
  PERIODS,
  SORTS,
  THIS_WEEK,
  WEEKS,
  derive,
  fmtDay,
  ownMax,
  plural,
  sharedMax,
  sortBy,
  weekLabel,
  weekStart,
  weekSummary,
  type Derived,
  type Period,
  type SortKey,
} from "./wall-model";
import s from "./wall.module.css";

type View = "wall" | "table";

const SHORTCUTS: [string, string][] = [
  ["← → ↑ ↓", "Move between cards"],
  ["Enter", "Open a card in place"],
  ["Esc", "Close it, or clear a pinned week"],
  ["Shift ← →", "Step the highlighted week"],
  ["T", "Switch wall and table"],
  ["S", "Next sort order"],
  ["1 2 3", "6 weeks, 12 weeks, 6 months"],
  ["?", "Show or hide these keys"],
];

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

export function WallLens() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { scope } = useAnalytics();
  const goLens = useGoLens();
  const { wall: projects, finished: wrapped } = useWorld();
  const [period, setPeriod] = useState<Period>(6);
  const [sort, setSort] = useState<SortKey>("look");
  const [colSort, setColSort] = useState<ColSort>(null);
  const [same, setSame] = useState(true);
  const [view, setView] = useState<View>("wall");
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [compareBy, setCompareBy] = useState<ColKey>("left");

  // The open card is the project in scope, so the picker and the wall agree.
  const expanded = projects.some((p) => p.id === scope) ? scope : null;
  const setExpanded = (id: string | null) => setScope(id ?? "all");

  const week = hoverWeek ?? pinned;

  const derived = useMemo(() => projects.map((p) => derive(p, period)), [projects, period]);
  const rows = useMemo(() => sortBy(derived, sort), [derived, sort]);
  const tableRows = useMemo(() => sortRows(rows, colSort, period), [rows, colSort, period]);
  const max = useMemo(() => {
    const m = sharedMax(derived, period);
    return Math.max(m, ...wrapped.flatMap((f) => f.finished.slice(WEEKS - period)));
  }, [derived, period, wrapped]);
  const maxFor = (d: Derived) => (same ? max : ownMax(d, period));

  /* ── actions ───────────────────────────────────────────────────────── */

  const focusCard = (id: string) => {
    requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(`[data-card="${CSS.escape(id)}"]`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };
  const openCard = (id: string) => {
    setExpanded(expanded === id ? null : id);
    focusCard(id);
  };
  const cycleSort = () => {
    setColSort(null);
    setSort((cur) => SORTS[(SORTS.findIndex((x) => x.value === cur) + 1) % SORTS.length].value);
  };
  const pinWeek = (w: number) => setPinned((cur) => (cur === w ? null : w));
  const onAsk = (id: string) => {
    askAbout(id, "on-course", "Asked from All projects.");
    goLens("ask");
  };
  const onReplay = (id: string) => {
    replayOf(id);
    goLens("replay");
  };

  // Arriving with a project in scope: bring its card into view.
  useEffect(() => {
    if (expanded) focusCard(expanded);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveFocus = (key: string) => {
    const root = rootRef.current;
    if (!root) return false;
    const cards = [...root.querySelectorAll<HTMLElement>("[data-card]")].filter((el) => el.offsetParent !== null);
    if (!cards.length) return false;
    const current = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-card]");
    if (!current || !cards.includes(current)) {
      cards[0].focus();
      return true;
    }
    const r = current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const el of cards) {
      if (el === current) continue;
      const b = el.getBoundingClientRect();
      const dx = b.left + b.width / 2 - cx;
      const dy = b.top + b.height / 2 - cy;
      const sameRow = Math.abs(b.top - r.top) < 24;
      let score = Infinity;
      if (key === "ArrowRight" && sameRow && dx > 0) score = dx;
      if (key === "ArrowLeft" && sameRow && dx < 0) score = -dx;
      if (key === "ArrowDown" && b.top > r.top + 8) score = dy * 4 + Math.abs(dx);
      if (key === "ArrowUp" && b.top < r.top - 8) score = -dy * 4 + Math.abs(dx);
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (!best && (key === "ArrowRight" || key === "ArrowLeft")) {
      const i = cards.indexOf(current) + (key === "ArrowRight" ? 1 : -1);
      best = cards[i] ?? null;
    }
    if (best) {
      best.focus({ preventScroll: true });
      best.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    return true;
  };

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTyping(e.target)) {
      if (e.key === "Escape") (e.target as HTMLElement).blur();
      return;
    }
    // Keys inside an open menu belong to the menu.
    if ((e.target as HTMLElement | null)?.closest("[role=menu]")) return;
    const k = e.key;
    if (k === "?") {
      setHelp((h) => !h);
      e.preventDefault();
    } else if (k === "Escape") {
      if (help) setHelp(false);
      else if (expanded) {
        const id = expanded;
        setExpanded(null);
        focusCard(id);
      } else if (pinned !== null) setPinned(null);
    } else if (k === "t" || k === "T") {
      setView((v) => (v === "wall" ? "table" : "wall"));
    } else if (k === "s" || k === "S") {
      cycleSort();
    } else if (k === "1" || k === "2" || k === "3") {
      setPeriod(PERIODS[Number(k) - 1].value);
    } else if (e.shiftKey && (k === "ArrowLeft" || k === "ArrowRight")) {
      e.preventDefault();
      const from = WEEKS - period;
      const cur = week ?? THIS_WEEK;
      setPinned(Math.max(from, Math.min(THIS_WEEK, cur + (k === "ArrowRight" ? 1 : -1))));
    } else if (view === "wall" && k.startsWith("Arrow")) {
      const t = e.target as HTMLElement;
      if (t.tagName === "BUTTON" && !t.closest("[data-card]")) return;
      if (t.tagName === "A") return;
      if (moveFocus(k)) e.preventDefault();
    }
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* ── readout ───────────────────────────────────────────────────────── */

  const readWeek = week ?? THIS_WEEK - 1;
  const sum = weekSummary(derived, readWeek);
  const readout = (
    <>
      <b>{week === null ? `Last week, ${fmtDay(weekStart(readWeek))}` : weekLabel(readWeek)}:</b> {plural(sum.total, "task")} finished across all projects
      {sum.topProject && sum.total > 0 ? (
        <>
          , most in {sum.topProject.p.short} <span className={s.readNum}>({sum.topProject.p.finished[readWeek]})</span>
        </>
      ) : null}
      .{readWeek === THIS_WEEK ? <span className={s.readSub}> This week is five days in.</span> : null}
      {week === null ? <span className={s.readSub}> This week so far: {weekSummary(derived, THIS_WEEK).total}.</span> : null}
    </>
  );

  const shared = { period, same, week, onWeek: setHoverWeek, onPin: pinWeek, onAsk, onReplay };

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} className={`${s.page} v3-focus`}>
        <div className={s.inner}>
          <div className={s.sticky}>
            <div className={s.controls} role="toolbar" aria-label="Wall controls">
              <div className={s.seg} role="radiogroup" aria-label="Period">
                {PERIODS.map((p) => (
                  <button key={p.value} type="button" role="radio" aria-checked={period === p.value} className={s.segBtn} onClick={() => setPeriod(p.value)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <label className={s.sortPick}>
                <span className={s.sortLabel}>Sort</span>
                <select
                  className={s.sortSelect}
                  value={colSort ? "" : sort}
                  onChange={(e) => {
                    setColSort(null);
                    setSort(e.target.value as SortKey);
                  }}
                >
                  {colSort && <option value="">By column</option>}
                  {SORTS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" role="switch" aria-checked={same} className={s.switch} onClick={() => setSame((v) => !v)}>
                <span className={s.switchTrack} aria-hidden>
                  <span className={s.switchThumb} />
                </span>
                Same scale
              </button>
              <span className={s.barSpacer} />
              <div className={s.seg} role="radiogroup" aria-label="View">
                <button type="button" role="radio" aria-checked={view === "wall"} className={s.segBtn} onClick={() => setView("wall")}>
                  <WallIcon /> <span className={s.segText}>Wall</span>
                </button>
                <button type="button" role="radio" aria-checked={view === "table"} className={s.segBtn} onClick={() => setView("table")}>
                  <TableIcon /> <span className={s.segText}>Table</span>
                </button>
              </div>
              <div className={s.helpWrap}>
                <button type="button" className={s.helpBtn} aria-expanded={help} aria-controls="analytics-wall-keys" onClick={() => setHelp((h) => !h)}>
                  <Keyboard />
                  <span className={s.srOnly}>Keyboard shortcuts</span>
                  <kbd className={s.kbd}>?</kbd>
                </button>
                <AnimatePresence>
                  {help && (
                    <motion.div
                      id="analytics-wall-keys"
                      className={s.helpPop}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16 }}
                      role="dialog"
                      aria-label="Keyboard shortcuts"
                    >
                      <p className={s.helpTitle}>Keyboard</p>
                      <dl className={s.helpList}>
                        {SHORTCUTS.map(([k, v]) => (
                          <div key={k}>
                            <dt>
                              <kbd className={s.kbd}>{k}</kbd>
                            </dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className={s.strip} aria-live="polite">
              <span className={s.stripDot} data-on={week !== null || undefined} aria-hidden />
              <p className={s.stripText}>{readout}</p>
              {pinned !== null ? (
                <button type="button" className={s.pinBtn} onClick={() => setPinned(null)}>
                  <Pin /> Pinned · Clear
                </button>
              ) : (
                <span className={s.stripHint}>Point at any week to line it up on every card. Click to pin.</span>
              )}
            </div>
            <AnimatePresence initial={false}>
              {!same && (
                <motion.div
                  className={s.scaleNoteBar}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <p>
                    <b>Each card now has its own scale.</b> Small projects look as busy as big ones, so compare shapes here, not heights.
                  </p>
                  <button type="button" className={s.smallGhost} onClick={() => setSame(true)}>
                    Back to one scale
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {view === "wall" ? (
            <>
              <LayoutGroup>
                <div className={s.wall}>
                  {rows.map((d) => {
                    const isOpen = expanded === d.p.id;
                    return (
                      <motion.div key={d.p.id} layout="position" className={isOpen ? s.cellWide : s.cell} transition={{ type: "spring", stiffness: 520, damping: 44, mass: 0.8 }}>
                        {isOpen ? (
                          <Detail d={d} max={max} onClose={() => openCard(d.p.id)} {...shared} />
                        ) : (
                          <Card d={d} compact={expanded !== null} onOpen={() => openCard(d.p.id)} max={maxFor(d)} {...shared} />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </LayoutGroup>
              <ol className={s.phoneList}>
                {rows.map((d) => (
                  <li key={d.p.id} className={s.phoneItem}>
                    <PhoneRow d={d} period={period} max={maxFor(d)} week={week} open={expanded === d.p.id} onOpen={() => openCard(d.p.id)} />
                    {expanded === d.p.id && <Detail d={d} max={max} onClose={() => openCard(d.p.id)} {...shared} />}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <div className={s.tableOnly}>
                <Table rows={tableRows} period={period} max={max} week={week} sort={colSort} onSort={setColSort} onWeek={setHoverWeek} onPin={pinWeek} />
              </div>
              <div className={s.compareOnly}>
                <CompareList rows={rows} period={period} by={compareBy} onBy={setCompareBy} />
              </div>
            </>
          )}

          {wrapped.length > 0 && (
            <section className={s.finishedSec} aria-labelledby="analytics-finished">
              <h2 id="analytics-finished" className={s.secTitle}>
                Wrapped
              </h2>
              {wrapped.map((f) => (
                <FinishedRow key={f.id} f={f} max={max} period={period} onAsk={onAsk} onReplay={onReplay} />
              ))}
            </section>
          )}

          <footer className={s.foot2}>
            <div className={s.method}>
              <p>
                <b>How to read this.</b> All {projects.length} active projects, the same ones Projects lists. Every bar chart shares one scale unless you switch it off, so a
                tall bar always means more finished; its axis runs from the first week shown to this week. The strip under it runs from today across the next 13 weeks: the dot is
                when the work due by the big date likely runs out at the last 7 days&rsquo; pace, the tall mark is the big date. On track, at risk or off track is what each project lead has set.
              </p>
            </div>
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}
