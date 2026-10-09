"use client";

import {
  AnimatePresence,
  LayoutGroup,
  MotionConfig,
  motion,
} from "motion/react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  RECENTLY_FINISHED,
  THIS_WEEK,
  WEEKS,
  fmtDay,
  projectsFor,
  weekStart,
  type Client,
  type Scenario,
} from "./data";
import { Keyboard, Pin, Search, TableIcon, WallIcon } from "./icons";
import {
  PERIODS,
  SORTS,
  STATUS_WORD,
  derive,
  ownMax,
  plural,
  sharedMax,
  sortBy,
  weekLabel,
  weekSummary,
  type Derived,
  type Period,
  type SortKey,
  type Status,
} from "./model";
import {
  CompareList,
  Table,
  sortRows,
  type ColKey,
  type ColSort,
} from "./table";
import { Card, Detail, FinishedRow, PhoneRow } from "./wall";
import s from "./c6.module.css";

type View = "wall" | "table";

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "normal", label: "9 projects" },
  { value: "single", label: "1 project" },
  { value: "many", label: "38 projects" },
];

const SHORTCUTS: [string, string][] = [
  ["← → ↑ ↓", "Move between cards"],
  ["Enter", "Open a card in place"],
  ["Esc", "Close it, or clear a pinned week"],
  ["Shift ← →", "Step the highlighted week"],
  ["T", "Switch wall and table"],
  ["S", "Next sort order"],
  ["1 2 3", "4 weeks, 12 weeks, 6 months"],
  ["?", "Show or hide these keys"],
];

const STATUS_ORDER: Status[] = [
  "behind",
  "watch",
  "course",
  "new",
  "nodate",
  "empty",
];

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "SELECT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  );
}

