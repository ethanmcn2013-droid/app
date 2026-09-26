"use client";

import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type DragEvent } from "react";
import {
  fmtTime,
  GUESTS,
  initialBenches,
  MF_STEPS,
  ORCHARD_STEPS,
  OUTLINE,
  paneId,
  PEOPLE,
  projectById,
  PROJECTS,
  TABLES,
  TASKS,
  toolById,
  type Bench,
  type PaneState,
  type ProjectId,
  type Step,
  type ToolId,
} from "./data";
import { BenchCtx, cx, outside, type BenchApi, type DragItem, type SendTarget } from "./ctx";
import { AddToolPopover, BenchBar, EdgeTab, GhostPane, PaneFrame, PaneResizer, SendSheet, Toast, ToolRail, ToolTile, type SendOption } from "./chrome";
import { DayPlanBody, SuppliersBody, TasksBody, TimerBody } from "./tools-day";
import { GuestsBody, SeatingBody } from "./tools-people";
import { EarlyBody, FailedBody, FilesBody, NotesBody, OutlineBody, PressBody, ProofsBody, SocialBody, SplitBody, StudyBody } from "./tools-other";
import s from "./c5.module.css";

type Mode = "bench" | "first" | "failed";

/* The preview state can come from the address (?state=first) for review links. */
const noop = () => () => {};
let ticks = 0;
const nextTick = () => (ticks += 1);
const readMode = (): Mode => {
  const v = new URLSearchParams(window.location.search).get("state");
  return v === "first" || v === "failed" ? v : "bench";
};

export default function WorkbenchConcept() {
  const urlMode = useSyncExternalStore(noop, readMode, () => "bench" as Mode);
  const [picked, setPicked] = useState<Mode | null>(null);
  const mode = picked ?? urlMode;
  return (
    <MotionConfig reducedMotion="user">
      <Workbench key={mode} mode={mode} onMode={setPicked} />
    </MotionConfig>
  );
}

/* ── pane bodies ─────────────────────────────────────────────────── */

function PaneBody({ tool, project }: { tool: ToolId; project: ProjectId }) {
  switch (tool) {
    case "tasks":
      return <TasksBody />;
    case "seating":
      return project === "mf" || project === "orchard" ? <SeatingBody /> : <EarlyBody tool={tool} />;
    case "guests":
      return project === "mf" ? <GuestsBody /> : <EarlyBody tool={tool} />;
    case "dayplan":
      return project === "mf" || project === "orchard" ? <DayPlanBody /> : <EarlyBody tool={tool} />;
    case "suppliers":
      return project === "orchard" ? <SuppliersBody /> : <EarlyBody tool={tool} />;
    case "timer":
      return project === "orchard" ? <TimerBody /> : <EarlyBody tool={tool} />;
    case "outline":
      return <OutlineBody />;
    case "split":
      return <SplitBody />;
    case "study":
      return <StudyBody />;
    case "social":
      return <SocialBody />;
    case "press":
      return <PressBody />;
    case "proofs":
      return <ProofsBody />;
    case "notes":
      return <NotesBody />;
    case "files":
      return <FilesBody />;
    default:
      return <EarlyBody tool={tool} />;
  }
}

const LINKS: [ToolId, ToolId, string][] = [
  ["seating", "guests", "Seating and Guest list are linked: pick a table to see who is at it"],
  ["tasks", "dayplan", "Tasks and Day plan are linked: drag a task onto a time"],
  ["dayplan", "timer", "The timer follows the Day plan"],
  ["outline", "split", "Group split follows who has each part of the Shared doc"],
  ["tasks", "seating", "The seating task shows how many tables are full"],
];
const linkBetween = (a: ToolId, b: ToolId) => LINKS.find(([x, y]) => (x === a && y === b) || (x === b && y === a))?.[2] ?? null;

const MIN_PANE = 260;

/* ── the bench ───────────────────────────────────────────────────── */

