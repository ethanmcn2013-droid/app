"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { EASE_OUT_EXPO, MOTION_MODERATE } from "@/lib/motion";
import {
  LANES,
  LANE_ORDER,
  type LaneId,
  type Task,
} from "@/lib/data";
import { maybeFireFirstCompletion } from "@/components/app/done-dopamine/first-completion-moment";
import { Icon } from "@/components/app/room/room-icons";
import {
  LabelList,
  OverdueFlag,
  RoomAvatarStack,
  ScheduleText,
  TaskCompleteBox,
  TaskSignals,
} from "@/components/app/room/room-task-ui";
import { CardMenu, TagEditor, type MenuColumn } from "./card-actions";
import { useRoomVisibleTasks } from "@/components/app/room/room-tools-context";
import roomStyles from "@/components/app/room/option-b.module.css";
import {
  useTasksDispatch,
  useTasksState,
} from "@/lib/tasks/tasks-context";
import { tasksByColumn } from "@/lib/tasks/selectors";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { InlineComposer } from "@/components/app/add-task/inline-composer";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { BoardGhost } from "@/components/app/empty-state/ghost-views";
import {
  renameColumnAction,
  addColumnAction,
  reorderColumnsAction,
  deleteColumnAction,
  setColumnColorAction,
  setColumnDescriptionAction,
  type ColumnConfig,
} from "@/server/actions/board";
import {
  COLUMN_COLORS,
  COLUMN_PICKER_ORDER,
  boardColumnColor,
  type ColumnColorKey,
} from "@/lib/board-colors";
import { useColumnConfig, usePersonalization } from "@/lib/domain-context";

// ─── ARCH NOTE: Custom columns and the canonical lane ─────────────────────────
//
// The effective board column for a task is:
//   board_column_key IS NOT NULL → task belongs to that custom column
//   board_column_key IS NULL     → task belongs to its canonical `lane` column
//
// Custom-column tasks group under "doing" in List/Timeline/Calendar/export/
// print/SSE, those views never read boardColumnKey; they use `lane` only.
// Moving a task into a custom column sets boardColumnKey but leaves `lane`
// unchanged so those views stay coherent. Moving into a system column clears
// boardColumnKey and updates `lane` so it is canonical again.
//
// The `tasksByColumn` selector encodes this COALESCE logic.

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True when viewport is <768px. SSR-safe: starts false, flips on mount. */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

// ─── Column descriptor ────────────────────────────────────────────────────────

/**
 * Normalised column descriptor for the board.
 * Merges system-lane data (ink/bg/dot) with config overrides (name)
 * and custom column records.
 */
type BoardColumn = {
  key: string;
  name: string;
  /** Whether this is one of the four system lanes. Custom columns are not. */
  isSystem: boolean;
  /** Style tokens, undefined for custom columns (uses a neutral palette). */
  dot: string;
  bg: string;
  ink: string;
  /** Effective column colour: owner choice, else the system default, else
   *  neutral. Never overwrites a saved choice (see boardColumnColor). */
  color: ColumnColorKey;
  /** Editable subtext. System lanes fall back to a static default; custom
   *  columns have none until the owner writes one. Empty string = cleared. */
  description: string | undefined;
};

/** Default subtext for the four standard system lanes (Phase 2). Owners
 *  can edit or clear these per workspace; the copy matches the relabelled
 *  columns (Blocked · In Progress · Reviewing · Done). */
const DEFAULT_LANE_DESCRIPTIONS: Record<string, string> = {
  todo: "Held up — clear the blocker before it can move.",
  doing: "In motion right now.",
  review: "Being checked before it ships.",
  done: "Finished work stays visible.",
};

/** Resolve a column's effective description: an explicit stored value
 *  (including "") wins; otherwise a system lane shows its default. */
function resolveDescription(
  key: string,
  isSystem: boolean,
  stored: string | undefined,
): string | undefined {
  if (stored !== undefined) return stored;
  return isSystem ? DEFAULT_LANE_DESCRIPTIONS[key] : undefined;
}

/**
 * Build the ordered list of BoardColumns from the ColumnConfig and the
 * static LANES map. Falls back to LANE_ORDER if no config is stored.
 *
 * Order: config.order drives render sequence. System lanes that are missing
 * from order are appended defensively. Custom columns not in order are
 * appended after system lanes.
 */
function buildBoardColumns(config: ColumnConfig | null): BoardColumn[] {
  // Custom column neutral palette (one shared neutral, all custom
  // columns get the same quiet stone treatment, matching DESIGN.md restraint).
  const CUSTOM_DOT = "#94a3b8";
  const CUSTOM_BG = "#f8f9fa";
  const CUSTOM_INK = "#64748b";

  if (!config) {
    return LANE_ORDER.map((id) => ({
      key: id,
      name: LANES[id].name,
      isSystem: true,
      dot: LANES[id].dot,
      bg: LANES[id].bg,
      ink: LANES[id].ink,
      color: boardColumnColor(id, undefined, true),
      description: resolveDescription(id, true, undefined),
    }));
  }

  const order = config.order.length > 0 ? config.order : [...LANE_ORDER];
  const customByKey = Object.fromEntries(config.custom.map((c) => [c.key, c]));
  const colorOf = (key: string, isSystem: boolean): ColumnColorKey =>
    boardColumnColor(key, config.colors?.[key], isSystem);
  const descriptionOf = (key: string, isSystem: boolean): string | undefined =>
    resolveDescription(key, isSystem, config.descriptions?.[key]);

  // Collect columns in order.
  const seen = new Set<string>();
  const cols: BoardColumn[] = [];

  for (const key of order) {
    if (seen.has(key)) continue;
    seen.add(key);
    if ((LANE_ORDER as string[]).includes(key)) {
      const laneId = key as LaneId;
      cols.push({
        key,
        name: config.system[laneId] ?? LANES[laneId].name,
        isSystem: true,
        dot: LANES[laneId].dot,
        bg: LANES[laneId].bg,
        ink: LANES[laneId].ink,
        color: colorOf(key, true),
        description: descriptionOf(key, true),
      });
    } else if (customByKey[key]) {
      cols.push({
        key,
        name: customByKey[key].name,
        isSystem: false,
        dot: CUSTOM_DOT,
        bg: CUSTOM_BG,
        ink: CUSTOM_INK,
        color: colorOf(key, false),
        description: descriptionOf(key, false),
      });
    }
    // Unknown key in order → silently skip (defensive).
  }

  // Append any system lanes missing from order.
  for (const id of LANE_ORDER) {
    if (!seen.has(id)) {
      cols.push({
        key: id,
        name: config.system[id] ?? LANES[id].name,
        isSystem: true,
        dot: LANES[id].dot,
        bg: LANES[id].bg,
        ink: LANES[id].ink,
        color: colorOf(id, true),
        description: descriptionOf(id, true),
      });
      seen.add(id);
    }
  }

  return cols;
}

