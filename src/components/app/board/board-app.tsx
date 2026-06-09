"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { EASE_OUT_EXPO, MOTION_MODERATE } from "@/lib/motion";
import {
  LANES,
  LANE_ORDER,
  PRIORITY_LABEL,
  type LaneId,
  type Task,
} from "@/lib/data";
import { AvatarStack } from "@/components/showcase/avatar";
import {
  useTasksDispatch,
  useTasksState,
} from "@/lib/tasks/tasks-context";
import { tasksByColumn } from "@/lib/tasks/selectors";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { InlineComposer } from "@/components/app/add-task/inline-composer";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { BoardGhost } from "@/components/app/empty-state/ghost-views";
import { BlockerBadge } from "@/components/app/blockers/blocker-badge";
import { Popover } from "@/components/app/detail-panel/popover";
import { RecurrenceChip } from "@/components/app/cards/recurrence-chip";
import { setTaskMilestoneAction } from "@/server/actions/tasks";
import {
  renameColumnAction,
  addColumnAction,
  reorderColumnsAction,
  deleteColumnAction,
  type ColumnConfig,
} from "@/server/actions/board";
import { useColumnConfig } from "@/lib/domain-context";

// ─── ARCH NOTE: Custom columns and the canonical lane ─────────────────────────
//
// The effective board column for a task is:
//   board_column_key IS NOT NULL → task belongs to that custom column
//   board_column_key IS NULL     → task belongs to its canonical `lane` column
//
// Custom-column tasks group under "doing" in List/Timeline/Calendar/export/
// print/SSE — those views never read boardColumnKey; they use `lane` only.
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
  /** Style tokens — undefined for custom columns (uses a neutral palette). */
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
  // Custom column neutral palette (one shared neutral — all custom
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

  // Optimistic column config for add/reorder/delete — the server revalidates
  // the layout on success so we hydrate from server after a beat.
  const [optimisticConfig, setOptimisticConfig] = useState<ColumnConfig | null>(
    columnConfig,
  );
  // Sync when server config changes (layout revalidate).
  useEffect(() => {
    setOptimisticConfig(columnConfig);
  }, [columnConfig]);

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
  const tasksByColumnMap = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of boardColumns) {
      map[col.key] = tasksByColumn(state, col.key);
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

      // Single-key complete — the landing wordmark promises a one-keystroke
      // "done" gesture; deliver it on the focused card. `x` only — no
      // modifier — to keep parity with the composer's single-key `c` open.
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
        headline="This is where your master plan goes."
        body="Drop tasks into lanes. Drag them across as work moves. Watch momentum build."
      />
    );
  }

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <div className="thin-scroll flex h-full flex-1 gap-3 overflow-x-auto overflow-y-hidden px-8 pb-8 pt-5">
        {boardColumns.map((col, idx) => {
          const colTasks = tasksByColumnMap[col.key] ?? [];
          const isHover = hoverColumn === col.key;

          // Inline add for custom columns uses lane "doing" as the canonical
          // lane for newly created tasks — they'll visually appear in this
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
              className="flex w-[85vw] max-w-[298px] flex-shrink-0 flex-col rounded-xl p-2.5 transition-colors sm:w-[298px]"
              style={{
                background: isHover ? col.bg : `${col.bg}E6`,
                outline: isHover
                  ? `2px dashed ${col.dot}`
                  : "2px dashed transparent",
                outlineOffset: -4,
              }}
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
                dot={col.dot}
                ink={col.ink}
                count={colTasks.length}
                columnIndex={idx}
                totalColumns={boardColumns.length}
                allColumnKeys={boardColumns.map((c) => c.key)}
                onAddTask={() => setComposerColumn(col.key)}
                onOptimisticConfigChange={setOptimisticConfig}
                currentConfig={optimisticConfig}
              />

              <div className="flex flex-col gap-2 overflow-y-auto pr-0.5 thin-scroll">
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

                {composerColumn === col.key ? (
                  <InlineComposer
                    lane={composerLane}
                    onClose={() => setComposerColumn(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setComposerColumn(col.key)}
                    className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] text-ink-quiet transition-colors hover:bg-white/60 hover:text-ink-soft"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add task
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Add column tile — lives at the end of the lane row. */}
        <AddColumnTile
          currentConfig={optimisticConfig}
          onOptimisticConfigChange={setOptimisticConfig}
        />
      </div>
      <ShortcutHint />
    </div>
  );
}

// ─── LaneHeader ───────────────────────────────────────────────────────────────

/**
 * Inline-editable column header with overflow menu for reorder + delete.
 *
 * At rest: dot, name, count, quiet pencil on hover, "+" button.
 * Double-click OR pencil-click activates the inline editor.
 * Overflow "⋯" menu on custom columns: move left / move right / delete.
 * System lanes: overflow menu with move left / move right (no delete).
 */
function LaneHeader({
  columnKey,
  columnName,
  isSystem,
  dot,
  ink,
  count,
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
  dot: string;
  ink: string;
  count: number;
  columnIndex: number;
  totalColumns: number;
  allColumnKeys: string[];
  onAddTask: () => void;
  onOptimisticConfigChange: (c: ColumnConfig | null) => void;
  currentConfig: ColumnConfig | null;
}) {
  const [editing, setEditing] = useState(false);
  const [optimisticName, setOptimisticName] = useState(columnName);
  const [draft, setDraft] = useState(columnName);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setOptimisticName(columnName); }, [columnName]);

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

  return (
    <div className="group/colhdr flex items-center justify-between px-1.5 pb-2 pt-0.5">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className="block h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: dot }}
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
            className="w-full max-w-[140px] rounded border border-[var(--brand)] bg-transparent px-1 py-0 text-[12px] font-semibold outline-none ring-1 ring-[var(--brand)]"
            style={{ color: ink }}
          />
        ) : (
          <button
            type="button"
            aria-label={`Rename column ${optimisticName}`}
            title="Double-click to rename"
            onDoubleClick={startEdit}
            className="group/lh flex min-w-0 cursor-default items-center gap-1"
          >
            <span
              className="truncate text-[12px] font-semibold"
              style={{ color: ink }}
            >
              {optimisticName}
            </span>
            <svg
              aria-hidden="true"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              onClick={startEdit}
              className="flex-shrink-0 cursor-pointer text-ink-quiet opacity-0 transition-opacity group-hover/lh:opacity-100"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <span className="flex-shrink-0 text-[11.5px] text-ink-quiet">
          {count}
        </span>
      </div>

      <div className="flex flex-shrink-0 items-center gap-0.5">
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
          className="rounded p-1 text-ink-quiet hover:bg-white/60 hover:text-ink-soft"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
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
        // Layout revalidates — no manual cleanup needed; useEffect syncs
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
      className={[
        "flex w-[85vw] max-w-[298px] flex-shrink-0 items-center rounded-xl border border-dashed border-line-soft sm:w-[298px]",
        adding ? "p-2.5 transition-colors" : "cursor-pointer px-4 py-3 transition-colors hover:border-line hover:bg-bg-sunken/60",
      ].join(" ")}
      onClick={!adding ? startAdd : undefined}
      role={!adding ? "button" : undefined}
      tabIndex={!adding ? 0 : undefined}
      aria-label={!adding ? "Add column" : undefined}
      onKeyDown={!adding ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startAdd(); } } : undefined}
    >
      {adding ? (
        <div className="flex w-full items-center gap-1.5">
          <span className="block h-2 w-2 flex-shrink-0 rounded-full bg-line-soft" />
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
            className="w-full max-w-[180px] rounded border border-[var(--brand)] bg-transparent px-1 py-0 text-[12px] font-semibold text-ink outline-none ring-1 ring-[var(--brand)] placeholder:text-ink-quiet"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[12px] font-medium text-ink-quiet">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add column
        </div>
      )}
    </div>
  );
}