type ToastState = { key: number; message: string; undo?: () => void };

function Workbench({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
  const [benches, setBenches] = useState<Bench[]>(() => initialBenches(mode === "first"));
  const [activeId, setActiveId] = useState("mf-week");
  const [direction, setDirection] = useState(1);
  const [onTools, setOnTools] = useState<Record<ProjectId, ToolId[]>>(() => Object.fromEntries(PROJECTS.map((p) => [p.id, p.on])) as Record<ProjectId, ToolId[]>);

  const [tasks, setTasks] = useState(TASKS);
  const [guests, setGuests] = useState(GUESTS);
  const [tables, setTables] = useState(TABLES);
  const [orchardSteps, setOrchardSteps] = useState<Step[]>(ORCHARD_STEPS);
  const [sections, setSections] = useState(OUTLINE);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const [drag, setDrag] = useState<DragItem | null>(null);
  const [insert, setInsert] = useState<{ idx: number; x: number } | null>(null);
  const [send, setSend] = useState<SendTarget | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pulse, setPulse] = useState<string | null>(null);
  const [wide, setWide] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(() => new Set(mode === "failed" ? ["seating-mf"] : []));
  const [retrying, setRetrying] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [freshTool, setFreshTool] = useState<ToolId | null>(null);
  const [phoneIdx, setPhoneIdx] = useState(0);
  const [scrollTo, setScrollTo] = useState<{ id: string; n: number } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [rootW, setRootW] = useState<number | null>(null);
  const [areaW, setAreaW] = useState(1100);

  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => {
      if (rootRef.current) setRootW(rootRef.current.clientWidth);
      if (areaRef.current) setAreaW(areaRef.current.clientWidth);
    });
    if (rootRef.current) ro.observe(rootRef.current);
    if (areaRef.current) ro.observe(areaRef.current);
    return () => ro.disconnect();
  }, []);

  const phone = rootW !== null && rootW < 640;
  const bench = benches.find((b) => b.id === activeId) ?? benches[0];
  const project = bench.project;

  /* Which panes show, which tuck to the edge. */
  const capacity = phone ? Infinity : areaW >= 960 ? 3 : areaW >= 560 ? 2 : 1;
  const { visible, tucked } = useMemo(() => {
    const panes = bench.panes;
    if (phone) return { visible: panes, tucked: [] as PaneState[] };
    if (wide && panes.some((p) => p.id === wide)) return { visible: panes.filter((p) => p.id === wide), tucked: panes.filter((p) => p.id !== wide) };
    if (panes.length <= capacity) return { visible: panes, tucked: [] as PaneState[] };
    const keep = new Set([...panes].sort((a, b) => b.used - a.used).slice(0, capacity).map((p) => p.id));
    return { visible: panes.filter((p) => keep.has(p.id)), tucked: panes.filter((p) => !keep.has(p.id)) };
  }, [bench.panes, capacity, phone, wide]);

  const tuckedW = tucked.length ? 52 : 0;
  const totalWeight = visible.reduce((a, p) => a + p.weight, 0) || 1;
  const usable = Math.max(1, areaW - tuckedW - (visible.length - 1) * 14 - 24);
  const pxPerWeight = usable / totalWeight;

  /* ── small timers ── */
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 2200);
    return () => window.clearTimeout(id);
  }, [flash]);
  useEffect(() => {
    if (!pulse) return;
    const id = window.setTimeout(() => setPulse(null), 900);
    return () => window.clearTimeout(id);
  }, [pulse]);
  useEffect(() => {
    if (!justSaved) return;
    const id = window.setTimeout(() => setJustSaved(false), 2600);
    return () => window.clearTimeout(id);
  }, [justSaved]);
  useEffect(() => {
    if (!freshTool) return;
    const id = window.setTimeout(() => setFreshTool(null), 1200);
    return () => window.clearTimeout(id);
  }, [freshTool]);
  useEffect(() => {
    if (!retrying) return;
    const id = window.setTimeout(() => {
      setFailed((f) => {
        const n = new Set(f);
        n.delete(retrying);
        return n;
      });
      setRetrying(null);
    }, 1100);
    return () => window.clearTimeout(id);
  }, [retrying]);
  /* On a phone, bring the pane you asked for into view. */
  useEffect(() => {
    if (!scrollTo || !phone) return;
    const el = areaRef.current?.querySelector<HTMLElement>(`[data-wrap="${scrollTo.id}"]`);
    if (el && areaRef.current) areaRef.current.scrollTo({ left: el.offsetLeft - 12, behavior: "smooth" });
  }, [scrollTo, phone]);

  const say = useCallback((message: string, undo?: () => void) => setToast({ key: nextTick(), message, undo }), []);

  /* ── bench edits ── */
  const updateBench = useCallback((id: string, fn: (b: Bench) => Bench) => setBenches((bs) => bs.map((b) => (b.id === id ? fn(b) : b))), []);
  const maxUsed = Math.max(0, ...bench.panes.map((p) => p.used));

  const touch = (pid: string) => {
    const p = bench.panes.find((x) => x.id === pid);
    if (!p || p.used === maxUsed) return;
    updateBench(bench.id, (b) => ({ ...b, panes: b.panes.map((x) => (x.id === pid ? { ...x, used: maxUsed + 1 } : x)) }));
  };

  const openTool = (tool: ToolId, at?: number) => {
    const existing = bench.panes.find((p) => p.tool === tool);
    if (existing) {
      focusPaneId(existing.id);
      return;
    }
    const avg = visible.length ? visible.reduce((a, p) => a + p.weight, 0) / visible.length : 1;
    const pane: PaneState = { id: paneId(tool), tool, weight: avg, used: maxUsed + 1 };
    setWide(null);
    updateBench(bench.id, (b) => {
      const panes = [...b.panes];
      panes.splice(at ?? panes.length, 0, pane);
      return { ...b, panes };
    });
    setScrollTo({ id: pane.id, n: nextTick() });
  };

  const focusPaneId = (pid: string) => {
    touch(pid);
    if (wide && wide !== pid) setWide(null);
    setPulse(pid);
    setScrollTo({ id: pid, n: nextTick() });
  };
  const focusPane = (tool: ToolId) => {
    const p = bench.panes.find((x) => x.tool === tool);
    if (p) focusPaneId(p.id);
    else openTool(tool);
  };

  const closePane = (pid: string) => {
    const before = bench;
    updateBench(bench.id, (b) => ({ ...b, panes: b.panes.filter((p) => p.id !== pid) }));
    if (wide === pid) setWide(null);
    const name = toolById(before.panes.find((p) => p.id === pid)!.tool).name;
    say(`${name} closed. It is still on, in the tools on the left`, () => updateBench(before.id, () => before));
  };

  const switchBench = (id: string) => {
    if (id === bench.id) return;
    const from = benches.findIndex((b) => b.id === bench.id);
    const to = benches.findIndex((b) => b.id === id);
    setDirection(to > from ? 1 : -1);
    setActiveId(id);
    setSelectedTable(null);
    setWide(null);
    setMoreOpen(false);
    setPhoneIdx(0);
    areaRef.current?.scrollTo({ left: 0 });
  };

  const saveBench = () => {
    updateBench(bench.id, (b) => ({ ...b, saved: true }));
    setJustSaved(true);
    say(`Saved as “${bench.name}”. It is in your benches above`);
  };

  const newBench = () => {
    const p = projectById(project);
    const id = `b-${nextTick()}`;
    const nb: Bench = { id, name: `${p.name}: Friday 25 September`, project, saved: false, panes: [{ id: paneId("tasks"), tool: "tasks", weight: 1, used: 1 }] };
    setBenches((bs) => [...bs.filter((b) => b.saved || b.id === bench.id), nb]);
    setDirection(1);
    setActiveId(id);
    setWide(null);
  };

  const turnOn = (tool: ToolId) => {
    setOnTools((o) => ({ ...o, [project]: [...o[project], tool] }));
    setFreshTool(tool);
    setMoreOpen(false);
    openTool(tool);
    say(`${toolById(tool).name} is on for ${projectById(project).name}`);
  };

  /* ── resizing ── */
  const resizeBy = (i: number, dWeight: number) => {
    const a = visible[i];
    const b = visible[i + 1];
    const min = MIN_PANE / pxPerWeight;
    let wa = a.weight + dWeight;
    let wb = b.weight - dWeight;
    if (wa < min) {
      wb -= min - wa;
      wa = min;
    }
    if (wb < min) {
      wa -= min - wb;
      wb = min;
    }
    updateBench(bench.id, (bn) => ({ ...bn, panes: bn.panes.map((p) => (p.id === a.id ? { ...p, weight: wa } : p.id === b.id ? { ...p, weight: wb } : p)) }));
  };

  /* ── shared work ── */
  const placeTask = (taskId: string, at: number) => {
    const prev = tasks;
    const task = tasks.find((x) => x.id === taskId);
    setTasks((ts) => ts.map((x) => (x.id === taskId ? { ...x, at } : x)));
    setFlash(taskId);
    if (!bench.panes.some((p) => p.tool === "dayplan")) openTool("dayplan");
    say(`${task?.title} is on the Day plan at ${fmtTime(at)}. Tasks shows the time too`, () => setTasks(prev));
  };
  const unplaceTask = (taskId: string) => {
    const prev = tasks;
    setTasks((ts) => ts.map((x) => (x.id === taskId ? { ...x, at: undefined } : x)));
    say("Taken off the Day plan. It is still in Tasks", () => setTasks(prev));
  };
  const nudgeTask = (taskId: string, delta: number) => setTasks((ts) => ts.map((x) => (x.id === taskId && x.at !== undefined ? { ...x, at: Math.min(25 * 60, Math.max(8 * 60, x.at + delta)) } : x)));
  const seatGuest = (guestId: string, table: number | null) => {
    const prev = guests;
    const g = guests.find((x) => x.id === guestId);
    setGuests((gs) => gs.map((x) => (x.id === guestId ? { ...x, table } : x)));
    say(`${g?.name} is at Table ${table}`, () => setGuests(prev));
  };
  const addTable = () => {
    const n = tables.length + 1;
    setTables((t) => [...t, { n, seats: 8 }]);
    say(`Table ${n} added, with eight seats`, () => setTables((t) => t.filter((x) => x.n !== n)));
  };
  const pushLater = (fromAt: number, minutes: number) => {
    const prev = orchardSteps;
    setOrchardSteps((st) => st.map((x) => (x.at >= fromAt ? { ...x, at: x.at + minutes } : x)));
    say(`Everything from ${fmtTime(fromAt)} moved ${minutes} minutes later. The Day plan and the band see it now`, () => setOrchardSteps(prev));
  };
  const reassign = (sectionId: string, who: (typeof sections)[number]["who"]) => {
    const prev = sections;
    const sec = sections.find((x) => x.id === sectionId);
    setSections((ss) => ss.map((x) => (x.id === sectionId ? { ...x, who } : x)));
    setFlash(sectionId);
    say(`“${sec?.title}” is now ${PEOPLE[who].name.split(" ")[0]}'s. The Shared doc shows it`, () => setSections(prev));
  };
  const toggleTask = (id: string) => setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));

  const openSet = useMemo(() => new Set(bench.panes.map((p) => p.tool)), [bench.panes]);

  const api: BenchApi = {
    project,
    tasks,
    toggleTask,
    guests,
    tables,
    seatGuest,
    addTable,
    selectedTable,
    selectTable: (n) => {
      setSelectedTable(n);
      if (n !== null && !openSet.has("guests") && project === "mf") say(`Table ${n} picked. Open Guest list to see who is at it`);
    },
    mfSteps: MF_STEPS,
    orchardSteps,
    placeTask,
    unplaceTask,
    nudgeTask,
    pushLater,
    sections,
    reassign,
    drag,
    setDrag: (d) => {
      setDrag(d);
      if (!d) setInsert(null);
    },
    openSend: setSend,
    flash,
    isOpen: (t) => openSet.has(t),
    openTool: (t) => openTool(t),
    focusPane,
    say,
  };

  /* ── dragging a tool in from the rail ── */
  const onAreaDragOver = (e: DragEvent) => {
    if (drag?.kind !== "tool" || phone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const wraps = [...(areaRef.current?.querySelectorAll<HTMLElement>("[data-wrap]") ?? [])];
    const area = areaRef.current!.getBoundingClientRect();
    let idx = wraps.length;
    for (let i = 0; i < wraps.length; i += 1) {
      const r = wraps[i].getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) {
        idx = i;
        break;
      }
    }
    const ref = wraps[idx] ?? wraps[wraps.length - 1];
    const rr = ref?.getBoundingClientRect();
    const x = !rr ? 24 : wraps[idx] ? rr.left - area.left - 7 : rr.right - area.left + 7;
    if (idx !== insert?.idx) setInsert({ idx, x });
  };
  const onAreaDrop = (e: DragEvent) => {
    if (drag?.kind !== "tool") return;
    e.preventDefault();
    const tool = drag.id;
    const vis = visible[insert?.idx ?? visible.length];
    const at = vis ? bench.panes.findIndex((p) => p.id === vis.id) : bench.panes.length;
    setDrag(null);
    setInsert(null);
    openTool(tool, at);
  };

  /* ── send sheet ── */
  const sheet = useMemo(() => {
    if (!send) return null;
    if (send.kind === "task") {
      const task = tasks.find((x) => x.id === send.id)!;
      if (task.project !== "mf") {
        return {
          title: `Send “${task.title}” to`,
          lead: "It stays in Tasks too.",
          grid: false,
          options: [
            { id: "notes", title: "Notes", sub: "Keep it with the Project's notes" },
            { id: "calendar", title: "Calendar sync", sub: "Put it in your own calendar" },
          ] as SendOption[],
        };
      }
      const items = [...MF_STEPS, ...tasks.filter((x) => x.project === "mf" && x.at !== undefined && x.id !== task.id).map((x) => ({ at: x.at!, title: x.title }))].sort((a, b) => a.at - b.at);
      const opts: SendOption[] = [];
      for (let i = 1; i < items.length; i += 1) {
        const a = items[i - 1];
        const b = items[i];
        if (b.at - a.at >= 45 && a.at >= 16 * 60) {
          const m = Math.round((a.at + b.at) / 2 / 15) * 15;
          opts.push({ id: `at-${m}`, title: fmtTime(m), sub: `Between “${a.title}” and “${b.title}”` });
        }
      }
      return {
        title: `Give “${task.title}” a time`,
        lead: "It goes on the Day plan for Saturday 3 October and stays in Tasks, with the time beside it.",
        grid: false,
        options: [...opts.slice(0, 5), { id: "notes", title: "Or keep it in Notes", sub: "No time needed" }],
      };
    }
    const g = guests.find((x) => x.id === send.id)!;
    return {
      title: `Give ${g.name} a table`,
      lead: g.table ? `Now at Table ${g.table}.` : "Tables with a free seat are ready to pick.",
      grid: true,
      options: tables.map((tb) => {
        const n = guests.filter((x) => x.table === tb.n).length;
        const free = tb.seats - n;
        return { id: `t-${tb.n}`, title: `Table ${tb.n}`, sub: free > 0 ? `${free} free` : "Full", disabled: free <= 0 || g.table === tb.n };
      }),
    };
  }, [send, tasks, guests, tables]);

  const pickSend = (id: string) => {
    if (!send) return;
    if (send.kind === "task" && id.startsWith("at-")) placeTask(send.id, Number(id.slice(3)));
    else if (send.kind === "guest" && id.startsWith("t-")) seatGuest(send.id, Number(id.slice(2)));
    else say(`Sent to ${id === "notes" ? "Notes" : "Calendar sync"}. It is still in Tasks`);
    setSend(null);
  };

  /* ── render ── */
  const onList = onTools[project];
  const showGhost = !phone && bench.panes.length <= 1 && !wide;
  const accepts = (tool: ToolId) => (drag?.kind === "task" && tool === "dayplan" && project === "mf") || (drag?.kind === "guest" && tool === "seating");
  const dimFor = (tool: ToolId) => !!drag && drag.kind !== "tool" && !accepts(tool) && !((drag.kind === "task" && tool === "tasks") || (drag.kind === "guest" && tool === "guests"));

  const states = (
    <label className={s.stateSelect} title="Concept only: see other states of this page">
      <span className={s.stateLabel}>Preview</span>
      <select value={mode} onChange={(e) => onMode(e.target.value as Mode)} aria-label="Preview a state of this page">
        <option value="bench">Your bench</option>
        <option value="first">First visit</option>
        <option value="failed">A tool failed</option>
      </select>
    </label>
  );

  return (
    <BenchCtx.Provider value={api}>
      <div ref={rootRef} className={cx(s.root, phone && s.phone)} onDragEnd={() => setDrag(null)}>
        <div className={s.frame}>
          <ToolRail
            project={project}
            on={onList}
            open={openSet}
            fresh={freshTool}
            onPick={(tool) => openTool(tool)}
            onMore={() => setMoreOpen((v) => !v)}
            moreOpen={moreOpen}
            footer={phone ? null : states}
            onDragTool={(d) => {
              setDrag(d);
              if (!d) setInsert(null);
            }}
          />

          <div className={s.main}>
            <LayoutGroup>
              <BenchBar
                benches={benches}
                active={bench}
                onSwitch={switchBench}
                onSave={saveBench}
                onNew={newBench}
                onRename={(name) => updateBench(bench.id, (b) => ({ ...b, name }))}
                justSaved={justSaved}
              />
            </LayoutGroup>

            {phone && (
              <div className={s.indicator} role="tablist" aria-label="Tools on this bench">
                {bench.panes.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={i === phoneIdx}
                    className={cx(s.indicatorPill, i === phoneIdx && s.indicatorOn)}
                    onClick={() => setScrollTo({ id: p.id, n: nextTick() })}
                  >
                    {toolById(p.tool).name}
                  </button>
                ))}
              </div>
            )}

            <div
              ref={areaRef}
              className={cx(s.area, drag?.kind === "tool" && s.areaDropping)}
              onDragOver={onAreaDragOver}
              onDrop={onAreaDrop}
              onDragLeave={(e) => {
                if (outside(e)) setInsert(null);
              }}
              onScroll={(e) => {
                if (!phone) return;
                const el = e.currentTarget;
                const first = el.querySelector<HTMLElement>("[data-wrap]");
                const w = first ? first.offsetWidth + 12 : el.clientWidth;
                const idx = Math.round(el.scrollLeft / w);
                if (idx !== phoneIdx) setPhoneIdx(idx);
              }}
            >
              {tucked.length > 0 && (
                <div className={s.edge} aria-label="Tucked away">
                  <AnimatePresence>
                    {tucked.map((p) => (
                      <EdgeTab
                        key={p.id}
                        tool={p.tool}
                        onOpen={() => {
                          if (wide) setWide(null);
                          focusPaneId(p.id);
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                {visible.map((p, i) => {
                  const def = toolById(p.tool);
                  const isFailed = failed.has(p.id);
                  const widthPx = p.weight * pxPerWeight;
                  const nextP = visible[i + 1];
                  return (
                    <motion.section
                      key={p.id}
                      data-wrap={p.id}
                      className={s.paneWrap}
                      style={phone ? undefined : { flex: visible.length === 1 ? "1 1 0px" : `${p.weight} 1 0px` }}
                      layout={resizing ? false : "position"}
                      custom={direction}
                      variants={paneVariants}
                      initial="enter"
                      animate="show"
                      exit="leave"
                      transition={{ type: "spring", stiffness: 340, damping: 34, delay: i * 0.03 }}
                      aria-label={`${def.name} pane`}
                    >
                      <PaneFrame
                        tool={p.tool}
                        project={project}
                        wide={wide === p.id}
                        canWiden={!phone && bench.panes.length > 1}
                        onWiden={() => setWide(wide === p.id ? null : p.id)}
                        onClose={() => closePane(p.id)}
                        onTouch={() => touch(p.id)}
                        readOnly={p.tool === "proofs"}
                        accepts={accepts(p.tool)}
                        dim={dimFor(p.tool)}
                        pulse={pulse === p.id}
                        compact={!phone && widthPx < 360}
                      >
                        {isFailed ? <FailedBody tool={p.tool} retrying={retrying === p.id} onRetry={() => setRetrying(p.id)} /> : <PaneBody tool={p.tool} project={project} />}
                      </PaneFrame>
                      {!phone && nextP && (
                        <PaneResizer
                          left={def}
                          right={toolById(nextP.tool)}
                          share={p.weight / (p.weight + nextP.weight)}
                          linked={linkBetween(p.tool, nextP.tool)}
                          onDrag={(dx) => resizeBy(i, dx / pxPerWeight)}
                          onStep={(d) => resizeBy(i, d * (p.weight + nextP.weight))}
                          onReset={() => resizeBy(i, (p.weight + nextP.weight) / 2 - p.weight)}
                          onStart={() => setResizing(true)}
                          onEnd={() => setResizing(false)}
                        />
                      )}
                    </motion.section>
                  );
                })}
              </AnimatePresence>
              {insert && drag?.kind === "tool" && <InsertMark tool={drag.id} x={insert.x} />}

              {showGhost && <GhostPane project={project} onPick={(tool) => openTool(tool)} dropActive={drag?.kind === "tool"} onDropTool={() => drag?.kind === "tool" && openTool(drag.id)} />}
            </div>

            <div className={s.toastSlot} aria-live="polite">
              <AnimatePresence>{toast && <Toast key={toast.key} message={toast.message} onClose={() => setToast(null)} onUndo={toast.undo ? () => (toast.undo!(), setToast(null)) : undefined} />}</AnimatePresence>
            </div>
          </div>
        </div>

        <AnimatePresence>{moreOpen && <AddToolPopover project={project} on={onList} onClose={() => setMoreOpen(false)} onTurnOn={turnOn} />}</AnimatePresence>
        <AnimatePresence>{sheet && <SendSheet title={sheet.title} lead={sheet.lead} options={sheet.options} grid={sheet.grid} onPick={pickSend} onClose={() => setSend(null)} />}</AnimatePresence>
      </div>
    </BenchCtx.Provider>
  );
}

const paneVariants = {
  enter: (dir: number) => ({ opacity: 0, x: 48 * dir, scale: 0.98 }),
  show: { opacity: 1, x: 0, scale: 1 },
  leave: (dir: number) => ({ opacity: 0, x: -48 * dir, scale: 0.98, transition: { duration: 0.18 } }),
};

function InsertMark({ tool, x }: { tool: ToolId; x: number }) {
  return (
    <motion.div className={s.insert} style={{ left: x }} initial={{ opacity: 0, scaleY: 0.6 }} animate={{ opacity: 1, scaleY: 1 }} aria-hidden="true">
      <ToolTile tool={tool} size={28} />
    </motion.div>
  );
}
