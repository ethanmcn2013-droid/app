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
  RoomAvatarStack,
  ScheduleText,
  TaskCompleteBox,
  TaskSignals,
} from "@/components/app/room/room-task-ui";
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
  type ColumnConfig,
} from "@/server/actions/board";
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

/** Release-velocity record for the most recently dropped card. */
type DropMomentum = { taskId: string; dx: number; dy: number } | null;

const MOMENTUM_CLAMP = 100;
const MOMENTUM_SCALE = 60;

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
};

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
    }));
  }

  const order = config.order.length > 0 ? config.order : [...LANE_ORDER];
  const customByKey = Object.fromEntries(config.custom.map((c) => [c.key, c]));

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
      });
    } else if (customByKey[key]) {
      cols.push({
        key,
        name: customByKey[key].name,
        isSystem: false,
        dot: CUSTOM_DOT,
        bg: CUSTOM_BG,
        ink: CUSTOM_INK,
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
  const { moveTask, moveTaskToColumn, toggleComplete } = useTasksDispatch();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverColumn, setHoverColumn] = useState<string | null>(null);
  const [composerColumn, setComposerColumn] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();

  // Pointer samples for release-velocity momentum.
  const dragSamplesRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const [dropMomentum, setDropMomentum] = useState<DropMomentum>(null);
  useEffect(() => {
    if (!dropMomentum) return;
    const id = window.setTimeout(() => setDropMomentum(null), 600);
    return () => window.clearTimeout(id);
  }, [dropMomentum]);

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

  /** Derive px/ms velocity from the tail of the sample buffer. */
  function consumeReleaseMomentum(): { dx: number; dy: number } {
    const samples = dragSamplesRef.current;
    dragSamplesRef.current = [];
    if (reduceMotion || samples.length < 2) return { dx: 0, dy: 0 };
    const last = samples[samples.length - 1];
    let first = samples[0];
    for (let i = samples.length - 2; i >= 0; i--) {
      if (last.t - samples[i].t > 80) {
        first = samples[i + 1] ?? samples[i];
        break;
      }
      first = samples[i];
    }
    const dt = last.t - first.t;
    if (dt <= 0) return { dx: 0, dy: 0 };
    const vx = (last.x - first.x) / dt;
    const vy = (last.y - first.y) / dt;
    const clamp = (v: number) =>
      Math.max(-MOMENTUM_CLAMP, Math.min(MOMENTUM_CLAMP, v * MOMENTUM_SCALE));
    return { dx: clamp(vx), dy: clamp(vy) };
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
    <section aria-label="Workspace Board" className={roomStyles.boardView}>
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
          const isHover = hoverColumn === col.key;

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
              onDragOver={(e) => { e.preventDefault(); setHoverColumn(col.key); }}
              onDragLeave={() => setHoverColumn(null)}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/task-id");
                const momentum = consumeReleaseMomentum();
                if (taskId) {
                  if (momentum.dx !== 0 || momentum.dy !== 0) {
                    setDropMomentum({ taskId, dx: momentum.dx, dy: momentum.dy });
                  }
                  moveTaskToColumn(taskId, col.key);
                }
                setHoverColumn(null);
                setDraggingId(null);
              }}
            >
              <LaneHeader
                columnKey={col.key}
                columnName={col.name}
                isSystem={col.isSystem}
                count={colTasks.length}
                total={totalsByColumn[col.key] ?? colTasks.length}
                columnIndex={idx}
                totalColumns={boardColumns.length}
                allColumnKeys={boardColumns.map((c) => c.key)}
                onAddTask={() => setComposerColumn(col.key)}
                onOptimisticConfigChange={setOptimisticConfig}
                currentConfig={optimisticConfig}
              />

              <div className={roomStyles.boardTaskList}>
                <AnimatePresence initial={false}>
                  {colTasks.map((task) => (
                    <Card
                      key={task.id}
                      task={task}
                      currentColumnKey={col.key}
                      draggable={!isMobile}
                      isDragging={draggingId === task.id}
                      isSelected={openTaskId === task.id}
                      isFocused={effectiveFocusedId === task.id}
                      boardColumns={boardColumns}
                      momentum={
                        dropMomentum && dropMomentum.taskId === task.id
                          ? { dx: dropMomentum.dx, dy: dropMomentum.dy }
                          : null
                      }
                      onClick={() => { setFocusedId(task.id); openTask(task.id); }}
                      onMoveToColumn={(targetKey) => moveTaskToColumn(task.id, targetKey)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/task-id", task.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(task.id);
                        dragSamplesRef.current = [
                          { x: e.clientX, y: e.clientY, t: performance.now() },
                        ];
                      }}
                      onDrag={(e) => {
                        if (e.clientX === 0 && e.clientY === 0) return;
                        const samples = dragSamplesRef.current;
                        samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
                        if (samples.length > 32) samples.splice(0, samples.length - 32);
                      }}
                      onDragEnd={() => { setDraggingId(null); setHoverColumn(null); }}
                    />
                  ))}
                </AnimatePresence>

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
/** Editorial Project Room (Option B): each system lane explains itself in
 *  one line, so the board reads as a narrated room rather than four
 *  unlabeled buckets. Custom columns are user-named and carry no note. */