// ─── BoardApp ─────────────────────────────────────────────────────────────────

export function BoardApp() {
  const state = useTasksState();
  const columnConfig = useColumnConfig();
  const personalization = usePersonalization();
  const { moveTask, moveTaskToColumn, reorderTask, toggleComplete } =
    useTasksDispatch();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [composerColumn, setComposerColumn] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // ── Drag & drop ────────────────────────────────────────────────────────
  // dropTarget marks the live insertion point: which column and the index a
  // drop would land at. Columns highlight; system lanes also show an
  // insertion line at the index. No momentum — the reorder animates through
  // the store's optimistic update (Framer `layout`), which reads as smooth
  // rather than a card flung on release.
  const [dropTarget, setDropTarget] = useState<{ column: string; index: number } | null>(null);
  // The dragged task, captured at dragstart, so a drop knows whether it can
  // reorder by position (only when the card and target are both system lanes).
  const dragRef = useRef<{ id: string; fromSystem: boolean } | null>(null);
  // Auto-scroll a column's list while a drag hovers near its top/bottom edge.
  const autoScrollRef = useRef<{ el: HTMLElement; dir: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  function pumpAutoScroll() {
    const s = autoScrollRef.current;
    if (s && s.dir !== 0) {
      s.el.scrollTop += s.dir * 11;
      rafRef.current = requestAnimationFrame(pumpAutoScroll);
    } else {
      rafRef.current = null;
    }
  }
  function setAutoScroll(el: HTMLElement | null, dir: number) {
    autoScrollRef.current = el && dir !== 0 ? { el, dir } : null;
    if (el && dir !== 0 && rafRef.current == null) {
      rafRef.current = requestAnimationFrame(pumpAutoScroll);
    }
  }
  function endDrag() {
    setDraggingId(null);
    setDropTarget(null);
    dragRef.current = null;
    setAutoScroll(null, 0);
  }

  // Optimistic column config for add/reorder/delete, the server revalidates
  // the layout on success so we hydrate from server after a beat.
  const [optimisticConfig, setOptimisticConfig] = useState<ColumnConfig | null>(
    columnConfig,
  );
  const [previousColumnConfig, setPreviousColumnConfig] = useState(columnConfig);
  // Adjust during render when a server revalidation supplies a new config.
  if (previousColumnConfig !== columnConfig) {
    setPreviousColumnConfig(columnConfig);
    setOptimisticConfig(columnConfig);
  }

  const boardColumns = useMemo(
    () => buildBoardColumns(optimisticConfig),
    [optimisticConfig],
  );

  /** Insertion index for a drop: the first card whose vertical midpoint is
   *  below the pointer (counts every rendered card, including the one being
   *  dragged). Falls back to the end of the list. */
  function computeDropIndex(list: HTMLElement, clientY: number): number {
    const cards = Array.from(
      list.querySelectorAll<HTMLElement>("[data-task-id]"),
    );
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return cards.length;
  }

  /** Update the live drop target + edge auto-scroll as a drag moves over a
   *  column's list. */
  function onListDragOver(e: React.DragEvent, columnKey: string) {
    if (!dragRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const list = e.currentTarget as HTMLElement;
    const index = computeDropIndex(list, e.clientY);
    setDropTarget((prev) =>
      prev && prev.column === columnKey && prev.index === index
        ? prev
        : { column: columnKey, index },
    );
    // Edge auto-scroll for long, independently-scrolling columns.
    const rect = list.getBoundingClientRect();
    const EDGE = 56;
    const dir =
      e.clientY < rect.top + EDGE ? -1 : e.clientY > rect.bottom - EDGE ? 1 : 0;
    setAutoScroll(dir !== 0 ? list : null, dir);
  }

  /** Commit a drop: reorder within/among system lanes by position, else move
   *  the card into the target column. */
  function onListDrop(e: React.DragEvent, col: BoardColumn) {
    e.preventDefault();
    const info = dragRef.current;
    const taskId = info?.id ?? e.dataTransfer.getData("text/task-id");
    if (!taskId) { endDrag(); return; }
    const list = e.currentTarget as HTMLElement;
    const visualIndex = dropTarget?.column === col.key
      ? dropTarget.index
      : computeDropIndex(list, e.clientY);

    if (col.isSystem && info?.fromSystem) {
      // Position-honouring reorder (within a lane or across system lanes).
      const colTasks = tasksByColumn(state, col.key);
      const from = colTasks.findIndex((t) => t.id === taskId);
      const siblingIndex = from >= 0 && visualIndex > from ? visualIndex - 1 : visualIndex;
      reorderTask(taskId, col.key as LaneId, siblingIndex);
    } else {
      // Into/among custom columns, or a custom-column card into a lane: the
      // column-aware move clears/sets boardColumnKey correctly (append).
      moveTaskToColumn(taskId, col.key);
    }
    endDrag();
  }

  // Memoize column → tasks map to avoid re-walking on every keystroke.
  // Only system lanes matter for keyboard nav (custom columns don't have
  // keyboard cross-lane shortcuts in this version).
  //
  // T·95: the room tools (search / filter / sort) scope what the board
  // shows — lanes render the visible subset, the lane count reads
  // "visible/total" when they differ, the lab's exact contract.
  const visibleTasks = useRoomVisibleTasks();
  const visibleIds = useMemo(
    () => new Set(visibleTasks.map((t) => t.id)),
    [visibleTasks],
  );
  const tasksByColumnMap = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of boardColumns) {
      map[col.key] = tasksByColumn(state, col.key).filter((t) => visibleIds.has(t.id));
    }
    return map;
  }, [state, boardColumns, visibleIds]);
  const totalsByColumn = useMemo(() => {
    const map: Record<string, number> = {};
    for (const col of boardColumns) {
      map[col.key] = tasksByColumn(state, col.key).length;
    }
    return map;
  }, [state, boardColumns]);

  // Whether the card currently being dragged lives in a system lane (no
  // custom-column key). Derived from state so it stays reactive — the drop
  // insertion line only shows for position-honouring system-lane drops.
  const dragFromSystem = draggingId
    ? !state.tasks.find((t) => t.id === draggingId)?.boardColumnKey
    : false;

  // Keyboard-driven focus. Works across system lanes only for now.
  const effectiveFocusedId: string | null = (() => {
    if (focusedId && state.tasks.some((t) => t.id === focusedId)) {
      return focusedId;
    }
    for (const col of boardColumns) {
      const first = tasksByColumnMap[col.key]?.[0];
      if (first) return first.id;
    }
    return null;
  })();

  const focusRef = useRef(effectiveFocusedId);
  const colMapRef = useRef(tasksByColumnMap);
  const columnsRef = useRef(boardColumns);
  useEffect(() => { focusRef.current = effectiveFocusedId; }, [effectiveFocusedId]);
  useEffect(() => { colMapRef.current = tasksByColumnMap; }, [tasksByColumnMap]);
  useEffect(() => { columnsRef.current = boardColumns; }, [boardColumns]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as Element | null;
      if (target && target.matches("input, textarea, [contenteditable]")) return;

      const id = focusRef.current;
      const colMap = colMapRef.current;
      const columns = columnsRef.current;

      if (e.key === "Escape") {
        if (id) { setFocusedId(null); e.preventDefault(); }
        return;
      }

      if (!id) return;

      // Locate current focus.
      let curColKey: string | null = null;
      let curIndex = -1;
      for (const col of columns) {
        const i = (colMap[col.key] ?? []).findIndex((t) => t.id === id);
        if (i !== -1) { curColKey = col.key; curIndex = i; break; }
      }
      if (!curColKey) return;

      const mod = e.metaKey || e.ctrlKey;
      const curColIdx = columns.findIndex((c) => c.key === curColKey);

      // Single-key complete, the landing wordmark promises a one-keystroke
      // "done" gesture; deliver it on the focused card. `x` only, no
      // modifier, to keep parity with the composer's single-key `c` open.
      // Cmd/Ctrl+Enter is retained below as the alternate.
      if (!mod && !e.shiftKey && !e.altKey && e.key === "x") {
        e.preventDefault(); toggleComplete(id); return;
      }

      if (mod && e.key === "Enter") {
        e.preventDefault(); toggleComplete(id); return;
      }

      if (mod && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const targetCol = columns[curColIdx + dir];
        if (!targetCol) return;
        e.preventDefault();
        // Only use moveTask for system lanes (keyboard move keeps lane canonical).
        if (targetCol.isSystem) {
          moveTask(id, targetCol.key as LaneId);
        } else {
          moveTaskToColumn(id, targetCol.key);
        }
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault(); openTask(id); return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const dir = e.key === "ArrowUp" ? -1 : 1;
        const colTasks = colMap[curColKey] ?? [];
        const next = colTasks[curIndex + dir];
        if (next) { e.preventDefault(); setFocusedId(next.id); }
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const targetCol = columns[curColIdx + dir];
        if (!targetCol) return;
        const targetTasks = colMap[targetCol.key] ?? [];
        if (targetTasks.length === 0) return;
        const targetIdx = Math.min(curIndex, targetTasks.length - 1);
        e.preventDefault();
        setFocusedId(targetTasks[targetIdx].id);
        return;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moveTask, moveTaskToColumn, openTask, toggleComplete]);

  if (state.tasks.length === 0) {
    return (
      <EmptyStateOverlay
        ghost={<BoardGhost />}
        ghostMode="structural"
        headline={personalization.headline}
        body={personalization.body}
      />
    );
  }

  return (
    <section aria-label="Project Board" className={roomStyles.boardView}>
      <div className={`${roomStyles.boardScroller} thin-scroll`}>
        <div
          className={roomStyles.boardGrid}
          style={{
            gridTemplateColumns: `repeat(${boardColumns.length + 1}, minmax(252px, 1fr))`,
            minWidth: (boardColumns.length + 1) * 266,
          }}
        >
        {boardColumns.map((col, idx) => {
          const colTasks = tasksByColumnMap[col.key] ?? [];
          const isHover = dropTarget?.column === col.key;
          const accentVar = COLUMN_COLORS[col.color].var;
          // Show the positional insertion line only where a drop honours it:
          // the dragged card and the target are both system lanes.
          const showDropLine = col.isSystem && dragFromSystem && isHover;

          // Inline add for custom columns uses lane "doing" as the canonical
          // lane for newly created tasks, they'll visually appear in this
          // custom column via their boardColumnKey, but semantically live in "doing".
          // For system lanes, the composer uses the actual lane.
          const composerLane: LaneId = col.isSystem
            ? (col.key as LaneId)
            : "doing";

          return (
            <motion.div
              key={col.key}
              role="group"
              aria-label={col.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: MOTION_MODERATE,
                delay: idx * 0.05,
                ease: EASE_OUT_EXPO,
              }}
              className={roomStyles.boardLane}
              data-status={LANE_TONE[col.key]}
              data-drop={isHover || undefined}
              data-tinted={accentVar ? "" : undefined}
              style={accentVar ? ({ "--lane-accent": accentVar } as React.CSSProperties) : undefined}
            >
              <LaneHeader
                columnKey={col.key}
                columnName={col.name}
                isSystem={col.isSystem}
                color={col.color}
                description={col.description}
                count={colTasks.length}
                total={totalsByColumn[col.key] ?? colTasks.length}
                columnIndex={idx}
                totalColumns={boardColumns.length}
                allColumns={boardColumns.map((c) => ({
                  key: c.key,
                  name: c.name,
                  dot: c.color === "neutral" ? c.dot : COLUMN_COLORS[c.color].var ?? c.dot,
                }))}
                onAddTask={() => setComposerColumn(col.key)}
                onOptimisticConfigChange={setOptimisticConfig}
                currentConfig={optimisticConfig}
              />

              <div
                className={roomStyles.boardTaskList}
                onDragOver={(e) => onListDragOver(e, col.key)}
                onDrop={(e) => onListDrop(e, col)}
              >
                <AnimatePresence initial={false}>
                  {colTasks.map((task, ti) => (
                    <Card
                      key={task.id}
                      task={task}
                      currentColumnKey={col.key}
                      draggable={!isMobile}
                      isDragging={draggingId === task.id}
                      dropBefore={showDropLine && dropTarget?.index === ti}
                      isSelected={openTaskId === task.id}
                      isFocused={effectiveFocusedId === task.id}
                      boardColumns={boardColumns}
                      onClick={() => { setFocusedId(task.id); openTask(task.id); }}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/task-id", task.id);
                        e.dataTransfer.effectAllowed = "move";
                        dragRef.current = {
                          id: task.id,
                          fromSystem: col.isSystem && !task.boardColumnKey,
                        };
                        setDraggingId(task.id);
                      }}
                      onDragEnd={endDrag}
                    />
                  ))}
                </AnimatePresence>
                {showDropLine && dropTarget?.index === colTasks.length ? (
                  <div className={roomStyles.dropLineEnd} />
                ) : null}

                {colTasks.length === 0 && composerColumn !== col.key ? (
                  <div className={roomStyles.emptyLane} data-drop-active={isHover || undefined}>
                    <strong>
                      {(totalsByColumn[col.key] ?? 0) === 0 ? "A clear lane" : "No matching work"}
                    </strong>
                    <span>
                      {(totalsByColumn[col.key] ?? 0) === 0
                        ? "Add the next useful task when it is ready."
                        : "Adjust the room filters to bring work back."}
                    </span>
                  </div>
                ) : null}
                {composerColumn === col.key ? (
                  <InlineComposer
                    lane={composerLane}
                    onClose={() => setComposerColumn(null)}
                  />
                ) : null}
              </div>
              {composerColumn === col.key ? null : (
                <button
                  className={roomStyles.laneAddButton}
                  onClick={() => setComposerColumn(col.key)}
                  type="button"
                >
                  <Icon name="add" size={14} />
                  Add task
                </button>
              )}
            </motion.div>
          );
        })}

        {/* Add column tile, lives at the end of the lane row. */}
        <AddColumnTile
          currentConfig={optimisticConfig}
          columnRefs={boardColumns.map((c) => ({ key: c.key, name: c.name, dot: c.dot }))}
          onOptimisticConfigChange={setOptimisticConfig}
        />
        </div>
      </div>
    </section>
  );
}