// ─── ShortcutHint ─────────────────────────────────────────────────────────────

function ShortcutHint() {
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-10">
      <div className="pointer-events-auto">
        <Popover
          align="end"
          width={232}
          aria-label="Keyboard shortcuts"
          trigger={({ onClick, "aria-expanded": expanded, ref }) => (
            <button
              ref={ref}
              type="button"
              onClick={onClick}
              aria-expanded={expanded}
              aria-label="Keyboard shortcuts"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line-soft bg-white/80 text-[11.5px] font-semibold text-ink-quiet shadow-[0_2px_8px_-2px_rgba(20,21,26,0.08)] backdrop-blur transition-colors hover:border-line hover:text-ink-soft"
            >
              /
            </button>
          )}
        >
          {() => (
            <div className="flex flex-col gap-1.5 px-2 py-2 text-[12px] leading-relaxed text-ink-soft">
              <div className="flex items-center gap-2">
                <Keys keys={["↑", "↓"]} />
                <span className="text-ink-quiet">within column</span>
              </div>
              <div className="flex items-center gap-2">
                <Keys keys={["←", "→"]} />
                <span className="text-ink-quiet">across columns</span>
              </div>
              <div className="flex items-center gap-2">
                <Keys keys={["⏎"]} />
                <span className="text-ink-quiet">open</span>
              </div>
              <div className="flex items-center gap-2">
                <Keys keys={["X"]} />
                <span className="text-ink-quiet">mark done</span>
              </div>
              <div className="flex items-center gap-2">
                <Keys keys={["⌘←", "⌘→"]} />
                <span className="text-ink-quiet">move</span>
              </div>
            </div>
          )}
        </Popover>
      </div>
    </div>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="inline-flex min-w-[20px] items-center justify-center rounded border border-line-soft bg-bg-sunken px-1 py-px text-[11px] font-medium text-ink-soft"
        >
          {k}
        </kbd>
      ))}
    </span>
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
  const prio = PRIORITY_LABEL[task.priority];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);

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

  const isPending = isDragging || !!momentum;

  const nativeDragProps = draggable
    ? ({ draggable: true, onDragStart, onDrag, onDragEnd } as unknown as Record<string, unknown>)
    : ({} as Record<string, unknown>);

  const outline = isFocused
    ? "2px solid var(--brand)"
    : isSelected
      ? "1.5px solid var(--brand)"
      : "none";
  const focusScale = isFocused && !reduce ? 1.04 : 1;

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
      className={[
        "group relative cursor-pointer rounded-[10px] border border-line-soft bg-white px-3 py-2.5 text-[13px] leading-snug shadow-[0_1px_2px_rgba(20,21,26,0.04)] transition-[outline,box-shadow] hover:shadow-[0_6px_18px_-6px_rgba(20,21,26,0.16)]",
        task.isMilestone ? "border-l-[2px] border-l-[var(--brand)]" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 flex-1">
          {task.isMilestone ? (
            <span className="mr-1 inline-block text-[10px] text-[var(--brand)]" aria-hidden>◇</span>
          ) : null}
          {task.title}
        </span>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {task.priority === "p0" ? (
            <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-red-600">P0</span>
          ) : null}
          <MilestoneQuickToggle task={task} />
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Move to column"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-ink-quiet opacity-100 transition-colors hover:bg-bg-sunken hover:text-ink-soft md:opacity-0 md:group-hover:opacity-100"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="19" cy="12" r="1.6" />
              </svg>
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
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-soft" title={prio.label}>
            <span className="block h-1.5 w-1.5 rounded-full" style={{ background: prio.color }} />
            {task.priority.toUpperCase()}
          </span>
          {task.due ? (
            <span className="text-[10.5px] text-ink-quiet">{task.due}</span>
          ) : null}
          <RecurrenceChip recurrence={task.recurrence} />
        </div>
        <AvatarStack users={task.assignees} size={18} />
      </div>
      {task.idleDays || task.comments || task.blockedBy?.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {task.idleDays ? (
            <span className="inline-flex items-center gap-1 rounded border border-amber-200/70 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              Idle {task.idleDays}d
            </span>
          ) : null}
          {task.blockedBy && task.blockedBy.length > 0 ? (
            <BlockerBadge blockedBy={task.blockedBy} />
          ) : null}
          {task.comments ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-quiet">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {task.comments}
            </span>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}

// ─── MilestoneQuickToggle ─────────────────────────────────────────────────────

function MilestoneQuickToggle({ task }: { task: Task }) {
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(!!task.isMilestone);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      await setTaskMilestoneAction(task.id, next);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove milestone" : "Mark as milestone"}
      title={optimistic ? "Remove milestone" : "Mark as milestone"}
      className={[
        "inline-flex h-5 w-5 items-center justify-center rounded transition-colors",
        "opacity-100 md:opacity-0 md:group-hover:opacity-100",
        optimistic ? "text-[var(--brand)]" : "text-ink-quiet hover:bg-bg-sunken hover:text-ink-soft",
      ].join(" ")}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill={optimistic ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 2 L22 12 L12 22 L2 12 Z" />
      </svg>
    </button>
  );
}
