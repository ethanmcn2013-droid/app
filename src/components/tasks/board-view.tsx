"use client";

/**
 * Board: columns of cards you can drag, carry with the keyboard, and edit
 * in place.
 *
 * - One roving tab stop for the whole board; arrows move between cards,
 *   Space picks a card up and arrows carry it, Enter opens it.
 * - Pointer drag through useBoardDrag (4px mouse threshold, 300ms touch
 *   press), with a cached layout and transform-only motion.
 * - Each column carries its purpose in one line, an honest empty state and
 *   an inline composer at its foot. Done is compact by default.
 *
 * Data attributes data-board, data-lane, data-id and data-floor-head are
 * the public hooks the browser tests rely on; keep them.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLabStore } from "@/components/hybrid/store";
import { useCalendarFrame } from "@/components/app/room/room-brief-context";
import { useRoomTools } from "@/components/app/room/room-tools-context";
import { useFitColumns, useShowStatusDescriptions } from "@/components/hybrid/view-prefs";
import { usePersonalization } from "@/lib/domain-context";
import type { BoardColumn } from "@/lib/board-columns";
import type { LabTask } from "@/components/hybrid/types";
import { AvatarStack } from "@/components/app/presence/avatar-stack";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { useSurface } from "./surface";
import { timeOf, type TimeFact } from "./time";
import { BlockedMark, CompleteToggle, CountMeta, DueChip, LabelChips, PriorityIcon, StatusGlyph, SubtaskReceipt, srOnly } from "./atoms";
import { Highlight, describeTask, labelsOf, usePeople, useTaskNumberOf } from "./task-bits";
import { useTasksPlace } from "./use-tasks-place";
import { useTasksFlight } from "./use-tasks-flight";
import { useBoardDrag, type DropTarget } from "./use-board-drag";
import { useCollapsedLanes, useDoneMode, useTaskNumbers } from "./display-prefs";
import { AddColumnButton, ColumnMenu } from "./column-menu";
import { boardOrder } from "./view-order";
import { setVisibleTaskOrder } from "./sheet-bridge";
import { TIcon } from "./icons";
import styles from "./board.module.css";

/** What each shipped column is for, in the product's own voice. */
export const LANE_NOTE: Record<string, string> = {
  todo: "Agreed and ready to start",
  doing: "In motion right now",
  review: "Being checked before it's finished",
  waiting: "Held by a reply or a delivery",
  done: "Finished work",
};

const EMPTY_NOTE: Record<string, string> = {
  todo: "Nothing agreed yet. Add the next thing that needs doing.",
  doing: "Nothing in motion. Drag a card here when work starts.",
  review: "Nothing waiting for a check.",
  waiting: "Nothing waiting on anyone. Drop a task here when it is held by a reply or a delivery.",
  done: "Finished work collects here.",
};

const DONE_PREVIEW = 3;

/** The narrowest a fitted lane may get before the board scrolls instead. */
const FIT_MIN = 248;

/** The shipped default descriptions (board-columns.ts). A column still on
 *  its default reads the shorter note; an owner's own words always win. */
const SHIPPED_DESCRIPTIONS = new Set([
  "Agreed and ready to start.",
  "In motion right now.",
  "Being checked before it goes out.",
  "Held by a reply, a delivery, or a decision.",
  "Finished work stays visible.",
]);

function laneNote(column: BoardColumn): string {
  const own = column.description?.trim();
  if (own && !SHIPPED_DESCRIPTIONS.has(own)) return own.replace(/\.$/, "");
  return LANE_NOTE[column.key] ?? own?.replace(/\.$/, "") ?? "";
}

