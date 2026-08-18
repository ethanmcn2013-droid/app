"use client";

/**
 * Studio Floor — the Tasks board.
 *
 * A React port of the design master at
 * `docs/design/labs/tasks-2026-08/floor.html`, which was taken through
 * eleven rounds of a seven-seat panel (final: 8.1–8.7 against a 9.5 bar,
 * 350 findings, 243 confirmed and fixed). The master remains the reference;
 * this file renders the same board over the live workspace store.
 *
 * What the direction locks:
 *   · Three colours, all from tokens.css: --ink, --indigo-600 and --paper,
 *     and tints of those three at stated alpha. The board names no value of
 *     its own, because a second copy of a colour is a second place it drifts
 *     from. Status is carried by ink density and
 *     fill, never by hue — so there is no amber lane, no green tick and no
 *     red overdue here on purpose.
 *   · One chip grammar. Every time fact is a point in time; the fill says
 *     the condition. Filled means behind, outlined means today, indigo
 *     means the next milestone.
 *   · One roving tab stop for the whole board, which does not grow with the
 *     work on it.
 *
 * Data, selection, the detail panel, bulk actions and persistence are the
 * existing store's — this file replaces the rendering, nothing else.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useLabStore } from "@/components/hybrid/store";
import { useBoardColumns } from "@/components/hybrid/columns-context";
import { LANE_NOTE } from "./floor-workspace";
import { labelById } from "@/components/hybrid/fixtures";
import type { LabTask } from "@/components/hybrid/types";
import { useFloorPlace } from "./use-floor-place";
import { useFloorFlight } from "./use-floor-flight";
import { useFloorUndo, type FloorAct } from "./use-floor-undo";
import styles from "./floor.module.css";

/** The label registry is module state in the hybrid tree. */
function labelName(id: string): string | null {
  return labelById(id)?.name ?? null;
}

/* ── time ──────────────────────────────────────────────────────────
   One fact per card, resolved once, in one grammar. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toUTC(iso: string): number {
  const [y, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

function dayLabel(iso: string, today: number): string {
  const date = toUTC(iso);
  const days = Math.round((date - today) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(date).getUTCDay()];
  }
  const d = new Date(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function dayCount(iso: string, today: number): string {
  const days = Math.abs(Math.round((today - toUTC(iso)) / 86_400_000));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export type TimeFact = { kind: string; label: string; said: string; spoken: string };

/** Midnight UTC today, so a card's time fact is stable across a render. */
export function todayStamp(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function timeOf(task: LabTask, columnIsDone: boolean, today: number): TimeFact {
  const none = { kind: "none", label: "", said: "", spoken: "" };
  if (task.completed || columnIsDone) {
    if (!task.completedAt) return none;
    const iso = task.completedAt.slice(0, 10);
    return {
      kind: "done",
      label: dayLabel(iso, today),
      said: `Completed ${dayLabel(iso, today)}`,
      spoken: "Completed ",
    };
  }
  if (task.schedule.kind === "milestone") {
    return {
      kind: "milestone",
      label: dayLabel(task.schedule.on, today),
      said: `Milestone, due ${dayLabel(task.schedule.on, today)}`,
      spoken: "Milestone ",
    };
  }
  const due =
    task.schedule.kind === "due" || task.schedule.kind === "range" ? task.schedule.dueOn : null;
  if (!due) return none;
  const delta = Math.round((toUTC(due) - today) / 86_400_000);
  if (delta < 0) {
    return {
      kind: "overdue",
      label: dayLabel(due, today),
      said: `${dayCount(due, today)} overdue, due ${dayLabel(due, today)}`,
      spoken: "Overdue, due ",
    };
  }
  if (delta === 0) {
    return { kind: "today", label: "Today", said: "Due today", spoken: "Due " };
  }
  return {
    kind: "soon",
    label: dayLabel(due, today),
    said: `Due ${dayLabel(due, today)}`,
    spoken: "Due ",
  };
}

/** A couple is one name and must never break across two lines. */
function bindName(text: string): string {
  return text.replace(/ & /g, "\u00a0&\u00a0");
}

/* ── icons ─────────────────────────────────────────────────────── */

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const Dots = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
  </svg>
);
const Plus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const Comment = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-4.4A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
);

