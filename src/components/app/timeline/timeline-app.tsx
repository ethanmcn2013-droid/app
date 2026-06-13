"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion } from "motion/react";
import { LANES, type Task } from "@/lib/data";
import { Avatar } from "@/components/showcase/avatar";
import {
  useTasksDispatch,
  useTasksState,
} from "@/lib/tasks/tasks-context";
import { tasksSortedByStartDay } from "@/lib/tasks/selectors";
import { useTaskPanel } from "@/lib/tasks/use-task-panel";
import { EmptyStateOverlay } from "@/components/app/empty-state/empty-state-overlay";
import { TimelineGhost } from "@/components/app/empty-state/ghost-views";
import { usePersonalization } from "@/lib/domain-context";
import { setTaskTimelineAction } from "@/server/actions/timeline-drag";

const DAYS = 14;
const DAY_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

/** True when viewport is <768px. SSR-safe: starts false, flips on mount.
 *  Drag is disabled on mobile to match the board's policy from cycle 14. */
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

/** Live drag state for whichever bar is being dragged. `mode` discriminates
 *  whole-bar moves from right-edge resizes — both share the same gesture
 *  scaffolding but write different fields on commit. */
type DragState =
  | {
      mode: "move";
      taskId: string;
      // Original bar geometry (in days) at gesture start.
      startDay: number;
      durationDays: number;
      // Pointer x at gesture start, in container-relative pixels.
      pointerStartX: number;
      // Cached track width, sampled once at gesture start so a
      // mid-drag scrollbar appearance can't jitter the math.
      trackWidth: number;
      // Live-snapped values for ghost overlay rendering.
      ghostStartDay: number;
      ghostDurationDays: number;
    }
  | {
      mode: "resize";
      taskId: string;
      startDay: number;
      durationDays: number;
      pointerStartX: number;
      trackWidth: number;
      ghostStartDay: number;
      ghostDurationDays: number;
    };

