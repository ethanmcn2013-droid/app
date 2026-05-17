"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { tasksByLane as selectTasksByLane } from "@/lib/tasks/selectors";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { InlineComposer } from "@/components/app/add-task/inline-composer";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { BoardGhost } from "@/components/app/empty-state/ghost-views";
import { BlockerBadge } from "@/components/app/blockers/blocker-badge";
import { Popover } from "@/components/app/detail-panel/popover";
import { RecurrenceChip } from "@/components/app/cards/recurrence-chip";

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

/** Release-velocity record for the most recently dropped card.
 *  `dx`/`dy` are pre-clamped pixel offsets representing where
 *  the pointer was carrying the card; the just-mounted card in
 *  the destination lane springs from this offset back to zero so
 *  the drop reads as physical follow-through rather than a snap. */
type DropMomentum = { taskId: string; dx: number; dy: number } | null;

/** Max follow-through distance in either axis. Held tight so the
 *  motion stays subtle — the card should look like it's settling,
 *  not like it's been thrown. */
const MOMENTUM_CLAMP = 100;
/** Velocity → distance scaling. Velocity is in px/ms (we sample
 *  pointer over ~80ms). The follow-through is a small fraction of
 *  raw velocity so even a fast flick stays within the clamp. */
const MOMENTUM_SCALE = 60;