/** The keycap says what this keyboard actually has on it. */
const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  ? "⌘"
  : "Ctrl ";

function shortTitle(title: string): string {
  if (title.length <= 48) return title;
  const words = title.slice(0, 48).split(" ");
  words.pop();
  return `${words.join(" ")}…`;
}

/* ── the card ──────────────────────────────────────────────────── */

type CardProps = {
  task: LabTask;
  time: TimeFact;
  done: boolean;
  stop: boolean;
  carried: boolean;
  open: boolean;
  clientOnly: string | null;
  clientOf: (task: LabTask) => string | null;
  tagOf: (task: LabTask) => string | null;
  onTick: (id: string) => void;
  onMenu: (id: string, anchor: HTMLElement) => void;
  onDragStart: (event: React.DragEvent) => void;
  onClient: (name: string) => void;
  menuOpen: boolean;
};

function FloorCard({
  task, time, done, stop, carried, open, clientOnly,
  clientOf, tagOf, onTick, onMenu, onClient, menuOpen, onDragStart,
}: CardProps) {
  const client = clientOf(task);
  const tag = tagOf(task);
  const showTime = time.kind !== "none" && time.label !== "";
  const priority = task.priority === "high" || task.priority === "urgent"
    ? task.priority === "urgent" ? "Urgent" : "High"
    : null;
  const bare = !client && !tag && !priority && !task.comments.length;
  const described = [
    time.said,
    task.description,
    client ?? tag,
    priority ? `${priority} priority` : "",
    task.comments.length ? `${task.comments.length} ${task.comments.length === 1 ? "comment" : "comments"}` : "",
  ].filter(Boolean).map((p) => String(p).replace(/\.$/, "")).join(". ");

  return (
    <article
      className={styles.card}
      data-id={task.id}
      draggable={!open}
      onDragStart={onDragStart}
      aria-label={task.title}
      aria-describedby={`fd-${task.id}`}
      {...(task.description ? { "aria-expanded": open } : {})}
      tabIndex={stop ? 0 : -1}
      {...(done ? {} : { "aria-roledescription": "Task, movable" })}
      {...(carried ? { "aria-grabbed": true, "data-force": "moving" } : {})}
      {...(open ? { "data-open": "" } : {})}
      {...(done ? { "data-done": "" } : {})}
      {...(task.schedule.kind === "milestone" ? { "data-next": "" } : {})}
      {...(bare ? { "data-bare": "" } : {})}
    >
      <button
        type="button"
        className={styles.tick}
        data-act="tick"
        tabIndex={stop ? 0 : -1}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? "Mark not done" : "Mark done"}
        onClick={(e) => { e.stopPropagation(); onTick(task.id); }}
      >
        <Check />
      </button>

      <div className={styles.cardTitleRow}>
        {showTime && (
          <span className={styles.when} data-t={time.kind} title={time.said}>
            <span className={styles.sr}>{time.spoken}</span>
            {time.label}
          </span>
        )}
        <p className={styles.cardTitle} data-trim="title" data-clip="row" id={`ft-${task.id}`}>{bindName(task.title)}</p>
        <span className={styles.sr} id={`fd-${task.id}`}>{described}.</span>
      </div>

      {task.description && <p className={styles.cardNote} data-trim="note">{task.description}</p>}

      <div className={styles.cardFoot}>
        {client && (
          <button
            type="button"
            className={styles.who}
            data-act="client"
            tabIndex={stop ? 0 : -1}
            aria-pressed={clientOnly === client}
            title={clientOnly === client ? "Show every couple again" : `Show only ${client}`}
            onClick={(e) => { e.stopPropagation(); onClient(client); }}
          >
            {bindName(client)}
          </button>
        )}
        {!client && tag && <span className={styles.tag}>{tag}</span>}
        {priority && !done && <span className={styles.hi}>{priority}<span className={styles.sr}> priority</span></span>}
        {task.comments.length > 0 && (
          <span className={styles.cm}><Comment />{task.comments.length}</span>
        )}
        <button
          type="button"
          className={styles.cardDots}
          data-act="menu"
          tabIndex={stop ? 0 : -1}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Move this task"
          onClick={(e) => { e.stopPropagation(); onMenu(task.id, e.currentTarget); }}
        >
          <Dots />
        </button>
      </div>
    </article>
  );
}