export function BoardView({ onCompose }: { onCompose: (columnKey: string, anchor: HTMLElement | null) => void }) {
  const surface = useSurface();
  const store = useLabStore();
  const tools = useRoomTools();
  const calendar = useCalendarFrame();
  const { taskId: openId } = useTaskPanel();
  const [fit] = useFitColumns();
  const [showNotes] = useShowStatusDescriptions();
  const [doneMode] = useDoneMode();
  const [collapsed, toggleCollapsed] = useCollapsedLanes();
  const [numbersPref] = useTaskNumbers();
  const numberOf = useTaskNumberOf();
  const people = usePeople();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [carriedId, setCarriedId] = useState<string | null>(null);
  const carriedFrom = useRef<{ lane: string; index: number } | null>(null);
  const [composing, setComposing] = useState<string | null>(null);
  const [expandedDone, setExpandedDone] = useState(false);
  const [lifted, setLifted] = useState<string | null>(null);
  const dropFrom = useRef<DOMRect | null>(null);

  const columns = surface.columns;
  const rowsFor = useCallback(
    (column: BoardColumn): LabTask[] => {
      const rows = surface.visible.filter((task) => task.status === column.key);
      return tools.sort === "manual" ? rows.sort((a, b) => a.order - b.order) : rows;
    },
    [surface.visible, tools.sort],
  );
  const laneAll = useCallback((key: string) => surface.all.filter((task) => task.status === key).sort((a, b) => a.order - b.order), [surface.all]);

  const ordered = useMemo(() => boardOrder(columns.map((c) => c.key), (key) => rowsFor(columns.find((c) => c.key === key)!)), [columns, rowsFor]);
  useEffect(() => setVisibleTaskOrder(ordered), [ordered]);
  const stopId = focusId && ordered.includes(focusId) ? focusId : ordered[0] ?? null;

  /* Place, truth and travel are measured after layout. */
  const version = `${surface.visible.map((t) => `${t.id}:${t.status}:${t.order}:${t.completed ? 1 : 0}`).join()}|${carriedId}|${composing}|${doneMode}|${expandedDone}|${JSON.stringify(collapsed)}`;
  const place = useTasksPlace(rootRef, version);
  const flight = useTasksFlight(rootRef, styles.flightGhost, version);

  const { setMotion } = surface;
  useEffect(() => {
    setMotion({
      capture: place.capture,
      arm: (id) => {
        const from = dropFrom.current ?? undefined;
        dropFrom.current = null;
        flight.arm(id, from);
      },
      focus: (id) => {
        place.wantFocus(id);
        if (id) setFocusId(id);
      },
    });
    return () => setMotion(null);
  });

  /* Fit columns only while every fitted lane keeps at least FIT_MIN of
     width; otherwise the lanes stay a readable fixed width and scroll.
     Measured before paint and on resize, written straight to the host so
     no re-render is needed. */
  useLayoutEffect(() => {
    const host = rootRef.current;
    const board = host?.querySelector<HTMLElement>("[data-board]");
    if (!host || !board) return;
    const measure = () => {
      const style = window.getComputedStyle(board);
      const children = Array.from(board.children) as HTMLElement[];
      const lanes = children.filter((child) => child.hasAttribute("data-lane") && !child.hasAttribute("data-collapsed"));
      const fixed = children.filter((child) => !lanes.includes(child)).reduce((sum, child) => sum + child.offsetWidth, 0);
      const gap = Number.parseFloat(style.columnGap) || 0;
      const available =
        board.clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0) - fixed - gap * Math.max(0, children.length - 1);
      host.toggleAttribute("data-fit-room", fit && (lanes.length === 0 || available / lanes.length >= FIT_MIN));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => observer.disconnect();
  }, [columns.length, collapsed, doneMode, fit]);

  /* ── pointer drag ─────────────────────────────────────────────────── */
  const drag = useBoardDrag({
    root: rootRef,
    enabled: !surface.readOnly,
    ghostClass: styles.dragGhost,
    slotClass: styles.dropSlot,
    onLift: (id) => {
      setLifted(id);
      surface.undo.hold();
    },
    onDrop: (id, target: DropTarget, ghost) => {
      setLifted(null);
      surface.undo.release();
      const index = fullIndexFor(id, target);
      dropFrom.current = ghost;
      surface.move(id, target.lane, index);
    },
    onCancel: () => {
      setLifted(null);
      surface.undo.release();
    },
  });

  /** A drop index among visible cards, turned into one among all cards in the lane. */
  const fullIndexFor = (id: string, target: DropTarget): number => {
    const column = columns.find((c) => c.key === target.lane);
    const visible = column ? rowsFor(column).filter((t) => t.id !== id) : [];
    const all = laneAll(target.lane).filter((t) => t.id !== id);
    if (target.index < visible.length) {
      const at = all.findIndex((t) => t.id === visible[target.index].id);
      return at < 0 ? all.length : at;
    }
    const last = visible[visible.length - 1];
    return last ? all.findIndex((t) => t.id === last.id) + 1 : all.length;
  };

  /* ── keyboard: roving focus and carry ─────────────────────────────── */
  const locate = useCallback(
    (id: string) => {
      for (let x = 0; x < columns.length; x += 1) {
        const rows = rowsFor(columns[x]);
        const y = rows.findIndex((t) => t.id === id);
        if (y !== -1) return { x, y, rows };
      }
      return null;
    },
    [columns, rowsFor],
  );

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, [contenteditable=true]")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        const card = target.closest<HTMLElement>("[data-id]");
        const at = card ? locate(card.dataset.id!) : null;
        if (at) {
          event.preventDefault();
          at.rows.forEach((task) => {
            if (!store.selectedIds.includes(task.id)) store.toggleSelected(task.id);
          });
        }
      }
      return;
    }
    if (event.key === "Escape" && carriedId && carriedFrom.current) {
      event.preventDefault();
      event.stopPropagation();
      place.capture();
      store.moveStatus(carriedId, carriedFrom.current.lane, carriedFrom.current.index);
      place.wantFocus(carriedId);
      setCarriedId(null);
      carriedFrom.current = null;
      return;
    }
    const card = target.closest<HTMLElement>("[data-id]");
    if (!card) return;
    const id = card.dataset.id!;
    if (target.closest("[data-act]") && (event.key === " " || event.key === "Enter")) return;
    setFocusId(id);
    surface.setFocusedId(id);

    if (event.key === " " && !surface.readOnly) {
      event.preventDefault();
      if (carriedId === id) {
        const at = locate(id);
        const from = carriedFrom.current;
        if (at && from) {
          const task = surface.all.find((t) => t.id === id);
          if (task && (from.lane !== columns[at.x].key || from.index !== at.y)) {
            const toDone = columns[at.x].isDone && !columns.find((c) => c.key === from.lane)?.isDone;
            if (toDone) surface.undo.arm({ kind: "done", id, title: task.title });
            else surface.undo.arm({ kind: "move", id, title: task.title, lane: from.lane, index: from.index, toLane: columns[at.x].key });
          }
        }
        setCarriedId(null);
        carriedFrom.current = null;
        store.setPreview(null);
        return;
      }
      const at = locate(id);
      if (at) {
        carriedFrom.current = { lane: columns[at.x].key, index: laneAll(columns[at.x].key).findIndex((t) => t.id === id) };
        setCarriedId(id);
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (carriedId) return;
      store.openTask(id);
      return;
    }
    const DIR: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      h: [-1, 0],
      l: [1, 0],
      k: [0, -1],
      j: [0, 1],
    };
    const dir = DIR[event.key];
    if (!dir || (carriedId !== id && (event.key === "h" || event.key === "l"))) return;
    event.preventDefault();
    const at = locate(id);
    if (!at) return;
    const [dx, dy] = dir;
    if (carriedId === id) {
      if (dy) {
        const to = Math.max(0, Math.min(at.rows.length - 1, at.y + dy));
        if (to !== at.y) {
          place.capture();
          store.moveStatus(id, columns[at.x].key, fullIndexFor(id, { lane: columns[at.x].key, index: to }));
          place.wantFocus(id);
        }
      } else {
        const x = at.x + dx;
        if (x >= 0 && x < columns.length) {
          place.capture();
          const lane = columns[x].key;
          store.moveStatus(id, lane, fullIndexFor(id, { lane, index: Math.min(at.y, rowsFor(columns[x]).length) }));
          place.wantFocus(id);
        }
      }
      return;
    }
    if (event.shiftKey && dy) {
      const next = at.rows[at.y + dy];
      if (next) {
        store.toggleSelected(next.id, ordered, true);
        setFocusId(next.id);
        place.wantFocus(next.id);
        document.querySelector<HTMLElement>(`[data-id="${CSS.escape(next.id)}"]`)?.focus();
      }
      return;
    }
    const focusCard = (next: string) => {
      setFocusId(next);
      surface.setFocusedId(next);
      window.requestAnimationFrame(() => {
        const node = rootRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(next)}"]`);
        node?.focus();
        node?.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    };
    if (dy) {
      const next = at.rows[at.y + dy];
      if (next) focusCard(next.id);
      return;
    }
    for (let x = at.x + dx; x >= 0 && x < columns.length; x += dx) {
      const rows = rowsFor(columns[x]);
      if (rows.length) {
        focusCard(rows[Math.min(at.y, rows.length - 1)].id);
        return;
      }
    }
  };

  const carried = carriedId ? surface.all.find((t) => t.id === carriedId) : null;
  const carriedAt = carriedId ? locate(carriedId) : null;
  const personalization = usePersonalization();
  const blank = surface.all.length === 0;
  const filteredEmpty = !blank && surface.filtering && surface.visible.length === 0;

  return (
    <div
      ref={rootRef}
      className={styles.boardHost}
      data-sheet=""
      data-fit={fit ? "" : undefined}
      data-carrying={carriedId ? "" : undefined}
      data-first-run={blank ? "" : undefined}
      onKeyDown={onKeyDown}
      style={{ "--lanes": columns.length } as CSSProperties}
    >
      {blank ? <FirstRunGuide onAdd={(title) => surface.addInline(columns[0]?.key ?? "todo", title)} personalization={personalization} /> : null}
      {filteredEmpty ? <FilteredEmpty /> : null}
      <PhonePager
        columns={columns}
        counts={columns.map((c) => rowsFor(c).length)}
        tools={(column) => (
          <>
            {surface.readOnly ? null : (
              <button
                type="button"
                className={styles.laneButton}
                aria-label={`Add a task to ${column.name}`}
                onClick={() => setComposing(column.key)}
              >
                <TIcon.plus size={16} />
              </button>
            )}
            <ColumnMenu column={column} count={laneAll(column.key).length} onCollapse={() => toggleCollapsed(column.key)} />
          </>
        )}
      />
      <div
        className={styles.board}
        data-board=""
        role="application"
        aria-roledescription="task board"
        aria-label="Task board. Arrow keys move between tasks, Space picks one up, Enter opens it."
      >
        {columns.map((column) => {
          const rows = rowsFor(column);
          const total = laneAll(column.key).length;
          const isCollapsed = Boolean(collapsed[column.key]) || (column.isDone && doneMode === "collapsed");
          const compactDone = column.isDone && doneMode === "compact";
          // Compact Done lists the most recently finished first.
          const newestFirst = compactDone ? [...rows].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")) : rows;
          const shown = compactDone && !expandedDone ? newestFirst.slice(0, DONE_PREVIEW) : newestFirst;
          const over = column.limit !== undefined && rows.length > column.limit;
          if (isCollapsed) {
            return (
              <section
                key={column.key}
                className={styles.collapsed}
                data-lane={column.key}
                data-collapsed=""
                aria-label={`${column.name}, ${rows.length} ${rows.length === 1 ? "task" : "tasks"}, folded`}
              >
                <button
                  type="button"
                  className={styles.unfold}
                  onClick={() => (column.isDone && doneMode === "collapsed" && !collapsed[column.key] ? null : toggleCollapsed(column.key))}
                  aria-label={`Unfold ${column.name}`}
                  title={column.isDone && doneMode === "collapsed" ? "Change this in Display" : `Unfold ${column.name}`}
                >
                  <StatusGlyph column={column} size={14} />
                  <span className={styles.foldName}>{column.name}</span>
                  <span className={styles.foldCount}>{rows.length}</span>
                </button>
                <div data-tray-body="" className={styles.foldBody} />
              </section>
            );
          }
          return (
            <section
              key={column.key}
              className={styles.lane}
              data-lane={column.key}
              data-done={column.isDone ? "" : undefined}
              data-compact-done={compactDone ? "" : undefined}
              data-over={over ? "" : undefined}
              data-empty={rows.length === 0 && composing !== column.key ? "" : undefined}
              aria-labelledby={`lane-${column.key}`}
            >
              <header className={styles.laneHead}>
                <div className={styles.laneTop}>
                  <StatusGlyph column={column} size={15} />
                  <h2 className={styles.laneName} id={`lane-${column.key}`}>{column.name}</h2>
                  <span className={styles.laneCount} data-over={over ? "" : undefined} title={over ? `Over the limit of ${column.limit}` : undefined}>
                    {surface.filtering ? `${rows.length} of ${total}` : column.limit !== undefined ? `${rows.length} / ${column.limit}` : rows.length}
                    <span className={srOnly}> {rows.length === 1 ? "task" : "tasks"}</span>
                  </span>
                  <span className={styles.laneTools}>
                    {surface.readOnly ? null : (
                      <button
                        type="button"
                        className={styles.laneButton}
                        aria-label={`Add a task to ${column.name}`}
                        title={`Add a task to ${column.name}`}
                        tabIndex={-1}
                        onClick={() => setComposing(column.key)}
                      >
                        <TIcon.plus size={14} />
                      </button>
                    )}
                    <ColumnMenu column={column} count={total} onCollapse={() => toggleCollapsed(column.key)} />
                  </span>
                </div>
                {showNotes ? <p className={styles.laneNote}>{laneNote(column)}</p> : null}
              </header>
              <div className={styles.laneBody} data-tray-body="" data-many={rows.length > 50 ? "" : undefined}>
                <div data-drop-layer="" className={styles.dropLayer} aria-hidden="true" />
                {shown.map((task) =>
                  compactDone ? (
                    <DoneRow key={task.id} task={task} stop={task.id === stopId} onPointerDown={(e) => drag.onPointerDown(e, task.id)} justDragged={drag.justDragged} />
                  ) : (
                    <TaskCard
                      key={task.id}
                      task={task}
                      column={column}
                      time={timeOf(task, column.isDone, calendar)}
                      stop={task.id === stopId}
                      open={openId === task.id}
                      selected={store.selectedIds.includes(task.id)}
                      carried={carriedId === task.id}
                      placed={store.recentlyPlacedId === task.id}
                      lifted={lifted === task.id}
                      number={numbersPref === "on" ? numberOf(task.id) : null}
                      people={people(task.assigneeIds)}
                      ordered={ordered}
                      onPointerDown={(e) => drag.onPointerDown(e, task.id)}
                      justDragged={drag.justDragged}
                      onFocus={() => {
                        setFocusId(task.id);
                        surface.setFocusedId(task.id);
                      }}
                    />
                  ),
                )}
                {compactDone && rows.length > DONE_PREVIEW ? (
                  <button type="button" className={styles.showAll} onClick={() => setExpandedDone((v) => !v)}>
                    {expandedDone ? "Show fewer" : `Show all ${rows.length}`}
                  </button>
                ) : null}
                {rows.length === 0 && composing !== column.key ? (
                  surface.filtering ? (
                    // The banner above says why the board is quiet; each lane
                    // only needs to say it holds nothing that matches.
                    filteredEmpty ? null : <p className={styles.emptyQuiet}>Nothing here matches.</p>
                  ) : (
                    <div className={styles.emptyZone}>
                      <p>{EMPTY_NOTE[column.key] ?? "Drop a task here or add one."}</p>
                    </div>
                  )
                ) : null}
                {composing === column.key ? (
                  <InlineComposer
                    column={column}
                    onAdd={(title) => surface.addInline(column.key, title)}
                    onClose={() => setComposing(null)}
                  />
                ) : null}
              </div>
              {surface.readOnly || composing === column.key ? null : (
                <button
                  type="button"
                  className={styles.addRow}
                  data-act="add"
                  onClick={() => setComposing(column.key)}
                  onDoubleClick={(event) => onCompose(column.key, event.currentTarget)}
                  aria-label={`Add a task to ${column.name}`}
                >
                  <TIcon.plus size={14} />
                  Add a task
                </button>
              )}
            </section>
          );
        })}
        {surface.readOnly || !surface.canManage ? null : <AddColumnButton />}
      </div>
      {carried && carriedAt ? (
        <div className={styles.carryBar} role="status">
          <b>{carried.title}</b>
          <span>
            {columns[carriedAt.x]?.name}, position {carriedAt.y + 1} of {carriedAt.rows.length}
          </span>
          <span className={styles.carryKeys}>Arrows move · Space drops · Esc puts it back</span>
        </div>
      ) : null}
    </div>
  );
}