export function BoardApp() {
  // Task DATA lives in the shared store; INTERACTION state stays
  // local — dragging/hover fire many times per second and would
  // re-render every other view if hoisted.
  const state = useTasksState();
  const { moveTask, toggleComplete } = useTasksDispatch();
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverLane, setHoverLane] = useState<LaneId | null>(null);
  // At-most-one inline composer open at a time.
  const [composerLane, setComposerLane] = useState<LaneId | null>(null);
  // Keyboard-driven focus. Independent of the detail-panel's
  // `openTaskId` selection — you can move focus around without
  // committing to "open this card."
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();

  // Pointer samples taken during a native drag, used to derive
  // release velocity at drop time. Refs (not state) — these mutate
  // many times per drag and never need to trigger renders.
  const dragSamplesRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const [dropMomentum, setDropMomentum] = useState<DropMomentum>(null);
  // Auto-clear momentum after the spring has had time to settle so
  // a re-mount of the same card later doesn't carry stale offset.
  useEffect(() => {
    if (!dropMomentum) return;
    const id = window.setTimeout(() => setDropMomentum(null), 600);
    return () => window.clearTimeout(id);
  }, [dropMomentum]);

  /** Derives px/ms velocity from the tail of the sample buffer
   *  (last ~80ms). Returns clamped follow-through offsets. */
  function consumeReleaseMomentum(): { dx: number; dy: number } {
    const samples = dragSamplesRef.current;
    dragSamplesRef.current = [];
    if (reduceMotion || samples.length < 2) return { dx: 0, dy: 0 };
    const last = samples[samples.length - 1];
    // Walk back to the first sample that's within 80ms of the end —
    // a too-long window dilutes a flick, too short is noisy.
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

  // Memoize lane → tasks lookup so the keyboard handler doesn't
  // walk the full task list four times per keystroke.
  const tasksByLaneMap = useMemo(() => {
    const map = {} as Record<LaneId, Task[]>;
    for (const lane of LANE_ORDER) {
      map[lane] = selectTasksByLane(state, lane);
    }
    return map;
  }, [state]);

  // The card that should appear focused right now. If user state
  // is missing or stale (its task got removed), fall back to the
  // first card in the first non-empty lane. Derived on render so
  // we don't need a setState-in-effect dance.
  const effectiveFocusedId: string | null = (() => {
    if (focusedId && state.tasks.some((t) => t.id === focusedId)) {
      return focusedId;
    }
    for (const lane of LANE_ORDER) {
      const first = tasksByLaneMap[lane][0];
      if (first) return first.id;
    }
    return null;
  })();

  // Keyboard navigation. Stable across renders via refs to the
  // mutating bits (focused id, current lane data) so we don't
  // re-bind document listeners on every state tick.
  const focusRef = useRef(effectiveFocusedId);
  const lanesRef = useRef(tasksByLaneMap);
  useEffect(() => {
    focusRef.current = effectiveFocusedId;
  }, [effectiveFocusedId]);
  useEffect(() => {
    lanesRef.current = tasksByLaneMap;
  }, [tasksByLaneMap]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Skip when typing in any editable surface — composer,
      // detail-panel inputs, contenteditable description editor.
      const target = e.target as Element | null;
      if (target && target.matches("input, textarea, [contenteditable]")) {
        return;
      }

      const id = focusRef.current;
      const lanes = lanesRef.current;

      if (e.key === "Escape") {
        if (id) {
          setFocusedId(null);
          e.preventDefault();
        }
        return;
      }

      // From here, all bindings act on the focused card.
      if (!id) return;

      // Locate current focus in the latest lane snapshot.
      let curLane: LaneId | null = null;
      let curIndex = -1;
      for (const lane of LANE_ORDER) {
        const i = lanes[lane].findIndex((t) => t.id === id);
        if (i !== -1) {
          curLane = lane;
          curIndex = i;
          break;
        }
      }
      if (!curLane) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && (e.key === "Enter")) {
        e.preventDefault();
        toggleComplete(id);
        return;
      }

      if (mod && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const laneIdx = LANE_ORDER.indexOf(curLane);
        const targetLane = LANE_ORDER[laneIdx + dir];
        if (!targetLane) return;
        e.preventDefault();
        moveTask(id, targetLane);
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openTask(id);
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const dir = e.key === "ArrowUp" ? -1 : 1;
        const laneTasks = lanes[curLane];
        const next = laneTasks[curIndex + dir];
        if (next) {
          e.preventDefault();
          setFocusedId(next.id);
        }
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const laneIdx = LANE_ORDER.indexOf(curLane);
        const targetLane = LANE_ORDER[laneIdx + dir];
        if (!targetLane) return;
        const targetTasks = lanes[targetLane];
        if (targetTasks.length === 0) return;
        // Snap to last card when target lane is shorter.
        const targetIdx = Math.min(curIndex, targetTasks.length - 1);
        e.preventDefault();
        setFocusedId(targetTasks[targetIdx].id);
        return;
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moveTask, openTask, toggleComplete]);

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
      {LANE_ORDER.map((laneId, idx) => {
        const lane = LANES[laneId];
        const laneTasks = tasksByLaneMap[laneId];
        const isHover = hoverLane === laneId;
        return (
          <motion.div
            key={laneId}
            role="group"
            aria-label={lane.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: MOTION_MODERATE,
              delay: idx * 0.05,
              ease: EASE_OUT_EXPO,
            }}
            className="flex w-[85vw] max-w-[298px] flex-shrink-0 flex-col rounded-xl p-2.5 transition-colors sm:w-[298px]"
            style={{
              background: isHover ? lane.bg : `${lane.bg}E6`,
              outline: isHover
                ? `2px dashed ${lane.dot}`
                : "2px dashed transparent",
              outlineOffset: -4,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setHoverLane(laneId);
            }}
            onDragLeave={() => setHoverLane(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/task-id");
              // Compute release momentum BEFORE state mutation so
              // the freshly mounted card in the new lane can read
              // it on its first paint.
              const momentum = consumeReleaseMomentum();
              if (id) {
                if (momentum.dx !== 0 || momentum.dy !== 0) {
                  setDropMomentum({ taskId: id, dx: momentum.dx, dy: momentum.dy });
                }
                moveTask(id, laneId);
              }
              setHoverLane(null);
              setDraggingId(null);
            }}
          >
            <div className="flex items-center justify-between px-1.5 pb-2 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ background: lane.dot }}
                />
                <span
                  className="text-[12px] font-semibold"
                  style={{ color: lane.ink }}
                >
                  {lane.name}
                </span>
                <span className="text-[11.5px] text-ink-quiet">
                  {laneTasks.length}
                </span>
              </div>
              <button
                aria-label={`Add task to ${lane.name}`}
                className="rounded p-1 text-ink-quiet hover:bg-white/60 hover:text-ink-soft"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto pr-0.5 thin-scroll">
              <AnimatePresence initial={false}>
                {laneTasks.map((task) => (
                  <Card
                    key={task.id}
                    task={task}
                    currentLane={laneId}
                    draggable={!isMobile}
                    isDragging={draggingId === task.id}
                    isSelected={openTaskId === task.id}
                    isFocused={effectiveFocusedId === task.id}
                    momentum={
                      dropMomentum && dropMomentum.taskId === task.id
                        ? { dx: dropMomentum.dx, dy: dropMomentum.dy }
                        : null
                    }
                    onClick={() => {
                      setFocusedId(task.id);
                      openTask(task.id);
                    }}
                    onMove={(target) => moveTask(task.id, target)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/task-id", task.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(task.id);
                      // Reset and seed the velocity sampler.
                      dragSamplesRef.current = [
                        { x: e.clientX, y: e.clientY, t: performance.now() },
                      ];
                    }}
                    onDrag={(e) => {
                      // Native HTML5 drag events fire with (0, 0)
                      // coords on the final dragend event — sample
                      // here while coords are still live.
                      if (e.clientX === 0 && e.clientY === 0) return;
                      const samples = dragSamplesRef.current;
                      samples.push({
                        x: e.clientX,
                        y: e.clientY,
                        t: performance.now(),
                      });
                      // Cap the buffer so a long drag doesn't grow unbounded.
                      if (samples.length > 32) samples.splice(0, samples.length - 32);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setHoverLane(null);
                    }}
                  />
                ))}
              </AnimatePresence>

              {composerLane === laneId ? (
                <InlineComposer
                  lane={laneId}
                  onClose={() => setComposerLane(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setComposerLane(laneId)}
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
      </div>
      <ShortcutHint />
    </div>
  );
}

/** Bottom-right "/" hint that opens a keyboard cheat-sheet popover.
 *  Sized small and dimmed — meant to be discoverable, not loud. */
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
                <span className="text-ink-quiet">within lane</span>
              </div>
              <div className="flex items-center gap-2">
                <Keys keys={["←", "→"]} />
                <span className="text-ink-quiet">across lanes</span>
              </div>
              <div className="flex items-center gap-2">
                <Keys keys={["⏎"]} />
                <span className="text-ink-quiet">open</span>
              </div>
              <div className="flex items-center gap-2">
                <Keys keys={["⌘⏎"]} />
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

function Card({
  task,
  currentLane,
  draggable,
  isDragging,
  isSelected,
  isFocused,
  momentum,
  onClick,
  onMove,
  onDragStart,
  onDrag,
  onDragEnd,
}: {
  task: Task;
  currentLane: LaneId;
  draggable: boolean;
  isDragging: boolean;
  isSelected: boolean;
  isFocused: boolean;
  /** Release-velocity follow-through for a just-dropped card. The
   *  card mounts in its new lane offset by (dx, dy) and springs to
   *  zero so the drop reads as inertia rather than a hard snap. */
  momentum: { dx: number; dy: number } | null;
  onClick: () => void;
  onMove: (target: LaneId) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDrag: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const prio = PRIORITY_LABEL[task.priority];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Scroll the focused card into view as keyboard nav moves
  // around. `nearest` keeps the lane from jumping when the
  // target is already visible.
  useEffect(() => {
    if (!isFocused) return;
    cardRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [isFocused, reduce]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // A card is "pending" while it is settling from a drop (momentum present)
  // or while it is mid-drag. aria-busy signals the transient state to AT.
  const isPending = isDragging || !!momentum;

  // motion.div redefines onDragStart/onDragEnd for its pan system; we want
  // native HTML5 drag for cross-column moves. Cast through `as` so the
  // native handlers reach the DOM untouched.
  const nativeDragProps = draggable
    ? ({
        draggable: true,
        onDragStart,
        onDrag,
        onDragEnd,
      } as unknown as Record<string, unknown>)
    : ({} as Record<string, unknown>);

  // Focused trumps selected for outline weight — keyboard nav is
  // the more transient/explicit signal. Scale bump is opt-out via
  // prefers-reduced-motion.
  const outline = isFocused
    ? "2px solid var(--brand)"
    : isSelected
      ? "1.5px solid var(--brand)"
      : "none";
  const focusScale = isFocused && !reduce ? 1.04 : 1;

  // When a card is dropped mid-flight, mount it at the velocity-
  // derived overshoot offset and spring back to zero. The spring
  // (stiffness 250, damping 28) settles in ~350ms with a barely-
  // perceptible kiss of overshoot — physical, not bouncy. Reduced-
  // motion users get a fast linear settle and skip the offset.
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
      initial={
        momentum
          ? { opacity: 1, x: initialX, y: initialY, scale: focusScale }
          : { opacity: 0, y: 8 }
      }
      animate={{
        opacity: isDragging ? 0.4 : 1,
        x: 0,
        y: 0,
        scale: focusScale,
      }}
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
      style={{
        outline,
        outlineOffset: -1,
      }}
      aria-busy={isPending ? "true" : undefined}
      data-task-id={task.id}
      data-task-title={task.title}
      data-task-focused={isFocused ? "true" : undefined}
      className="group relative cursor-pointer rounded-[10px] border border-line-soft bg-white px-3 py-2.5 text-[13px] leading-snug shadow-[0_1px_2px_rgba(20,21,26,0.04)] transition-[outline,box-shadow] hover:shadow-[0_6px_18px_-6px_rgba(20,21,26,0.16)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 flex-1">{task.title}</span>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          {task.priority === "p0" ? (
            <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-red-600">
              P0
            </span>
          ) : null}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Move to lane"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
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
                className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-line-soft bg-white p-1 shadow-[0_18px_40px_-18px_rgba(20,21,26,0.22)]"
              >
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-quiet">
                  Move to
                </div>
                {LANE_ORDER.filter((id) => id !== currentLane).map((id) => {
                  const l = LANES[id];
                  return (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        onMove(id);
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12.5px] text-ink-soft transition-colors hover:bg-bg-sunken hover:text-ink"
                    >
                      <span
                        className="block h-1.5 w-1.5 rounded-full"
                        style={{ background: l.dot }}
                      />
                      {l.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded bg-bg-sunken px-1.5 py-0.5 text-[10.5px] font-medium text-ink-soft"
            title={prio.label}
          >
            <span
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: prio.color }}
            />
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
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
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
