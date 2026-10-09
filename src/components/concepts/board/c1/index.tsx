"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import { DATASETS, STAGES, TODAY, type Dataset, type Person, type StageKey, type Task } from "./data";
import { Avatar, cardLabel, CardFace } from "./card";
import { InlineComposer } from "./composer";
import { Icon, StageGlyph } from "./icons";
import { isLate, type Parsed } from "./model";
import { CardPeek, MoveSheet, StagePager, UndoToast, type PeekState } from "./overlays";
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
  person?: Person | null;
  limit?: number;
  empty: string;
};

function columnsFor(group: Group, people: Person[]): ColumnDef[] {
  if (group === "stage") return STAGES.map((s) => ({ key: s.key, name: s.name, stage: s.key, limit: s.limit, empty: s.empty }));
  return [
    ...people.map((p) => ({ key: p.id, name: p.first, person: p, empty: `Nothing open for ${p.first}.` })),
    { key: "none", name: "No one yet", person: null, empty: "Every open task has someone on it." },
  ];
}

function inColumn(task: Task, col: ColumnDef, group: Group) {
  if (group === "stage") return task.stage === col.stage;
  if (task.stage === "done") return false;
  return col.key === "none" ? task.people.length === 0 : task.people[0] === col.key;
}

function sortColumn(list: Task[], col: ColumnDef) {
  if (col.stage !== "done") return list;
  return [...list].sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
}

const WEEK_START = "2026-09-21";
const HOVER_DELAY = 450;

type DragState = { id: string; over: string | null; index: number; height: number; width: number };
type KbState = { id: string; snapshot: Task[] };
type Toast = { id: number; message: string; undo: boolean };

/* ── Page ──────────────────────────────────────────────────────────── */