/* ── Card ─────────────────────────────────────────────────────────── */

function TaskCard({
  task,
  column,
  time,
  stop,
  open,
  selected,
  carried,
  placed,
  lifted,
  number,
  people,
  ordered,
  onPointerDown,
  justDragged,
  onFocus,
}: {
  task: LabTask;
  column: BoardColumn;
  time: TimeFact;
  stop: boolean;
  open: boolean;
  selected: boolean;
  carried: boolean;
  placed: boolean;
  lifted: boolean;
  number: string | null;
  people: ReturnType<ReturnType<typeof usePeople>>;
  ordered: string[];
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  justDragged: () => boolean;
  onFocus: () => void;
}) {
  const surface = useSurface();
  const store = useLabStore();
  const { density } = useRoomTools();
  const done = task.completed || column.isDone;
  const labels = labelsOf(task);
  const renaming = surface.renaming === task.id;
  const subtaskDone = task.subtasks.filter((s) => s.completed).length;
  const showPriority = !done && (task.priority === "high" || task.priority === "urgent");
  const hasMeta = time.kind !== "none" || showPriority || labels.length || task.subtasks.length || task.comments.length || task.blockedByIds.length || task.attachments.length;
  const description = `${selected ? "Selected. " : ""}${describeTask(task, column.name, time, people)}`;

  return (
    <article
      className={styles.card}
      data-id={task.id}
      data-open={open ? "" : undefined}
      data-selected={selected ? "" : undefined}
      data-carried={carried ? "" : undefined}
      data-placed={placed ? "" : undefined}
      data-lifted={lifted ? "" : undefined}
      data-done={done ? "" : undefined}
      tabIndex={stop ? 0 : -1}
      aria-label={task.title}
      aria-describedby={`card-d-${task.id}`}
      aria-roledescription={surface.readOnly ? undefined : "movable task"}
      aria-keyshortcuts="Enter Space"
      onFocus={onFocus}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        if (justDragged() || renaming) return;
        if ((event.target as HTMLElement).closest("[data-act]")) return;
        if (event.shiftKey && !surface.readOnly) {
          store.toggleSelected(task.id, ordered, true);
          return;
        }
        if ((event.metaKey || event.ctrlKey) && !surface.readOnly) {
          store.toggleSelected(task.id);
          return;
        }
        store.openTask(task.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        surface.openMenu(task.id, event.clientX, event.clientY);
      }}
    >
      <div className={styles.cardMain}>
        <CompleteToggle
          title={task.title}
          done={done}
          column={column}
          readOnly={surface.readOnly}
          tabIndex={stop ? 0 : -1}
          onToggle={() => surface.complete(task.id)}
        />
        {renaming ? (
          <RenameField task={task} />
        ) : (
          <p
            className={styles.cardTitle}
            title={task.title.length > 90 ? task.title : undefined}
            onDoubleClick={(event) => {
              if (surface.readOnly) return;
              event.stopPropagation();
              surface.setRenaming(task.id);
            }}
          >
            {number ? <span className={styles.cardNumber}>{number}</span> : null}
            <Highlight text={task.title} />
          </p>
        )}
      </div>
      {density === "comfortable" && task.description ? (
        <p className={styles.cardNote}>
          <Highlight text={task.description} />
        </p>
      ) : null}
      {hasMeta || people.length ? (
        <div className={styles.cardMeta}>
          {time.kind !== "none" ? (
            <button
              type="button"
              data-act="due"
              className={styles.metaButton}
              tabIndex={-1}
              aria-label={`Change due date. ${time.said}`}
              disabled={surface.readOnly}
              onClick={(event) => {
                event.stopPropagation();
                surface.openPicker("due", [task.id], event.currentTarget);
              }}
            >
              <DueChip time={time} />
            </button>
          ) : null}
          {showPriority ? (
            <button
              type="button"
              data-act="priority"
              className={styles.metaButton}
              tabIndex={-1}
              title={`${task.priority === "urgent" ? "Urgent" : "High"} priority`}
              aria-label={`Change priority. ${task.priority === "urgent" ? "Urgent" : "High"}`}
              disabled={surface.readOnly}
              onClick={(event) => {
                event.stopPropagation();
                surface.openPicker("priority", [task.id], event.currentTarget);
              }}
            >
              <PriorityIcon priority={task.priority} />
            </button>
          ) : null}
          <LabelChips labels={labels} />
          <BlockedMark count={task.blockedByIds.length} />
          {/* Counts and faces sit together at the end of the last line, so a
              short card stays one line and a busy one never strands a face. */}
          <span className={styles.metaEnd}>
            <SubtaskReceipt done={subtaskDone} total={task.subtasks.length} />
            <CountMeta kind="comments" count={task.comments.length} />
            <CountMeta kind="files" count={task.attachments.length} />
            {people.length ? (
              <button
                type="button"
                data-act="assignee"
                className={styles.metaFaces}
                tabIndex={-1}
                aria-label={`Change assignees. Assigned to ${people.map((p) => p.name).join(", ")}`}
                disabled={surface.readOnly}
                onClick={(event) => {
                  event.stopPropagation();
                  surface.openPicker("assignee", [task.id], event.currentTarget);
                }}
              >
                <AvatarStack members={people} size="sm" max={2} label={`Assigned to ${people.map((p) => p.name).join(", ")}`} />
              </button>
            ) : null}
          </span>
        </div>
      ) : null}
      <button
        type="button"
        className={styles.cardMenu}
        data-act="menu"
        tabIndex={stop ? 0 : -1}
        aria-haspopup="menu"
        aria-expanded={surface.menu?.id === task.id}
        aria-label={`Actions for ${task.title}`}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          surface.openMenu(task.id, rect.right, rect.bottom + 4);
        }}
      >
        <TIcon.more size={14} />
      </button>
      <span className={srOnly} id={`card-d-${task.id}`}>{description}.</span>
    </article>
  );
}