const LANE_NOTES: Record<string, string> = {
  todo: "Agreed and ready to start.",
  doing: "In motion right now.",
  review: "Held by a reply, a delivery, or a decision.",
  done: "Finished work stays visible.",
};

function LaneHeader({
  columnKey,
  columnName,
  isSystem,
  count,
  total,
  columnIndex,
  totalColumns,
  allColumnKeys,
  onAddTask,
  onOptimisticConfigChange,
  currentConfig,
}: {
  columnKey: string;
  columnName: string;
  isSystem: boolean;
  count: number;
  total: number;
  columnIndex: number;
  totalColumns: number;
  allColumnKeys: string[];
  onAddTask: () => void;
  onOptimisticConfigChange: (c: ColumnConfig | null) => void;
  currentConfig: ColumnConfig | null;
}) {
  const [editing, setEditing] = useState(false);
  const [optimisticName, setOptimisticName] = useState(columnName);
  const [previousColumnName, setPreviousColumnName] = useState(columnName);
  const [draft, setDraft] = useState(columnName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);

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

  function moveLeft() {
    setOverflowOpen(false);
    if (columnIndex === 0) return;
    const newOrder = [...allColumnKeys];
    const tmp = newOrder[columnIndex - 1];
    newOrder[columnIndex - 1] = newOrder[columnIndex];
    newOrder[columnIndex] = tmp;
    // Optimistic update.
    if (currentConfig) {
      onOptimisticConfigChange({ ...currentConfig, order: newOrder });
    }
    startTransition(async () => {
      try {
        await reorderColumnsAction(newOrder);
      } catch {
        // Revert optimistic on error.
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

  function deleteColumn() {
    setOverflowOpen(false);
    if (isSystem) return;
    // Optimistic: remove the column from config immediately.
    if (currentConfig) {
      const nextConfig: ColumnConfig = {
        ...currentConfig,
        custom: currentConfig.custom.filter((c) => c.key !== columnKey),
        order: currentConfig.order.filter((k) => k !== columnKey),
      };
      onOptimisticConfigChange(nextConfig);
    }
    startTransition(async () => {
      try {
        await deleteColumnAction(columnKey);
      } catch {
        // Revert on error.
        onOptimisticConfigChange(currentConfig);
      }
    });
  }

  const canMoveLeft = columnIndex > 0;
  const canMoveRight = columnIndex < totalColumns - 1;
  const showOverflow = canMoveLeft || canMoveRight || !isSystem;
  const laneNote = isSystem ? LANE_NOTES[columnKey] : undefined;

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
          <h2
            onDoubleClick={startEdit}
            title="Double-click to rename"
          >
            {optimisticName}
          </h2>
        )}
        <span className={roomStyles.laneCount}>
          {count === total ? total : `${count}/${total}`}
        </span>
      </div>

      <div className={roomStyles.laneHeaderActions}>
        {/* Overflow menu: move left/right + delete (custom) */}
        {showOverflow ? (
          <div ref={overflowRef} className="relative">
            <button
              type="button"
              aria-label="Column options"
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              onClick={(e) => { e.stopPropagation(); setOverflowOpen((v) => !v); }}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-ink-quiet opacity-0 transition-colors hover:bg-white/70 hover:text-ink-soft group-hover/colhdr:opacity-100"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>
            {overflowOpen ? (
              <div
                role="menu"
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line-soft bg-white p-1 shadow-[0_18px_40px_-18px_rgba(20,21,26,0.22)]"
              >
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
                {!isSystem ? (
                  <>
                    <div className="my-1 border-t border-line-soft" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={deleteColumn}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      Delete column
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Add task button */}
        <button
          type="button"
          aria-label={`Add task to ${optimisticName}`}
          onClick={(e) => { e.stopPropagation(); onAddTask(); }}
          className="rounded p-1 text-[var(--x-task-text-muted)] hover:bg-[var(--x-task-hover)] hover:text-[var(--x-task-text)]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      {laneNote ? <p>{laneNote}</p> : null}
    </header>
  );
}

// ─── AddColumnTile ────────────────────────────────────────────────────────────

/**
 * Quiet "+ Add column" affordance at the end of the lane row.
 *
 * At rest: a thin ghost tile with a centered "+" and a "Add column" label —
 * same height as a collapsed lane, same corner radius. Matches DESIGN.md
 * restraint: not a loud button, not a floating action button.
 *
 * On click: the tile becomes an inline input (same 12px/semibold scale as
 * LaneHeader). Enter/blur commits; Escape cancels. Optimistic: the column
 * appears immediately with a temp name; the server action provides the stable key.
 */
function AddColumnTile({
  currentConfig,
  onOptimisticConfigChange,
}: {
  currentConfig: ColumnConfig | null;
  onOptimisticConfigChange: (c: ColumnConfig | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  function startAdd() {
    setDraft("");
    setAdding(true);
  }

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) { cancel(); return; }
    setAdding(false);

    // Optimistic: add a placeholder column with a temp key until the
    // server round-trip completes and the layout revalidates.
    const tempKey = `col-temp-${Date.now()}`;
    const base = currentConfig ?? { system: {}, custom: [], order: [...LANE_ORDER] };
    onOptimisticConfigChange({
      ...base,
      custom: [...base.custom, { key: tempKey, name: trimmed }],
      order: [...base.order, tempKey],
    });

    startTransition(async () => {
      try {
        await addColumnAction(trimmed);
        // Layout revalidates, no manual cleanup needed; useEffect syncs
        // optimisticConfig from the server-resolved columnConfig.
      } catch {
        // Revert the temp column.
        onOptimisticConfigChange(currentConfig);
      }
    });
  }

  function cancel() {
    setAdding(false);
    setDraft("");
  }

  return (
    <div
      className={roomStyles.addColumnTile}
      onClick={!adding ? startAdd : undefined}
      role={!adding ? "button" : undefined}
      tabIndex={!adding ? 0 : undefined}
      aria-label={!adding ? "Add column" : undefined}
      onKeyDown={!adding ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startAdd(); } } : undefined}
    >
      {adding ? (
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
          placeholder="Column name"
          aria-label="New column name"
          className="w-full max-w-[180px] rounded border border-[var(--x-task-focus)] bg-transparent px-1 py-0 text-[12px] font-semibold text-ink outline-none"
        />
      ) : (
        <>
          <strong>Add column</strong>
          <span>A custom lane for this workspace.</span>
        </>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({
  task,
  currentColumnKey,
  draggable,
  isDragging,
  isSelected,
  isFocused,
  momentum,
  boardColumns,
  onClick,
  onMoveToColumn,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  task: Task;
  currentColumnKey: string;
  draggable: boolean;
  isDragging: boolean;
  isSelected: boolean;
  isFocused: boolean;
  momentum: { dx: number; dy: number } | null;
  boardColumns: BoardColumn[];
  onClick: () => void;
  onMoveToColumn: (targetKey: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDrag: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Mount-stable clock for the overdue receipt (Compiler-safe).
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!isFocused) return;
    cardRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [isFocused, reduce]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMenuOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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

  const isPending = isDragging || !!momentum;

  const nativeDragProps = draggable
    ? ({ draggable: true, onDragStart, onDrag, onDragEnd } as unknown as Record<string, unknown>)
    : ({} as Record<string, unknown>);

  const outline = isFocused ? "2px solid var(--x-task-focus)" : "none";
  const focusScale = isFocused && !reduce ? 1.02 : 1;

  const initialX = momentum && !reduce ? momentum.dx : 0;
  const initialY = momentum && !reduce ? momentum.dy : 0;
  const settleTransition = reduce
    ? { duration: 0.12, ease: "linear" as const }
    : { type: "spring" as const, stiffness: 250, damping: 28, mass: 0.9 };

  return (
    <motion.div
      ref={cardRef}
      layoutId={`appcard-${task.id}`}
      layout
      initial={momentum ? { opacity: 1, x: initialX, y: initialY, scale: focusScale } : { opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.4 : 1, x: 0, y: 0, scale: focusScale }}
      exit={{ opacity: 0, y: 8 }}
      transition={{
        layout: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.2 },
        scale: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
        x: settleTransition,
        y: settleTransition,
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
      {/* Lab card anatomy (board-view.tsx): lead (complete-box · title ·
          menu) → purpose → labels → schedule row → signal footer. */}
      <div className={roomStyles.cardLead}>
        <TaskCompleteBox task={task} />
        <span className={roomStyles.taskTitleButton}>{task.title}</span>
        <div ref={menuRef} className="relative">
          <button
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
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line-soft bg-white p-1 shadow-[0_18px_40px_-18px_rgba(20,21,26,0.22)]"
            >
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-quiet">
                Move to
              </div>
              {boardColumns
                .filter((c) => c.key !== currentColumnKey)
                .map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onMoveToColumn(col.key);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink"
                  >
                    <span className="block h-1.5 w-1.5 rounded-full" style={{ background: col.dot }} />
                    {col.name}
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      </div>
      {task.description ? (
        <p className={roomStyles.cardPurpose}>{task.description}</p>
      ) : null}
      <div className={roomStyles.cardLabels}>
        <LabelList limit={2} task={task} />
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

