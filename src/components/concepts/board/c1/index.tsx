"use client";

/* The Tasks board: stage columns on the demo store. Every card is a store
   task; a drop, a quick-look edit or a new card writes through the store's
   mutations, so the list and the calendar show the same change. The board
   keeps only its own furniture: the order cards were dragged into, the
   replay and the drag physics. */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import { STAGES, boardPerson, toBoardTask, type Person, type StageKey, type Task } from "./data";
import { Avatar, cardLabel, CardFace } from "./card";
import { Icon, StageGlyph } from "./icons";
import { isLate } from "./model";
import { Scrim, Sparkline, StuckTriage, TimeMachine } from "./flow";
import { FlowIcon } from "./flow-icons";
import {
  REPLAY_DAYS,
  OPEN_STAGES,
  STUCK_STAGES,
  dayCaption,
  dayLabel,
  flowAt,
  isoFor,
  moveAt,
  movesOn,
  nextStage,
  usualTimes,
  withStage,
  type Placed,
} from "./flow-model";
import flowStyles from "./flow.module.css";
import { ViewSwitch } from "../../tasks/view-switch";
import { CardPeek, MoveSheet, StagePager, type PeekState } from "./overlays";
import {
  STUCK_DAYS,
  TEAM,
  ageInStatus,
  boardOn,
  cameIn,
  historyFor,
  movedBetween,
  statusOn,
  stuckByUrgency,
  type DemoState,
  type TaskStatus,
  type TeamPersonId,
} from "../../demo/store";
import { addTask, updateTask, useDemoStore } from "../../demo/store/client";
import { useDemoLinks } from "../../demo/links";
import { cellPatch, type CellValue } from "../../final/tasks-list/data";
import type { TaskLine } from "../../tasks/grammar";
import { nudge as sendNudge, useNudged } from "../../tasks/nudge";
import { NewTaskComposer, focusNewTask } from "../../tasks/composer";
import { NewTaskFab, TasksPageHeader, ownerLabel, useNewTaskKey, useNewTaskParam } from "../../tasks/page-header";
import { inTaskScope, storeScope, useTaskScope } from "../../tasks/scope";
import { addFromLine } from "../../tasks/task-line";
import { TaskToast, useTaskToast } from "../../tasks/toast";
import { batch, dropViewSteps, pushViewStep, undoLast, useUndoKey } from "../../tasks/undo";
import { editSentence } from "../../tasks/words";
import styles from "./board.module.css";

/* ── Small hooks ───────────────────────────────────────────────────── */

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/* ── Columns ───────────────────────────────────────────────────────── */

type Group = "stage" | "person";

type ColumnDef = {
  key: string;
  name: string;
  stage?: StageKey;
  person?: Person;
  empty: string;
};

const TEAM_PEOPLE = TEAM.map((id) => boardPerson(id)!);

function columnsFor(group: Group): ColumnDef[] {
  if (group === "stage") return STAGES.map((s) => ({ key: s.key, name: s.name, stage: s.key, empty: s.empty }));
  return TEAM_PEOPLE.map((p) => ({ key: p.id, name: p.first, person: p, empty: `Nothing open for ${p.first}.` }));
}

function inColumn(task: Task, col: ColumnDef, group: Group) {
  if (group === "stage") return task.stage === col.stage;
  if (task.stage === "done") return false;
  return task.people[0] === col.key;
}

function sortColumn(list: Task[], col: ColumnDef) {
  if (col.stage !== "done") return list;
  return [...list].sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
}

/** Until someone drags them, cards sit late first, then by date, then by priority. */
function defaultOrder(a: Task, b: Task) {
  const la = isLate(a) ? 0 : 1;
  const lb = isLate(b) ? 0 : 1;
  if (la !== lb) return la - lb;
  if (a.due !== b.due) return !a.due ? 1 : !b.due ? -1 : a.due.localeCompare(b.due);
  return b.priority - a.priority || a.id.localeCompare(b.id);
}

const HOVER_DELAY = 450;
const selectState = (s: DemoState) => s;

type DragState = { id: string; over: string | null; index: number; height: number; width: number };

/* ── Page ──────────────────────────────────────────────────────────── */