/** A finished task as one quiet line, the Done column's default. */
function DoneRow({
  task,
  stop,
  onPointerDown,
  justDragged,
}: {
  task: LabTask;
  stop: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  justDragged: () => boolean;
}) {
  const surface = useSurface();
  const store = useLabStore();
  const calendar = useCalendarFrame();
  const time = timeOf(task, true, calendar);
  return (
    <article
      className={styles.doneRow}
      data-id={task.id}
      tabIndex={stop ? 0 : -1}
      aria-label={task.title}
      aria-describedby={`card-d-${task.id}`}
      onPointerDown={onPointerDown}
      onClick={(event) => {
        if (justDragged() || (event.target as HTMLElement).closest("[data-act]")) return;
        if (event.shiftKey && !surface.readOnly) {
          store.toggleSelected(task.id, surface.visible.map((t) => t.id), true);
          return;
        }
        if ((event.metaKey || event.ctrlKey) && !surface.readOnly) {
          store.toggleSelected(task.id);
          return;
        }
        store.openTask(task.id);
      }}
      data-selected={store.selectedIds.includes(task.id) ? "" : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        surface.openMenu(task.id, event.clientX, event.clientY);
      }}
      onFocus={() => surface.setFocusedId(task.id)}
    >
      <CompleteToggle title={task.title} done column={undefined} readOnly={surface.readOnly} size="sm" tabIndex={stop ? 0 : -1} onToggle={() => surface.complete(task.id)} />
      <span className={styles.doneTitle}>
        <Highlight text={task.title} />
      </span>
      {time.kind === "done" ? <span className={styles.doneWhen}>{time.label.replace(/^Done /, "")}</span> : null}
      <span className={srOnly} id={`card-d-${task.id}`}>Done. {time.said}.</span>
    </article>
  );
}