export function TimelineApp() {
  const personalization = usePersonalization();
  const state = useTasksState();
  const dispatch = useTasksDispatch();
  const sorted = tasksSortedByStartDay(state);
  const { taskId: openTaskId, openTask } = useTaskPanel();
  const isMobile = useIsMobile();

  // Track ref points at the per-row track (the right column of the
  // grid). Captured at gesture start so each row uses its own width.
  const [drag, setDrag] = useState<DragState | null>(null);
  // Imperative ref so the global pointermove listener doesn't have to
  // be re-registered on every state change.
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  // Global pointermove / pointerup. Registered once when a drag is
  // active so the gesture survives the cursor leaving the bar — which
  // happens immediately on a fast horizontal flick.
  useEffect(() => {
    if (!drag) return;

    function clamp(v: number, lo: number, hi: number) {
      return Math.max(lo, Math.min(hi, v));
    }

    function handleMove(e: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;
      const dx = e.clientX - current.pointerStartX;
      const dayWidth = current.trackWidth / DAYS;
      if (dayWidth <= 0) return;
      const dayDelta = Math.round(dx / dayWidth);

      if (current.mode === "move") {
        // Whole-bar drag: shift startDay; clamp so the bar's right
        // edge can't fall off the grid (start + dur stays <= 30).
        const max = 30 - current.durationDays;
        const next = clamp(current.startDay + dayDelta, 0, max);
        if (next !== current.ghostStartDay) {
          setDrag({ ...current, ghostStartDay: next });
        }
      } else {
        // Right-edge resize: grow/shrink durationDays. Pointer x in
        // bar-local space is (pointerStartX - barLeft) + dx; we
        // approximate with the day-delta math since the bar's left
        // hasn't moved.
        const next = clamp(current.durationDays + dayDelta, 1, 30);
        if (next !== current.ghostDurationDays) {
          setDrag({ ...current, ghostDurationDays: next });
        }
      }
    }

    function handleUp() {
      const current = dragRef.current;
      if (!current) return;
      // Only fire the action if something actually changed —
      // a click that didn't move the pointer falls through to the
      // bar's onClick and opens the panel.
      const moved =
        current.mode === "move"
          ? current.ghostStartDay !== current.startDay
          : current.ghostDurationDays !== current.durationDays;

      if (moved) {
        if (current.mode === "move") {
          dispatch.updateTask(current.taskId, {
            startDay: current.ghostStartDay,
          });
          startTransition(() => {
            void setTaskTimelineAction(current.taskId, {
              startDay: current.ghostStartDay,
            });
          });
        } else {
          dispatch.updateTask(current.taskId, {
            durationDays: current.ghostDurationDays,
          });
          startTransition(() => {
            void setTaskTimelineAction(current.taskId, {
              durationDays: current.ghostDurationDays,
            });
          });
        }
      }
      setDrag(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // `dispatch` is stable from the provider's useMemo with empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null]);

  if (state.tasks.length === 0) {
    return (
      <EmptyStateOverlay
        ghost={<TimelineGhost />}
        headline={personalization.headline}
        body={personalization.body}
        primaryLabel={personalization.firstTaskExample}
      />
    );
  }

  function beginDrag(
    e: ReactPointerEvent<HTMLElement>,
    task: Task,
    mode: "move" | "resize",
  ) {
    if (isMobile) return;
    // Only react to the primary button — right-clicks and middle-clicks
    // shouldn't start a drag.
    if (e.button !== 0) return;
    const trackEl = (e.currentTarget.closest("[data-timeline-track]") ??
      null) as HTMLDivElement | null;
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    e.preventDefault();
    e.stopPropagation();
    const startDay = task.startDay ?? 0;
    const durationDays = task.durationDays ?? 1;
    setDrag({
      mode,
      taskId: task.id,
      startDay,
      durationDays,
      pointerStartX: e.clientX,
      trackWidth: rect.width,
      ghostStartDay: startDay,
      ghostDurationDays: durationDays,
    });
  }

  return (
    <div className="thin-scroll flex-1 overflow-auto px-8 py-5">
      <div className="overflow-hidden rounded-xl border border-line-soft bg-white">
        {/* Header */}
        <div className="grid grid-cols-[240px_1fr] border-b border-line-soft bg-bg-sunken/40">
          <div className="border-r border-line-soft px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-quiet">
            Task
          </div>
          <div
            className="grid text-center text-[10.5px] font-medium"
            style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}
          >
            {DAY_LABELS.map((d, i) => {
              const isWeekend = d === "Sat" || d === "Sun";
              return (
                <div
                  key={i}
                  className={
                    "border-r border-line-soft/60 py-2 last:border-r-0 " +
                    (isWeekend
                      ? "bg-bg-sunken/70 text-ink-quiet"
                      : "text-ink-soft")
                  }
                >
                  {d}
                  <span className="ml-1 text-ink-faint">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative">
          {sorted.map((task, idx) => {
            const lane = LANES[task.lane];
            const isDragging = drag?.taskId === task.id;
            // While dragging, the live bar follows the ghost-snapped
            // values so the user sees the snap rather than free-floating
            // pixels. CSS transitions on the bar give the release-snap
            // its native feel without a spring.
            const start = isDragging
              ? drag.ghostStartDay
              : task.startDay ?? 0;
            const dur = isDragging
              ? drag.ghostDurationDays
              : task.durationDays ?? 1;
            const left = (start / DAYS) * 100;
            const width = (dur / DAYS) * 100;
            // Ghost destination — rendered behind the bar so the user
            // sees where the bar will land. Always matches the
            // currently-snapped values; visually distinct only while
            // dragging (when the bar itself moves with the ghost, the
            // ghost outline still confirms the snap target).
            const ghostLeft = isDragging
              ? (drag.ghostStartDay / DAYS) * 100
              : 0;
            const ghostWidth = isDragging
              ? (drag.ghostDurationDays / DAYS) * 100
              : 0;
            return (
              <div
                key={task.id}
                className="grid grid-cols-[240px_1fr] items-center border-b border-line-soft last:border-b-0"
              >
                <div className="flex items-center gap-2 truncate border-r border-line-soft px-4 py-2.5 text-[12.5px]">
                  <span
                    className="block h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: lane.dot }}
                  />
                  <span className="truncate">{task.title}</span>
                </div>
                <div className="relative h-12" data-timeline-track>
                  <div
                    className="pointer-events-none absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}
                  >
                    {Array.from({ length: DAYS }).map((_, i) => {
                      const d = DAY_LABELS[i];
                      const isWeekend = d === "Sat" || d === "Sun";
                      return (
                        <div
                          key={i}
                          className={
                            "border-r border-line-soft/60 last:border-r-0 " +
                            (isWeekend ? "bg-bg-sunken/40" : "")
                          }
                        />
                      );
                    })}
                  </div>

                  {/* Ghost destination overlay — only visible while
                      this row is being dragged. Sits behind the bar
                      so the bar reads as the foreground element. */}
                  {isDragging ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-md border border-dashed"
                      style={{
                        left: `calc(${ghostLeft}% + 4px)`,
                        width: `calc(${ghostWidth}% - 8px)`,
                        height: "calc(100% - 12px)",
                        borderColor: lane.dot,
                        background: `${lane.dot}15`,
                      }}
                    />
                  ) : null}

                  <motion.div
                    initial={
                      isDragging
                        ? false
                        : { opacity: 0, x: -6 }
                    }
                    animate={
                      isDragging ? undefined : { opacity: 1, x: 0 }
                    }
                    transition={{
                      duration: 0.35,
                      delay: Math.min(idx * 0.025, 0.2),
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    onPointerDown={(e) => beginDrag(e, task, "move")}
                    onClick={() => {
                      // Suppress the click that fires after a drag.
                      // pointerup nulls `drag` synchronously, but the
                      // browser still dispatches click; gating on a
                      // post-drag flag isn't strictly necessary because
                      // the action only runs when ghost != start.
                      if (drag) return;
                      openTask(task.id);
                    }}
                    className={
                      "absolute top-1/2 flex -translate-y-1/2 select-none items-center gap-1.5 overflow-hidden rounded-md border px-2 py-1.5 text-[11px] font-medium shadow-sm hover:shadow-md " +
                      (isMobile
                        ? "cursor-pointer"
                        : isDragging
                          ? "cursor-grabbing"
                          : "cursor-grab")
                    }
                    style={{
                      left: `calc(${left}% + 4px)`,
                      width: `calc(${width}% - 8px)`,
                      background: task.lane === "done" ? "#fff" : lane.bg,
                      borderColor:
                        openTaskId === task.id ? "var(--brand)" : lane.dot,
                      borderWidth: openTaskId === task.id ? 1.5 : 1,
                      color: lane.ink,
                      outline:
                        openTaskId === task.id
                          ? "1.5px solid var(--brand)"
                          : "none",
                      outlineOffset: 1,
                      // CSS transition handles the snap-on-release: while
                      // dragging we want immediate feedback, on release
                      // we want a soft settle into the snapped cell.
                      transition: isDragging
                        ? "none"
                        : "left 180ms cubic-bezier(0.16, 1, 0.3, 1), width 180ms cubic-bezier(0.16, 1, 0.3, 1)",
                      zIndex: isDragging ? 10 : 1,
                      boxShadow: isDragging
                        ? "0 6px 18px -4px rgba(0,0,0,0.18)"
                        : undefined,
                    }}
                  >
                    <Avatar user={task.assignees[0]} size={14} />
                    <span className="truncate">{task.title}</span>
                    {task.priority === "p0" ? (
                      <span className="ml-auto rounded bg-red-100 px-1 text-[9px] font-bold uppercase tracking-wider text-red-600">
                        P0
                      </span>
                    ) : null}
                    {/* Right-edge resize handle. Invisible 8px strip
                        so the cursor flips to ew-resize without
                        cluttering the bar. Mobile: not rendered. */}
                    {!isMobile ? (
                      <span
                        role="presentation"
                        onPointerDown={(e) => beginDrag(e, task, "resize")}
                        className="absolute inset-y-0 right-0 w-2 cursor-ew-resize"
                        style={{ touchAction: "none" }}
                      />
                    ) : null}
                  </motion.div>
                </div>
              </div>
            );
          })}

          {/* Today marker */}
          <div
            className="pointer-events-none absolute top-0 z-20 h-full w-px"
            style={{
              left: `calc(240px + ${(2 / DAYS) * 100}%)`,
              background:
                "linear-gradient(to bottom, transparent, var(--brand) 8%, var(--brand) 92%, transparent)",
              boxShadow: "0 0 8px var(--brand-glow)",
            }}
          >
            <div
              className="absolute left-1/2 top-1 -translate-x-1/2 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white"
              style={{ background: "var(--brand)" }}
            >
              Today
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
