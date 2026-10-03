"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Icon, menuKeys } from "./bits";
import { CreateCard, NewTile, type Draft } from "./create-card";
import { daysFromToday, factFor, needsAttention, PEOPLE, type Project, type StatusId } from "./data";
import { VIEWS, type ViewId } from "./model";
import { setSharedView, useSharedView } from "./live";
import { ProjectCard } from "./project-card";
import s from "./shelf.module.css";

type Sort = "date" | "recent" | "health";

const SORT_LABEL: Record<Sort, string> = { date: "Next date", recent: "Recently opened", health: "How it is doing" };
const SORT_HINT: Record<Sort, string> = { date: "Soonest first", recent: "Where you left off", health: "Trouble first" };
const HEALTH_RANK: Record<StatusId, number> = { off_track: 0, at_risk: 1, on_track: 2, wrapped: 3 };

export function matches(p: Project, q: string) {
  if (!q) return true;
  return `${p.name} ${p.purpose} ${PEOPLE[p.owner]?.name ?? ""}`.toLowerCase().includes(q);
}

/** The covers lens: every project as a living cover, in one shelf. */
export function Shelf({
  projects,
  query,
  onClearQuery,
  homeId,
  returning,
  back,
  reduce,
  hydrated,
  createSignal,
  createName,
  onCreateNamed,
  freshId,
  onCreate,
  onOpen,
  onReturned,
  onLeaveBack,
  reportOrder,
}: {
  projects: Project[];
  query: string;
  onClearQuery: () => void;
  homeId: string | null;
  returning: string | null;
  back: string | null;
  reduce: boolean;
  hydrated: boolean;
  createSignal: number;
  /** A name to start the new project with, when a search found nothing by it. */
  createName: string;
  onCreateNamed: (name: string) => void;
  /** A project just made here: it lands first and glows once. */
  freshId: string | null;
  onCreate: (d: Draft) => void;
  onOpen: (id: string) => void;
  onReturned: () => void;
  onLeaveBack: () => void;
  reportOrder: (ids: string[]) => void;
}) {
  const show = useSharedView();
  const setShow = setSharedView;
  const [sort, setSort] = useState<Sort>("date");
  const [sortOpen, setSortOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [seenSignal, setSeenSignal] = useState(createSignal);
  const [focusId, setFocusId] = useState<string | null>(null);
  const hits = useRef(new Map<string, HTMLButtonElement>());
  const sortRef = useRef<HTMLDivElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // The header's New project (or N) asks the shelf to open its cover editor.
  if (createSignal !== seenSignal) {
    setSeenSignal(createSignal);
    setCreating(true);
  }

  const active = projects.filter((p) => p.status !== "wrapped");
  const q = query.trim().toLowerCase();
  const viewDef = VIEWS.find((v) => v.id === show) ?? VIEWS[0];

  const visible = useMemo(() => {
    const list = projects.filter(viewDef.test).filter((p) => matches(p, q));
    const byDate = (a: Project, b: Project) => {
      if (a.status === "wrapped" && b.status === "wrapped") return daysFromToday(b.date) - daysFromToday(a.date);
      if (a.status === "wrapped") return 1;
      if (b.status === "wrapped") return -1;
      return daysFromToday(a.date) - daysFromToday(b.date);
    };
    return [...list].sort((a, b) => {
      // A project made a moment ago leads the shelf, so you see it land.
      if (a.id === freshId) return -1;
      if (b.id === freshId) return 1;
      if (sort === "recent") return b.opened - a.opened || b.updatedOn.localeCompare(a.updatedOn);
      if (sort === "health") {
        const r = HEALTH_RANK[a.status] - HEALTH_RANK[b.status] - (needsAttention(a) ? 0.5 : 0) + (needsAttention(b) ? 0.5 : 0);
        if (r !== 0) return r;
        if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      }
      return byDate(a, b);
    });
  }, [projects, viewDef, q, sort, freshId]);

  const ids = visible.map((p) => p.id).join(",");
  useEffect(() => {
    reportOrder(ids ? ids.split(",") : []);
  }, [ids, reportOrder]);

  // Coming back from a home, the roving tab stop follows the project that was open.
  const tabId = (focusId && visible.some((p) => p.id === focusId) ? focusId : null) ?? back ?? visible[0]?.id ?? null;

  useEffect(() => {
    if (!sortOpen) return;
    const menu = sortMenuRef.current;
    (menu?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu?.querySelector<HTMLElement>("button"))?.focus();
    function onDown(e: PointerEvent) {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [sortOpen]);

  /** Arrow keys walk the shelf: left and right in reading order, up and down to the nearest cover in the next row. */
  function onKeyNav(e: ReactKeyboardEvent<HTMLButtonElement>, id: string) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const list = visible.map((p) => hits.current.get(p.id)).filter((el): el is HTMLButtonElement => !!el);
    const i = visible.findIndex((p) => p.id === id);
    if (i < 0 || list.length === 0) return;
    let to = i;
    if (e.key === "ArrowRight") to = Math.min(list.length - 1, i + 1);
    else if (e.key === "ArrowLeft") to = Math.max(0, i - 1);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = list.length - 1;
    else {
      const here = list[i].getBoundingClientRect();
      const cx = here.left + here.width / 2;
      const down = e.key === "ArrowDown";
      let best = -1;
      let bestScore = Infinity;
      list.forEach((el, j) => {
        const r = el.getBoundingClientRect();
        const dy = down ? r.top - here.top : here.top - r.top;
        if (dy < 8) return;
        const score = dy * 4 + Math.abs(r.left + r.width / 2 - cx);
        if (score < bestScore) {
          bestScore = score;
          best = j;
        }
      });
      if (best < 0) return;
      to = best;
    }
    e.preventDefault();
    const el = list[to];
    setFocusId(visible[to].id);
    el.focus({ preventScroll: true });
    el.closest("article")?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }

  const homeOpen = homeId !== null;

  return (
    <div className={s.coversLens}>
      <div className={s.toolbar}>
        <div className={s.segmented} role="tablist" aria-label="Show">
          {VIEWS.map((v, i) => {
            const n = projects.filter(v.test).length;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={show === v.id}
                tabIndex={show === v.id ? 0 : -1}
                title={v.hint}
                className={`${s.seg} ${show === v.id ? s.segOn : ""}`}
                onClick={() => setShow(v.id)}
                onKeyDown={(e) => {
                  const to: ViewId | null =
                    e.key === "ArrowRight"
                      ? VIEWS[(i + 1) % VIEWS.length].id
                      : e.key === "ArrowLeft"
                        ? VIEWS[(i - 1 + VIEWS.length) % VIEWS.length].id
                        : e.key === "Home"
                          ? VIEWS[0].id
                          : e.key === "End"
                            ? VIEWS[VIEWS.length - 1].id
                            : null;
                  if (!to) return;
                  e.preventDefault();
                  setShow(to);
                  const btns = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                  btns?.[VIEWS.findIndex((x) => x.id === to)]?.focus();
                }}
              >
                {show === v.id ? <motion.span layoutId="covers-seg" className={s.segPill} transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
                <span className={s.segLabel}>{v.label}</span>
                <span className={s.segCount}>{n}</span>
              </button>
            );
          })}
        </div>

        <div className={s.sortWrap} ref={sortRef}>
          <button
            ref={sortBtnRef}
            type="button"
            className={s.sortBtn}
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            aria-label={`Sort: ${SORT_LABEL[sort]}`}
            onClick={() => setSortOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setSortOpen(true);
              }
            }}
          >
            <Icon.sort size={14} />
            <span className={s.sortLabel}>
              <span className={s.sortPrefix}>Sort:</span> {SORT_LABEL[sort]}
            </span>
            <Icon.chevronDown size={12} />
          </button>
          <AnimatePresence>
            {sortOpen ? (
              <motion.div
                ref={sortMenuRef}
                className={s.menu}
                role="menu"
                aria-label="Sort projects"
                onKeyDown={(e) =>
                  menuKeys(e, (refocus) => {
                    setSortOpen(false);
                    if (refocus) sortBtnRef.current?.focus();
                  })
                }
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
                transition={{ duration: 0.16 }}
              >
                {(Object.keys(SORT_LABEL) as Sort[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="menuitemradio"
                    aria-checked={sort === k}
                    className={s.menuItem}
                    tabIndex={-1}
                    onClick={() => {
                      setSort(k);
                      setSortOpen(false);
                      sortBtnRef.current?.focus();
                    }}
                  >
                    <span>{SORT_LABEL[k]}</span>
                    <span className={s.menuHint}>{SORT_HINT[k]}</span>
                    {sort === k ? (
                      <span className={s.menuCheck}>
                        <Icon.check size={14} />
                      </span>
                    ) : null}
                  </button>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <div className={s.grid}>
        <AnimatePresence mode="popLayout">
          {creating ? (
            <CreateCard
              key="editor"
              editing
              openSignal={createSignal}
              startName={createName}
              startKind={null}
              takenHues={active.map((p) => p.tone)}
              animateIn={hydrated}
              onStart={() => setCreating(true)}
              onCancel={() => setCreating(false)}
              onCreate={(d) => {
                setCreating(false);
                onCreate(d);
              }}
            />
          ) : null}
          {visible.map((p, i) => (
            <ProjectCard
              key={p.id}
              p={p}
              fact={factFor(p)}
              index={i + 1}
              open={p.id === homeId}
              hubOpen={homeOpen}
              reduce={reduce}
              returning={p.id === returning}
              back={p.id === back}
              onLeaveBack={onLeaveBack}
              fresh={p.id === freshId}
              animateIn={hydrated}
              tabbable={p.id === tabId}
              onOpen={onOpen}
              onFocusCard={setFocusId}
              onKeyNav={onKeyNav}
              onReturned={onReturned}
              registerHit={(id, el) => {
                if (el) hits.current.set(id, el);
                else hits.current.delete(id);
              }}
            />
          ))}
        </AnimatePresence>
        {!creating && show === "active" && !q ? <NewTile onStart={() => setCreating(true)} /> : null}
        {visible.length === 0 && (q || show !== "active") ? (
          <div className={s.noMatch}>
            <p className={s.noMatchTitle}>
              {q ? <>No project matches “{query.trim()}”</> : show === "risk" ? "Nothing needs attention right now." : show === "mine" ? "You lead no active projects." : "Nothing wrapped yet."}
            </p>
            {q ? <p className={s.noMatchHint}>Search looks at a project&rsquo;s name, its lead and what it is for. Wrapped projects are under Wrapped.</p> : null}
            {q ? (
              <div className={s.noMatchActions}>
                <button type="button" className={s.btnPrimary} onClick={() => onCreateNamed(query.trim())}>
                  Create “{query.trim()}”
                </button>
                <button type="button" className={s.btnGhost} onClick={onClearQuery}>
                  Clear the search
                </button>
              </div>
            ) : (
              <button type="button" className={s.btnGhost} onClick={() => setShow("active")}>
                See all active projects
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