/* ── Rename in place ──────────────────────────────────────────────── */

function RenameField({ task }: { task: LabTask }) {
  const surface = useSurface();
  const store = useLabStore();
  const [value, setValue] = useState(task.title);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.select();
  }, []);
  const finish = (save: boolean) => {
    const clean = value.trim().replace(/\s+/g, " ");
    if (save && clean && clean !== task.title) store.updateTitle(task.id, clean);
    surface.setRenaming(null);
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-id="${CSS.escape(task.id)}"]`)?.focus());
  };
  return (
    <textarea
      ref={ref}
      className={styles.renameField}
      value={value}
      rows={1}
      aria-label="Task title"
      onChange={(event) => setValue(event.target.value.replace(/\n/g, " "))}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      }}
    />
  );
}

/* ── Inline composer ──────────────────────────────────────────────── */

function InlineComposer({ column, onAdd, onClose }: { column: BoardColumn; onAdd: (title: string) => void; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className={styles.composer} data-composer="">
      <div className={styles.composerRow}>
        <StatusGlyph column={column} size={16} />
        <textarea
          ref={ref}
          className={styles.composerInput}
          value={value}
          rows={1}
          placeholder="What needs doing?"
          aria-label={`New task in ${column.name}`}
          onChange={(event) => setValue(event.target.value.replace(/\n/g, " "))}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!value.trim()) {
                onClose();
                return;
              }
              onAdd(value);
              setValue("");
              setCount((n) => n + 1);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          onBlur={() => {
            if (!value.trim()) onClose();
          }}
        />
      </div>
      <p className={styles.composerHint}>
        {count ? `${count} added. ` : ""}Enter adds it and keeps going. Esc closes.
      </p>
    </div>
  );
}

/* ── Phone column pager ───────────────────────────────────────────── */

/**
 * On a phone the pager chip is the column header: it names the column in
 * view and its count, and the column's add and menu buttons sit at the end
 * of the same row, so the lane itself starts with its first card.
 */
function PhonePager({ columns, counts, tools }: { columns: BoardColumn[]; counts: number[]; tools: (column: BoardColumn) => React.ReactNode }) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const board = ref.current?.parentElement?.querySelector<HTMLElement>("[data-board]");
    if (!board) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const lane = board.querySelector<HTMLElement>("[data-lane]");
        const width = lane ? lane.offsetWidth + 12 : board.clientWidth;
        setActive(Math.round(board.scrollLeft / Math.max(1, width)));
      });
    };
    board.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      board.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  const go = (index: number) => {
    const board = ref.current?.parentElement?.querySelector<HTMLElement>("[data-board]");
    const lane = board?.querySelectorAll<HTMLElement>("[data-lane]")[index];
    if (!board || !lane) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    board.scrollTo({ left: lane.offsetLeft - 16, behavior: reduce ? "auto" : "smooth" });
  };
  return (
    <div className={styles.pager} ref={ref}>
      <div className={styles.pagerTabs} role="tablist" aria-label="Columns">
      {columns.map((column, index) => (
        <button
          key={column.key}
          type="button"
          role="tab"
          aria-selected={index === active}
          className={styles.pagerItem}
          onClick={() => go(index)}
        >
          <StatusGlyph column={column} size={12} />
          {column.name}
          <span className={styles.pagerCount}>{counts[index]}</span>
        </button>
      ))}
      </div>
      {columns[active] ? <div className={styles.pagerTools}>{tools(columns[active])}</div> : null}
    </div>
  );
}

/* ── First run and filtered-empty ─────────────────────────────────── */

function FirstRunGuide({
  onAdd,
  personalization,
}: {
  onAdd: (title: string) => void;
  personalization: { headline: string; body: string; firstTaskExample: string };
}) {
  const surface = useSurface();
  const [value, setValue] = useState("");
  const examples = [personalization.firstTaskExample, "Confirm the date with everyone involved", "Make a list of who to contact first"];
  if (surface.readOnly) {
    return (
      <div className={styles.guide} role="note">
        <h2 className={styles.guideTitle}>Nothing here yet</h2>
        <p className={styles.guideBody}>When someone adds a task to this project it will show up on this board.</p>
      </div>
    );
  }
  return (
    <div className={styles.guide} role="region" aria-label="Start your board">
      <span className={styles.guideIcon} aria-hidden="true"><TIcon.board size={18} /></span>
      <h2 className={styles.guideTitle}>{personalization.headline}</h2>
      <p className={styles.guideBody}>{personalization.body}</p>
      <form
        className={styles.guideForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (!value.trim()) return;
          onAdd(value);
          setValue("");
        }}
      >
        <input
          className={styles.guideInput}
          value={value}
          autoFocus
          placeholder="What needs doing first?"
          aria-label="What needs doing first?"
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" className={styles.guideAdd} disabled={!value.trim()}>Add task</button>
      </form>
      <div className={styles.guideExamples}>
        {examples.map((example) => (
          <button key={example} type="button" className={styles.guideExample} onClick={() => setValue(example)}>
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilteredEmpty() {
  const tools = useRoomTools();
  const q = tools.query.trim();
  return (
    <div className={styles.filteredEmpty} role="status">
      <TIcon.filter size={16} />
      <span>{q && tools.activeFilterCount === 0 ? `Nothing matches “${q}” in titles or descriptions.` : "No tasks match these filters."}</span>
      {q ? <button type="button" onClick={() => tools.setQuery("")}>Clear search</button> : null}
      {tools.activeFilterCount ? <button type="button" onClick={tools.clearFilters}>Clear filters</button> : null}
    </div>
  );
}