export default function AllProjectsWall() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [period, setPeriod] = useState<Period>(12);
  const [sort, setSort] = useState<SortKey>("date");
  const [colSort, setColSort] = useState<ColSort>(null);
  const [same, setSame] = useState(true);
  const [view, setView] = useState<View>("wall");
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [client, setClient] = useState<Client | "all">("all");
  const [query, setQuery] = useState("");
  const [dates, setDates] = useState<Record<string, number | null>>({});
  const [compareBy, setCompareBy] = useState<ColKey>("left");

  const week = hoverWeek ?? pinned;

  const base = useMemo(() => projectsFor(scenario), [scenario]);
  const derived = useMemo(
    () =>
      base.map((p) => {
        const set = dates[p.id];
        return derive(
          set === undefined
            ? p
            : { ...p, bigDate: set, dateLabel: p.dateLabel ?? "Big date" },
          period,
        );
      }),
    [base, dates, period],
  );
  const many = base.length > 12;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return derived.filter(
      (d) =>
        (client === "all" || d.p.client === client) &&
        (!q || d.p.name.toLowerCase().includes(q)),
    );
  }, [derived, client, query]);
  const rows = useMemo(() => sortBy(visible, sort), [visible, sort]);
  const tableRows = useMemo(
    () => sortRows(rows, colSort, period),
    [rows, colSort, period],
  );
  const showFinished =
    scenario !== "single" && client !== "Northgate" && client !== "Hollow Lane";
  const max = useMemo(() => {
    const m = sharedMax(visible, period);
    if (!showFinished) return m;
    return Math.max(m, ...RECENTLY_FINISHED.finished.slice(WEEKS - period));
  }, [visible, period, showFinished]);
  const maxFor = (d: Derived) => (same ? max : ownMax(d, period));

  const clients = useMemo(() => {
    const m = new Map<Client, number>();
    for (const d of derived) m.set(d.p.client, (m.get(d.p.client) ?? 0) + 1);
    return [...m.entries()];
  }, [derived]);

  const counts = useMemo(() => {
    const c = new Map<Status, number>();
    for (const d of visible) c.set(d.status, (c.get(d.status) ?? 0) + 1);
    return c;
  }, [visible]);
  const doneInPeriod = visible.reduce((t, d) => t + d.donePeriod, 0);
  const periodLong = PERIODS.find((p) => p.value === period)!.long;

  /* ── actions ───────────────────────────────────────────────────────── */

  const focusCard = (id: string) => {
    requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(
        `[data-card="${CSS.escape(id)}"]`,
      );
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  };
  const openCard = (id: string) => {
    const next = expanded === id ? null : id;
    setExpanded(next);
    focusCard(id);
  };
  const cycleSort = () => {
    setColSort(null);
    setSort(
      (cur) =>
        SORTS[(SORTS.findIndex((x) => x.value === cur) + 1) % SORTS.length]
          .value,
    );
  };
  const pinWeek = (w: number) => setPinned((cur) => (cur === w ? null : w));
  const onSetDate = (id: string, day: number | null) =>
    setDates((cur) => ({ ...cur, [id]: day }));
  const changeScenario = (v: Scenario) => {
    setScenario(v);
    setExpanded(null);
    setClient("all");
    setQuery("");
    setPinned(null);
  };

  const moveFocus = (key: string) => {
    const root = rootRef.current;
    if (!root) return false;
    const cards = [...root.querySelectorAll<HTMLElement>("[data-card]")].filter(
      (el) => el.offsetParent !== null,
    );
    if (!cards.length) return false;
    const current = (
      document.activeElement as HTMLElement | null
    )?.closest<HTMLElement>("[data-card]");
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
      if (key === "ArrowDown" && b.top > r.top + 8)
        score = dy * 4 + Math.abs(dx);
      if (key === "ArrowUp" && b.top < r.top - 8)
        score = -dy * 4 + Math.abs(dx);
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
      setPinned(
        Math.max(
          from,
          Math.min(THIS_WEEK, cur + (k === "ArrowRight" ? 1 : -1)),
        ),
      );
    } else if (view === "wall" && k.startsWith("Arrow")) {
      const t = e.target as HTMLElement;
      if (t.tagName === "BUTTON" && !t.closest("[data-card]")) return;
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
  const sum = weekSummary(visible, readWeek);
  const readout =
    visible.length === 0 ? (
      <>No projects match.</>
    ) : (
      <>
        <b>
          {week === null
            ? `Last week, ${fmtDay(weekStart(readWeek))}`
            : weekLabel(readWeek)}
          :
        </b>{" "}
        {plural(sum.total, "thing")} finished across{" "}
        {visible.length === 1 ? "this project" : "all projects"}
        {sum.topClient && sum.clientCount > 1 && sum.total > 0 ? (
          <>
            , most at {sum.topClient[0]}{" "}
            <span className={s.readNum}>({sum.topClient[1]})</span>
          </>
        ) : null}
        {sum.topProject && visible.length > 1 && sum.total > 0 ? (
          <span className={s.readSub}>
            {" "}
            Busiest project: {sum.topProject.p.name},{" "}
            {sum.topProject.p.finished[readWeek]}.
          </span>
        ) : null}
        {readWeek === THIS_WEEK ? (
          <span className={s.readSub}> This week is five days in.</span>
        ) : null}
      </>
    );

  const shared = {
    period,
    same,
    week,
    onWeek: setHoverWeek,
    onPin: pinWeek,
    onSetDate,
  };

  const statusLine = STATUS_ORDER.filter((st) => counts.get(st)).map((st) => (
    <span key={st} className={s.ledeStat} data-status={st}>
      {counts.get(st)} {STATUS_WORD[st].toLowerCase()}
    </span>
  ));

  return (
    <MotionConfig reducedMotion="user">
      <motion.div ref={rootRef} className={`${s.page} v3-focus`} layoutScroll>
        <div className={s.inner}>
          <header className={s.head}>
            <div>
              <h1 className={s.h1}>All projects</h1>
              <p className={s.lede}>
                {visible.length > 1 ? (
                  <>
                    {plural(visible.length, "project")} side by side, every
                    chart on the same scale.{" "}
                    <span className={s.ledeStats}>{statusLine}</span>
                  </>
                ) : (
                  <>One project so far. Its whole story is below.</>
                )}{" "}
                <span className={s.ledeDone}>
                  {plural(doneInPeriod, "thing")} finished in the {periodLong}.
                </span>
              </p>
            </div>
            <div className={s.helpWrap}>
              <button
                type="button"
                className={s.helpBtn}
                aria-expanded={help}
                aria-controls="c6-keys"
                onClick={() => setHelp((h) => !h)}
              >
                <Keyboard />
                <span>Keys</span>
                <kbd className={s.kbd}>?</kbd>
              </button>
              <AnimatePresence>
                {help && (
                  <motion.div
                    id="c6-keys"
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
          </header>

          <div className={s.sticky}>
            <div
              className={s.controls}
              role="toolbar"
              aria-label="Wall controls"
            >
              <div className={s.seg} role="radiogroup" aria-label="Period">
                {PERIODS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={period === p.value}
                    className={s.segBtn}
                    onClick={() => setPeriod(p.value)}
                  >
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
              <button
                type="button"
                role="switch"
                aria-checked={same}
                className={s.switch}
                onClick={() => setSame((v) => !v)}
              >
                <span className={s.switchTrack} aria-hidden>
                  <span className={s.switchThumb} />
                </span>
                Same scale
              </button>
              <span className={s.barSpacer} />
              <div className={s.seg} role="radiogroup" aria-label="View">
                <button
                  type="button"
                  role="radio"
                  aria-checked={view === "wall"}
                  className={s.segBtn}
                  onClick={() => setView("wall")}
                >
                  <WallIcon /> <span className={s.segText}>Wall</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={view === "table"}
                  className={s.segBtn}
                  onClick={() => setView("table")}
                >
                  <TableIcon /> <span className={s.segText}>Table</span>
                </button>
              </div>
            </div>
            <div className={s.strip} aria-live="polite">
              <span
                className={s.stripDot}
                data-on={week !== null || undefined}
                aria-hidden
              />
              <p className={s.stripText}>{readout}</p>
              {pinned !== null ? (
                <button
                  type="button"
                  className={s.pinBtn}
                  onClick={() => setPinned(null)}
                >
                  <Pin /> Pinned · Clear
                </button>
              ) : (
                <span className={s.stripHint}>
                  Point at any week to line it up on every card. Click to pin.
                </span>
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
                    <b>Each card now has its own scale.</b> Small projects look
                    as busy as big ones, so compare shapes here, not heights.
                  </p>
                  <button
                    type="button"
                    className={s.smallGhost}
                    onClick={() => setSame(true)}
                  >
                    Back to one scale
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {many && (
            <div className={s.filters}>
              <div
                className={s.chips}
                role="radiogroup"
                aria-label="Filter by client"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={client === "all"}
                  className={s.chip}
                  onClick={() => setClient("all")}
                >
                  All <span className={s.chipNum}>{derived.length}</span>
                </button>
                {clients.map(([c, n]) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={client === c}
                    className={s.chip}
                    onClick={() => setClient(c)}
                  >
                    {c} <span className={s.chipNum}>{n}</span>
                  </button>
                ))}
              </div>
              <label className={s.find}>
                <Search />
                <span className={s.srOnly}>Find a project</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a project"
                  className={s.findInput}
                />
              </label>
            </div>
          )}

          {view === "wall" ? (
            <>
              {scenario === "single" && rows[0] ? (
                <div className={s.lone}>
                  <Detail d={rows[0]} lone max={max} {...shared} />
                  <div className={s.lonePrompt}>
                    <div className={s.ghostCards} aria-hidden>
                      <span />
                      <span />
                      <span />
                    </div>
                    <div>
                      <p className={s.lonePromptTitle}>
                        Compare Projects side by side once you have more than
                        one
                      </p>
                      <p className={s.muted}>
                        Each new Project gets a card here, drawn on the same
                        scale as this one.
                      </p>
                    </div>
                    <button type="button" className={s.smallPrimary}>
                      New project
                    </button>
                  </div>
                </div>
              ) : (
                <LayoutGroup>
                  <div className={s.wall} data-many={many || undefined}>
                    {rows.map((d) => {
                      const isOpen = expanded === d.p.id;
                      return (
                        <motion.div
                          key={d.p.id}
                          layout="position"
                          className={isOpen ? s.cellWide : s.cell}
                          transition={{
                            type: "spring",
                            stiffness: 520,
                            damping: 44,
                            mass: 0.8,
                          }}
                        >
                          {isOpen ? (
                            <Detail
                              d={d}
                              max={max}
                              onClose={() => openCard(d.p.id)}
                              {...shared}
                            />
                          ) : (
                            <Card
                              d={d}
                              compact={expanded !== null}
                              onOpen={() => openCard(d.p.id)}
                              max={maxFor(d)}
                              {...shared}
                            />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </LayoutGroup>
              )}
              <ol className={s.phoneList}>
                {rows.map((d) => (
                  <li key={d.p.id}>
                    <PhoneRow
                      d={d}
                      period={period}
                      max={maxFor(d)}
                      week={week}
                      onOpen={() => openCard(d.p.id)}
                    />
                    {expanded === d.p.id && (
                      <Detail
                        d={d}
                        max={max}
                        onClose={() => openCard(d.p.id)}
                        {...shared}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <div className={s.tableOnly}>
                <Table
                  rows={tableRows}
                  period={period}
                  max={max}
                  week={week}
                  sort={colSort}
                  onSort={setColSort}
                  onWeek={setHoverWeek}
                  onPin={pinWeek}
                />
              </div>
              <div className={s.compareOnly}>
                <CompareList
                  rows={rows}
                  period={period}
                  by={compareBy}
                  onBy={setCompareBy}
                />
              </div>
            </>
          )}

          {rows.length === 0 && (
            <div className={s.empty}>
              <p>No projects match “{query}”.</p>
              <button
                type="button"
                className={s.smallGhost}
                onClick={() => {
                  setQuery("");
                  setClient("all");
                }}
              >
                Show all
              </button>
            </div>
          )}

          {showFinished && (
            <section className={s.finishedSec} aria-labelledby="c6-finished">
              <h2 id="c6-finished" className={s.secTitle}>
                Recently finished
              </h2>
              <FinishedRow f={RECENTLY_FINISHED} max={max} period={period} />
            </section>
          )}

          <footer className={s.foot2}>
            <div className={s.method}>
              <p>
                <b>How to read this.</b> Every bar chart shares one scale unless
                you switch it off, so a tall bar always means more finished. The
                line under each chart runs from today to the next 13 weeks; the
                dot is when open work likely runs out at the pace of the last 6
                weeks, the tall mark is the big date.
              </p>
            </div>
            <div className={s.scenario}>
              <span className={s.scenarioLabel}>Try this page with</span>
              <div className={s.seg} role="radiogroup" aria-label="Sample data">
                {SCENARIOS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={scenario === o.value}
                    className={s.segBtn}
                    onClick={() => changeScenario(o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </footer>
        </div>
      </motion.div>
    </MotionConfig>
  );
}
