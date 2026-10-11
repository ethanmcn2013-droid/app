"use client";

import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import clsx from "clsx";
import { STAGES, TEAM_SETS, TODAY_LABEL, type Person, type Stage, type Task, type TeamSet } from "./data";
import { NO_OWNER, findSuggestion, lowerFirst, isOpen, laneIdOf, lanesFor, lateCount, moveTask, openLoad, plural, type Lane, type Lens } from "./model";
import {
  Avatar,
  BalanceBanner,
  CapacityMeter,
  CompactCard,
  HandOverSheet,
  LoadRing,
  Segmented,
  VIEW_OPTIONS,
  type Handoff,
} from "./parts";
import { PhoneBoard } from "./phone";
import { IconArrow, IconCheck, IconChevron, IconCollapse, IconExpand, IconMoon, IconPlus, IconSearch } from "./icons";
import s from "./c2.module.css";

const CELL_CAP = 4;

type Drag = {
  id: string;
  x: number;
  y: number;
  ox: number;
  oy: number;
  w: number;
  over: { lane: string; stage: Stage | "keep" } | null;
};

type Toast = { id: number; text: string; undo?: Task[] };

function usePhone() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(max-width: 760px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(max-width: 760px)").matches,
    () => false,
  );
}

export default function WhosCarryingWhat() {
  const phone = usePhone();
  const [setId, setSetId] = useState(TEAM_SETS[0].id);
  const [taskMap, setTaskMap] = useState<Record<string, Task[]>>(() =>
    Object.fromEntries(TEAM_SETS.map((t) => [t.id, t.tasks])),
  );
  const [lens, setLens] = useState<Lens>("person");
  const [showDone, setShowDone] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [handOverId, setHandOverId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [handoffs, setHandoffs] = useState<Record<string, Handoff>>({});
  const [proposing, setProposing] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmAway, setConfirmAway] = useState<{ taskId: string; lane: string; stage: Stage } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const set = TEAM_SETS.find((t) => t.id === setId) as TeamSet;
  const tasks = taskMap[setId];
  const setTasks = useCallback(
    (next: Task[] | ((prev: Task[]) => Task[])) =>
      setTaskMap((m) => ({ ...m, [setId]: typeof next === "function" ? next(m[setId]) : next })),
    [setId],
  );

  const people = set.people;
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const projectById = useMemo(() => new Map(set.projects.map((p) => [p.id, p])), [set.projects]);
  const lanes = lanesFor(set, lens);
  const stages = STAGES.filter((st) => st.id !== "done" || showDone);
  const load = useCallback((id: string) => openLoad(tasks, id), [tasks]);
  // One scale for the whole team, so meters compare fairly and do not jump as work moves.
  const baseSlots = useMemo(
    () => Math.max(...set.people.map((p) => Math.max(p.capacity + 3, openLoad(set.tasks, p.id) + 2))),
    [set],
  );
  const slots = Math.max(baseSlots, ...people.map((p) => load(p.id) + 1));

  const suggestion = findSuggestion(set, tasks);
  const suggestionKey = suggestion ? `${setId}:${suggestion.from.id}:${suggestion.to.id}:${suggestion.taskIds.join()}` : null;
  const showBanner = !!suggestion && dismissed !== suggestionKey && lens === "person";
  const suggestedIds = new Set(proposing && suggestion ? suggestion.taskIds : []);

  const q = query.trim().toLowerCase();
  const visible = (t: Task) => (!q || t.title.toLowerCase().includes(q)) && (showDone || t.stage !== "done");

  const openCount = tasks.filter(isOpen).length;
  const unowned = tasks.filter((t) => isOpen(t) && !t.owner).length;

  /* ── toasts and hand-off badges ── */
  const toastSeq = useRef(0);
  const say = useCallback((text: string, undo?: Task[]) => {
    const id = ++toastSeq.current;
    setToast({ id, text, undo });
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 5200);
  }, []);
  const flashHandoffs = useCallback((list: Handoff[]) => {
    setHandoffs((h) => ({ ...h, ...Object.fromEntries(list.map((x) => [x.taskId, x])) }));
    window.setTimeout(() => {
      setHandoffs((h) => {
        const next = { ...h };
        for (const x of list) if (next[x.taskId] === x) delete next[x.taskId];
        return next;
      });
    }, 2000);
  }, []);

  /* ── moving work ── */
  const applyMove = useCallback(
    (taskId: string, lane: string, stage: Stage) => {
      const before = tasks;
      const task = before.find((t) => t.id === taskId);
      if (!task) return;
      const next = moveTask(before, taskId, lens, lane, stage);
      setTasks(next);
      if (lens === "person" && (task.owner ?? NO_OWNER) !== lane) {
        const from = task.owner ? personById.get(task.owner) ?? null : null;
        const to = lane === NO_OWNER ? null : personById.get(lane) ?? null;
        flashHandoffs([{ taskId, from, to }]);
        say(to ? `Handed to ${to.first}. ${to.first} now has ${openLoad(next, to.id)} of ${to.capacity}.` : "Left without an owner", before);
      } else if (lens === "project" && task.project !== lane) {
        say(`Moved to ${projectById.get(lane)?.name}`, before);
      } else if (task.stage !== stage) {
        say(`Moved to ${STAGES.find((x) => x.id === stage)?.label}`, before);
      }
    },
    [tasks, lens, setTasks, personById, projectById, flashHandoffs, say],
  );

  const requestMove = useCallback(
    (taskId: string, lane: string, stage: Stage) => {
      const person = lens === "person" ? personById.get(lane) : undefined;
      const task = tasks.find((t) => t.id === taskId);
      if (person?.away && task?.owner !== person.id) {
        setConfirmAway({ taskId, lane, stage });
        return;
      }
      applyMove(taskId, lane, stage);
    },
    [lens, personById, tasks, applyMove],
  );

  const handOver = (personId: string | null) => {
    const task = tasks.find((t) => t.id === handOverId);
    setHandOverId(null);
    if (!task) return;
    const lane = personId ?? NO_OWNER;
    const target = personId ? personById.get(personId) : undefined;
    if (target?.away) {
      setConfirmAway({ taskId: task.id, lane, stage: task.stage });
      return;
    }
    const before = tasks;
    const next = moveTask(before, task.id, "person", lane, task.stage);
    setTasks(next);
    flashHandoffs([{ taskId: task.id, from: task.owner ? personById.get(task.owner) ?? null : null, to: target ?? null }]);
    say(target ? `Handed to ${target.first}. ${target.first} now has ${openLoad(next, target.id)} of ${target.capacity}.` : "Left without an owner", before);
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    const before = tasks;
    let next = before;
    for (const id of suggestion.taskIds) next = moveTask(next, id, "person", suggestion.to.id, "todo");
    setTasks(next);
    setProposing(false);
    // One nudge at a time: hold back the follow-on suggestion until someone moves work by hand.
    const after = findSuggestion(set, next);
    if (after) setDismissed(`${setId}:${after.from.id}:${after.to.id}:${after.taskIds.join()}`);
    flashHandoffs(suggestion.taskIds.map((taskId) => ({ taskId, from: suggestion.from, to: suggestion.to })));
    say(
      `Moved ${plural(suggestion.taskIds.length, "card")} to ${suggestion.to.first}. ${suggestion.from.first} now has ${openLoad(next, suggestion.from.id)} of ${suggestion.from.capacity}.`,
      before,
    );
  };

  /* ── pointer drag (mouse and pen; touch uses Hand over) ── */
  const rootRef = useRef<HTMLDivElement>(null);
  const pending = useRef<{ id: string; x: number; y: number; rect: DOMRect } | null>(null);
  const suppressClick = useRef(false);

  const hit = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
    if (!el) return null;
    const [lane, stage] = (el.dataset.drop ?? "").split("|");
    return { lane, stage: stage as Stage | "keep" };
  };

  const onCardPointerDown = (task: Task) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    pending.current = { id: task.id, x: e.clientX, y: e.clientY, rect };
    let active = false;
    const move = (ev: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      if (!active && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < 5) return;
      if (!active) {
        active = true;
        document.body.style.userSelect = "none";
      }
      const root = rootRef.current;
      if (root) {
        const r = root.getBoundingClientRect();
        const edge = 72;
        if (ev.clientY > r.bottom - edge) root.scrollTop += Math.ceil((ev.clientY - (r.bottom - edge)) / 4);
        else if (ev.clientY < r.top + edge) root.scrollTop -= Math.ceil((r.top + edge - ev.clientY) / 4);
      }
      setDrag({
        id: p.id,
        x: ev.clientX,
        y: ev.clientY,
        ox: p.x - p.rect.left,
        oy: p.y - p.rect.top,
        w: p.rect.width,
        over: hit(ev.clientX, ev.clientY),
      });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      const p = pending.current;
      pending.current = null;
      if (!active || !p) return;
      suppressClick.current = true;
      window.setTimeout(() => (suppressClick.current = false), 0);
      setDrag(null);
      const target = hit(ev.clientX, ev.clientY);
      if (!target) return;
      const t = tasks.find((x) => x.id === p.id);
      if (!t) return;
      const stage = target.stage === "keep" ? t.stage : target.stage;
      if (laneIdOf(t, lens) === target.lane && t.stage === stage) return;
      requestMove(p.id, target.lane, stage);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const dragTask = drag ? tasks.find((t) => t.id === drag.id) ?? null : null;
  const dragSourceLane = dragTask ? laneIdOf(dragTask, lens) : null;
  const overLane = drag?.over?.lane ?? null;

  /* ── keyboard ── */
  const searchRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerInView, setBannerInView] = useState(true);
  useEffect(() => {
    const el = bannerRef.current;
    const root = rootRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(([entry]) => setBannerInView(entry.isIntersecting), { root, threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [phone]);
  const allLaneIds = lanes.map((l) => l.id);
  const allCollapsed = allLaneIds.every((id) => collapsed.has(id));
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(allLaneIds));

  const onRootKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if (handOverId || confirmAway) return;
    if (e.key === "c" || e.key === "C") {
      e.preventDefault();
      toggleAll();
    } else if (e.key === "d" || e.key === "D") {
      e.preventDefault();
      setShowDone((v) => !v);
    } else if (e.key === "/") {
      e.preventDefault();
      searchRef.current?.focus();
    } else if (e.key === "Escape") {
      setSelected(null);
      setProposing(false);
    }
  };

  const keyRef = useRef(onRootKey);
  useEffect(() => {
    keyRef.current = onRootKey;
  });
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const cardKey = (task: Task) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "h" || e.key === "H") {
      e.preventDefault();
      e.stopPropagation();
      setHandOverId(task.id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelected(task.id);
    }
  };

  const newSeq = useRef(0);
  const addTask = (lane: string) => {
    const title = draft.trim();
    if (!title) {
      setAdding(null);
      return;
    }
    const id = `new-${++newSeq.current}`;
    const project = lens === "project" ? lane : set.projects[0].id;
    const owner = lens === "person" ? (lane === NO_OWNER ? null : lane) : null;
    setTasks((prev) => [...prev, { id, title, stage: "todo", owner, project }]);
    setDraft("");
  };

  /* ── rendering helpers ── */
  const renderCard = (t: Task) => (
    <motion.div
      key={t.id}
      layoutId={`d-${t.id}`}
      layout="position"
      className={clsx(s.cardSlot, drag?.id === t.id && s.cardGhosted)}
      transition={{ type: "spring", stiffness: 480, damping: 40 }}
    >
      <CompactCard
        task={t}
        lens={lens}
        project={projectById.get(t.project)}
        owner={t.owner ? personById.get(t.owner) ?? null : null}
        handoff={handoffs[t.id] ?? null}
        suggested={suggestedIds.has(t.id)}
        selected={selected === t.id}
        lifted={false}
        onPointerDown={onCardPointerDown(t)}
        onHandOver={() => setHandOverId(t.id)}
        onSelect={() => {
          if (suppressClick.current) return;
          setSelected((cur) => (cur === t.id ? null : t.id));
        }}
        onKeyDown={cardKey(t)}
      />
    </motion.div>
  );

  const laneTitle = (lane: Lane) =>
    lane.kind === "person" ? lane.person.first : lane.kind === "project" ? lane.project.name : "No owner yet";

  const summaryLine = (lane: Lane) => {
    const laneTasks = tasks.filter((t) => laneIdOf(t, lens) === lane.id && isOpen(t));
    const late = lateCount(tasks, lane.id, lens);
    if (lane.kind === "person" && lane.person.away) return `${lane.person.away}, ${laneTasks.length ? plural(laneTasks.length, "open task") : "nothing open"}`;
    if (lane.kind === "unassigned") return laneTasks.length ? `${plural(laneTasks.length, "task")} need someone` : "Every task has an owner";
    if (!laneTasks.length) return "Nothing open";
    return `${laneTasks.length} open, ${late ? `${late} past due` : "nothing late"}`;
  };

  const subLine = (
    <p className={s.sub}>
      {TODAY_LABEL} · {plural(openCount, "open task")} across {plural(people.length, "person", "people")}
      {unowned ? (
        <>
          {" "}
          · <span className={s.subStrong}>{unowned} without an owner</span>
        </>
      ) : null}
    </p>
  );

  return (
    <MotionConfig reducedMotion="user">
      <motion.div ref={rootRef} className={s.root} layoutScroll data-dragging={drag ? "" : undefined}>
        {/* ── Header ── */}
        <header className={s.head}>
          <div className={s.titleRow}>
            <div className={s.titleBlock}>
              <div className={s.titleLine}>
                <h1 className={s.h1}>Tasks</h1>
                <div className={s.teamPick}>
                  <button
                    type="button"
                    className={s.teamPill}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <span className={s.teamTile} style={{ background: `var(--v3-project-${set.hue})` }}>
                      {set.short}
                    </span>
                    {set.name}
                    <IconChevron width={14} height={14} />
                  </button>
                  <AnimatePresence>
                    {menuOpen ? (
                      <motion.div
                        className={s.menu}
                        role="menu"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.14 }}
                      >
                        {TEAM_SETS.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            role="menuitemradio"
                            aria-checked={t.id === setId}
                            className={clsx(s.menuItem, t.id === setId && s.menuItemOn)}
                            onClick={() => {
                              setSetId(t.id);
                              setMenuOpen(false);
                              setProposing(false);
                              setCollapsed(new Set());
                              setSelected(null);
                            }}
                          >
                            <span className={s.teamTile} style={{ background: `var(--v3-project-${t.hue})` }}>
                              {t.short}
                            </span>
                            <span className={s.menuText}>
                              <span>{t.name}</span>
                              <span className={s.menuSub}>{plural(t.people.length, "person", "people")}</span>
                            </span>
                            {t.id === setId ? <IconCheck width={14} height={14} /> : null}
                          </button>
                        ))}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
              {phone ? subLine : null}
            </div>
            <div className={s.titleControls}>
              <Segmented
                label="Group lanes"
                pill
                value={lens}
                onChange={(v) => {
                  setLens(v);
                  setProposing(false);
                  setCollapsed(new Set());
                }}
                options={[
                  { id: "person", label: "By person" },
                  { id: "project", label: "By project" },
                ]}
              />
              <Segmented label="View" value="board" options={VIEW_OPTIONS} compact />
            </div>
          </div>

          {!phone ? (
            <div className={s.toolbar}>
              {subLine}
              <label className={s.search}>
                <IconSearch width={14} height={14} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find a task"
                  aria-label="Find a task"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setQuery("");
                      e.currentTarget.blur();
                    }
                  }}
                />
                <kbd className={s.kbd}>/</kbd>
              </label>
              <div className={s.toolbarTools}>
                <button type="button" className={clsx(s.tool, showDone && s.toolOn)} aria-pressed={showDone} onClick={() => setShowDone((v) => !v)}>
                  <span className={clsx(s.switch, showDone && s.switchOn)} aria-hidden />
                  Show done
                  <kbd className={s.kbd}>D</kbd>
                </button>
                <button type="button" className={s.tool} onClick={toggleAll} aria-pressed={allCollapsed}>
                  {allCollapsed ? <IconExpand width={14} height={14} /> : <IconCollapse width={14} height={14} />}
                  {allCollapsed ? "Open lanes" : "Team summary"}
                  <kbd className={s.kbd}>C</kbd>
                </button>
              </div>
            </div>
          ) : null}

          <div ref={bannerRef}>
          <AnimatePresence initial={false}>
            {showBanner && suggestion ? (
              <BalanceBanner
                key="banner"
                from={suggestion.from}
                to={suggestion.to}
                over={suggestion.over}
                room={suggestion.room}
                count={suggestion.taskIds.length}
                proposing={proposing}
                onPropose={() => {
                  setProposing(true);
                  window.setTimeout(() => {
                    document
                      .querySelector(`[data-card="${suggestion.taskIds[0]}"]`)
                      ?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
                  }, 60);
                  setCollapsed((c) => {
                    const n = new Set(c);
                    n.delete(suggestion.from.id);
                    n.delete(suggestion.to.id);
                    return n;
                  });
                }}
                onAccept={acceptSuggestion}
                onCancel={() => setProposing(false)}
                onDismiss={() => setDismissed(suggestionKey)}
              />
            ) : null}
          </AnimatePresence>
          </div>
        </header>

        {phone ? (
          <PhoneBoard
            set={set}
            lens={lens}
            lanes={lanes}
            tasks={tasks}
            slots={slots}
            handoffs={handoffs}
            suggestedIds={suggestedIds}
            onHandOver={setHandOverId}
          />
        ) : (
          <LayoutGroup>
            <div
              className={s.grid}
              style={{ gridTemplateColumns: `var(--rail) repeat(${stages.length}, minmax(200px, 1fr))` } as CSSProperties}
              role="grid"
              aria-label={lens === "person" ? "Tasks by person and stage" : "Tasks by project and stage"}
            >
              {/* column heads */}
              <div className={s.colHeads} role="row">
                <div className={s.colCorner} role="columnheader">
                  {lens === "person" ? "People" : "Projects"}
                </div>
                {stages.map((st) => {
                  const n = tasks.filter((t) => t.stage === st.id && visible(t)).length;
                  return (
                    <div key={st.id} className={s.colHead} role="columnheader" title={st.hint}>
                      <span className={s.stageMark} data-stage={st.id} aria-hidden />
                      <span className={s.colName}>{st.label}</span>
                      <span className={s.colCount}>{n}</span>
                    </div>
                  );
                })}
              </div>

              {lanes.map((lane) => {
                const laneTasks = tasks.filter((t) => laneIdOf(t, lens) === lane.id);
                const open = laneTasks.filter(isOpen);
                const done = laneTasks.length - open.length;
                const person = lane.kind === "person" ? lane.person : null;
                const isCollapsed = collapsed.has(lane.id);
                const isOver = !!drag && overLane === lane.id && dragSourceLane !== lane.id;
                const isSource = !!drag && dragSourceLane === lane.id && overLane !== lane.id && overLane !== null;
                const proposedIn = proposing && suggestion && person?.id === suggestion.to.id ? suggestion.taskIds.length : 0;
                const proposedOut = proposing && suggestion && person?.id === suggestion.from.id ? suggestion.taskIds.length : 0;
                const incoming = lens === "person" && isOver ? 1 : proposedIn;
                const leaving = lens === "person" && isSource ? 1 : proposedOut;
                const projectHue = lane.kind === "project" ? lane.project.hue : null;
                const laneStyle = projectHue ? ({ "--stripe": `var(--v3-project-${projectHue})` } as CSSProperties) : undefined;

                const toggle = () =>
                  setCollapsed((c) => {
                    const n = new Set(c);
                    if (n.has(lane.id)) n.delete(lane.id);
                    else n.add(lane.id);
                    return n;
                  });

                if (isCollapsed) {
                  return (
                    <motion.div
                      layout="position"
                      key={lane.id}
                      className={clsx(
                        s.lane,
                        s.laneCollapsed,
                        lane.kind === "unassigned" && s.laneUnassigned,
                        person?.away && s.laneAway,
                        projectHue && s.laneProject,
                        isOver && s.laneDropping,
                      )}
                      style={laneStyle}
                      role="row"
                      data-drop={`${lane.id}|todo`}
                    >
                      <button type="button" className={s.summaryRow} onClick={toggle} aria-expanded={false}>
                        <LaneAvatar lane={lane} size={28} />
                        <span className={s.summaryName}>{laneTitle(lane)}</span>
                        <span className={s.summaryText}>{summaryLine(lane)}</span>
                        {person ? (
                          <span className={s.summaryMeter}>
                            <CapacityMeter load={load(person.id)} capacity={person.capacity} slots={slots} incoming={incoming} leaving={leaving} away={!!person.away} compact />
                          </span>
                        ) : null}
                        <span className={s.summaryStages}>
                          {STAGES.filter((st) => st.id !== "done").map((st) => {
                            const n = open.filter((t) => t.stage === st.id).length;
                            return (
                              <span key={st.id} className={clsx(s.summaryStage, !n && s.summaryZero)} title={`${n} ${st.label.toLowerCase()}`}>
                                <span className={s.stageMark} data-stage={st.id} aria-hidden />
                                {n}
                              </span>
                            );
                          })}
                        </span>
                        {person && !person.away ? (
                          <span className={clsx(s.summaryWords, load(person.id) > person.capacity && s.meterOver)}>
                            {load(person.id)} of {person.capacity}
                          </span>
                        ) : (
                          <span className={s.summaryWords} />
                        )}
                        <IconChevron className={s.summaryChevron} width={14} height={14} />
                      </button>
                    </motion.div>
                  );
                }

                const emptyLane = open.filter(visible).length === 0 && !(showDone && done > 0);

                return (
                  <motion.div
                    layout="position"
                    key={lane.id}
                    className={clsx(
                      s.lane,
                      lane.kind === "unassigned" && s.laneUnassigned,
                      lane.kind === "unassigned" && open.length === 0 && s.laneUnassignedDone,
                      person?.away && s.laneAway,
                      projectHue && s.laneProject,
                      isOver && s.laneDropping,
                    )}
                    style={laneStyle}
                    role="row"
                  >
                    {/* rail */}
                    <div className={s.rail} role="rowheader">
                      <div className={s.railInner}>
                      <div className={s.railTop}>
                        <LaneAvatar lane={lane} size={32} />
                        <div className={s.railWho}>
                          <span className={s.railName}>
                            {lane.kind === "person" ? lane.person.name : laneTitle(lane)}
                          </span>
                          <span className={s.railRole}>
                            {lane.kind === "person" ? (
                              lane.person.away ? (
                                <span className={s.awayNote}>
                                  <IconMoon width={12} height={12} />
                                  {lane.person.away}
                                </span>
                              ) : (
                                lane.person.role
                              )
                            ) : lane.kind === "project" ? (
                              lane.project.note
                            ) : open.length ? (
                              `${plural(open.length, "task")} need someone`
                            ) : (
                              "All claimed"
                            )}
                          </span>
                        </div>
                        <button type="button" className={s.collapseBtn} onClick={toggle} aria-label={`Collapse ${laneTitle(lane)}`} aria-expanded>
                          <IconChevron width={14} height={14} />
                        </button>
                      </div>
                      {person ? (
                        <>
                          <CapacityMeter load={load(person.id)} capacity={person.capacity} slots={slots} incoming={incoming} leaving={leaving} away={!!person.away} />
                          <RailFacts tasks={open} />
                        </>
                      ) : lane.kind === "unassigned" ? (
                        <p className={s.railHint}>{open.length ? "Unowned work is the easiest to lose. Drag each one to someone with room." : "Nice and clear."}</p>
                      ) : lane.kind === "project" ? (
                        <ProjectPeople tasks={open} personById={personById} />
                      ) : null}
                      {done > 0 && !showDone ? (
                        <button type="button" className={s.doneLink} onClick={() => setShowDone(true)}>
                          <IconCheck width={12} height={12} />
                          {done} done this week
                        </button>
                      ) : null}
                      </div>
                    </div>

                    {/* cells */}
                    {emptyLane ? (
                      <div className={s.emptyCell} style={{ gridColumn: `2 / span ${stages.length}` }} data-drop={`${lane.id}|todo`}>
                        {lane.kind === "unassigned" ? (
                          <>
                            <span className={s.emptyIcon} data-tone="ok">
                              <IconCheck width={14} height={14} />
                            </span>
                            <span>
                              <strong>Every task has an owner.</strong> Drop something here if it needs a new home.
                            </span>
                          </>
                        ) : person?.away ? (
                          <span>
                            <strong>{person.first} is {lowerFirst(person.away)}.</strong> Anything dropped here waits for them.
                          </span>
                        ) : person ? (
                          <span>
                            <strong>Nothing on {person.first}&apos;s plate.</strong> Drag something here or leave room for {set.leaveRoomFor}.
                          </span>
                        ) : (
                          <span>Nothing open in this project.</span>
                        )}
                      </div>
                    ) : lane.kind === "unassigned" ? (
                      <div
                        className={clsx(s.tray, drag?.over?.lane === NO_OWNER && dragSourceLane !== NO_OWNER && s.cellHot)}
                        style={{ gridColumn: `2 / span ${stages.length}` }}
                        data-drop={`${NO_OWNER}|keep`}
                        role="gridcell"
                        aria-label="Tasks without an owner"
                      >
                        {laneTasks.filter(visible).map(renderCard)}
                        {drag?.over?.lane === NO_OWNER && dragSourceLane !== NO_OWNER ? (
                          <div className={s.dropHint}>Leave without an owner</div>
                        ) : null}
                        {adding === lane.id ? (
                          <input
                            className={s.addInput}
                            autoFocus
                            value={draft}
                            placeholder="A task for anyone"
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => {
                              setAdding(null);
                              setDraft("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") addTask(lane.id);
                              if (e.key === "Escape") {
                                setAdding(null);
                                setDraft("");
                              }
                            }}
                            aria-label="New task title"
                          />
                        ) : (
                          <button type="button" className={clsx(s.addBtn, s.trayAdd)} onClick={() => setAdding(lane.id)}>
                            <IconPlus width={13} height={13} />
                            Add a task for anyone
                          </button>
                        )}
                      </div>
                    ) : (
                      stages.map((st) => {
                        const key = `${lane.id}|${st.id}`;
                        const cellTasks = laneTasks.filter((t) => t.stage === st.id && visible(t));
                        const expanded = expandedCells.has(key);
                        const shown = expanded || cellTasks.slice(CELL_CAP).some((x) => suggestedIds.has(x.id)) ? cellTasks : cellTasks.slice(0, CELL_CAP);
                        const hidden = cellTasks.length - shown.length;
                        const hot = drag?.over?.lane === lane.id && drag.over.stage === st.id;
                        const addHere = st.id === "todo" && !person?.away;
                        return (
                          <div key={st.id} className={clsx(s.cell, hot && s.cellHot)} data-drop={key} role="gridcell" aria-label={`${laneTitle(lane)}, ${st.label}`}>
                            {shown.map(renderCard)}
                            {hot && dragTask && (laneIdOf(dragTask, lens) !== lane.id || dragTask.stage !== st.id) ? (
                              <div className={s.dropHint}>
                                {lens === "person" && laneIdOf(dragTask, lens) !== lane.id
                                  ? person
                                    ? person.away
                                      ? `${person.first} is away. You'll be asked first.`
                                      : `Give to ${person.first}`
                                    : "Leave without an owner"
                                  : `Move to ${st.label}`}
                              </div>
                            ) : null}
                            {hidden > 0 ? (
                              <button type="button" className={s.moreBtn} onClick={() => setExpandedCells((c) => new Set(c).add(key))}>
                                Show {hidden} more
                              </button>
                            ) : null}
                            {expanded && cellTasks.length > CELL_CAP ? (
                              <button
                                type="button"
                                className={s.moreBtn}
                                onClick={() =>
                                  setExpandedCells((c) => {
                                    const n = new Set(c);
                                    n.delete(key);
                                    return n;
                                  })
                                }
                              >
                                Show fewer
                              </button>
                            ) : null}
                            {addHere ? (
                              adding === lane.id ? (
                                <input
                                  className={s.addInput}
                                  autoFocus
                                  value={draft}
                                  placeholder={person ? `A task for ${person.first}` : "A task for anyone"}
                                  onChange={(e) => setDraft(e.target.value)}
                                  onBlur={() => {
                                    setAdding(null);
                                    setDraft("");
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") addTask(lane.id);
                                    if (e.key === "Escape") {
                                      setAdding(null);
                                      setDraft("");
                                    }
                                  }}
                                  aria-label="New task title"
                                />
                              ) : (
                                <button type="button" className={s.addBtn} onClick={() => setAdding(lane.id)}>
                                  <IconPlus width={13} height={13} />
                                  Add
                                </button>
                              )
                            ) : null}
                            {!cellTasks.length && !hot && !addHere ? <span className={s.cellEmpty} aria-hidden /> : null}
                          </div>
                        );
                      })
                    )}
                  </motion.div>
                );
              })}
            </div>
          </LayoutGroup>
        )}

        {/* the proposal stays in reach while the board scrolls to the cards */}
        <AnimatePresence>
          {proposing && suggestion && !bannerInView ? (
            <motion.div
              key="proposal"
              className={s.proposal}
              role="region"
              aria-label="Suggested swap"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              <span className={s.proposalFaces} aria-hidden>
                <Avatar person={suggestion.from} size={24} />
                <IconArrow width={14} height={14} />
                <Avatar person={suggestion.to} size={24} />
              </span>
              <span className={s.proposalText}>
                Move {plural(suggestion.taskIds.length, "card")} to {suggestion.to.first}?
              </span>
              <button type="button" className={s.btnGhost} onClick={() => setProposing(false)}>
                Not now
              </button>
              <button type="button" className={s.btnPrimary} onClick={acceptSuggestion}>
                Move {suggestion.taskIds.length}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* floating card while dragging */}
        {drag && dragTask ? (
          <div className={s.dragLayer} style={{ transform: `translate(${drag.x - drag.ox}px, ${drag.y - drag.oy}px)`, width: drag.w }} aria-hidden>
            <div className={s.dragTilt}>
              <CompactCard
                task={dragTask}
                lens={lens}
                project={projectById.get(dragTask.project)}
                owner={dragTask.owner ? personById.get(dragTask.owner) ?? null : null}
                handoff={null}
                suggested={false}
                selected={false}
                lifted
                onPointerDown={() => {}}
                onHandOver={() => {}}
                onSelect={() => {}}
                onKeyDown={() => {}}
              />
            </div>
          </div>
        ) : null}

        <AnimatePresence>
          {handOverId ? (
            <HandOverSheet
              key="sheet"
              task={tasks.find((t) => t.id === handOverId) as Task}
              people={people}
              tasksLoad={load}
              slots={slots}
              onPick={handOver}
              onClose={() => setHandOverId(null)}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {confirmAway ? (
            <AwayConfirm
              key="away"
              person={personById.get(confirmAway.lane) as Person}
              task={tasks.find((t) => t.id === confirmAway.taskId) as Task}
              owner={(() => {
                const t = tasks.find((x) => x.id === confirmAway.taskId);
                return t?.owner ? personById.get(t.owner) ?? null : null;
              })()}
              onConfirm={() => {
                applyMove(confirmAway.taskId, confirmAway.lane, confirmAway.stage);
                setConfirmAway(null);
              }}
              onCancel={() => setConfirmAway(null)}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              className={s.toast}
              role="status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
            >
              <span>{toast.text}</span>
              {toast.undo ? (
                <button
                  type="button"
                  className={s.toastBtn}
                  onClick={() => {
                    if (toast.undo) setTasks(toast.undo);
                    setToast(null);
                  }}
                >
                  Undo
                </button>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </MotionConfig>
  );
}

function LaneAvatar({ lane, size }: { lane: Lane; size: number }) {
  if (lane.kind === "person") return <Avatar person={lane.person} size={size} />;
  if (lane.kind === "unassigned") return <Avatar person={null} size={size} />;
  return (
    <span
      className={s.projectTile}
      style={{ width: size, height: size, background: `var(--v3-project-${lane.project.hue})`, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {lane.project.short
        .split(/[\s&]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("")}
    </span>
  );
}

function RailFacts({ tasks }: { tasks: Task[] }) {
  const late = tasks.filter((t) => t.due?.tone === "late").length;
  const soon = tasks.filter((t) => t.due?.tone === "soon").length;
  const waiting = tasks.filter((t) => t.stage === "waiting").length;
  const facts = [
    late ? { k: "late", text: `${late} past due`, tone: "late" } : null,
    soon ? { k: "soon", text: `${soon} due in a day`, tone: "soon" } : null,
    waiting ? { k: "wait", text: `${waiting} waiting on others`, tone: "wait" } : null,
  ].filter((x): x is { k: string; text: string; tone: string } => !!x);
  if (!facts.length) return null;
  return (
    <ul className={s.facts}>
      {facts.map((f) => (
        <li key={f.k} className={s.fact}>
          <span className={s.factDot} data-tone={f.tone} aria-hidden />
          {f.text}
        </li>
      ))}
    </ul>
  );
}

function ProjectPeople({ tasks, personById }: { tasks: Task[]; personById: Map<string, Person> }) {
  const ids = [...new Set(tasks.map((t) => t.owner).filter((x): x is string => !!x))];
  const unowned = tasks.filter((t) => !t.owner).length;
  return (
    <div className={s.projectPeople}>
      <span className={s.stack}>
        {ids.slice(0, 4).map((id) => (
          <Avatar key={id} person={personById.get(id) ?? null} size={24} className={s.stackFace} />
        ))}
      </span>
      <span className={s.railRole}>
        {plural(tasks.length, "open task")}
        {unowned ? `, ${unowned} unowned` : ""}
      </span>
    </div>
  );
}

function AwayConfirm({
  person,
  task,
  owner,
  onConfirm,
  onCancel,
}: {
  person: Person;
  task: Task;
  owner: Person | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div className={s.sheetScrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div
        className={clsx(s.sheet, s.confirm)}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="c2-away-title"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      >
        <div className={s.confirmHead}>
          <LoadRing load={0} capacity={person.capacity} size={48}>
            <Avatar person={person} size={38} />
          </LoadRing>
          <div>
            <h2 id="c2-away-title" className={s.sheetTitle}>
              {person.first} is {lowerFirst(person.away ?? "")}
            </h2>
            <p className={s.sheetSub}>
              &ldquo;{task.title}&rdquo; would sit untouched until then.
              {task.due ? ` It is due ${task.due.label.toLowerCase().startsWith("today") || task.due.label.toLowerCase().startsWith("tomorrow") ? task.due.label.toLowerCase() : task.due.label}.` : ""}
            </p>
          </div>
        </div>
        <div className={s.confirmActions}>
          <button type="button" className={s.btnGhost} onClick={onCancel} autoFocus>
            {owner ? `Keep with ${owner.first}` : "Keep it unowned"}
          </button>
          <button type="button" className={s.btnPrimary} onClick={onConfirm}>
            Give it to {person.first} anyway
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