/* ── the board ─────────────────────────────────────────────────── */

export type FloorBoardProps = {
  /** The set the view tools have already filtered and sorted. */
  tasks: LabTask[];
  /** The header's own filters, so the board and the facts agree. */
  lateOnly?: boolean;
  todayOnly?: boolean;
  onClearHeaderFilters?: () => void;
};

export function FloorBoard({
  tasks, lateOnly = false, todayOnly = false, onClearHeaderFilters,
}: FloorBoardProps) {
  const store = useLabStore();
  const columns = useBoardColumns();
  const rootRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => todayStamp(), []);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [carriedId, setCarriedId] = useState<string | null>(null);
  const carriedFrom = useRef<{ status: string; index: number } | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [clientOnly, setClientOnly] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [draftLane, setDraftLane] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const overRef = useRef<{ lane: string; index: number } | null>(null);
  /* The venue's own grouping. A client is a label that names a couple —
     the board's convention is an ampersand between two given names. */
  const clientOf = useCallback((task: LabTask): string | null => {
    const label = task.labelIds.length ? labelName(task.labelIds[0]) : null;
    return label && label.includes("&") ? label : null;
  }, []);
  const tagOf = useCallback((task: LabTask): string | null => {
    const label = task.labelIds.length ? labelName(task.labelIds[0]) : null;
    return label && !label.includes("&") ? label : null;
  }, []);

  /* The board can be asked more than one question at once; the predicate
     intersects them and the sentence is composed from whichever are live. */
  const filtering = Boolean(clientOnly) || lateOnly || todayOnly;

  const rowsFor = useCallback(
    (column: { key: string; isDone: boolean }) => {
      let rows = tasks.filter((t) => t.status === column.key).sort((a, b) => a.order - b.order);
      if (lateOnly) rows = rows.filter((t) => timeOf(t, column.isDone, today).kind === "overdue");
      if (todayOnly) rows = rows.filter((t) => timeOf(t, column.isDone, today).kind === "today");
      if (clientOnly) rows = rows.filter((t) => clientOf(t) === clientOnly);
      return rows;
    },
    [tasks, clientOnly, clientOf, lateOnly, todayOnly, today],
  );

  const all = tasks;
  const totalShown = columns.reduce((n, c) => n + rowsFor(c).length, 0);

  const snapWas = useRef<string | null>(null);
  const edgeFrame = useRef(0);

  /* Place, truth and travel are all measured after layout, so they live in
     their own hooks rather than in the render. */
  const version = `${tasks.map((t) => `${t.id}:${t.status}:${t.completed ? 1 : 0}`).join()}|${openNoteId}|${carriedId}|${draftLane}|${clientOnly}|${lateOnly}|${todayOnly}`;
  const place = useFloorPlace(rootRef, version);
  const flight = useFloorFlight(rootRef, styles.cardGhost, version);

  /* Reversing an act runs through the same paths that made it, so an undone
     completion travels back exactly as it travelled out. */
  const undo = useFloorUndo(
    useCallback((act: FloorAct) => {
      place.capture();
      if (act.kind === "done") {
        flight.arm(act.id);
        store.toggleComplete(act.id);
        store.setPreview?.(null);
      } else if (act.kind === "move") {
        flight.arm(act.id);
        store.moveStatus(act.id, act.lane, act.index);
      } else {
        store.deleteTask(act.id);
      }
      place.wantFocus(act.kind === "add" ? null : act.id);
      setFocusId(act.kind === "add" ? null : act.id);
    }, [flight, place, store]),
  );

  /* Every route to a change goes through these, so no route can be the one
     that forgets the flight, the record or the operator's place. */
  const complete = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const done = task.completed || columns.find((c) => c.key === task.status)?.isDone;
    place.capture();
    flight.arm(id);
    store.toggleComplete(id);
    if (done) undo.forget(id, "done");
    else undo.arm({ kind: "done", id, title: task.title });
    place.wantFocus(id);
    setFocusId(id);
  }, [tasks, columns, place, flight, store, undo]);

  const move = useCallback((id: string, lane: string, index: number, record = true) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const at = columns.findIndex((c) => c.key === task.status);
    const from = { lane: task.status, index: Math.max(0, rowsFor(columns[at] ?? columns[0]).findIndex((t) => t.id === id)) };
    const toDone = columns.find((c) => c.key === lane)?.isDone;
    place.capture();
    flight.arm(id);
    store.moveStatus(id, lane, index);
    if (!record) return;
    /* A move into Done is a completion, whichever route took it there. */
    if (toDone && !columns.find((c) => c.key === from.lane)?.isDone) {
      undo.arm({ kind: "done", id, title: task.title });
    } else {
      undo.arm({ kind: "move", id, title: task.title, lane: from.lane, index: from.index, toLane: lane });
    }
    place.wantFocus(id);
    setFocusId(id);
  }, [tasks, columns, rowsFor, place, flight, store, undo]);

  /* The board's single tab stop. */
  const ordered = columns.flatMap((c) => rowsFor(c).map((t) => t.id));
  const stopId = focusId && ordered.includes(focusId) ? focusId : ordered[0] ?? null;

  const filterSentence = useCallback(() => {
    if (!filtering) return "Showing all work.";
    const rest = all.length - totalShown;
    const what = [
      clientOnly ? `for ${clientOnly}` : "",
      lateOnly ? "overdue" : "",
      todayOnly ? "due today" : "",
    ].filter(Boolean).join(", ");
    return `${totalShown
      ? `Showing the ${totalShown} ${totalShown === 1 ? "task" : "tasks"} ${what}. `
      : `Nothing ${what}. `}${rest} ${rest === 1 ? "other is" : "others are"} hidden.`;
  }, [filtering, all.length, totalShown, clientOnly, lateOnly, todayOnly]);

  /** A lane by the name the operator sees on the column. */
  const laneName = useCallback(
    (key: string) => columns.find((c) => c.key === key)?.name ?? key,
    [columns],
  );

  const clearFilters = useCallback(() => {
    setClientOnly(null);
    onClearHeaderFilters?.();
  }, [onClearHeaderFilters]);

  /* ── keyboard ──────────────────────────────────────────────── */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("[contenteditable=true], input, textarea")) return;

      if ((event.metaKey || event.ctrlKey) && (event.key === "z" || event.key === "Z")) {
        event.preventDefault();
        undo.undo();
        return;
      }
      if (event.key === "Escape") {
        if (menuFor) { event.preventDefault(); setMenuFor(null); return; }
        if (carriedId && carriedFrom.current) {
          event.preventDefault();
          store.moveStatus(carriedId, carriedFrom.current.status, carriedFrom.current.index);
          setCarriedId(null); carriedFrom.current = null;
          return;
        }
        if (openNoteId) { event.preventDefault(); setOpenNoteId(null); return; }
        if (clientOnly) { event.preventDefault(); setClientOnly(null); return; }
        return;
      }

      const card = target.closest("[data-id]") as HTMLElement | null;
      if (!card) return;
      const id = card.dataset.id!;
      if (target.closest("[data-act]") && (event.key === " " || event.key === "Enter")) return;
      setFocusId(id);

      const locate = () => {
        for (let x = 0; x < columns.length; x += 1) {
          const rows = rowsFor(columns[x]);
          const y = rows.findIndex((t) => t.id === id);
          if (y !== -1) return { x, y, rows };
        }
        return null;
      };

      if (event.key === " ") {
        event.preventDefault();
        if (carriedId === id) { setCarriedId(null); carriedFrom.current = null; return; }
        const at = locate();
        if (at) { carriedFrom.current = { status: columns[at.x].key, index: at.y }; setCarriedId(id); }
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        setOpenNoteId((prev) => (prev === id ? null : id));
        return;
      }
      const DIR: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const dir = DIR[event.key];
      if (!dir) return;
      event.preventDefault();
      const at = locate();
      if (!at) return;
      const [dx, dy] = dir;
      if (carriedId === id) {
        if (dy) {
          const to = Math.max(0, Math.min(at.rows.length - 1, at.y + dy));
          if (to !== at.y) { place.capture(); store.moveStatus(id, columns[at.x].key, to); place.wantFocus(id); }
        } else {
          const x = at.x + dx;
          if (x >= 0 && x < columns.length) {
            place.capture();
            store.moveStatus(id, columns[x].key, Math.min(at.y, rowsFor(columns[x]).length));
            place.wantFocus(id);
          }
        }
        return;
      }
      if (dy) {
        const next = at.rows[at.y + dy];
        if (next) setFocusId(next.id);
        return;
      }
      for (let x = at.x + dx; x >= 0 && x < columns.length; x += dx) {
        const rows = rowsFor(columns[x]);
        if (rows.length) { setFocusId(rows[Math.min(at.y, rows.length - 1)].id); return; }
      }
    },
    [menuFor, carriedId, openNoteId, clientOnly, columns, rowsFor, store, place, undo],
  );



  /* ── pointer drag ──────────────────────────────────────────── */
  const onDragStart = (event: React.DragEvent, id: string) => {
    const at = columns.findIndex((c) => rowsFor(c).some((t) => t.id === id));
    carriedFrom.current = { status: columns[at]?.key ?? columns[0].key, index: 0 };
    setCarriedId(id);
    undo.hold();
    /* Mandatory snap re-snaps every per-frame nudge, so it stands down for
       the length of the gesture. */
    const board = rootRef.current?.querySelector<HTMLElement>("[data-board]");
    if (board) {
      snapWas.current = board.style.scrollSnapType;
      board.style.scrollSnapType = "none";
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };
  const onDragOver = (event: React.DragEvent, lane: string) => {
    if (!carriedId) return;
    event.preventDefault();
    const board = rootRef.current?.querySelector<HTMLElement>("[data-board]");
    if (board) edgeScroll(board, event.clientX);
    const body = (event.currentTarget as HTMLElement).querySelector(`.${styles.trayBody}`);
    let index = 0;
    if (body) {
      const cards = [...body.querySelectorAll<HTMLElement>("[data-id]")].filter((c) => c.dataset.id !== carriedId);
      index = cards.length;
      for (let i = 0; i < cards.length; i += 1) {
        const box = cards[i].getBoundingClientRect();
        if (event.clientY < box.top + box.height / 2) { index = i; break; }
      }
    }
    overRef.current = { lane, index };
  };
  const onDrop = (event: React.DragEvent) => {
    stopEdge();
    if (!carriedId || !overRef.current) return;
    event.preventDefault();
    const origin = carriedFrom.current;
    /* Picking a card up and putting it back is a non-event; it used to arm an
       undo and announce a move. */
    if (origin && overRef.current.lane === origin.status && overRef.current.index === origin.index) {
      setCarriedId(null); carriedFrom.current = null; overRef.current = null;
      return;
    }
    move(carriedId, overRef.current.lane, overRef.current.index);
    setCarriedId(null); carriedFrom.current = null; overRef.current = null;
  };

  /* Holding a card at the edge walks the board across. Without it, at 768
     three of five columns cannot be reached by drag at all. */
  const stopEdge = useCallback(() => {
    cancelAnimationFrame(edgeFrame.current);
    edgeFrame.current = 0;
    const board = rootRef.current?.querySelector<HTMLElement>("[data-board]");
    if (board && snapWas.current !== null) {
      board.style.scrollSnapType = snapWas.current;
      snapWas.current = null;
    }
  }, []);

  const edgeScroll = useCallback((board: HTMLElement, x: number) => {
    const box = board.getBoundingClientRect();
    const step = x < box.left + 64 ? -14 : x > box.right - 64 ? 14 : 0;
    cancelAnimationFrame(edgeFrame.current);
    edgeFrame.current = 0;
    if (!step) return;
    const run = () => {
      board.scrollLeft += step;
      edgeFrame.current = requestAnimationFrame(run);
    };
    edgeFrame.current = requestAnimationFrame(run);
  }, []);

  /* ── the composer ──────────────────────────────────────────── */
  const commitDraft = (lane: string) => {
    const title = draftText.trim().replace(/\s+/g, " ");
    setDraftText("");
    if (!title) { setDraftLane(null); return; }
    const before = new Set(tasks.map((t) => t.id));
    store.addTask(lane, undefined, title);
    /* A task made under a filter used to be confirmed by name and be nowhere
       on screen. */
    if (filtering) clearFilters();
    /* Adding one task is rare; adding six on a Monday morning is the case. */
    setDraftLane(lane);
    queueMicrotask(() => {
      const made = store.tasks.find((t) => !before.has(t.id));
      if (made) undo.arm({ kind: "add", id: made.id, title, toLane: lane });
    });
  };

  return (
    <div
      ref={rootRef}
      className={styles.boardHost}
      onKeyDown={onKeyDown}
      {...(filtering ? { "data-filtered": "" } : {})}
    >
      {/* ── the board ─────────────────────────────────────── */}
        <div
          className={styles.board}
          data-board=""
          style={{ "--lanes": columns.length } as React.CSSProperties}
          role="application"
          aria-label="Task board, arrow keys to move between tasks, space to pick one up"
          onDrop={onDrop}
        >
          {columns.map((column) => {
            const rows = rowsFor(column);
            const laneAll = tasks.filter((t) => t.status === column.key);
            /* The column already carries its description in the head; an
               empty column says what is missing, not the same sentence a
               second time. */
            const empty = filtering || rows.length ? "" : "Nothing here yet.";
            return (
              <section
                key={column.key}
                className={styles.tray}
                data-lane={column.key}
                {...(rows.length ? {} : { "data-empty": "" })}
                aria-describedby={`fn-${column.key}`}
                role="region"
                aria-label={
                  filtering
                    ? `${column.name}, ${rows.length} of ${laneAll.length} shown`
                    : rows.length
                      ? `${column.name}, ${rows.length} ${rows.length === 1 ? "task" : "tasks"}`
                      : `${column.name}, nothing here yet`
                }
                onDragOver={(e) => onDragOver(e, column.key)}
              >
                <div className={styles.trayHead}>
                  <div className={styles.trayTop}>
                    <span className={styles.pip} aria-hidden="true" />
                    <h2 className={styles.trayName}>{column.name}</h2>
                    <span className={styles.trayCount} aria-hidden="true">
                      {rows.length}
                      {filtering && <span className={styles.ofAll}> of {laneAll.length}</span>}
                    </span>
                  </div>
                  <p className={styles.trayNote} id={`fn-${column.key}`}>
                    {filtering ? "" : column.description ?? LANE_NOTE[column.key] ?? ""}
                  </p>
                </div>

                <div className={styles.trayBody} data-tray-body="">
                  {rows.map((task) => (
                    <FloorCard
                      key={task.id}
                      onDragStart={(e) => onDragStart(e, task.id)}
                        task={task}
                        time={timeOf(task, column.isDone, today)}
                        done={task.completed || column.isDone}
                        stop={task.id === stopId}
                        carried={task.id === carriedId}
                        open={task.id === openNoteId}
                        clientOnly={clientOnly}
                        clientOf={clientOf}
                        tagOf={tagOf}
                        menuOpen={menuFor === task.id}
                        onTick={complete}
                        onClient={(name) => setClientOnly((p) => (p === name ? null : name))}
                        onMenu={(id, anchor) => {
                          const frame = rootRef.current!.getBoundingClientRect();
                          const box = anchor.getBoundingClientRect();
                          setMenuAt({
                            left: Math.max(8, Math.min(box.left - frame.left, frame.width - 200)),
                            top: Math.min(box.bottom - frame.top + 6, frame.height - 250),
                          });
                          setMenuFor((p) => (p === id ? null : id));
                        }}
                    />
                  ))}
                  {!rows.length && empty && <p className={styles.trayEmpty}>{empty}</p>}

                  {draftLane === column.key && (
                    <article className={styles.card} data-draft="">
                      <button type="button" className={styles.tick} tabIndex={-1} aria-hidden="true"><Check /></button>
                      <div className={styles.cardTitleRow}>
                        <p
                          className={styles.cardTitle}
                          contentEditable
                          suppressContentEditableWarning
                          role="textbox"
                          aria-label="What has to happen?"
                          data-placeholder="What has to happen?"
                          ref={(node) => { if (node && node.textContent !== draftText) node.textContent = draftText; }}
                          onInput={(e) => setDraftText((e.target as HTMLElement).textContent ?? "")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); commitDraft(column.key); }
                            if (e.key === "Escape") { e.preventDefault(); setDraftLane(null); setDraftText(""); }
                          }}
                        />
                      </div>
                      <p className={styles.draftHint}>Enter adds it. Esc discards.</p>
                    </article>
                  )}
                </div>

                <button
                  type="button"
                  className={styles.trayAdd}
                  tabIndex={rows.some((t) => t.id === stopId) || (!stopId && column === columns[0]) ? 0 : -1}
                  aria-label={`Add a task to ${column.name}`}
                  onClick={() => { setDraftLane(column.key); setDraftText(""); }}
                >
                  <Plus /><span>Add here</span>
                </button>
              </section>
            );
          })}
        </div>

        {all.length === 0 && (
          <div className={styles.emptyBoard}>
            <p>
              <b>Nothing on the board yet.</b>
              Put the first thing you have to do somewhere you will see it again.
            </p>
            <button type="button" onClick={() => { setDraftLane(columns[0]?.key ?? "todo"); setDraftText(""); }}>
              <Plus />Add the first task
            </button>
          </div>
        )}
        {filtering && totalShown === 0 && (
          <div className={styles.emptyBoard}>
            <p><b>Nothing matches.</b>{filterSentence()}</p>
            <button type="button" onClick={clearFilters}><Plus />Show all work</button>
          </div>
        )}

        {/* ── the foot strip ────────────────────────────────────
             The board's one statement of what it is doing to you: what is in
             your hand, what you just did with the way back, or what is being
             hidden. In that order — the hand always wins. */}
        {!carriedId && undo.showing && (
          <div
            className={styles.carry}
            onMouseEnter={undo.hold}
            onMouseLeave={undo.release}
            onFocus={undo.hold}
            onBlur={undo.release}
          >
            <span className={styles.carryName}>
              <b>{shortTitle(undo.showing.title)}</b>
              {undo.showing.kind === "done" ? " done"
                : undo.showing.kind === "add" ? ` added to ${laneName(undo.showing.toLane)}`
                : ` moved to ${laneName(undo.showing.toLane)}`}
            </span>
            <button type="button" className={styles.carryDo} data-act="undo" onClick={undo.undo}>Undo</button>
            {undo.depth > 1 && <em>{undo.depth - 1} more</em>}
            <em><kbd>{MOD}Z</kbd></em>
          </div>
        )}
        {!carriedId && !undo.showing && filtering && (
          <div className={styles.carry}>
            <span className={styles.carryName}>{filterSentence()}</span>
            <button type="button" className={styles.carryDo} onClick={clearFilters}>Show all</button>
          </div>
        )}
        {carriedId && (
          <div className={styles.carry}>
            <span className={styles.carryName}>
              <b>{store.taskById(carriedId)?.title ?? ""}</b>
            </span>
            <em><kbd data-keys="arrows">↑↓←→</kbd> move</em>
            <em><kbd>Space</kbd> drop</em>
            <em><kbd>Esc</kbd> cancel</em>
          </div>
      )}

      {/* ── the move menu ───────────────────────────────────── */}
      {menuFor && (
        <>
          <div className={styles.menuVeil} onClick={() => setMenuFor(null)} />
          <div
            className={styles.cardMenu}
            role="menu"
            aria-label="Move task"
            style={{ left: menuAt.left, top: menuAt.top }}
          >
            <p>Move to</p>
            {columns.map((c) => (
              <button
                key={c.key}
                type="button"
                role="menuitem"
                aria-current={store.taskById(menuFor)?.status === c.key ? true : undefined}
                onClick={() => { move(menuFor, c.key, 0); setMenuFor(null); }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