export default function StudioColumns() {
  const phone = useMedia("(max-width: 720px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");

  const [projectId, setProjectId] = useState("orchard");
  const [store, setStore] = useState<Record<string, Task[]>>(() => Object.fromEntries(DATASETS.map((d) => [d.id, d.tasks])));
  const [history, setHistory] = useState<{ projectId: string; tasks: Task[] }[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [lateOnly, setLateOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("stage");
  const [doneOpen, setDoneOpen] = useState(false);
  const [composer, setComposer] = useState<{ col: string; sheet: boolean } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [kb, setKb] = useState<KbState | null>(null);
  const [peek, setPeek] = useState<PeekState | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [phoneActive, setPhoneActive] = useState(0);
  const [railPulse, setRailPulse] = useState(0);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [menu, setMenu] = useState<"project" | "group" | null>(null);
  const [announce, setAnnounce] = useState("");

  const dataset = DATASETS.find((d) => d.id === projectId) as Dataset;
  const people = dataset.people;
  const tasks = store[projectId];
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const peopleOf = useCallback((t: Task) => t.people.map((id) => byId.get(id)).filter(Boolean) as Person[], [byId]);

  const columns = useMemo(() => columnsFor(group, people), [group, people]);
  const matches = useCallback(
    (t: Task) => {
      if (filterPerson && !t.people.includes(filterPerson)) return false;
      if (lateOnly && !isLate(t)) return false;
      if (query && !t.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    },
    [filterPerson, lateOnly, query],
  );

  /* ── Mutations ──────────────────────────────────────────────────── */

  const toastId = useRef(0);
  const showToast = useCallback((message: string, undo = true) => {
    toastId.current += 1;
    setToast({ id: toastId.current, message, undo });
  }, []);

  const commit = useCallback(
    (next: Task[], message?: string, snapshot?: Task[]) => {
      setHistory((h) => [...h.slice(-19), { projectId, tasks: snapshot ?? tasks }]);
      setStore((s) => ({ ...s, [projectId]: next }));
      if (message) showToast(message);
    },
    [projectId, tasks, showToast],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setStore((s) => ({ ...s, [last.projectId]: last.tasks }));
    setProjectId(last.projectId);
    showToast("Undone", false);
    setAnnounce("Last change undone");
  }, [history, showToast]);

  /** Place a task in a column at a visible index. Pure: returns the new list. */
  const placeTask = useCallback(
    (list: Task[], id: string, colKey: string, index: number): Task[] => {
      const col = columns.find((c) => c.key === colKey);
      const task = list.find((t) => t.id === id);
      if (!col || !task) return list;
      let moved: Task = task;
      if (group === "stage" && col.stage) {
        moved = { ...task, stage: col.stage };
        if (col.stage === "done") moved.doneAt = TODAY;
        else delete moved.doneAt;
        if (col.stage !== "waiting") delete moved.heldBy;
      } else if (group === "person") {
        const rest = task.people.filter((p) => p !== task.people[0] && p !== colKey);
        moved = { ...task, people: col.key === "none" ? rest : [col.key, ...rest] };
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
      if (group === "person") return col.person ? `Handed to ${col.person.first}` : "Nobody on it now";
      if (col.stage === "done") return `Done: ${t.title}`;
      return `Moved to ${col.name}`;
    },
    [columns, group],
  );

  const addTask = useCallback(
    (colKey: string, parsed: Parsed) => {
      const col = columns.find((c) => c.key === colKey)!;
      const id = `n${Date.now()}`;
      const who = parsed.person?.id ?? (group === "person" && col.person ? col.person.id : undefined);
      const task: Task = {
        id,
        title: parsed.title.charAt(0).toUpperCase() + parsed.title.slice(1),
        stage: col.stage ?? "todo",
        due: parsed.due,
        priority: parsed.priority ?? 0,
        people: who ? [who] : filterPerson ? [filterPerson] : [],
        doneAt: col.stage === "done" ? TODAY : undefined,
      };
      const colTasks = tasks.filter((t) => inColumn(t, col, group));
      const last = colTasks[colTasks.length - 1];
      const next = last ? [...tasks.slice(0, tasks.indexOf(last) + 1), task, ...tasks.slice(tasks.indexOf(last) + 1)] : [...tasks, task];
      commit(next);
      setJustAdded(id);
      setAnnounce(`Added ${task.title} to ${col.name}`);
    },
    [columns, group, tasks, filterPerson, commit],
  );

  const toggleStep = useCallback(
    (taskId: string, stepId: string) => {
      const next = tasks.map((t) =>
        t.id === taskId ? { ...t, subtasks: t.subtasks?.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)) } : t,
      );
      commit(next);
    },
    [tasks, commit],
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

  const registerZone = useCallback((key: string) => (el: HTMLElement | null) => {
    if (el) zoneRefs.current.set(key, el);
    else zoneRefs.current.delete(key);
  }, []);

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
    let to: { x: number; y: number; scale: number; opacity: number } = { x: d.origin.left, y: d.origin.top, scale: 1, opacity: 1 };
    if (over && over === "done-rail") {
      const rail = zoneRefs.current.get("done-rail")!.getBoundingClientRect();
      to = { x: rail.left + rail.width / 2 - d.origin.width * 0.25, y: rail.top + 40, scale: 0.4, opacity: 0 };
    } else if (over) {
      const slot = zoneRefs.current.get(over)?.querySelector<HTMLElement>("[data-placeholder]");
      if (slot) {
        const r = slot.getBoundingClientRect();
        to = { x: r.left, y: r.top, scale: 1, opacity: 1 };
      }
    }
    if (el) {
      el.dataset.settling = "";
      el.style.transition = `transform ${duration}ms var(--v3-ease), opacity ${duration}ms ease`;
      el.style.transform = `translate3d(${to.x}px, ${to.y}px, 0) rotate(0deg) scale(${to.scale})`;
      el.style.opacity = String(to.opacity);
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
      commit(next, sameCol ? undefined : describeMove(task, colKey));
      if (colKey === "done") setRailPulse((n) => n + 1);
      setAnnounce(sameCol ? `Reordered ${task.title}` : `${describeMove(task, colKey)}`);
    }, duration + 10);
  }, [reduced, tasks, placeTask, colOf, commit, describeMove]);

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

  useEffect(() => {
    if (!peek?.pinned || phone) return;
    function onDown(e: PointerEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("[role=dialog]") || t.closest("[data-card-id]")) return;
      setPeek(null);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [peek?.pinned, phone]);

  /* ── Keyboard: pick up, move, drop ──────────────────────────────── */

  const visibleIn = useCallback(
    (list: Task[], col: ColumnDef) => sortColumn(list.filter((t) => inColumn(t, col, group) && matches(t)), col),
    [group, matches],
  );

  function position(list: Task[], task: Task) {
    const col = columns.find((c) => inColumn(task, c, group))!;
    const vis = visibleIn(list, col);
    return { col, index: vis.findIndex((t) => t.id === task.id), total: vis.length };
  }

  function focusCard(id: string) {
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)?.focus({ preventScroll: false }));
  }

  function onCardKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, task: Task) {
    const picked = kb?.id === task.id;
    if (e.key === " ") {
      e.preventDefault();
      if (!kb) {
        setKb({ id: task.id, snapshot: tasks });
        setPeek(null);
        const pos = position(tasks, task);
        setAnnounce(
          `Picked up ${task.title}. In ${pos.col.name}, ${pos.index + 1} of ${pos.total}. Arrow keys move it, space drops it, escape cancels.`,
        );
      } else if (picked) {
        const pos = position(tasks, task);
        const from = kb.snapshot.find((t) => t.id === task.id)!;
        const fromCol = colOf(from);
        setHistory((h) => [...h.slice(-19), { projectId, tasks: kb.snapshot }]);
        setKb(null);
        if (fromCol?.key !== pos.col.key) {
          showToast(describeMove(task, pos.col.key));
          if (pos.col.stage === "done") setRailPulse((n) => n + 1);
        }
        setAnnounce(`Dropped ${task.title} in ${pos.col.name}, ${pos.index + 1} of ${pos.total}.`);
      }
      return;
    }
    if (e.key === "Escape" && picked) {
      e.preventDefault();
      setStore((s) => ({ ...s, [projectId]: kb.snapshot }));
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
    const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
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
      } else {
        index = Math.max(0, Math.min(pos.total - 1, pos.index + (e.key === "ArrowUp" ? -1 : 1)));
        if (index === pos.index) return;
        // placeTask indexes the list without the task in it.
      }
      const next = placeTask(tasks, task.id, colKey, index);
      setStore((s) => ({ ...s, [projectId]: next }));
      const moved = next.find((t) => t.id === task.id)!;
      const np = position(next, moved);
      setAnnounce(`${np.col.name}, ${np.index + 1} of ${np.total}.`);
      focusCard(task.id);
      return;
    }
    // Not holding: arrows move focus around the board.
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
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

  /* ── Global keys ────────────────────────────────────────────────── */

  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        undo();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        const focused = t.closest<HTMLElement>("[data-col]")?.dataset.col;
        const col = phone ? columns[phoneActive]?.key : focused ?? columns[0].key;
        if (col === "done" && !doneOpen) setDoneOpen(true);
        setComposer({ col: col ?? columns[0].key, sheet: phone });
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        setMenu(null);
        setPeek(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, columns, phone, phoneActive, doneOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  const total = tasks.length;
  const doneWeek = tasks.filter((t) => t.stage === "done" && (t.doneAt ?? "") >= WEEK_START).length;
  const late = tasks.filter(isLate).length;
  const stageCounts = Object.fromEntries(STAGES.map((s) => [s.key, tasks.filter((t) => t.stage === s.key && matches(t)).length])) as Record<
    StageKey,
    number
  >;
  const dragTask = drag ? tasks.find((t) => t.id === drag.id) : undefined;
  const peekTask = peek ? tasks.find((t) => t.id === peek.id) : undefined;
  const moveTask = moveId ? tasks.find((t) => t.id === moveId) : undefined;
  const filterName = filterPerson ? byId.get(filterPerson)?.first : null;

  function switchProject(id: string) {
    setProjectId(id);
    setFilterPerson(null);
    setLateOnly(false);
    setQuery("");
    setMenu(null);
    setComposer(null);
    setPeek(null);
    setDoneOpen(false);
    setPhoneActive(0);
    boardRef.current?.scrollTo({ left: 0 });
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  const doneCol = columns.find((c) => c.stage === "done");
  const railMode = group === "stage" && !doneOpen && !phone;

  function renderColumn(col: ColumnDef) {
    const all = sortColumn(
      tasks.filter((t) => inColumn(t, col, group)),
      col,
    );
    const visible = all.filter((t) => matches(t) && t.id !== drag?.id);
    const count = all.filter((t) => t.id !== drag?.id).length + (drag && drag.over === col.key && dragTask && !inColumn(dragTask, col, group) ? 1 : 0);
    const over = !!col.limit && count > col.limit;
    const isDrop = drag?.over === col.key;
    const items: ({ kind: "card"; task: Task } | { kind: "slot" })[] = visible.map((task) => ({ kind: "card", task }));
    if (isDrop) items.splice(Math.min(drag!.index, items.length), 0, { kind: "slot" });
    const filteredOut = all.length > 0 && visible.length === 0 && !isDrop;

    return (
      <section
        key={col.key}
        className={styles.column}
        data-col={col.key}
        data-over-limit={over ? "" : undefined}
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
            <span className={styles.columnCount} aria-label={`${count} ${count === 1 ? "task" : "tasks"}`}>
              {count}
            </span>
            <span className={styles.columnSpacer} />
            {col.limit ? (
              <span className={styles.limit} data-over={over ? "" : undefined} title={`The team works on up to ${col.limit} at once`}>
                {count} of {col.limit}
              </span>
            ) : null}
            {col.stage === "done" && !phone ? (
              <button type="button" className={styles.iconButton} onClick={() => setDoneOpen(false)} aria-label="Collapse done tasks">
                <Icon.collapse size={14} />
              </button>
            ) : null}
          </div>
          {over ? <p className={styles.limitNote}>More than the team can carry at once</p> : null}
        </header>
        <div className={styles.columnBody} ref={registerZone(col.key)}>
          <LayoutGroup id={col.key}>
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
                  layout="position"
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  className={styles.cardWrap}
                >
                  <CardFace
                    task={item.task}
                    people={peopleOf(item.task)}
                    showStage={group === "person"}
                    pickedUp={kb?.id === item.task.id}
                    justAdded={justAdded === item.task.id}
                    data-card-id={item.task.id}
                    role="button"
                    tabIndex={0}
                    aria-label={cardLabel(item.task, peopleOf(item.task))}
                    aria-describedby="board-howto"
                    aria-pressed={kb?.id === item.task.id ? true : undefined}
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
          </LayoutGroup>
          {visible.length === 0 && !isDrop && !(composer?.col === col.key && !composer.sheet) ? (
            <div className={styles.emptyColumn} data-filtered={filteredOut ? "" : undefined}>
              {filteredOut ? (
                filterName ? (
                  <>No tasks for {filterName} here</>
                ) : query ? (
                  <>Nothing here matches “{query}”</>
                ) : (
                  <>Nothing late here</>
                )
              ) : (
                col.empty
              )}
            </div>
          ) : null}
          {composer?.col === col.key && !composer.sheet ? (
            <InlineComposer
              people={people}
              stageName={col.name}
              onSubmit={(p) => addTask(col.key, p)}
              onClose={() => setComposer(null)}
            />
          ) : (
            <button type="button" className={styles.addButton} onClick={() => setComposer({ col: col.key, sheet: false })}>
              <Icon.plus size={14} />
              Add task
              {col.key === columns[0].key ? <kbd className={styles.kbd}>C</kbd> : null}
            </button>
          )}
        </div>
      </section>
    );
  }

  const doneCount = tasks.filter((t) => t.stage === "done").length;
  const railOver = drag?.over === "done-rail";

  return (
    <MotionConfig reducedMotion="user">
      <div className={styles.root} data-dragging={drag ? "" : undefined}>
        <p id="board-howto" className={styles.srOnly}>
          Press space to pick up. Arrow keys move it, space drops it, escape cancels. Press enter for a quick look.
        </p>
        <div className={styles.srOnly} aria-live="assertive">
          {announce}
        </div>

        {/* ── Header ─────────────────────────────────────────────── */}
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <div className={styles.titleRow}>
              <h1 className={styles.h1}>Tasks</h1>
              <div className={styles.menuAnchor} data-menu="">
                <button
                  type="button"
                  className={styles.projectPill}
                  aria-haspopup="menu"
                  aria-expanded={menu === "project"}
                  onClick={() => setMenu(menu === "project" ? null : "project")}
                >
                  <span className={styles.projectDot} style={{ "--dot": dataset.tone } as CSSProperties} aria-hidden="true" />
                  <span className={styles.projectName}>{dataset.name}</span>
                  <span className={styles.projectKind}>{dataset.kind}</span>
                  <Icon.chevronDown size={14} />
                </button>
                {menu === "project" ? (
                  <div className={styles.menu} role="menu" aria-label="Switch project">
                    <p className={styles.menuLabel}>Switch project</p>
                    {DATASETS.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={d.id === projectId}
                        className={styles.menuItem}
                        onClick={() => switchProject(d.id)}
                      >
                        <span className={styles.projectTile} style={{ "--dot": d.tone } as CSSProperties} aria-hidden="true">
                          {d.name.charAt(0)}
                        </span>
                        <span className={styles.menuItemText}>
                          <span>{d.name}</span>
                          <span className={styles.menuItemSub}>
                            {d.kind}, {d.people.length} people
                          </span>
                        </span>
                        {d.id === projectId ? <Icon.check size={14} className={styles.menuCheck} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <p className={styles.progressLine}>
              {total === 0 ? (
                "No tasks yet"
              ) : (
                <>
                  <span className={styles.ring} style={{ "--p": `${Math.round((tasks.filter((t) => t.stage === "done").length / total) * 100)}%` } as CSSProperties} aria-hidden="true" />
                  <span>
                    <strong className={styles.strong}>{doneWeek}</strong> of {total} done this week
                    {late ? "," : ""}
                  </span>
                  {late ? (
                    <>
                      <button
                        type="button"
                        className={styles.lateButton}
                        aria-pressed={lateOnly}
                        onClick={() => setLateOnly((v) => !v)}
                        title={lateOnly ? "Show everything" : "Show only late tasks"}
                      >
                        {late} late
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              const col = phone ? columns[phoneActive].key : columns[0].key;
              setComposer({ col, sheet: phone });
            }}
          >
            <Icon.plus size={16} />
            <span className={styles.primaryText}>New task</span>
            <kbd className={styles.kbdOnAccent} aria-hidden="true">
              C
            </kbd>
          </button>
        </header>

        {/* ── Toolbar ────────────────────────────────────────────── */}
        <div className={styles.toolbar} role="toolbar" aria-label="Board view">
          <div className={styles.segmented} role="group" aria-label="Layout">
            <button type="button" className={styles.segment} aria-pressed="true">
              <Icon.board size={14} />
              Board
            </button>
            <button type="button" className={styles.segment} aria-pressed="false" title="Explored in the list concepts">
              <Icon.list size={14} />
              List
            </button>
            <button type="button" className={styles.segment} aria-pressed="false" title="Explored in the calendar concepts">
              <Icon.calendar size={14} />
              Calendar
            </button>
          </div>
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
          <div className={styles.faces} role="group" aria-label="Show tasks for">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.face}
                aria-pressed={filterPerson === p.id}
                data-dim={filterPerson && filterPerson !== p.id ? "" : undefined}
                onClick={() => setFilterPerson(filterPerson === p.id ? null : p.id)}
                title={filterPerson === p.id ? `Showing ${p.first}'s tasks. Click to show everyone.` : `Only ${p.first}'s tasks`}
                aria-label={`Only ${p.name}'s tasks`}
              >
                <Avatar person={p} size={26} ring />
              </button>
            ))}
            {filterPerson || lateOnly ? (
              <button
                type="button"
                className={styles.clearFilter}
                onClick={() => {
                  setFilterPerson(null);
                  setLateOnly(false);
                }}
              >
                <Icon.close size={12} />
                {filterName ? `${filterName}${lateOnly ? ", late" : ""}` : "Late only"}
              </button>
            ) : null}
          </div>
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
          <EmptyBoard
            dataset={dataset}
            onStart={(title) => {
              addTask(columns[0].key, { title, tokens: [] });
            }}
            onWrite={() => setComposer({ col: columns[0].key, sheet: true })}
          />
        ) : (
          <div className={styles.board} ref={boardRef} onScroll={onBoardScroll} data-group={group}>
            {columns.filter((c) => !(railMode && c.stage === "done")).map(renderColumn)}
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
            onClose={() => {
              const id = peek.id;
              setPeek(null);
              if (peek.pinned && !phone) focusCard(id);
            }}
            onToggleStep={(stepId) => toggleStep(peekTask.id, stepId)}
            onEnter={() => window.clearTimeout(leaveTimer.current)}
            onLeave={() => {
              if (!peek.pinned) leaveTimer.current = window.setTimeout(() => setPeek((p) => (p?.pinned ? p : null)), 140);
            }}
            onMove={() => {
              setPeek(null);
              setMoveId(peekTask.id);
            }}
          />
        ) : null}

        {moveTask ? (
          <MoveSheet
            task={moveTask}
            counts={stageCounts}
            onClose={() => setMoveId(null)}
            onPick={(stage) => {
              const next = tasks.map((t) =>
                t.id === moveTask.id ? { ...t, stage, doneAt: stage === "done" ? TODAY : undefined, heldBy: stage === "waiting" ? t.heldBy : undefined } : t,
              );
              const reordered = stage === "done" ? [next.find((t) => t.id === moveTask.id)!, ...next.filter((t) => t.id !== moveTask.id)] : next;
              commit(reordered, stage === "done" ? `Done: ${moveTask.title}` : `Moved to ${STAGES.find((s) => s.key === stage)!.name}`);
              setMoveId(null);
            }}
          />
        ) : null}

        {composer?.sheet ? (
          <div className={styles.scrim} onClick={() => setComposer(null)}>
            <div role="dialog" aria-modal="true" aria-label="New task" className={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <span className={styles.sheetGrip} aria-hidden="true" />
              <h2 className={styles.sheetTitle}>
                New task in {columns.find((c) => c.key === composer.col)?.name ?? "To do"}
              </h2>
              <InlineComposer
                people={people}
                variant="sheet"
                stageName={columns.find((c) => c.key === composer.col)?.name ?? "To do"}
                onSubmit={(p) => {
                  addTask(composer.col, p);
                  setComposer(null);
                  showToast(`Added to ${columns.find((c) => c.key === composer.col)?.name ?? "To do"}`, true);
                }}
                onClose={() => setComposer(null)}
              />
            </div>
          </div>
        ) : null}

        {phone && total > 0 && !composer && !moveTask && !peek ? (
          <button
            type="button"
            className={styles.fab}
            onClick={() => setComposer({ col: columns[phoneActive].key, sheet: true })}
          >
            <Icon.plus size={18} />
            Add task
          </button>
        ) : null}

        {toast ? (
          <UndoToast
            key={toast.id}
            message={toast.message}
            onUndo={toast.undo && history.length ? undo : undefined}
            onClose={() => setToast(null)}
          />
        ) : null}
      </div>
    </MotionConfig>
  );
}

/* ── Whole-board empty state ──────────────────────────────────────── */

function EmptyBoard({ dataset, onStart, onWrite }: { dataset: Dataset; onStart: (title: string) => void; onWrite: () => void }) {
  return (
    <div className={styles.emptyBoard}>
      <div className={styles.emptyArt} aria-hidden="true">
        {STAGES.slice(0, 4).map((s, i) => (
          <div key={s.key} className={styles.emptyArtCol}>
            <StageGlyph stage={s.key} size={12} />
            {Array.from({ length: [3, 2, 1, 0][i] }, (_, j) => (
              <span key={j} className={styles.emptyArtCard} style={{ animationDelay: `${(i * 3 + j) * 60}ms` }} />
            ))}
          </div>
        ))}
      </div>
      <h2 className={styles.emptyTitle}>A clean board for {dataset.name}</h2>
      <p className={styles.emptyText}>
        Each task is a card. It starts in To do and moves right as the work gets done. Add one of these to begin, or write your own.
      </p>
      <ul className={styles.starters}>
        {dataset.starters?.map((s) => (
          <li key={s}>
            <button type="button" className={styles.starter} onClick={() => onStart(s)}>
              <StageGlyph stage="todo" size={16} />
              <span>{s}</span>
              <span className={styles.starterAdd}>
                <Icon.plus size={14} />
                Add
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={styles.secondaryButton} onClick={onWrite}>
        Write my own
        <kbd className={styles.kbd}>C</kbd>
      </button>
    </div>
  );
}
