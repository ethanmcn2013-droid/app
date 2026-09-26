"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon, menuKeys, StatusGlyph } from "./bits";
import { CreateCard, EmptyShelf, NewTile, type Draft } from "./create-card";
import { daysFromToday, ME, PROJECTS, type Kind, type Project, type Status } from "./data";
import { Hub } from "./hub";
import { ProjectCard } from "./project-card";
import s from "./shelf.module.css";

type Filter = "active" | "wrapped" | "all";
type Sort = "date" | "recent" | "health";
type Demo = "full" | "one" | "empty";

const SORT_LABEL: Record<Sort, string> = {
  date: "Next date",
  recent: "Recently opened",
  health: "Health",
};

const HEALTH_RANK: Record<Status, number> = {
  "off-track": 0,
  "at-risk": 1,
  "on-track": 2,
  "not-started": 3,
  wrapped: 4,
};

function seed(demo: Demo): Project[] {
  if (demo === "empty") return [];
  if (demo === "one") return PROJECTS.filter((p) => p.id === "mara-finn");
  return PROJECTS;
}

export default function CoverShelf() {
  const reduce = usePrefersReducedMotion();
  const [demo, setDemo] = useState<Demo>("full");
  const [projects, setProjects] = useState<Project[]>(() => seed("full"));
  const [filter, setFilter] = useState<Filter>("active");
  const [sort, setSort] = useState<Sort>("date");
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [flip, setFlip] = useState<-1 | 0 | 1>(0);
  const [returning, setReturning] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [createSignal, setCreateSignal] = useState(0);
  const [startKind, setStartKind] = useState<Kind | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [emptyStarted, setEmptyStarted] = useState(false);
  const [creating, setCreating] = useState(false);
  // False while the server markup is on screen and during hydration, so the
  // first paint already shows every cover. Later arrivals animate in.
  const hydrated = useHydrated();

  const hits = useRef(new Map<string, HTMLButtonElement>());
  const searchRef = useRef<HTMLInputElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const active = projects.filter((p) => p.status !== "wrapped");
  const wrappedList = projects.filter((p) => p.status === "wrapped");

  const visible = useMemo(() => {
    const base = filter === "active" ? active : filter === "wrapped" ? wrappedList : projects;
    const q = query.trim().toLowerCase();
    const list = q ? base.filter((p) => `${p.name} ${p.purpose}`.toLowerCase().includes(q)) : base;
    const byDate = (a: Project, b: Project) => {
      const da = a.start ? daysFromToday(a.start) : Number.POSITIVE_INFINITY;
      const db = b.start ? daysFromToday(b.start) : Number.POSITIVE_INFINITY;
      // Wrapped projects: most recent first.
      if (a.status === "wrapped" && b.status === "wrapped") return db - da;
      if (a.status === "wrapped") return 1;
      if (b.status === "wrapped") return -1;
      return da - db;
    };
    return [...list].sort((a, b) => {
      if (sort === "recent") return a.openedMinutesAgo - b.openedMinutesAgo;
      if (sort === "health") {
        const r = HEALTH_RANK[a.status] - HEALTH_RANK[b.status];
        if (r !== 0) return r;
        if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      }
      return byDate(a, b);
    });
  }, [active, wrappedList, projects, filter, query, sort]);

  const openIndex = openId ? visible.findIndex((p) => p.id === openId) : -1;
  const openProject = openIndex >= 0 ? visible[openIndex] : null;

  /* ── Actions ─────────────────────────────────────────────────── */

  const open = useCallback((id: string) => {
    setFlip(0);
    setReturning(null);
    setBack(null);
    setOpenId(id);
    setSortOpen(false);
    setProjects((list) => list.map((p) => (p.id === id ? { ...p, openedMinutesAgo: 0 } : p)));
  }, []);

  const close = useCallback(() => {
    const id = openId;
    if (!id) return;
    setReturning(reduce ? null : id);
    setBack(id);
    setOpenId(null);
    setFlip(0);
    // Give focus back to the card the hub came from.
    requestAnimationFrame(() => hits.current.get(id)?.focus({ preventScroll: true }));
  }, [openId, reduce]);

  const step = useCallback(
    (dir: -1 | 1) => {
      if (visible.length < 2 || openIndex < 0) return;
      const next = visible[(openIndex + dir + visible.length) % visible.length];
      setFlip(dir);
      setOpenId(next.id);
    },
    [visible, openIndex],
  );

  function toggleTask(projectId: string, taskId: string) {
    setProjects((list) =>
      list.map((p) => {
        if (p.id !== projectId) return p;
        let { done, overdue, review } = p;
        const week = p.week.map((t) => {
          if (t.id !== taskId) return t;
          const wasOverdue = t.state !== "done" && daysFromToday(t.due) < 0;
          if (t.state === "done") {
            done -= 1;
            const back = t.was ?? "open";
            if (back === "review") review += 1;
            if (daysFromToday(t.due) < 0) overdue += 1;
            return { ...t, state: back, was: undefined };
          }
          done += 1;
          if (t.state === "review") review -= 1;
          if (wasOverdue) overdue -= 1;
          return { ...t, state: "done" as const, was: t.state };
        });
        const fact =
          p.id === "mara-finn" && overdue === 0 && p.fact.tone === "overdue"
            ? { text: "Seating plan waiting on you", tone: "you" as const }
            : p.fact;
        return { ...p, week, done, overdue: Math.max(0, overdue), review: Math.max(0, review), fact };
      }),
    );
  }

  function setDate(id: string, iso: string | null) {
    setProjects((list) => list.map((p) => (p.id === id ? { ...p, start: iso, end: iso ? p.end : undefined } : p)));
  }

  function setStatus(id: string, status: Status) {
    setProjects((list) =>
      list.map((p) => (p.id === id ? { ...p, status, statusBy: "You", statusWhen: "just now" } : p)),
    );
  }

  function create(d: Draft) {
    const id = `new-${Date.now().toString(36)}`;
    const project: Project = {
      id,
      name: d.name,
      artSeed: d.seed,
      purpose: d.purpose || "Just started. Add a date and the first few tasks.",
      kind: d.kind,
      hue: d.hue,
      status: "not-started",
      statusBy: "You",
      statusWhen: "just now",
      start: null,
      done: 0,
      total: 0,
      overdue: 0,
      review: 0,
      fact: { text: "Add a date and the first few tasks", tone: "calm" },
      members: [{ person: ME, role: "Owner", owner: true }],
      openedMinutesAgo: 0,
      week: [],
      milestones: [],
      current: 0,
      activity: [{ day: "Today", time: "Now", who: ME, did: "created", what: "the project" }],
      links: [],
    };
    setProjects((list) => [project, ...list]);
    setCreating(false);
    setFilter((f) => (f === "wrapped" ? "active" : f));
    setFresh(id);
    setDemo((m) => (m === "empty" ? "one" : m));
  }

  function switchDemo(next: Demo) {
    setDemo(next);
    setProjects(seed(next));
    setOpenId(null);
    setReturning(null);
    setBack(null);
    setFilter("active");
    setQuery("");
    setStartKind(null);
    setEmptyStarted(false);
    setCreating(false);
    setFresh(null);
  }

  function startCreate(kind: Kind | null = null) {
    setStartKind(kind);
    setCreating(true);
    setCreateSignal((n) => n + 1);
    setQuery("");
    setFilter((f) => (f === "wrapped" ? "active" : f));
  }

  /* ── Keyboard ────────────────────────────────────────────────── */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // A menu or popover that handled the key has the final say.
      if (e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (openId) {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        } else if (!typing && e.key === "ArrowRight") {
          e.preventDefault();
          step(1);
        } else if (!typing && e.key === "ArrowLeft") {
          e.preventDefault();
          step(-1);
        }
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.key === "n" || e.key === "N") && !(projects.length === 0 && !emptyStarted)) {
        e.preventDefault();
        startCreate(null);
      } else if (e.key === "Escape" && sortOpen) {
        setSortOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, close, step, sortOpen, projects.length, emptyStarted]);

  // Opening the sort menu puts focus on the current choice.
  useEffect(() => {
    if (!sortOpen) return;
    const menu = sortMenuRef.current;
    (menu?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menu?.querySelector<HTMLElement>("button"))?.focus();
  }, [sortOpen]);

  useEffect(() => {
    if (!sortOpen) return;
    function onDown(e: PointerEvent) {
      if (!sortRef.current?.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [sortOpen]);

  /* ── Summary line ────────────────────────────────────────────── */

  const lead = useMemo(() => {
    const needs = active
      .filter((p) => p.start && (p.fact.tone === "you" || p.needsYou))
      .sort((a, b) => daysFromToday(a.start!) - daysFromToday(b.start!))[0];
    return needs ?? null;
  }, [active]);
  const watch = active.filter((p) => p.status === "at-risk" || p.status === "off-track");

  const hubOpen = openId !== null;
  const one = demo !== "empty" && active.length === 1 && filter !== "wrapped" && !query;
  const showEmpty = projects.length === 0 && !emptyStarted;

  return (
    <MotionConfig reducedMotion="user">
      <div className={s.root}>
        <LayoutGroup>
          <motion.div layoutScroll className={`${s.shelf} thin-scroll`} aria-hidden={hubOpen || undefined} inert={hubOpen}>
            <div className={s.inner}>
              <header className={s.head}>
                <div className={s.headText}>
                  <h1 className={s.h1}>Projects</h1>
                  <p className={s.summary}>
                    {projects.length === 0 ? (
                      "Nothing here yet. Your first project is one name away."
                    ) : (
                      <>
                        {active.length} active.{" "}
                        {lead ? (
                          <>
                            <button type="button" className={s.summaryLink} onClick={() => open(lead.id)}>
                              {lead.name}
                            </button>{" "}
                            is {dayWords(lead.start!)} and needs you.
                          </>
                        ) : (
                          "Nothing needs you today."
                        )}
                      </>
                    )}
                  </p>
                  {watch.length > 0 && projects.length > 1 ? (
                    <p className={s.watch}>
                      <span className={s.watchLabel}>Keep an eye on</span>
                      {watch.map((p) => (
                        <button key={p.id} type="button" className={s.watchChip} onClick={() => open(p.id)}>
                          <StatusGlyph status={p.status} />
                          {p.name}
                        </button>
                      ))}
                    </p>
                  ) : null}
                </div>
                {projects.length > 0 ? (
                  <button
                    type="button"
                    className={`${s.btnPrimary} ${s.headNew}`}
                    onClick={() => startCreate(null)}
                    aria-label="New project"
                  >
                    <Icon.plus size={14} />
                    <span>
                      New<span className={s.headNewWord}> project</span>
                    </span>
                    <kbd className={s.kbdOnAccent}>N</kbd>
                  </button>
                ) : null}
              </header>

              {projects.length > 0 ? (
                <div className={s.toolbar}>
                  <div className={s.segmented} role="tablist" aria-label="Show">
                    {(
                      [
                        ["active", "Active", active.length],
                        ["wrapped", "Wrapped", wrappedList.length],
                        ["all", "All", projects.length],
                      ] as const
                    ).map(([key, label, n]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={filter === key}
                        className={`${s.seg} ${filter === key ? s.segOn : ""}`}
                        onClick={() => setFilter(key)}
                      >
                        {filter === key ? (
                          <motion.span layoutId="seg-pill" className={s.segPill} transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                        ) : null}
                        <span className={s.segLabel}>{label}</span>
                        <span className={s.segCount}>{n}</span>
                      </button>
                    ))}
                  </div>

                  <div className={s.toolRight}>
                    <label className={s.search}>
                      <Icon.search size={14} />
                      <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Find a project"
                        aria-label="Find a project"
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setQuery("");
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                      <kbd className={s.kbd}>/</kbd>
                    </label>
                    <div className={s.sortWrap} ref={sortRef}>
                      <button
                        ref={sortBtnRef}
                        type="button"
                        className={s.sortBtn}
                        aria-haspopup="menu"
                        aria-expanded={sortOpen}
                        onClick={() => setSortOpen((v) => !v)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            e.preventDefault();
                            setSortOpen(true);
                          }
                        }}
                      >
                        <Icon.sort size={14} />
                        <span className={s.sortPrefix}>Sort:</span> {SORT_LABEL[sort]}
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
                </div>
              ) : null}

              {showEmpty ? (
                <EmptyShelf
                  onStart={(k) => {
                    setEmptyStarted(true);
                    startCreate(k);
                  }}
                />
              ) : (
                <div className={`${s.grid} ${one ? s.gridOne : ""}`}>
                  <AnimatePresence mode="popLayout">
                    {creating && !one ? (
                      <CreateCard
                        key="editor"
                        editing
                        openSignal={createSignal}
                        startKind={startKind}
                        takenHues={active.map((p) => p.hue)}
                        wide={projects.length === 0}
                        animateIn={hydrated}
                        onStart={() => startCreate(null)}
                        onCancel={() => {
                          setCreating(false);
                          if (projects.length === 0) setEmptyStarted(false);
                        }}
                        onCreate={create}
                      />
                    ) : null}
                    {visible.map((p, i) => (
                      <ProjectCard
                        key={p.id}
                        p={p}
                        index={i + 1}
                        open={p.id === openId}
                        hubOpen={hubOpen}
                        reduce={reduce}
                        feature={one}
                        returning={p.id === returning}
                        back={p.id === back}
                        onLeaveBack={() => setBack(null)}
                        fresh={p.id === fresh}
                        animateIn={hydrated}
                        onOpen={open}
                        onSetDate={setDate}
                        onReturned={() => setReturning(null)}
                        registerHit={(id, el) => {
                          if (el) hits.current.set(id, el);
                          else hits.current.delete(id);
                        }}
                      />
                    ))}
                    {one ? (
                      <CreateCard
                        key={`panel-${demo}`}
                        variant="panel"
                        editing={creating}
                        openSignal={createSignal}
                        startKind={startKind}
                        takenHues={active.map((p) => p.hue)}
                        animateIn={hydrated}
                        onStart={() => startCreate(null)}
                        onCancel={() => setCreating(false)}
                        onCreate={create}
                      />
                    ) : null}
                  </AnimatePresence>
                  {!creating && !one && projects.length > 0 && filter !== "wrapped" && !query ? (
                    <NewTile onStart={() => startCreate(null)} />
                  ) : null}
                  {visible.length === 0 && query ? (
                    <div className={s.noMatch}>
                      <p className={s.noMatchTitle}>No project matches &lsquo;{query}&rsquo;</p>
                      <button type="button" className={s.btnGhost} onClick={() => setQuery("")}>
                        Clear the search
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              <footer className={s.demoBar}>
                <span className={s.demoLabel}>Preview this concept with</span>
                <div className={s.demoSeg} role="group" aria-label="Sample data">
                  {(
                    [
                      ["full", "Full shelf"],
                      ["one", "One project"],
                      ["empty", "No projects"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={demo === k}
                      className={`${s.demoBtn} ${demo === k ? s.demoBtnOn : ""}`}
                      onClick={() => switchDemo(k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className={s.demoKeys}>
                  <kbd className={s.kbd}>N</kbd> new <kbd className={s.kbd}>/</kbd> find <kbd className={s.kbd}>Esc</kbd>{" "}
                  close <kbd className={s.kbd}>←</kbd>
                  <kbd className={s.kbd}>→</kbd> flip through
                </span>
              </footer>
            </div>
          </motion.div>

          <AnimatePresence>
            {openProject ? (
              <Hub
                key="hub"
                p={openProject}
                position={openIndex}
                count={visible.length}
                flip={flip}
                reduce={reduce}
                onClose={close}
                onStep={step}
                onToggleTask={toggleTask}
                onSetDate={setDate}
                onSetStatus={setStatus}
              />
            ) : null}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </MotionConfig>
  );
}

const SORT_HINT: Record<Sort, string> = {
  date: "Soonest first",
  recent: "Where you left off",
  health: "Trouble first",
};

/* Same rule as the date badge: a countdown inside two weeks, weeks beyond. */
function dayWords(iso: string) {
  const n = daysFromToday(iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n > 1 && n <= 14) return `${n} days out`;
  return `${Math.round(n / 7)} weeks out`;
}

const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/*
 * Reduced motion, read in a hydration-safe way: the server snapshot is
 * always false, and React re-renders after hydration if the viewer prefers
 * less motion, so server and client markup never disagree.
 */
const RM_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeRM(cb: () => void) {
  const mq = window.matchMedia(RM_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeRM,
    () => window.matchMedia(RM_QUERY).matches,
    () => false,
  );
}