export default function StudioColumns() {
  const phone = useMedia("(max-width: 720px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const to = useDemoLinks();

  /* ── The store, inside the scope ────────────────────────────────── */
  const scope = useTaskScope();
  const { project: scopeProject, owner: scopeOwner } = scope;
  const state = useDemoStore(selectState);
  const storeTasks = state.tasks;
  const sc = useMemo(() => storeScope({ project: scopeProject, owner: scopeOwner }), [scopeProject, scopeOwner]);
  // Most urgent first, the same order as the header's sentence.
  const stuckStore = useMemo(() => stuckByUrgency(state, sc), [state, sc]);
  const nudged = useNudged();

  /** The order cards were dragged into. Board furniture, not a fact about the task. */
  const [order, setOrder] = useState<string[] | null>(null);
  /** While a card is held with the keyboard, the board as it would be if dropped now. */
  const [held, setHeld] = useState<Task[] | null>(null);

  const base = useMemo(() => {
    const keep = inTaskScope({ project: scopeProject, owner: scopeOwner });
    const list = storeTasks
      .filter(keep)
      .map((t) => toBoardTask(t, historyFor(state, t.id)))
      .sort(defaultOrder);
    if (!order) return list;
    const rank = new Map(order.map((id, i) => [id, i]));
    return list.sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
  }, [storeTasks, state, scopeProject, scopeOwner, order]);
  const tasks = held ?? base;
  const baseById = useMemo(() => new Map(base.map((t) => [t.id, t])), [base]);

  const { toast, say, close: closeToast } = useTaskToast();
  const [lateOnly, setLateOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("stage");
  const [doneOpen, setDoneOpen] = useState(false);
  const [composer, setComposer] = useState<{ col: string; sheet: boolean } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [kb, setKb] = useState<{ id: string } | null>(null);
  const [peek, setPeek] = useState<PeekState | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [phoneActive, setPhoneActive] = useState(0);
  const [railPulse, setRailPulse] = useState(0);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [menu, setMenu] = useState<"group" | null>(null);
  const [announce, setAnnounce] = useState("");
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [stuckOnly, setStuckOnly] = useState(false);
  const [triage, setTriage] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [settling, setSettling] = useState(false);

  const peopleOf = useCallback((t: Task) => t.people.map((id) => boardPerson(id)).filter(Boolean) as Person[], []);

  /* ── Flow: ages, stuck work and the replay ─────────────────────── */

  const live = day === 0;
  /* A past day is the store's own replay: `boardOn` says which column each
     task stood in at the end of that day, and tasks not yet created drop out. */
  const pastStages = useMemo(() => {
    if (day === 0) return null;
    const board = boardOn(state, isoFor(day), sc);
    const m = new Map<string, TaskStatus>();
    for (const [st, list] of Object.entries(board) as [TaskStatus, typeof storeTasks][]) for (const t of list) m.set(t.id, st);
    return m;
  }, [state, sc, day]);
  const viewTasks = useMemo(() => {
    if (!pastStages) return tasks;
    const out: Task[] = [];
    for (const t of tasks) {
      const stage = pastStages.get(t.id);
      if (!stage) continue;
      const at = moveAt(t, day);
      out.push({ ...t, stage, doneAt: stage === "done" ? isoFor(at?.day ?? day) : undefined, heldBy: stage === "waiting" ? t.heldBy : undefined });
    }
    return out;
  }, [tasks, pastStages, day]);
  /* Each column's week, from the event log: what came in, what moved on. */
  const weekFlow = useMemo(() => {
    const from = isoFor(day - 6);
    const to = isoFor(day);
    const moves = movedBetween(state, from, to, sc);
    const moved = new Set(moves.map((m) => m.task.id));
    const out = {} as Record<StageKey, { inn: number; out: number }>;
    for (const st of STAGES) out[st.key] = { inn: 0, out: 0 };
    for (const m of moves) {
      out[m.to].inn += 1;
      if (m.from && m.from !== m.to) out[m.from].out += 1;
    }
    for (const t of cameIn(state, from, to, sc)) {
      if (moved.has(t.id)) continue;
      const st = statusOn(state, t, to);
      if (st) out[st].inn += 1;
    }
    return out;
  }, [state, sc, day]);
  const usual = useMemo(() => usualTimes(tasks), [tasks]);
  const flows = useMemo(() => flowAt(tasks, day), [tasks, day]);
  // Stuck is the store's rule, so every view counts the same four.
  const stuck: Placed[] = useMemo(
    () =>
      stuckStore.map((t) => {
        const age = ageInStatus(t);
        return { task: baseById.get(t.id) ?? toBoardTask(t), stage: t.status, since: -age, age };
      }),
    [stuckStore, baseById],
  );
  const ageById = useMemo(() => new Map(stuck.map((p) => [p.task.id, p])), [stuck]);
  const stuckIds = useMemo(() => new Set(stuck.map((p) => p.task.id)), [stuck]);
  const sparkMax = Math.max(...OPEN_STAGES.map((k) => Math.max(...flows[k].spark)), 1);

  /* The replay narrates each day, and the cards that moved that day glow. */
  const glide = replayOpen || settling;
  const dayMoves = useMemo(() => (replayOpen ? movesOn(tasks, day) : []), [replayOpen, tasks, day]);
  const movedIds = useMemo(() => new Set(dayMoves.map((m) => m.task.id)), [dayMoves]);

  const columns = useMemo(() => columnsFor(group), [group]);
  const matches = useCallback(
    (t: Task) => {
      if (stuckOnly && !stuckIds.has(t.id)) return false;
      if (lateOnly && !isLate(t)) return false;
      if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    },
    [lateOnly, query, stuckOnly, stuckIds],
  );

  /* ── Writing: through the store ─────────────────────────────────── */

  /** Every edit says what happened and offers Undo; a plain notice passes `false`. */
  const showToast = useCallback((message: string, undo = true) => say(message, undo), [say]);

  /** Store the stage and owner changes in `next`, and keep its order. One undo step. */
  const commitBoard = useCallback(
    (next: Task[], message?: string) => {
      const ops: (() => void)[] = [];
      for (const t of next) {
        const cur = baseById.get(t.id);
        if (!cur) continue;
        const patch: { status?: StageKey; owner?: TeamPersonId } = {};
        if (cur.stage !== t.stage) patch.status = t.stage;
        if (cur.people[0] !== t.people[0] && t.people[0]) patch.owner = t.people[0] as TeamPersonId;
        if (patch.status || patch.owner) ops.push(() => updateTask(t.id, patch));
      }
      const changed = batch(ops);
      const before = order;
      const after = next.map((t) => t.id);
      setOrder(after);
      // A drag inside a column changes only the board's order: it still takes one undo.
      if (!changed && (before ?? base.map((t) => t.id)).join() !== after.join()) pushViewStep("board", () => setOrder(before));
      if (message) showToast(message);
    },
    [baseById, base, order, showToast],
  );

  // The toast is a status region, so it is the one announcement for an undo.
  const undo = useCallback(() => {
    showToast(undoLast() ? "Undone" : "Nothing to undo", false);
  }, [showToast]);
  useUndoKey(
    useCallback((ok: boolean) => showToast(ok ? "Undone" : "Nothing to undo", false), [showToast]),
    !kb,
  );

  /* ── Replay ─────────────────────────────────────────────────────── */

  const replayTimer = useRef<number | null>(null);

  const stopReplay = useCallback(() => {
    if (replayTimer.current) window.clearInterval(replayTimer.current);
    replayTimer.current = null;
    setPlaying(false);
  }, []);

  const scrubTo = useCallback(
    (d: number) => {
      stopReplay();
      setPeek(null);
      setKb(null);
      setHeld(null);
      setComposer(null);
      const next = Math.max(-(REPLAY_DAYS - 1), Math.min(0, d));
      if (next < 0) setReplayOpen(true);
      setDay(next);
    },
    [stopReplay],
  );

  const settleTimer = useRef(0);
  const closeReplay = useCallback(() => {
    stopReplay();
    setDay(0);
    setReplayOpen(false);
    // Let the cards glide home before layout goes back to per-column motion.
    setSettling(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettling(false), 700);
  }, [stopReplay]);

  function togglePlay() {
    if (replayTimer.current) return stopReplay();
    setReplayOpen(true);
    let d = day >= 0 ? -(REPLAY_DAYS - 1) : day;
    setDay(d);
    setPeek(null);
    setComposer(null);
    setPlaying(true);
    replayTimer.current = window.setInterval(() => {
      d += 1;
      setDay(d);
      if (d >= 0) stopReplay();
    }, 480);
  }

  useEffect(() => () => dropViewSteps("board"), []);

  useEffect(
    () => () => {
      if (replayTimer.current) window.clearInterval(replayTimer.current);
      window.clearTimeout(settleTimer.current);
    },
    [],
  );

  /* ── Stuck work ─────────────────────────────────────────────────── */

  function nudge(p: Placed) {
    showToast(sendNudge(p.task.src), false);
  }

  function moveOn(p: Placed) {
    const next = nextStage(p.stage);
    if (!next) return;
    updateTask(p.task.id, { status: next });
    showToast(editSentence({ status: next }, { status: p.stage }));
  }

  function split(p: Placed) {
    const t = p.task.src;
    batch([
      () => updateTask(t.id, { title: `${t.title}, part 1` }),
      () => addTask({ title: `${t.title}, part 2`, project: t.project, owner: t.owner, priority: t.priority, status: "todo", due: t.due }),
    ]);
    showToast("Split in two. Part 2 is in To do");
  }

  /** Place a task in a column at a visible index. Pure: returns the new list. */
  const placeTask = useCallback(
    (list: Task[], id: string, colKey: string, index: number): Task[] => {
      const col = columns.find((c) => c.key === colKey);
      const task = list.find((t) => t.id === id);
      if (!col || !task) return list;
      let moved: Task = task;
      if (group === "stage" && col.stage) {
        moved = withStage(task, col.stage);
      } else if (group === "person") {
        const rest = task.people.filter((p) => p !== task.people[0] && p !== colKey);
        moved = { ...task, people: [col.key, ...rest] };
      }
      const without = list.filter((t) => t.id !== id);
      const target = sortColumn(
        without.filter((t) => inColumn(t, col, group) && matches(t)),
        col,
      );
      if (col.stage === "done") return [moved, ...without];
      const before = target[index];
      if (before) {
        const at = without.indexOf(before);
        return [...without.slice(0, at), moved, ...without.slice(at)];
      }
      const last = target[target.length - 1];
      if (last) {
        const at = without.indexOf(last) + 1;
        return [...without.slice(0, at), moved, ...without.slice(at)];
      }
      return [...without, moved];
    },
    [columns, group, matches],
  );

  const colOf = useCallback((t: Task) => columns.find((c) => inColumn(t, c, group)), [columns, group]);

  const describeMove = useCallback(
    (t: Task, colKey: string) => {
      const col = columns.find((c) => c.key === colKey)!;
      if (group === "person") return col.person ? editSentence({ owner: col.person.id as TeamPersonId }) : "Moved";
      return col.stage ? editSentence({ status: col.stage }, { status: t.stage }) : "Moved";
    },
    [columns, group],
  );

  /** A plain-words line becomes a card in this column. */
  const addCard = useCallback(
    (colKey: string, line: TaskLine) => {
      const col = columns.find((c) => c.key === colKey)!;
      const id = addFromLine(line, {
        status: col.stage ?? "todo",
        owner: (col.person?.id as TeamPersonId | undefined) ?? scopeOwner,
        project: scopeProject,
      });
      if (!id) return;
      // New cards land at the foot of their column.
      setOrder((o) => [...(o ?? base.map((t) => t.id)), id]);
      setJustAdded(id);
      // Said once, by the toast.
      showToast(`Added “${line.title}” to ${col.name}`);
    },
    [columns, scopeOwner, scopeProject, base, showToast],
  );

  const toggleStep = useCallback(
    (task: Task, stepId: string) => {
      const step = task.src.subtasks?.find((s) => s.id === stepId);
      updateTask(task.id, { subtasks: task.src.subtasks?.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) });
      if (step) showToast(step.done ? "Step reopened" : "Step done");
    },
    [showToast],
  );

  /** An edit from the quick look: the list's controls, the store's rules. */
  const editTask = useCallback(
    (task: Task, col: string, value: CellValue) => {
      const patch = cellPatch(col, value);
      if (!patch) return;
      updateTask(task.id, patch);
      if (patch.status === "done") setRailPulse((n) => n + 1);
      // The same toast as a drag or a tick on the list: what happened, then Undo.
      showToast(editSentence(patch, { status: task.stage }));
    },
    [showToast],
  );

  /* ── Pointer drag with physics ──────────────────────────────────── */

  const boardRef = useRef<HTMLDivElement>(null);
  const zoneRefs = useRef(new Map<string, HTMLElement>());
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    offX: number;
    offY: number;
    x: number;
    y: number;
    vx: number;
    rot: number;
    origin: DOMRect;
    started: boolean;
    raf: number;
    over: string | null;
    index: number;
    settling: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const registerZone = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) zoneRefs.current.set(key, el);
      else zoneRefs.current.delete(key);
    },
    [],
  );

  const hitTest = useCallback((x: number, y: number) => {
    let over: string | null = null;
    let index = 0;
    for (const [key, el] of zoneRefs.current) {
      const r = el.getBoundingClientRect();
      if (x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 80 && y <= r.bottom + 40) {
        over = key;
        const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-card-id]"));
        index = cards.length;
        for (let i = 0; i < cards.length; i++) {
          const cr = cards[i].getBoundingClientRect();
          if (y < cr.top + cr.height / 2) {
            index = i;
            break;
          }
        }
        break;
      }
    }
    return { over, index };
  }, []);

  const paintOverlay = useCallback(() => {
    const d = dragRef.current;
    const el = overlayRef.current;
    if (!d || !el || d.settling) return;
    el.style.transform = `translate3d(${d.x - d.offX}px, ${d.y - d.offY}px, 0) rotate(${d.rot.toFixed(2)}deg)`;
  }, []);

  const tick = useCallback(() => {
    function frame() {
      const d = dragRef.current;
      if (!d || !d.started || d.settling) return;
      const target = reduced ? 0 : Math.max(-6, Math.min(6, d.vx * 0.55));
      d.rot += (target - d.rot) * 0.18;
      d.vx *= 0.86;
      paintOverlay();
      // Edge scrolling: the board sideways, a column body up and down.
      const board = boardRef.current;
      if (board) {
        const r = board.getBoundingClientRect();
        if (d.x < r.left + 56) board.scrollLeft -= 12;
        else if (d.x > r.right - 56) board.scrollLeft += 12;
      }
      if (d.over) {
        const zone = zoneRefs.current.get(d.over);
        if (zone && zone.scrollHeight > zone.clientHeight) {
          const zr = zone.getBoundingClientRect();
          if (d.y < zr.top + 40) zone.scrollTop -= 10;
          else if (d.y > zr.bottom - 40) zone.scrollTop += 10;
        }
      }
      d.raf = requestAnimationFrame(frame);
    }
    if (dragRef.current) dragRef.current.raf = requestAnimationFrame(frame);
  }, [paintOverlay, reduced]);

  const setOverlay = useCallback(
    (el: HTMLDivElement | null) => {
      overlayRef.current = el;
      if (el) paintOverlay();
    },
    [paintOverlay],
  );

  const finishDrop = useCallback(() => {
    const d = dragRef.current;
    const el = overlayRef.current;
    if (!d) return;
    cancelAnimationFrame(d.raf);
    d.settling = true;
    const duration = reduced ? 0 : 180;
    const over = d.over;
    const task = tasks.find((t) => t.id === d.id);
    let target: { x: number; y: number; scale: number; opacity: number } = { x: d.origin.left, y: d.origin.top, scale: 1, opacity: 1 };
    if (over && over === "done-rail") {
      const rail = zoneRefs.current.get("done-rail")!.getBoundingClientRect();
      target = { x: rail.left + rail.width / 2 - d.origin.width * 0.25, y: rail.top + 40, scale: 0.4, opacity: 0 };
    } else if (over) {
      const slot = zoneRefs.current.get(over)?.querySelector<HTMLElement>("[data-placeholder]");
      if (slot) {
        const r = slot.getBoundingClientRect();
        target = { x: r.left, y: r.top, scale: 1, opacity: 1 };
      }
    }
    if (el) {
      el.dataset.settling = "";
      el.style.transition = `transform ${duration}ms var(--v3-ease), opacity ${duration}ms ease`;
      el.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) rotate(0deg) scale(${target.scale})`;
      el.style.opacity = String(target.opacity);
    }
    window.setTimeout(() => {
      dragRef.current = null;
      setDrag(null);
      if (!task || !over) return;
      const colKey = over === "done-rail" ? "done" : over;
      const next = placeTask(tasks, task.id, colKey, d.index);
      const changed = JSON.stringify(next.map((t) => [t.id, t.stage, t.people[0]])) !== JSON.stringify(tasks.map((t) => [t.id, t.stage, t.people[0]]));
      if (!changed) return;
      const fromCol = colOf(task);
      const sameCol = fromCol?.key === colKey;
      commitBoard(next, sameCol ? undefined : describeMove(task, colKey));
      if (colKey === "done") setRailPulse((n) => n + 1);
      // A move is said once, by its toast; a reorder has no toast, so it is announced.
      if (sameCol) setAnnounce(`Reordered ${task.title}`);
    }, duration + 10);
  }, [reduced, tasks, placeTask, colOf, commitBoard, describeMove]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId || d.settling) return;
      if (!d.started) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
        d.started = true;
        suppressClick.current = true;
        setPeek(null);
        const hit = hitTest(e.clientX, e.clientY);
        d.over = hit.over;
        d.index = hit.index;
        setDrag({ id: d.id, over: hit.over, index: hit.index, height: d.origin.height, width: d.origin.width });
        tick();
        document.body.style.cursor = "grabbing";
      }
      const dx = e.clientX - d.x;
      d.vx = d.vx * 0.7 + dx * 0.3;
      d.x = e.clientX;
      d.y = e.clientY;
      const hit = hitTest(e.clientX, e.clientY);
      if (hit.over !== d.over || hit.index !== d.index) {
        d.over = hit.over;
        d.index = hit.index;
        setDrag((prev) => (prev ? { ...prev, over: hit.over, index: hit.index } : prev));
      }
    }
    function onUp(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId || d.settling) return;
      document.body.style.cursor = "";
      if (!d.started) {
        dragRef.current = null;
        return;
      }
      finishDrop();
    }
    function onKey(e: KeyboardEvent) {
      const d = dragRef.current;
      if (d?.started && e.key === "Escape") {
        d.over = null;
        document.body.style.cursor = "";
        finishDrop();
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [hitTest, tick, finishDrop]);

  /* ── Touch: long press opens Move to ────────────────────────────── */

  const press = useRef<{ timer: number; x: number; y: number; id: string } | null>(null);

  function onCardPointerDown(e: ReactPointerEvent<HTMLDivElement>, task: Task) {
    suppressClick.current = false;
    if (!live) return;
    if (e.pointerType === "touch") {
      const timer = window.setTimeout(() => {
        suppressClick.current = true;
        press.current = null;
        navigator.vibrate?.(8);
        setPeek(null);
        setMoveId(task.id);
      }, 460);
      press.current = { timer, x: e.clientX, y: e.clientY, id: task.id };
      return;
    }
    if (e.button !== 0 || kb) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      id: task.id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      x: e.clientX,
      y: e.clientY,
      vx: 0,
      rot: 0,
      origin: rect,
      started: false,
      raf: 0,
      over: null,
      index: 0,
      settling: false,
    };
  }

  function onCardPointerMove(e: ReactPointerEvent) {
    const p = press.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) {
      window.clearTimeout(p.timer);
      press.current = null;
    }
  }

  function endPress() {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  }

  /* ── Hover quick look ───────────────────────────────────────────── */

  const hoverTimer = useRef(0);
  const leaveTimer = useRef(0);

  function onCardEnter(e: React.MouseEvent<HTMLDivElement>, task: Task) {
    if (phone || drag || kb || peek?.pinned) return;
    window.clearTimeout(leaveTimer.current);
    const el = e.currentTarget;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      if (dragRef.current?.started) return;
      const r = el.getBoundingClientRect();
      setPeek({ id: task.id, rect: { top: r.top, left: r.left, right: r.right, bottom: r.bottom }, pinned: false });
    }, HOVER_DELAY);
  }

  function onCardLeave() {
    window.clearTimeout(hoverTimer.current);
    if (peek && !peek.pinned) leaveTimer.current = window.setTimeout(() => setPeek((p) => (p?.pinned ? p : null)), 140);
  }

  function openPeek(el: HTMLElement, task: Task) {
    const r = el.getBoundingClientRect();
    setPeek((p) =>
      p?.pinned && p.id === task.id ? null : { id: task.id, rect: { top: r.top, left: r.left, right: r.right, bottom: r.bottom }, pinned: true },
    );
  }

  const closePeek = useCallback(
    (refocus: boolean) => {
      setPeek((p) => {
        if (p && refocus && p.pinned && !phone) focusCard(p.id);
        return null;
      });
      if (scope.task) scope.set({ task: undefined });
    },
    [phone, scope],
  );

  useEffect(() => {
    if (!peek?.pinned || phone) return;
    function onDown(e: PointerEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("[role=dialog]") || t.closest("[data-card-id]")) return;
      closePeek(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [peek?.pinned, phone, closePeek]);

  /* ── Keyboard: one tab stop, arrows move; pick up, move, drop ───── */

  const visibleIn = useCallback(
    (list: Task[], col: ColumnDef) => sortColumn(list.filter((t) => inColumn(t, col, group) && matches(t)), col),
    [group, matches],
  );

  function position(list: Task[], task: Task) {
    const col = columns.find((c) => inColumn(task, c, group))!;
    const vis = visibleIn(list, col);
    return { col, index: vis.findIndex((t) => t.id === task.id), total: vis.length };
  }

  /** The card that holds the board's one tab stop. */
  const [focusId, setFocusId] = useState<string | null>(null);

  function focusCard(id: string) {
    setFocusId(id);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)?.focus({ preventScroll: false }));
  }

  function onCardKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, task: Task) {
    const picked = kb?.id === task.id;
    if (!live && e.key !== "Enter") return;
    if (e.key === " ") {
      e.preventDefault();
      if (!kb) {
        setKb({ id: task.id });
        setHeld(tasks);
        setPeek(null);
        const pos = position(tasks, task);
        setAnnounce(`Picked up ${task.title}. In ${pos.col.name}, ${pos.index + 1} of ${pos.total}. Arrow keys move it, space drops it, escape cancels.`);
      } else if (picked) {
        const pos = position(tasks, task);
        const from = baseById.get(task.id);
        const fromCol = from ? colOf(from) : undefined;
        const moved = fromCol?.key !== pos.col.key;
        // A move is said once, by its toast, as with the pointer; a reorder is announced.
        commitBoard(tasks, moved && from ? describeMove(from, pos.col.key) : undefined);
        setHeld(null);
        setKb(null);
        if (moved && pos.col.stage === "done") setRailPulse((n) => n + 1);
        if (!moved) setAnnounce(`Dropped ${task.title} in ${pos.col.name}, ${pos.index + 1} of ${pos.total}.`);
        focusCard(task.id);
      }
      return;
    }
    if (e.key === "Escape" && picked) {
      e.preventDefault();
      setHeld(null);
      setKb(null);
      setAnnounce(`Move cancelled. ${task.title} is back where it was.`);
      focusCard(task.id);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      openPeek(e.currentTarget, task);
      return;
    }
    const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!arrows.includes(e.key)) return;
    e.preventDefault();
    const pos = position(tasks, task);
    const ci = columns.findIndex((c) => c.key === pos.col.key);
    if (picked) {
      let colKey = pos.col.key;
      let index = pos.index;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const nc = columns[ci + (e.key === "ArrowLeft" ? -1 : 1)];
        if (!nc) return;
        colKey = nc.key;
        if (nc.stage === "done") setDoneOpen(true);
        index = Math.min(pos.index, visibleIn(tasks, nc).length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        index = Math.max(0, Math.min(pos.total - 1, pos.index + (e.key === "ArrowUp" ? -1 : 1)));
        if (index === pos.index) return;
      } else return;
      const next = placeTask(tasks, task.id, colKey, index);
      setHeld(next);
      const moved = next.find((t) => t.id === task.id)!;
      const np = position(next, moved);
      setAnnounce(`${np.col.name}, ${np.index + 1} of ${np.total}.`);
      focusCard(task.id);
      return;
    }
    // Not holding: arrows move focus around the board.
    if (e.key === "Home" || e.key === "End") {
      const vis = visibleIn(tasks, pos.col);
      const n = e.key === "Home" ? vis[0] : vis[vis.length - 1];
      if (n) focusCard(n.id);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const vis = visibleIn(tasks, pos.col);
      const n = vis[pos.index + (e.key === "ArrowUp" ? -1 : 1)];
      if (n) focusCard(n.id);
    } else {
      for (let step = 1; step < columns.length; step++) {
        const nc = columns[ci + (e.key === "ArrowLeft" ? -step : step)];
        if (!nc) break;
        if (nc.stage === "done" && !doneOpen) continue;
        const vis = visibleIn(tasks, nc);
        if (vis.length) {
          focusCard(vis[Math.min(pos.index, vis.length - 1)].id);
          break;
        }
      }
    }
  }

  /* ── New task: N, the header button, or a column's Add ──────────── */

  const openNew = useCallback(() => {
    if (replayOpen) closeReplay();
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-col]")?.dataset.col;
    const col = phone ? columns[phoneActive]?.key : (focused ?? columns[0].key);
    if (col === "done" && !doneOpen) setDoneOpen(true);
    setComposer({ col: col ?? columns[0].key, sheet: phone });
    // Already open: N puts the cursor back in it.
    requestAnimationFrame(focusNewTask);
  }, [replayOpen, closeReplay, phone, columns, phoneActive, doneOpen]);
  useNewTaskKey(openNew, !kb);
  useNewTaskParam(openNew);

  /* ── Global keys ────────────────────────────────────────────────── */

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        scrubTo(day + (e.key === "[" ? -1 : 1));
        return;
      }
      if (e.key === "s" || e.key === "S") {
        setStuckOnly((v) => !v);
        return;
      }
      if ((e.key === "t" || e.key === "T") && replayOpen) {
        closeReplay();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        setMenu(null);
        if (peek) closePeek(true);
        if (triage) setTriage(false);
        else if (replayOpen && !peek) closeReplay();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [day, scrubTo, replayOpen, closeReplay, triage, peek, closePeek]);

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(null), 900);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  useEffect(() => {
    if (!menu) return;
    function onDown(e: PointerEvent) {
      if (!(e.target as HTMLElement).closest("[data-menu]")) setMenu(null);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menu]);

  /* ── ?task=<id>: open that card's quick look ────────────────────── */

  const openedTask = useRef<string | null>(null);
  useEffect(() => {
    const id = scope.task;
    if (!id || openedTask.current === id) return;
    const task = base.find((t) => t.id === id);
    if (!task) return;
    openedTask.current = id;
    let tries = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
      if (!el) {
        if (tries++ < 20) requestAnimationFrame(find);
        return;
      }
      el.scrollIntoView({ block: "center", inline: "center" });
      if (phone) {
        const i = columns.findIndex((c) => inColumn(task, c, group));
        if (i >= 0) goToColumn(i);
      }
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setFocusId(id);
        setPeek({ id, rect: { top: r.top, left: r.left, right: r.right, bottom: r.bottom }, pinned: true });
      });
    };
    requestAnimationFrame(() => {
      // Make sure the card is on the board: today, every filter off, Done open if it lives there.
      if (replayOpen) closeReplay();
      setStuckOnly(false);
      setLateOnly(false);
      setQuery("");
      if (task.stage === "done") setDoneOpen(true);
      requestAnimationFrame(find);
    });
    // goToColumn is stable enough for a one-off open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.task, base]);

  /* ── Phone pager ────────────────────────────────────────────────── */

  function onBoardScroll() {
    if (!phone || !boardRef.current) return;
    const el = boardRef.current;
    const first = el.firstElementChild as HTMLElement | null;
    if (!first) return;
    const step = first.getBoundingClientRect().width + 12;
    const i = Math.round(el.scrollLeft / step);
    if (i !== phoneActive) setPhoneActive(Math.max(0, Math.min(columns.length - 1, i)));
  }

  function goToColumn(i: number) {
    const el = boardRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - 16, behavior: reduced ? "auto" : "smooth" });
    setPhoneActive(i);
  }

  /* ── Derived numbers ────────────────────────────────────────────── */

  const total = base.length;
  const stageCounts = Object.fromEntries(STAGES.map((s) => [s.key, viewTasks.filter((t) => t.stage === s.key && matches(t)).length])) as Record<
    StageKey,
    number
  >;
  const dragTask = drag ? tasks.find((t) => t.id === drag.id) : undefined;
  const peekTask = peek ? viewTasks.find((t) => t.id === peek.id) : undefined;
  const moveTask = moveId ? tasks.find((t) => t.id === moveId) : undefined;

  /* ── Render ─────────────────────────────────────────────────────── */

  const doneCol = columns.find((c) => c.stage === "done");
  const railMode = group === "stage" && !doneOpen && !phone;
  const shownCols = columns.filter((c) => !(railMode && c.stage === "done"));
  // The one tab stop: the focused card, else the first card on the board.
  const firstCard = shownCols.map((c) => visibleIn(viewTasks, c)[0]).find(Boolean);
  const tabStop = focusId && viewTasks.some((t) => t.id === focusId && matches(t)) ? focusId : firstCard?.id;

  /** On a past day, stuck by the same rule as today: started and still for 5 days or more. */
  function wasStuck(t: Task) {
    if (!STUCK_STAGES.includes(t.stage)) return false;
    const at = moveAt(t, day);
    return !!at && day - at.day >= STUCK_DAYS;
  }

  /** A card's stuck badge on a past day, aged from that day. */
  function pastAge(t: Task): Placed | undefined {
    if (!wasStuck(t)) return undefined;
    const at = moveAt(t, day)!;
    return { task: t, stage: t.stage, since: at.day, age: day - at.day };
  }

  function emptyText(col: ColumnDef, filteredOut: boolean) {
    if (!filteredOut) return scopeOwner && group === "stage" ? `Nothing here for ${ownerLabel(scopeOwner).replace(/'s tasks$/, "")}.` : col.empty;
    if (query) return `Nothing here matches “${query}”`;
    if (stuckOnly) return "Nothing stuck here";
    if (lateOnly) return "Nothing late here";
    return "Nothing here matches the filter";
  }

  function renderColumn(col: ColumnDef) {
    const all = sortColumn(
      viewTasks.filter((t) => inColumn(t, col, group)),
      col,
    );
    const flow = col.stage && group === "stage" ? flows[col.stage] : null;
    const stuckHere = all.filter((t) => (live ? stuckIds.has(t.id) : wasStuck(t))).length;
    const week = col.stage && group === "stage" ? weekFlow[col.stage] : null;
    const visible = all.filter((t) => matches(t) && t.id !== drag?.id);
    // The count is what you can see: filters narrow it.
    const count = visible.length + (drag && drag.over === col.key && dragTask && !inColumn(dragTask, col, group) ? 1 : 0);
    const isDrop = drag?.over === col.key;
    const items: ({ kind: "card"; task: Task } | { kind: "slot" })[] = visible.map((task) => ({ kind: "card", task }));
    if (isDrop) items.splice(Math.min(drag!.index, items.length), 0, { kind: "slot" });
    const filteredOut = all.length > 0 && visible.length === 0 && !isDrop;
    const narrowed = visible.length !== all.filter((t) => t.id !== drag?.id).length;

    return (
      <section
        key={col.key}
        className={styles.column}
        data-col={col.key}
        data-drop={isDrop ? "" : undefined}
        data-stage={col.stage}
        aria-labelledby={`col-${col.key}`}
      >
        <header className={styles.columnHead}>
          <div className={styles.columnTitleRow}>
            {col.stage ? <StageGlyph stage={col.stage} /> : col.person ? <Avatar person={col.person} size={18} /> : <span className={styles.nobody} aria-hidden="true" />}
            <h2 id={`col-${col.key}`} className={styles.columnName}>
              {col.name}
            </h2>
            <span
              className={styles.columnCount}
              aria-label={narrowed ? `${count} of ${all.length} tasks shown` : `${count} ${count === 1 ? "task" : "tasks"}`}
              title={narrowed ? `${count} of ${all.length} match the filter` : undefined}
            >
              {count}
            </span>
            <span className={styles.columnSpacer} />
            {flow ? (
              <Sparkline
                values={flow.spark}
                max={flow.key === "done" ? Math.max(...flow.spark, 1) : sparkMax}
                label={`${col.name} over the last 14 days: ${flow.spark[0]} then, ${flow.spark[flow.spark.length - 1]} now${flow.key !== "done" ? `. Work usually spends ${usual[flow.key]} days here` : ""}`}
              />
            ) : null}
            {col.stage === "done" && !phone ? (
              <button type="button" className={styles.iconButton} onClick={() => setDoneOpen(false)} aria-label="Collapse done tasks">
                <Icon.collapse size={14} />
              </button>
            ) : null}
          </div>
          {week && col.stage ? (
            col.stage === "done" ? (
              <p className={flowStyles.colMeta} title={`In the 7 days to ${dayLabel(day, { long: true })}`}>
                <span>{week.inn} finished in 7 days</span>
              </p>
            ) : (
              <p
                className={flowStyles.colMeta}
                hidden={week.inn === 0 && week.out === 0 && stuckHere === 0}
                title={`In the 7 days to ${dayLabel(day, { long: true })}. Stuck means started and still for ${STUCK_DAYS} days or more.`}
              >
                <span>{week.inn} new</span>
                <span>{week.out} out</span>
                {stuckHere > 0 ? <span className={flowStyles.colStuck}>{stuckHere} stuck</span> : null}
              </p>
            )
          ) : null}
        </header>
        {/* Not a tab stop of its own: the board's cards share one, moved by the arrows. */}
        <div className={styles.columnBody} ref={registerZone(col.key)} tabIndex={-1}>
          <>
            {items.map((item) =>
              item.kind === "slot" ? (
                <motion.div
                  key="slot"
                  layout="position"
                  data-placeholder=""
                  className={styles.slot}
                  style={{ height: drag!.height }}
                  initial={reduced ? false : { opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.16 }}
                />
              ) : (
                <motion.div
                  key={item.task.id}
                  layout={glide ? true : "position"}
                  layoutId={glide ? `c1-card-${item.task.id}` : undefined}
                  transition={{ duration: glide ? 0.5 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  className={styles.cardWrap}
                  data-moved={movedIds.has(item.task.id) ? String(day) : undefined}
                >
                  <CardFace
                    task={item.task}
                    people={peopleOf(item.task)}
                    showStage={group === "person"}
                    aged={live ? ageById.get(item.task.id) : pastAge(item.task)}
                    nudged={live && nudged.has(item.task.id)}
                    asOf={live ? undefined : isoFor(day)}
                    pickedUp={kb?.id === item.task.id}
                    justAdded={justAdded === item.task.id}
                    data-card-id={item.task.id}
                    role="button"
                    tabIndex={item.task.id === tabStop ? 0 : -1}
                    aria-label={`${cardLabel(item.task, peopleOf(item.task), live ? undefined : isoFor(day))}${live && ageById.has(item.task.id) ? `. Stuck for ${ageById.get(item.task.id)!.age} days` : ""}`}
                    aria-describedby="board-howto"
                    aria-pressed={kb?.id === item.task.id ? true : undefined}
                    onFocus={() => setFocusId(item.task.id)}
                    onPointerDown={(e) => onCardPointerDown(e, item.task)}
                    onPointerMove={onCardPointerMove}
                    onPointerUp={endPress}
                    onPointerCancel={endPress}
                    onContextMenu={(e) => {
                      if (phone) e.preventDefault();
                    }}
                    onMouseEnter={(e) => onCardEnter(e, item.task)}
                    onMouseLeave={onCardLeave}
                    onKeyDown={(e) => onCardKeyDown(e, item.task)}
                    onClick={(e) => {
                      if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                      }
                      openPeek(e.currentTarget, item.task);
                    }}
                  />
                </motion.div>
              ),
            )}
          </>
          {visible.length === 0 && !isDrop && !(composer?.col === col.key && !composer.sheet) ? (
            <div className={styles.emptyColumn} data-filtered={filteredOut ? "" : undefined}>
              {emptyText(col, filteredOut)}
            </div>
          ) : null}
          {composer?.col === col.key && !composer.sheet ? (
            <NewTaskComposer className={styles.columnComposer} where={`in ${col.name}`} fallbackProject={scopeProject ?? "mara-finn"} onAdd={(line) => addCard(col.key, line)} onClose={() => setComposer(null)} />
          ) : !live ? null : (
            <button type="button" className={styles.addButton} tabIndex={-1} onClick={() => setComposer({ col: col.key, sheet: false })}>
              <Icon.plus size={14} />
              Add task
              {col.key === columns[0].key ? <kbd className={styles.kbd}>N</kbd> : null}
            </button>
          )}
        </div>
      </section>
    );
  }

  const doneCount = viewTasks.filter((t) => t.stage === "done" && matches(t)).length;
  const railOver = drag?.over === "done-rail";

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.root} data-dragging={drag ? "" : undefined} data-past={live ? undefined : ""}>
        <p id="board-howto" className={styles.srOnly}>
          Arrow keys move between cards. Press space to pick one up, arrows to move it, space to drop it, escape to cancel. Press enter for a quick look.
        </p>
        <div className={styles.srOnly} aria-live="assertive">
          {announce}
        </div>

        {/* ── Header: the one Tasks header ────────────────────────── */}
        <TasksPageHeader
          stuckOnly={stuckOnly}
          onStuck={setStuckOnly}
          lateOnly={lateOnly}
          onLate={() => setLateOnly((v) => !v)}
          onMoreStuck={() => setTriage(true)}
          onNewTask={openNew}
          onSay={(m) => showToast(m, false)}
          signature={
            total > 0 ? (
              <button
                type="button"
                className={flowStyles.stuckChip}
                aria-pressed={replayOpen}
                onClick={() => (replayOpen ? closeReplay() : togglePlay())}
                title="Watch the last 21 days play out ([ and ] step through days)"
              >
                <FlowIcon.rewind size={14} />
                Replay
              </button>
            ) : null
          }
        />

        {/* ── Replay: only when asked for ──────────────────────────── */}
        <AnimatePresence initial={false}>
          {replayOpen ? (
            <motion.section
              key="replay"
              className={flowStyles.flowBand}
              aria-label="Replay the last 21 days"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ overflow: "hidden" }}
            >
              <TimeMachine day={day} playing={playing} caption={dayCaption(dayMoves, day)} onDay={scrubTo} onPlay={togglePlay} onClose={closeReplay} />
            </motion.section>
          ) : null}
        </AnimatePresence>

        {/* ── Toolbar ────────────────────────────────────────────── */}
        <div className={styles.toolbar}>
          <ViewSwitch current="board" row />
          <div className={styles.menuAnchor} data-menu="">
            <button
              type="button"
              className={styles.chipButton}
              aria-haspopup="menu"
              aria-expanded={menu === "group"}
              onClick={() => setMenu(menu === "group" ? null : "group")}
            >
              <Icon.group size={14} />
              <span className={styles.chipLabel}>Group by</span>
              <span className={styles.chipValue}>{group === "stage" ? "Stage" : "Person"}</span>
              <Icon.chevronDown size={12} />
            </button>
            {menu === "group" ? (
              <div className={styles.menu} role="menu" aria-label="Group by">
                {(
                  [
                    ["stage", "Stage", "Work moves left to right"],
                    ["person", "Person", "Who is carrying what"],
                  ] as const
                ).map(([key, name, sub]) => (
                  <button
                    key={key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={group === key}
                    className={styles.menuItem}
                    onClick={() => {
                      setGroup(key);
                      setMenu(null);
                      setPhoneActive(0);
                      setOrder(null);
                      boardRef.current?.scrollTo({ left: 0 });
                    }}
                  >
                    <span className={styles.menuItemText}>
                      <span>{name}</span>
                      <span className={styles.menuItemSub}>{sub}</span>
                    </span>
                    {group === key ? <Icon.check size={14} className={styles.menuCheck} /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {lateOnly || stuckOnly ? (
            <button
              type="button"
              className={styles.clearFilter}
              onClick={() => {
                setLateOnly(false);
                setStuckOnly(false);
              }}
            >
              <Icon.close size={12} />
              {[lateOnly ? "Late" : null, stuckOnly ? "Stuck" : null].filter(Boolean).join(" and ")}
            </button>
          ) : null}
          <span className={styles.toolbarSpacer} />
          <label className={styles.search}>
            <Icon.search size={14} />
            <span className={styles.srOnly}>Find a task</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Find a task"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  e.currentTarget.blur();
                }
              }}
            />
            {!query ? <kbd className={styles.kbd}>/</kbd> : null}
          </label>
        </div>

        {phone && total > 0 ? <StagePager active={phoneActive} counts={stageCounts} onPick={goToColumn} /> : null}

        {/* ── Board ──────────────────────────────────────────────── */}
        {total === 0 ? (
          scopeOwner ? (
            <div className={styles.emptyBoard}>
              <h2 className={styles.emptyTitle}>Nothing here for {ownerLabel(scopeOwner).replace(/'s tasks$/, "")}</h2>
              <p className={styles.emptyText}>They have no tasks in this view. Show everyone&apos;s, or add one for them.</p>
              <div className={styles.emptyActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => scope.set({ owner: undefined })}>
                  Show everyone&apos;s tasks
                </button>
                <button type="button" className={styles.secondaryButton} onClick={openNew}>
                  Add a task
                  <kbd className={styles.kbd}>N</kbd>
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.emptyBoard}>
              <h2 className={styles.emptyTitle}>No tasks here yet</h2>
              <p className={styles.emptyText}>Each task is a card. It starts in To do and moves right as the work gets done.</p>
              <button type="button" className={styles.secondaryButton} onClick={openNew}>
                Add the first task
                <kbd className={styles.kbd}>N</kbd>
              </button>
            </div>
          )
        ) : (
          <LayoutGroup id="c1-board">
            <div className={styles.board} ref={boardRef} onScroll={onBoardScroll} data-group={group} role="group" aria-label="Board, one card per task" aria-describedby="board-howto">
              {shownCols.map(renderColumn)}
              {railMode && doneCol ? (
                <button
                  type="button"
                  ref={registerZone("done-rail")}
                  className={styles.rail}
                  data-over={railOver ? "" : undefined}
                  onClick={() => setDoneOpen(true)}
                  aria-expanded="false"
                  aria-label={`Show ${doneCount} done tasks`}
                >
                  <span className={styles.railGlyph} key={railPulse} data-pulse={railPulse ? "" : undefined}>
                    <StageGlyph stage="done" size={20} draw={railPulse > 0} />
                  </span>
                  <span className={styles.railText}>
                    <span className={styles.railCount} key={`c${doneCount}`}>
                      {doneCount}
                    </span>{" "}
                    done
                  </span>
                  <span className={styles.railHint}>{railOver ? "Drop to finish" : ""}</span>
                  <Icon.expand size={14} className={styles.railExpand} />
                </button>
              ) : null}
            </div>
          </LayoutGroup>
        )}

        {/* ── Floating layers ────────────────────────────────────── */}
        {dragTask && drag ? (
          <div ref={setOverlay} className={styles.dragLayer} style={{ width: drag.width }} aria-hidden="true">
            <CardFace task={dragTask} people={peopleOf(dragTask)} lifted showStage={group === "person"} />
          </div>
        ) : null}

        {peek && peekTask ? (
          <CardPeek
            key={peek.id}
            task={peekTask}
            people={peopleOf(peekTask)}
            peek={peek}
            sheet={phone}
            onClose={() => closePeek(true)}
            onToggleStep={(stepId) => toggleStep(peekTask, stepId)}
            onEnter={() => window.clearTimeout(leaveTimer.current)}
            onLeave={() => {
              if (!peek.pinned) leaveTimer.current = window.setTimeout(() => setPeek((p) => (p?.pinned ? p : null)), 140);
            }}
            onMove={() => {
              setPeek(null);
              setMoveId(peekTask.id);
            }}
            onEdit={(col, value) => editTask(peekTask, col, value)}
            onOpenList={to.inDemo ? to.task(peekTask.id, "list") : undefined}
          />
        ) : null}

        {moveTask ? (
          <MoveSheet
            task={moveTask}
            counts={stageCounts}
            onClose={() => setMoveId(null)}
            onPick={(stage) => {
              updateTask(moveTask.id, { status: stage });
              showToast(editSentence({ status: stage }, { status: moveTask.stage }));
              setMoveId(null);
            }}
          />
        ) : null}

        {composer?.sheet ? (
          <div className={styles.scrim} onClick={() => setComposer(null)}>
            <div role="dialog" aria-modal="true" aria-label="New task" className={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <span className={styles.sheetGrip} aria-hidden="true" />
              <h2 className={styles.sheetTitle}>New task in {columns.find((c) => c.key === composer.col)?.name ?? "To do"}</h2>
              <NewTaskComposer
                where={`in ${columns.find((c) => c.key === composer.col)?.name ?? "To do"}`}
                fallbackProject={scopeProject ?? "mara-finn"}
                onAdd={(line) => addCard(composer.col, line)}
                onClose={() => setComposer(null)}
              />
            </div>
          </div>
        ) : null}

        {phone && total > 0 && !composer && !moveTask && !peek ? <NewTaskFab onClick={openNew} /> : null}

        <AnimatePresence>
          {triage ? <Scrim key="scrim-t" onClose={() => setTriage(false)} /> : null}
          {triage ? (
            <StuckTriage
              key="triage"
              items={stuck}
              nudged={nudged}
              onClose={() => setTriage(false)}
              onNudge={nudge}
              onMoveOn={moveOn}
              onSplit={split}
            />
          ) : null}
        </AnimatePresence>

        <TaskToast toast={toast} onUndo={undo} onClose={closeToast} phoneLift={8} />
      </div>
    </MotionConfig>
  );
}