/** Lane tone → the lab's per-status dot/wash grammar. Production system
 *  lanes map onto the lab statuses; custom columns stay neutral. */
const LANE_TONE: Record<string, string | undefined> = {
  todo: undefined,
  doing: "active",
  review: "waiting",
  done: "done",
};

// ─── LaneHeader ───────────────────────────────────────────────────────────────

/**
 * Inline-editable column header with overflow menu for reorder + delete.
 *
 * At rest: dot, name, count, quiet pencil on hover, "+" button.
 * Double-click OR pencil-click activates the inline editor.
 * Overflow "⋯" menu on custom columns: move left / move right / delete.
 * System lanes: overflow menu with move left / move right (no delete).
 */
/** A base ColumnConfig synthesised when none is stored yet (demo / new
 *  board) so optimistic edits still apply. */
function clientBaseConfig(allKeys: string[]): ColumnConfig {
  return { system: {}, custom: [], order: [...allKeys], colors: {}, descriptions: {}, limits: {} };
}

type LaneColumnRef = { key: string; name: string; dot: string };

function LaneHeader({
  columnKey,
  columnName,
  isSystem,
  color,
  description,
  count,
  total,
  columnIndex,
  totalColumns,
  allColumns,
  onAddTask,
  onOptimisticConfigChange,
  currentConfig,
}: {
  columnKey: string;
  columnName: string;
  isSystem: boolean;
  color: ColumnColorKey;
  description: string | undefined;
  count: number;
  total: number;
  columnIndex: number;
  totalColumns: number;
  allColumns: LaneColumnRef[];
  onAddTask: () => void;
  onOptimisticConfigChange: (c: ColumnConfig | null) => void;
  currentConfig: ColumnConfig | null;
}) {
  const allColumnKeys = allColumns.map((c) => c.key);
  const [editing, setEditing] = useState(false);
  const [optimisticName, setOptimisticName] = useState(columnName);
  const [previousColumnName, setPreviousColumnName] = useState(columnName);
  const [draft, setDraft] = useState(columnName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  // Description editing (Phase 2D).
  const [descEditing, setDescEditing] = useState(false);
  const [descDraft, setDescDraft] = useState(description ?? "");
  // Safe delete (Phase 2E): confirmation + destination for a non-empty column.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const otherColumns = allColumns.filter((c) => c.key !== columnKey);
  const [deleteDest, setDeleteDest] = useState(otherColumns[0]?.key ?? "");

  if (previousColumnName !== columnName) {
    setPreviousColumnName(columnName);
    setOptimisticName(columnName);
  }

  // Close overflow on outside click.
  useEffect(() => {
    if (!overflowOpen) return;
    function onDocClick(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOverflowOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [overflowOpen]);

  function startEdit(e?: React.MouseEvent) {
    e?.stopPropagation();
    setDraft(optimisticName);
    setEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) { cancel(); return; }
    setEditing(false);
    setOptimisticName(trimmed);
    startTransition(async () => {
      try {
        await renameColumnAction(columnKey, trimmed);
      } catch {
        setOptimisticName(columnName);
      }
    });
  }

  function cancel() {
    setEditing(false);
    setDraft(optimisticName);
  }

  // ── Description editing ──────────────────────────────────────────────
  function startDescEdit() {
    setOverflowOpen(false);
    setDescDraft(description ?? "");
    setDescEditing(true);
  }

  function commitDescription() {
    const next = descDraft.trim();
    setDescEditing(false);
    if (next === (description ?? "")) return;
    const base = currentConfig ?? clientBaseConfig(allColumnKeys);
    onOptimisticConfigChange({
      ...base,
      descriptions: { ...base.descriptions, [columnKey]: next },
    });
    startTransition(async () => {
      try {
        await setColumnDescriptionAction(columnKey, next);
      } catch {
        onOptimisticConfigChange(currentConfig);
      }
    });
  }

  function cancelDescription() {
    setDescEditing(false);
    setDescDraft(description ?? "");
  }

  function moveLeft() {
    setOverflowOpen(false);
    if (columnIndex === 0) return;
    const newOrder = [...allColumnKeys];
    const tmp = newOrder[columnIndex - 1];
    newOrder[columnIndex - 1] = newOrder[columnIndex];
    newOrder[columnIndex] = tmp;
    if (currentConfig) {
      onOptimisticConfigChange({ ...currentConfig, order: newOrder });
    }
    startTransition(async () => {
      try {
        await reorderColumnsAction(newOrder);
      } catch {
        onOptimisticConfigChange(currentConfig);
      }
    });
  }

  function moveRight() {
    setOverflowOpen(false);
    if (columnIndex >= totalColumns - 1) return;
    const newOrder = [...allColumnKeys];
    const tmp = newOrder[columnIndex + 1];
    newOrder[columnIndex + 1] = newOrder[columnIndex];
    newOrder[columnIndex] = tmp;
    if (currentConfig) {
      onOptimisticConfigChange({ ...currentConfig, order: newOrder });
    }
    startTransition(async () => {
      try {
        await reorderColumnsAction(newOrder);
      } catch {
        onOptimisticConfigChange(currentConfig);
      }
    });
  }

  // ── Safe delete ──────────────────────────────────────────────────────
  function requestDelete() {
    setOverflowOpen(false);
    if (isSystem) return;
    setDeleteDest(otherColumns[0]?.key ?? "");
    setConfirmDelete(true);
  }

  function performDelete() {
    setConfirmDelete(false);
    if (isSystem) return;
    // A non-empty column needs a destination so its tasks never vanish; an
    // empty one deletes cleanly. Destination is only sent to the server
    // when there are tasks to move.
    const destination = total > 0 ? deleteDest || undefined : undefined;
    if (currentConfig) {
      onOptimisticConfigChange({
        ...currentConfig,
        custom: currentConfig.custom.filter((c) => c.key !== columnKey),
        order: currentConfig.order.filter((k) => k !== columnKey),
      });
    }
    startTransition(async () => {
      try {
        await deleteColumnAction(columnKey, destination);
      } catch {
        onOptimisticConfigChange(currentConfig);
      }
    });
  }

  function setColumnColor(next: ColumnColorKey) {
    setOverflowOpen(false);
    const base = currentConfig ?? clientBaseConfig(allColumnKeys);
    // Store the choice explicitly (including "neutral") so a system lane's
    // semantic default can be overridden. The server mirrors this.
    onOptimisticConfigChange({
      ...base,
      colors: { ...(base.colors ?? {}), [columnKey]: next },
    });
    startTransition(async () => {
      try {
        await setColumnColorAction(columnKey, next);
      } catch {
        onOptimisticConfigChange(currentConfig);
      }
    });
  }

  const canMoveLeft = columnIndex > 0;
  const canMoveRight = columnIndex < totalColumns - 1;
  const hasDescription = description !== undefined && description !== "";

  return (
    <header className={`${roomStyles.laneHeader} group/colhdr`}>
      <div>
        <span
          className={roomStyles.laneStatusMark}
          data-status={LANE_TONE[columnKey]}
        />
        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
            maxLength={80}
            onClick={(e) => e.stopPropagation()}
            aria-label="Column name"
            className="w-full max-w-[140px] rounded border border-[var(--x-task-focus)] bg-transparent px-1 py-0 text-[12px] font-semibold text-ink outline-none"
          />
        ) : (
          <button
            type="button"
            className={`${roomStyles.laneRenameButton} group/lh`}
            onClick={startEdit}
            title="Rename column"
            aria-label={`Rename ${optimisticName}`}
          >
            <span>{optimisticName}</span>
            <svg
              aria-hidden="true"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-0 transition-opacity group-hover/lh:opacity-100"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <span className={roomStyles.laneCount}>
          {count === total ? total : `${count}/${total}`}
        </span>
      </div>

      <div className={roomStyles.laneHeaderActions}>
        {/* Overflow menu: rename, colour, description, reorder, delete */}
        <div ref={overflowRef} className="relative">
          <button
            type="button"
            aria-label={`${optimisticName} column options`}
            aria-haspopup="menu"
            aria-expanded={overflowOpen}
            onClick={(e) => { e.stopPropagation(); setOverflowOpen((v) => !v); }}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-ink-quiet opacity-0 transition-colors hover:bg-white/70 hover:text-ink-soft group-hover/colhdr:opacity-100 focus-visible:opacity-100"
          >
            <Icon name="more" size={13} />
          </button>
          {overflowOpen ? (
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-line-soft bg-white p-1 shadow-[0_18px_40px_-18px_rgba(20,21,26,0.22)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={(e) => { setOverflowOpen(false); startEdit(e); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={startDescEdit}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M4 12h10M4 17h13" /></svg>
                {hasDescription ? "Edit description" : "Add description"}
              </button>

              <div className="my-1 border-t border-line-soft" />
              <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-quiet">
                Colour
              </div>
              <div className={roomStyles.laneColorRow} role="group" aria-label="Column colour">
                {COLUMN_PICKER_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={COLUMN_COLORS[key].label}
                    aria-pressed={color === key}
                    title={COLUMN_COLORS[key].label}
                    data-color={key}
                    data-selected={color === key ? "" : undefined}
                    onClick={() => setColumnColor(key)}
                    className={roomStyles.laneColorSwatch}
                    style={
                      COLUMN_COLORS[key].var
                        ? { background: COLUMN_COLORS[key].var as string, borderColor: COLUMN_COLORS[key].var as string }
                        : undefined
                    }
                  />
                ))}
              </div>

              {canMoveLeft || canMoveRight ? (
                <>
                  <div className="my-1 border-t border-line-soft" />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canMoveLeft}
                    onClick={moveLeft}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                    Move left
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canMoveRight}
                    onClick={moveRight}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                    Move right
                  </button>
                </>
              ) : null}
              {!isSystem ? (
                <>
                  <div className="my-1 border-t border-line-soft" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={requestDelete}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Icon name="trash" size={11} />
                    Delete column
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Add task button */}
        <button
          type="button"
          aria-label={`Add task to ${optimisticName}`}
          onClick={(e) => { e.stopPropagation(); onAddTask(); }}
          className="rounded p-1 text-[var(--x-task-text-muted)] hover:bg-[var(--x-task-hover)] hover:text-[var(--x-task-text)]"
        >
          <Icon name="add" size={13} />
        </button>
      </div>

      {/* Editable subtext (Phase 2D). */}
      {descEditing ? (
        <input
          autoFocus
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={commitDescription}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") { e.preventDefault(); commitDescription(); }
            if (e.key === "Escape") { e.preventDefault(); cancelDescription(); }
          }}
          maxLength={160}
          placeholder="Describe this column…"
          aria-label={`Description for ${optimisticName}`}
          className={roomStyles.laneDescInput}
        />
      ) : hasDescription ? (
        <button
          type="button"
          className={roomStyles.laneDescButton}
          onClick={startDescEdit}
          title="Edit column description"
        >
          {description}
        </button>
      ) : (
        <button
          type="button"
          className={roomStyles.laneDescAdd}
          onClick={startDescEdit}
        >
          Add description
        </button>
      )}

      {/* Safe-delete confirmation (Phase 2E). Rendered as a centred modal so
          it is never clipped by the lane's own overflow. */}
      {confirmDelete ? (
        <DeleteColumnDialog
          columnName={optimisticName}
          taskCount={total}
          destinations={otherColumns}
          deleteDest={deleteDest}
          onDest={setDeleteDest}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={performDelete}
        />
      ) : null}
    </header>
  );
}

/**
 * Centred confirmation for deleting a custom column. When the column holds
 * tasks the owner must choose a destination (a system lane or another
 * custom column) so nothing is silently lost; an empty column confirms
 * directly. Escape or the backdrop cancels; focus lands on the dialog.
 */
function DeleteColumnDialog({
  columnName,
  taskCount,
  destinations,
  deleteDest,
  onDest,
  onCancel,
  onConfirm,
}: {
  columnName: string;
  taskCount: number;
  destinations: LaneColumnRef[];
  deleteDest: string;
  onDest: (key: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4"
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={`Delete ${columnName}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-line-soft bg-white p-5 shadow-[0_28px_60px_-20px_rgba(20,21,26,0.4)] outline-none"
      >
        <h2 className="text-[15px] font-semibold text-ink">Delete “{columnName}”?</h2>
        {taskCount > 0 ? (
          <>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
              This column has {taskCount} task{taskCount === 1 ? "" : "s"}. Choose where
              they should go — they will be moved, never deleted.
            </p>
            <label className="mt-3 block">
              <span className="text-[11px] font-medium text-ink-quiet">Move tasks to</span>
              <select
                autoFocus
                value={deleteDest}
                onChange={(e) => onDest(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[12.5px] text-ink outline-none focus-visible:border-[var(--x-task-focus)]"
              >
                {destinations.map((d) => (
                  <option key={d.key} value={d.key}>{d.name}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
            This column is empty. Deleting it can’t be undone.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-line bg-white px-3 text-[12.5px] font-medium text-ink-soft transition-colors hover:border-ink-soft/30 hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={taskCount > 0 && !deleteDest}
            className="h-9 rounded-md bg-red-600 px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {taskCount > 0 ? "Move & delete" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AddColumnTile ────────────────────────────────────────────────────────────

/**
 * "+ Add column" affordance at the end of the lane row (Phase 2E).
 *
 * At rest: a quiet ghost tile. On click it opens a compact create form:
 * name (required, validated), optional description, a colour swatch, and a
 * position select. Enter in the name commits; Escape cancels. The new
 * column appears optimistically with a temp key, colour and description,
 * until the server assigns the stable key and the layout revalidates.
 */
function AddColumnTile({
  currentConfig,
  columnRefs,
  onOptimisticConfigChange,
}: {
  currentConfig: ColumnConfig | null;
  /** Existing columns in order, for the position select. */
  columnRefs: LaneColumnRef[];
  onOptimisticConfigChange: (c: ColumnConfig | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<ColumnColorKey>("neutral");
  // Position is the target index in the full order; default = end (append).
  const [position, setPosition] = useState<number>(columnRefs.length);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function startAdd() {
    setName("");
    setDescription("");
    setColor("neutral");
    setPosition(columnRefs.length);
    setError(null);
    setAdding(true);
  }

  function cancel() {
    setAdding(false);
    setError(null);
  }

  function commit() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Enter a column name."); return; }
    const desc = description.trim();
    const append = position >= columnRefs.length;
    setAdding(false);

    // Optimistic: add a placeholder column with a temp key at the chosen
    // position, carrying the chosen colour + description, until the server
    // round-trip completes and the layout revalidates.
    const tempKey = `col-temp-${Date.now()}`;
    const base = currentConfig ?? clientBaseConfig(columnRefs.map((c) => c.key));
    const nextOrder = [...base.order];
    if (append) nextOrder.push(tempKey);
    else nextOrder.splice(position, 0, tempKey);
    onOptimisticConfigChange({
      ...base,
      custom: [...base.custom, { key: tempKey, name: trimmed }],
      order: nextOrder,
      colors: color !== "neutral" ? { ...base.colors, [tempKey]: color } : base.colors,
      descriptions: desc ? { ...base.descriptions, [tempKey]: desc } : base.descriptions,
    });

    startTransition(async () => {
      try {
        await addColumnAction(trimmed, {
          description: desc || undefined,
          color: color !== "neutral" ? color : undefined,
          position: append ? undefined : position,
        });
        // Layout revalidates; optimisticConfig re-syncs from the server.
      } catch {
        onOptimisticConfigChange(currentConfig);
      }
    });
  }

  if (!adding) {
    return (
      <div
        className={roomStyles.addColumnTile}
        onClick={startAdd}
        role="button"
        tabIndex={0}
        aria-label="Add column"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startAdd(); } }}
      >
        <strong>Add column</strong>
        <span>A custom lane for this project.</span>
      </div>
    );
  }

  return (
    <form
      className={roomStyles.addColumnForm}
      onSubmit={(e) => { e.preventDefault(); commit(); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } }}
      aria-label="New column"
    >
      <label className={roomStyles.addColumnField}>
        <span>Name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => { setName(e.target.value); if (error) setError(null); }}
          maxLength={80}
          placeholder="e.g. Staging"
          aria-label="New column name"
          aria-invalid={error ? true : undefined}
        />
      </label>
      {error ? <p className={roomStyles.addColumnError}>{error}</p> : null}
      <label className={roomStyles.addColumnField}>
        <span>Description <em>(optional)</em></span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={160}
          placeholder="What belongs here"
          aria-label="New column description"
        />
      </label>
      <div className={roomStyles.addColumnField}>
        <span>Colour</span>
        <div className={roomStyles.laneColorRow} role="group" aria-label="New column colour">
          {COLUMN_PICKER_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              aria-label={COLUMN_COLORS[key].label}
              aria-pressed={color === key}
              title={COLUMN_COLORS[key].label}
              data-color={key}
              data-selected={color === key ? "" : undefined}
              onClick={() => setColor(key)}
              className={roomStyles.laneColorSwatch}
              style={
                COLUMN_COLORS[key].var
                  ? { background: COLUMN_COLORS[key].var as string, borderColor: COLUMN_COLORS[key].var as string }
                  : undefined
              }
            />
          ))}
        </div>
      </div>
      <label className={roomStyles.addColumnField}>
        <span>Position</span>
        <select
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label="New column position"
        >
          {columnRefs.map((c, i) => (
            <option key={c.key} value={i}>Before “{c.name}”</option>
          ))}
          <option value={columnRefs.length}>At the end</option>
        </select>
      </label>
      <div className={roomStyles.addColumnActions}>
        <button type="button" onClick={cancel} className={roomStyles.addColumnCancel}>Cancel</button>
        <button type="submit" className={roomStyles.addColumnCreate}>Add column</button>
      </div>
    </form>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({
  task,
  currentColumnKey,
  draggable,
  isDragging,
  dropBefore,
  isSelected,
  isFocused,
  boardColumns,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  currentColumnKey: string;
  draggable: boolean;
  isDragging: boolean;
  /** True when the live drop insertion line should sit above this card. */
  dropBefore: boolean;
  isSelected: boolean;
  isFocused: boolean;
  boardColumns: BoardColumn[];
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const tagTriggerRef = useRef<HTMLButtonElement | null>(null);
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { updateTask } = useTasksDispatch();
  // Mount-stable clock for the overdue receipt (Compiler-safe).
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!isFocused) return;
    cardRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [isFocused, reduce]);

  const menuColumns: MenuColumn[] = boardColumns.map((c) => ({
    key: c.key,
    name: c.name,
    color: c.color,
    dot: c.dot,
    isSystem: c.isSystem,
  }));

  function startTitleEdit() {
    setTitleDraft(task.title);
    setTitleEditing(true);
  }
  function commitTitle() {
    const next = titleDraft.trim();
    setTitleEditing(false);
    if (!next || next === task.title) return; // empty = cancel; preserve title
    updateTask(task.id, { title: next });
  }

  // Completion flourish, a one-shot beat the moment a card lands in "done",
  // whatever the trigger (keyboard `x`, drag, or the detail panel). Detecting
  // the transition here keeps it centralised and reduced-motion-safe; the
  // landing wordmark promises completion should *feel* like progress.
  const isDone = currentColumnKey === "done";
  const wasDoneRef = useRef(isDone);
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (isDone && !wasDoneRef.current) {
      // Once-ever first-completion beat, fires regardless of reduced motion
      // (the moment itself honours it); the per-card flourish stays motion-gated.
      maybeFireFirstCompletion();
      if (!reduce) {
        let stopTimer: ReturnType<typeof setTimeout> | undefined;
        const startTimer = setTimeout(() => {
          setCelebrate(true);
          stopTimer = setTimeout(() => setCelebrate(false), 720);
        }, 0);
        wasDoneRef.current = isDone;
        return () => {
          clearTimeout(startTimer);
          if (stopTimer) clearTimeout(stopTimer);
        };
      }
    }
    wasDoneRef.current = isDone;
  }, [isDone, reduce]);

  const isPending = isDragging;

  const nativeDragProps = draggable
    ? ({ draggable: true, onDragStart, onDragEnd } as unknown as Record<string, unknown>)
    : ({} as Record<string, unknown>);

  const outline = isFocused ? "2px solid var(--x-task-focus)" : "none";
  const focusScale = isFocused && !reduce ? 1.02 : 1;

  return (
    <motion.div
      ref={cardRef}
      layoutId={`appcard-${task.id}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, scale: focusScale }}
      exit={{ opacity: 0, y: 8 }}
      transition={{
        layout: { duration: reduce ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.18 },
        scale: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
      }}
      {...nativeDragProps}
      onClick={onClick}
      whileHover={!isPending ? { y: -1 } : undefined}
      style={{ outline, outlineOffset: -1 }}
      aria-busy={isPending ? "true" : undefined}
      data-task-id={task.id}
      data-task-title={task.title}
      data-task-focused={isFocused ? "true" : undefined}
      data-selected={isSelected || undefined}
      data-dragging={isDragging || undefined}
      data-drop-before={dropBefore || undefined}
      className={`group ${roomStyles.boardCard}`}
    >
      <AnimatePresence>
        {celebrate ? (
          <motion.span
            key="done-flourish"
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.span
              className="absolute rounded-full"
              style={{ width: 40, height: 40, border: "2px solid var(--brand)" }}
              initial={{ scale: 0.3, opacity: 0.5 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.svg
              width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="var(--brand)" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              initial={{ scale: 0.6 }}
              animate={{ scale: [0.6, 1.15, 1] }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.path
                d="M20 6 9 17l-5-5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.34, ease: "easeOut" }}
              />
            </motion.svg>
          </motion.span>
        ) : null}
      </AnimatePresence>
      {/* Lab card anatomy: lead (complete-box · title · menu) → purpose →
          labels → schedule row → signal/subtask footer. */}
      <div className={roomStyles.cardLead}>
        <TaskCompleteBox task={task} />
        {titleEditing ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
              if (e.key === "Escape") { e.preventDefault(); setTitleEditing(false); setTitleDraft(task.title); }
            }}
            maxLength={200}
            aria-label="Task title"
            className={roomStyles.cardTitleInput}
          />
        ) : (
          <span className={roomStyles.taskTitleButton}>{task.title}</span>
        )}
        <button
          ref={menuTriggerRef}
          type="button"
          aria-label={`More actions for ${task.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className={roomStyles.cardMenuButton}
        >
          <Icon name="more" size={16} />
        </button>
        {menuOpen ? (
          <CardMenu
            task={task}
            currentColumnKey={currentColumnKey}
            columns={menuColumns}
            triggerRef={menuTriggerRef}
            onClose={() => setMenuOpen(false)}
            onEditTitle={startTitleEdit}
          />
        ) : null}
      </div>
      {task.description ? (
        <p className={roomStyles.cardPurpose}>{task.description}</p>
      ) : null}
      <div className={roomStyles.cardLabels}>
        <LabelList limit={3} task={task} />
        <OverdueFlag now={now} task={task} />
        <button
          ref={tagTriggerRef}
          type="button"
          aria-label={`Edit tags for ${task.title}`}
          aria-haspopup="dialog"
          aria-expanded={tagEditorOpen}
          onClick={(e) => { e.stopPropagation(); setTagEditorOpen((v) => !v); }}
          className={roomStyles.cardTagButton}
        >
          <Icon name="add" size={12} />
          <span className={roomStyles.cardTagButtonText}>Tag</span>
        </button>
        {tagEditorOpen ? (
          <TagEditor
            task={task}
            triggerRef={tagTriggerRef}
            onClose={() => setTagEditorOpen(false)}
          />
        ) : null}
      </div>
      <div className={roomStyles.cardScheduleRow}>
        <ScheduleText now={now} task={task} />
        <RoomAvatarStack limit={3} task={task} />
      </div>
      <footer className={roomStyles.cardFooter}>
        <TaskSignals task={task} />
        {task.blockedBy && task.blockedBy.length > 0 ? (
          <span className={roomStyles.waitingReason}>
            Waiting on {task.blockedBy.length} task{task.blockedBy.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </footer>
    </motion.div>
  );
}

